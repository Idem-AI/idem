import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { Subscription, timer } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiService } from '../../../core/api.service';
import { CaptionStyle, Montage, MontageElement, MontageElementType } from '../../../core/models';
import { StudioState } from '../../../core/studio.state';
import { TourService } from '../../../core/tour.service';
import { Illustration } from '../../../shared/components/illustration';

type Tab = 'screen' | 'captions' | 'ends' | 'sound';
const RATIOS: Record<string, string> = { story: '9 / 16', square: '1 / 1', portrait: '4 / 5', landscape: '16 / 9' };
const FORMATS = ['story', 'square', 'portrait', 'landscape'];
const CAPTIONS: CaptionStyle[] = ['pop', 'karaoke', 'minimal', 'none'];
/** Un pictogramme par sorte d'élément (le mot à côté porte le sens). */
const TYPE_ICON: Record<MontageElementType, string> = {
  keyword: 'pi-bolt',
  stat: 'pi-chart-bar',
  icon: 'pi-star',
  list: 'pi-list',
  callout: 'pi-comment',
  broll: 'pi-image',
  lowerThird: 'pi-id-card',
  cta: 'pi-megaphone',
  zoom: 'pi-search-plus',
};

/** Un instant de l'original dans la vidéo montée (même calcul que le moteur). */
function mapTime(ranges: Montage['cuts']['ranges'], t: number): number | null {
  for (const r of ranges) if (t >= r.start - 1e-6 && t <= r.end + 1e-6) return r.at + Math.min(r.end, Math.max(r.start, t)) - r.start;
  return null;
}

/**
 * L'ÉDITEUR DU MONTAGE — une page à part, pour qui préfère cliquer plutôt qu'écrire.
 *
 *   à gauche   la vidéo telle qu'elle sortira, et une frise : l'intro, chaque élément à son
 *              moment, le carton de fin ; un clic y amène ;
 *   à droite   quatre onglets simples : ce qui apparaît à l'écran, les sous-titres (et ce qui
 *              est dit), le début et la fin, le son et le format.
 *
 * Tout s'enregistre seul (gratuit) ; l'aperçu se recharge et reste au même instant.
 */
@Component({
  selector: 'iv-montage-editor',
  imports: [RouterLink, TranslateModule, IdemLoaderComponent, Illustration],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './montage-editor.html',
})
export class MontageEditor {
  private readonly api = inject(ApiService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly state = inject(StudioState);
  private readonly tours = inject(TourService);
  protected readonly accountUrl = `${environment.services.dashboard.url}/account`;

  readonly montageId = input.required<string>();
  private readonly frame = viewChild<ElementRef<HTMLIFrameElement>>('frame');

  protected readonly formats = FORMATS;
  protected readonly captionStyles = CAPTIONS;
  protected readonly typeIcon = TYPE_ICON;
  protected readonly tabs: Tab[] = ['screen', 'captions', 'ends', 'sound'];

  protected readonly montage = signal<Montage | null>(null);
  protected readonly loadFailed = signal(false);
  protected readonly html = signal<SafeHtml | null>(null);
  protected readonly tab = signal<Tab>('screen');
  protected readonly time = signal(0);
  protected readonly duration = signal(0);
  protected readonly saving = signal(false);
  protected readonly saved = signal(false);
  protected readonly saveFailed = signal(false);
  protected readonly selected = signal<string | null>(null);
  protected readonly wordAt = signal<number | null>(null);
  protected readonly wordDraft = signal('');
  protected readonly draft = signal<MontageElement[]>([]);
  protected readonly intro = signal({ on: false, title: '', kicker: '' });
  protected readonly outro = signal({ on: false, text: '', detail: '' });
  protected readonly exporting = signal(false);
  protected readonly downloading = signal(false);
  protected readonly needCredits = signal(false);
  private autoDownload = false;
  private resumeAt = 0;

  protected readonly ratio = computed(() => RATIOS[this.montage()?.format ?? 'story'] ?? '9 / 16');
  /** L'aperçu tient dans 62 % de la hauteur de l'écran, quel que soit le format. */
  protected readonly previewWidth = computed(() => {
    const f = this.montage()?.format ?? 'story';
    return f === 'landscape' ? 'min(100%, 760px)' : f === 'square' ? 'min(100%, 62dvh)' : f === 'portrait' ? 'min(100%, calc(62dvh * 4 / 5))' : 'min(100%, calc(62dvh * 9 / 16))';
  });
  protected readonly ready = computed(() => this.montage()?.status === 'ready');
  protected readonly rendering = computed(() => (this.montage()?.renders ?? []).some((r) => r.status === 'rendering'));
  protected readonly backLink = computed(() => (this.montage()?.sessionId ? ['/studio/video', this.montage()!.sessionId!] : ['/studio/video']));
  protected readonly renderFresh = computed(() => {
    const m = this.montage();
    const r = (m?.renders ?? []).find((x) => x.status === 'done' && x.url);
    return !!m && !!r?.renderedAt && new Date(r.renderedAt).getTime() >= new Date(m.updatedAt).getTime() - 5000;
  });
  /** Les mots dans le temps de la vidéo finale (après l'intro). */
  protected readonly timed = computed(() => {
    const m = this.montage();
    if (!m) return [];
    const dropped = new Set(m.cuts.dropped ?? []);
    const o = m.intro?.durationSec ?? 0;
    return m.words.map((w, i) => {
      if (dropped.has(i)) return null;
      const start = mapTime(m.cuts.ranges, w.start) ?? mapTime(m.cuts.ranges, (w.start + w.end) / 2);
      return start === null ? null : { start: start + o, end: (mapTime(m.cuts.ranges, w.end) ?? start + 0.3) + o };
    });
  });
  protected readonly activeWord = computed(() => {
    const t = this.time();
    const timed = this.timed();
    for (let i = 0; i < timed.length; i++) {
      const w = timed[i];
      if (w && t >= w.start - 0.02 && t < w.end + 0.05) return i;
    }
    return -1;
  });
  /** La frise : la durée totale (intro + parole + carton) et la place de chaque repère. */
  protected readonly total = computed(() => {
    const m = this.montage();
    return this.duration() || (m ? (m.intro?.durationSec ?? 0) + (m.edit?.durationSec ?? 0) + (m.outro?.durationSec ?? 0) : 0);
  });
  protected readonly markers = computed(() => {
    const total = this.total() || 1;
    return this.draft()
      .filter((e) => !e.off && e.type !== 'zoom')
      .map((e) => ({ id: e.id, type: e.type, at: this.elementTime(e) ?? 0 }))
      .sort((a, b) => a.at - b.at)
      .map((x, i, all) => {
        // Les repères d'une même grappe (moins de 5 % d'écart) alternent entre deux rangées.
        const gap = (j: number) => (j > 0 && j < all.length ? ((all[j].at - all[j - 1].at) / total) * 100 : Infinity);
        let k = i;
        while (gap(k) < 5) k--;
        const inCluster = gap(i) < 5 || gap(i + 1) < 5;
        return { id: x.id, type: x.type, at: x.at, left: `${Math.min(98, Math.max(2, (x.at / total) * 100))}%`, top: inCluster ? ((i - k) % 2 ? '72%' : '28%') : '50%' };
      });
  });

  private poll: Subscription | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private pending: Record<string, unknown> = {};
  private onMessage = (event: MessageEvent) => {
    const frame = this.frame()?.nativeElement;
    if (!frame || event.source !== frame.contentWindow) return;
    const data = event.data as { type?: string; t?: number; duration?: number };
    if (data?.type === 'montage:time' && typeof data.t === 'number') this.time.set(data.t);
    // L'aperçu rechargé revient à l'instant où l'on était.
    if (data?.type === 'montage:ready') {
      if (typeof data.duration === 'number') this.duration.set(data.duration);
      if (this.resumeAt > 0) this.seek(this.resumeAt);
    }
  };

  constructor() {
    effect(() => {
      const id = this.montageId();
      untracked(() => this.load(id));
    });
    window.addEventListener('message', this.onMessage);
    inject(DestroyRef).onDestroy(() => {
      window.removeEventListener('message', this.onMessage);
      this.poll?.unsubscribe();
      if (this.saveTimer) {
        clearTimeout(this.saveTimer);
        this.flush();
      }
    });
  }

  private load(id: string): void {
    this.api.montage(id).subscribe({ next: (m) => this.apply(m, true), error: () => this.loadFailed.set(true) });
  }

  private apply(m: Montage, reloadPreview: boolean): void {
    const before = this.montage();
    this.montage.set(m);
    if (!this.saveTimer) {
      this.draft.set(m.elements.map((e) => ({ ...e, items: e.items ? [...e.items] : undefined })));
      this.intro.set({ on: !!m.intro, title: m.intro?.title ?? '', kicker: m.intro?.kicker ?? '' });
      this.outro.set({ on: !!m.outro, text: m.outro?.text ?? '', detail: m.outro?.detail ?? '' });
    }
    if (m.status === 'ready' && (reloadPreview || before?.status === 'processing')) this.loadPreview();
    // Première ouverture de l'éditeur : le guide (une fois par compte).
    if (!before && m.status === 'ready') void this.tours.maybeStart('editor');
    if (m.status === 'processing' || m.renders.some((r) => r.status === 'rendering')) this.watch();
    if (this.autoDownload && m.renders.some((r) => r.status === 'done') && !m.renders.some((r) => r.status === 'rendering')) {
      this.autoDownload = false;
      this.download();
    }
  }

  private loadPreview(): void {
    const m = this.montage();
    if (!m) return;
    this.resumeAt = this.time();
    this.api.montagePreview(m.id).subscribe({ next: ({ html }) => this.html.set(this.sanitizer.bypassSecurityTrustHtml(html)), error: () => undefined });
  }

  private watch(): void {
    if (this.poll) return;
    this.poll = timer(2500, 2500).subscribe(() => {
      const m = this.montage();
      if (!m) return;
      this.api.montage(m.id).subscribe({
        next: (next) => {
          if (next.status !== 'processing' && !next.renders.some((r) => r.status === 'rendering')) {
            this.poll?.unsubscribe();
            this.poll = null;
            this.state.refreshCredits();
          }
          this.apply(next, false);
        },
        error: () => undefined,
      });
    });
  }

  // ── Enregistrement automatique ──

  /** Une retouche : regroupée avec les suivantes, enregistrée après un court instant de calme. */
  private queue(patch: Record<string, unknown>, delay = 900): void {
    this.pending = { ...this.pending, ...patch };
    this.saved.set(false);
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.flush(), delay);
  }

  private flush(): void {
    this.saveTimer = null;
    const m = this.montage();
    const patch = this.pending;
    this.pending = {};
    if (!m || !Object.keys(patch).length) return;
    this.saving.set(true);
    this.saveFailed.set(false);
    this.api.updateMontage(m.id, patch).subscribe({
      next: (next) => {
        this.saving.set(false);
        this.saved.set(true);
        this.apply(next, next.status === 'ready');
      },
      error: () => {
        this.saving.set(false);
        this.saveFailed.set(true);
      },
    });
  }

  // ── Aperçu et frise ──

  protected seek(t: number): void {
    this.frame()?.nativeElement.contentWindow?.postMessage({ type: 'montage:seek', t: Math.max(0, t) }, '*');
    this.time.set(t);
  }

  protected seekAtBar(event: MouseEvent, bar: HTMLElement): void {
    const r = bar.getBoundingClientRect();
    this.seek(Math.max(0, Math.min(1, (event.clientX - r.left) / r.width)) * this.total());
  }

  protected pick(id: string): void {
    this.tab.set('screen');
    this.selected.set(id);
    const e = this.draft().find((x) => x.id === id);
    if (e) this.seek(this.elementTime(e) ?? 0);
    queueMicrotask(() => document.getElementById(`el-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  }

  protected elementTime(e: MontageElement): number | null {
    for (let i = e.from; i <= e.to; i++) {
      const w = this.timed()[i];
      if (w) return w.start;
    }
    return null;
  }

  protected clock(t: number | null): string {
    if (t === null) return '–';
    return `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  }

  protected percent(t: number): string {
    return `${Math.min(100, (t / (this.total() || 1)) * 100)}%`;
  }

  // ── À l'écran ──

  protected edit(id: string, field: 'text' | 'value' | 'label', value: string): void {
    this.draft.update((list) => list.map((e) => (e.id === id ? { ...e, [field]: value } : e)));
    this.queue({ elements: this.draft() });
  }

  protected editItems(id: string, value: string): void {
    const items = value.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 5);
    this.draft.update((list) => list.map((e) => (e.id === id ? { ...e, items } : e)));
    this.queue({ elements: this.draft() });
  }

  protected toggle(id: string): void {
    this.draft.update((list) => list.map((e) => (e.id === id ? { ...e, off: !e.off } : e)));
    this.queue({ elements: this.draft() }, 200);
  }

  protected remove(id: string): void {
    this.draft.update((list) => list.filter((e) => e.id !== id));
    this.queue({ elements: this.draft() }, 200);
  }

  protected itemsText(e: MontageElement): string {
    return (e.items ?? []).join('\n');
  }

  protected clipPoster(e: MontageElement): string | undefined {
    return this.montage()?.clips?.find((c) => c.id === e.clip)?.posterUrl;
  }

  // ── Sous-titres et ce qui est dit ──

  protected setCaptions(style: CaptionStyle): void {
    this.queue({ captions: style }, 0);
  }

  protected selectWord(i: number): void {
    this.wordAt.set(i);
    this.wordDraft.set(this.montage()?.words[i]?.text ?? '');
    const w = this.timed()[i];
    if (w) this.seek(w.start);
  }

  protected saveWord(): void {
    const i = this.wordAt();
    const text = this.wordDraft().trim();
    if (i === null || !text) return;
    this.wordAt.set(null);
    this.queue({ words: { [String(i)]: text } }, 0);
  }

  // ── Début et fin ──

  protected setIntro(patch: Partial<{ on: boolean; title: string; kicker: string }>): void {
    const next = { ...this.intro(), ...patch };
    if (patch.on && !next.title) next.title = this.montage()?.title ?? '';
    this.intro.set(next);
    this.queue({ intro: next.on && next.title.trim() ? { title: next.title.trim(), kicker: next.kicker.trim() } : null }, patch.on !== undefined ? 0 : 900);
  }

  protected setOutro(patch: Partial<{ on: boolean; text: string; detail: string }>): void {
    const next = { ...this.outro(), ...patch };
    this.outro.set(next);
    this.queue({ outro: next.on && next.text.trim() ? { text: next.text.trim(), detail: next.detail.trim() } : null }, patch.on !== undefined ? 0 : 900);
  }

  // ── Son et format ──

  protected setMusic(on: boolean): void {
    this.queue({ music: on }, 0);
  }

  protected setSilences(remove: boolean): void {
    this.queue({ cuts: remove ? 'tight' : 'none' }, 0);
  }

  protected setFormat(format: string): void {
    this.queue({ format }, 0);
  }

  // ── Télécharger ──

  protected getVideo(): void {
    const m = this.montage();
    if (!m) return;
    if (this.renderFresh()) return this.download();
    this.exporting.set(true);
    this.needCredits.set(false);
    this.api.exportMontage(m.id).subscribe({
      next: (next) => {
        this.exporting.set(false);
        this.autoDownload = true;
        this.apply(next, false);
        this.watch();
        this.state.refreshCredits();
      },
      error: (err) => {
        this.exporting.set(false);
        if (err?.status === 402) this.needCredits.set(true);
      },
    });
  }

  protected download(): void {
    const m = this.montage();
    if (!m) return;
    this.downloading.set(true);
    this.api.saveFile(`/montages/${m.id}/file`, 'ivision-montage.mp4').subscribe({ next: () => this.downloading.set(false), error: () => this.downloading.set(false) });
  }

  protected renderPercent(): number {
    const r = (this.montage()?.renders ?? [])[0];
    return r ? Math.round((r.status === 'done' ? 1 : r.progress || 0) * 100) : 0;
  }
}

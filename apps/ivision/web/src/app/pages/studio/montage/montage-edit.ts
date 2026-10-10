import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { Subscription, timer } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiService } from '../../../core/api.service';
import { CaptionStyle, CutMode, Montage, MontageElement, MontageStage } from '../../../core/models';
import { StudioState } from '../../../core/studio.state';
import { Illustration } from '../../../shared/components/illustration';

const RATIOS: Record<string, string> = { story: '9 / 16', square: '1 / 1', portrait: '4 / 5', landscape: '16 / 9' };
const STAGES: MontageStage[] = ['transcribe', 'cut', 'plan', 'media'];
const CAPTIONS: CaptionStyle[] = ['pop', 'karaoke', 'minimal', 'none'];
const CUTS: CutMode[] = ['tight', 'natural', 'none'];
const FORMATS = ['story', 'square', 'portrait', 'landscape'];

/** Un instant de l'original dans la vidéo montée (même calcul que le moteur). */
function mapTime(ranges: Montage['cuts']['ranges'], t: number): number | null {
  for (const r of ranges) if (t >= r.start - 1e-6 && t <= r.end + 1e-6) return r.at + Math.min(r.end, Math.max(r.start, t)) - r.start;
  return null;
}

/**
 * Retoucher un montage : l'aperçu (la page même qui sera rendue en MP4), la transcription
 * (un mot cliqué y amène, une faute se corrige), l'habillage élément par élément, les sous-titres,
 * le carton final, les coupes, la musique, puis l'export.
 */
@Component({
  selector: 'iv-montage-edit',
  imports: [RouterLink, TranslateModule, IdemLoaderComponent, Illustration],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './montage-edit.html',
})
export class MontageEditPage {
  private readonly api = inject(ApiService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);
  private readonly state = inject(StudioState);
  protected readonly accountUrl = `${environment.services.dashboard.url}/account`;

  readonly montageId = input.required<string>();
  private readonly frame = viewChild<ElementRef<HTMLIFrameElement>>('frame');

  protected readonly stages = STAGES;
  protected readonly captionStyles = CAPTIONS;
  protected readonly cutModes = CUTS;
  protected readonly formats = FORMATS;

  protected readonly montage = signal<Montage | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadFailed = signal(false);
  protected readonly html = signal<SafeHtml | null>(null);
  protected readonly saving = signal<string | null>(null);
  protected readonly saved = signal(false);
  protected readonly saveFailed = signal(false);
  protected readonly time = signal(0);
  protected readonly selectedWord = signal<number | null>(null);
  protected readonly wordDraft = signal('');
  /** Les éléments en cours de retouche (copie locale, enregistrée d'un bloc). */
  protected readonly draft = signal<MontageElement[]>([]);
  protected readonly draftDirty = signal(false);
  protected readonly outroText = signal('');
  protected readonly outroDetail = signal('');
  protected readonly exportPrice = signal<number | null>(null);
  protected readonly exporting = signal(false);
  protected readonly needCredits = signal(false);
  protected readonly downloading = signal(false);

  protected readonly ratio = computed(() => RATIOS[this.montage()?.format ?? 'story'] ?? '9 / 16');
  protected readonly ready = computed(() => this.montage()?.status === 'ready');
  protected readonly rendering = computed(() => (this.montage()?.renders ?? []).some((r) => r.status === 'rendering'));
  protected readonly render = computed(() => (this.montage()?.renders ?? []).find((r) => r.status === 'done' && r.url) ?? null);
  protected readonly renderFailed = computed(() => (this.montage()?.renders ?? []).some((r) => r.status === 'failed'));
  /** Les mots dans le temps de la vidéo montée ; un mot coupé est null. */
  protected readonly timed = computed(() => {
    const m = this.montage();
    if (!m) return [];
    const dropped = new Set(m.cuts.dropped ?? []);
    return m.words.map((w, i) => {
      if (dropped.has(i)) return null;
      const start = mapTime(m.cuts.ranges, w.start) ?? mapTime(m.cuts.ranges, (w.start + w.end) / 2);
      return start === null ? null : { start, end: mapTime(m.cuts.ranges, w.end) ?? start + 0.3 };
    });
  });
  /** Le mot dit à l'instant de l'aperçu. */
  protected readonly activeWord = computed(() => {
    const t = this.time();
    const timed = this.timed();
    for (let i = 0; i < timed.length; i++) {
      const w = timed[i];
      if (w && t >= w.start - 0.02 && t < w.end + 0.05) return i;
    }
    return -1;
  });

  private poll: Subscription | null = null;
  private onMessage = (event: MessageEvent) => {
    const frame = this.frame()?.nativeElement;
    if (!frame || event.source !== frame.contentWindow) return;
    const data = event.data as { type?: string; t?: number };
    if (data?.type === 'montage:time' && typeof data.t === 'number') this.time.set(data.t);
  };

  constructor() {
    effect(() => {
      const id = this.montageId();
      untracked(() => this.load(id));
    });
    window.addEventListener('message', this.onMessage);
    this.destroyRef.onDestroy(() => {
      window.removeEventListener('message', this.onMessage);
      this.poll?.unsubscribe();
    });
  }

  private load(id: string): void {
    this.loading.set(true);
    this.html.set(null);
    this.api.montage(id).subscribe({
      next: (m) => {
        this.loading.set(false);
        this.apply(m, true);
      },
      error: () => {
        this.loading.set(false);
        this.loadFailed.set(true);
      },
    });
  }

  /** Un montage reçu : copie locale des éléments, aperçu si prêt, suivi si quelque chose tourne. */
  private apply(m: Montage, reloadPreview: boolean): void {
    const wasReady = this.montage()?.status === 'ready';
    this.montage.set(m);
    this.state.upsertMontage(m);
    this.draft.set(m.elements.map((e) => ({ ...e, items: e.items ? [...e.items] : undefined })));
    this.draftDirty.set(false);
    this.outroText.set(m.outro?.text ?? '');
    this.outroDetail.set(m.outro?.detail ?? '');
    if (m.status === 'ready' && (reloadPreview || !wasReady)) this.loadPreview();
    if (m.status === 'ready') this.api.montageExportQuote(m.id).subscribe({ next: (q) => this.exportPrice.set(q.cost), error: () => this.exportPrice.set(null) });
    if (m.status === 'processing' || this.rendering()) this.watch();
  }

  private loadPreview(): void {
    const m = this.montage();
    if (!m) return;
    this.api.montagePreview(m.id).subscribe({
      next: ({ html }) => this.html.set(this.sanitizer.bypassSecurityTrustHtml(html)),
      error: () => this.saveFailed.set(true),
    });
  }

  /** Le traitement et le rendu tournent sur le serveur : on relit le montage jusqu'à la fin. */
  private watch(): void {
    if (this.poll) return;
    this.poll = timer(2500, 2500).subscribe(() => {
      const m = this.montage();
      if (!m) return;
      this.api.montage(m.id).subscribe({
        next: (next) => {
          const settled = next.status !== 'processing' && !next.renders.some((r) => r.status === 'rendering');
          if (settled) {
            this.poll?.unsubscribe();
            this.poll = null;
          }
          // Les retouches locales non enregistrées ne sont pas écrasées pendant un rendu.
          if (this.draftDirty() && next.status === 'ready' && m.status === 'ready') this.montage.set(next);
          else this.apply(next, m.status !== 'ready' && next.status === 'ready');
        },
        error: () => undefined,
      });
    });
  }

  private save(kind: string, patch: Record<string, unknown>): void {
    const m = this.montage();
    if (!m) return;
    this.saving.set(kind);
    this.saved.set(false);
    this.saveFailed.set(false);
    this.api.updateMontage(m.id, patch).subscribe({
      next: (next) => {
        this.saving.set(null);
        this.saved.set(true);
        this.apply(next, next.status === 'ready');
      },
      error: () => {
        this.saving.set(null);
        this.saveFailed.set(true);
      },
    });
  }

  // ── Aperçu ──

  protected seek(t: number): void {
    this.frame()?.nativeElement.contentWindow?.postMessage({ type: 'montage:seek', t: Math.max(0, t) }, '*');
    this.time.set(t);
  }

  protected seekWord(i: number): void {
    const w = this.timed()[i];
    if (w) this.seek(w.start);
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

  // ── Transcription ──

  protected selectWord(i: number): void {
    this.selectedWord.set(i);
    this.wordDraft.set(this.montage()?.words[i]?.text ?? '');
    this.seekWord(i);
  }

  protected saveWord(): void {
    const i = this.selectedWord();
    const text = this.wordDraft().trim();
    if (i === null || !text) return;
    this.selectedWord.set(null);
    this.save('word', { words: { [String(i)]: text } });
  }

  // ── Habillage ──

  protected editElement(id: string, field: 'text' | 'value' | 'label', value: string): void {
    this.draft.update((list) => list.map((e) => (e.id === id ? { ...e, [field]: value } : e)));
    this.draftDirty.set(true);
  }

  protected editItems(id: string, value: string): void {
    const items = value.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 5);
    this.draft.update((list) => list.map((e) => (e.id === id ? { ...e, items } : e)));
    this.draftDirty.set(true);
  }

  protected toggleElement(id: string, visible: boolean): void {
    this.draft.update((list) => list.map((e) => (e.id === id ? { ...e, off: !visible } : e)));
    this.draftDirty.set(true);
  }

  protected removeElement(id: string): void {
    this.draft.update((list) => list.filter((e) => e.id !== id));
    this.draftDirty.set(true);
  }

  protected saveElements(): void {
    this.save('elements', { elements: this.draft() });
  }

  protected itemsText(e: MontageElement): string {
    return (e.items ?? []).join('\n');
  }

  // ── Réglages ──

  protected setCaptions(style: string): void {
    this.save('captions', { captions: style });
  }

  protected setMusic(on: boolean): void {
    this.save('music', { music: on });
  }

  protected setCuts(mode: string): void {
    this.save('cuts', { cuts: mode });
  }

  protected setFormat(format: string): void {
    this.save('format', { format });
  }

  protected saveOutro(enabled: boolean): void {
    const text = this.outroText().trim();
    this.save('outro', { outro: enabled && text ? { text, detail: this.outroDetail().trim() } : null });
  }

  // ── Export ──

  protected exportMp4(): void {
    const m = this.montage();
    if (!m) return;
    this.exporting.set(true);
    this.needCredits.set(false);
    this.api.exportMontage(m.id).subscribe({
      next: (next) => {
        this.exporting.set(false);
        this.apply(next, false);
        this.watch();
        this.state.refreshCredits();
      },
      error: (err) => {
        this.exporting.set(false);
        if (err?.status === 402) this.needCredits.set(true);
        else this.saveFailed.set(true);
      },
    });
  }

  protected download(): void {
    const m = this.montage();
    if (!m) return;
    this.downloading.set(true);
    this.api.saveFile(`/montages/${m.id}/file`, `ivision-montage.mp4`).subscribe({
      next: () => this.downloading.set(false),
      error: () => {
        this.downloading.set(false);
        this.saveFailed.set(true);
      },
    });
  }

  protected renderPercent(): number {
    const r = (this.montage()?.renders ?? [])[0];
    return r ? Math.round((r.status === 'done' ? 1 : r.progress || 0) * 100) : 0;
  }

  protected stageState(stage: MontageStage): 'done' | 'running' | 'todo' {
    const current = this.montage()?.stage ?? 'transcribe';
    const order: MontageStage[] = ['upload', 'transcribe', 'cut', 'plan', 'media', 'ready'];
    const a = order.indexOf(stage);
    const b = order.indexOf(current);
    return a < b ? 'done' : a === b ? 'running' : 'todo';
  }
}

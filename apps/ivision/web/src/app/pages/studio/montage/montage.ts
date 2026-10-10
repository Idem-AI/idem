import { HttpEventType } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { Subscription, timer } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiService } from '../../../core/api.service';
import { Brand, Creativity, Montage, MontageMessage, MontageStage, MontageUpload } from '../../../core/models';
import { StudioState } from '../../../core/studio.state';
import { BrandHint } from '../../../shared/components/brand-hint';
import { CreativitySelect } from '../../../shared/components/creativity-select';
import { Illustration } from '../../../shared/components/illustration';
import { MontageDetails } from './montage-details';

const RATIOS: Record<string, string> = { story: '9 / 16', square: '1 / 1', portrait: '4 / 5', landscape: '16 / 9' };
const FORMATS = ['story', 'square', 'portrait', 'landscape'];
const STAGES: MontageStage[] = ['prepare', 'transcribe', 'cut', 'plan', 'media'];
const ORDER: MontageStage[] = ['upload', 'prepare', 'transcribe', 'cut', 'plan', 'media', 'ready'];
const SUGGESTIONS = ['noMusic', 'soberCaptions', 'moreDynamic', 'square'];

/**
 * L'ATELIER MONTAGE, EN CONVERSATION — pour quelqu'un qui n'a jamais monté une vidéo.
 *
 *   1. « Ajoutez vos vidéos » : une ou plusieurs (celles où l'on parle sont mises bout à bout,
 *      les autres deviennent des plans de coupe) ;
 *   2. « Quel montage voulez-vous ? » — facultatif ; quelques réglages simples, repliés ;
 *   3. le montage se prépare (étapes réelles) ; le résultat arrive dans le fil, prêt à
 *      télécharger ;
 *   4. on demande des changements en écrivant (« sans musique », « en carré ») ; pour aller plus
 *      loin, « Ajuster les détails » ouvre la transcription et l'habillage.
 */
@Component({
  selector: 'iv-montage',
  imports: [TranslateModule, IdemLoaderComponent, Illustration, CreativitySelect, BrandHint, MontageDetails],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './montage.html',
})
export class MontagePage {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly state = inject(StudioState);
  protected readonly accountUrl = `${environment.services.dashboard.url}/account`;

  readonly montageId = input<string | undefined>(undefined);
  private readonly frame = viewChild<ElementRef<HTMLIFrameElement>>('frame');
  private readonly log = viewChild<ElementRef<HTMLElement>>('log');

  protected readonly formats = FORMATS;
  protected readonly stages = STAGES;
  protected readonly suggestions = SUGGESTIONS;

  // ── État ──
  protected readonly available = signal<boolean | null>(null);
  protected readonly limits = signal({ maxBytes: 600 * 1024 * 1024, maxDurationSec: 300, minDurationSec: 3, maxFiles: 10 });
  protected readonly montage = signal<Montage | null>(null);
  protected readonly loading = signal(false);
  protected readonly loadFailed = signal(false);
  protected readonly html = signal<SafeHtml | null>(null);
  protected readonly time = signal(0);
  protected readonly details = signal(false);
  protected readonly brand = signal<Brand | null>(null);

  // ── Nouveau montage ──
  protected readonly uploads = signal<MontageUpload[]>([]);
  protected readonly uploading = signal(false);
  protected readonly uploadPercent = signal(0);
  protected readonly dragging = signal(false);
  protected readonly settingsOpen = signal(false);
  protected readonly format = signal('story');
  protected readonly removeSilences = signal(true);
  protected readonly music = signal(true);
  protected readonly creativity = signal<Creativity>('medium');
  protected readonly price = signal<number | null>(null);
  protected readonly creating = signal(false);

  // ── Conversation ──
  protected readonly text = signal('');
  protected readonly sending = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly needCredits = signal(false);
  protected readonly exporting = signal(false);
  protected readonly downloading = signal(false);
  private autoDownload = false;

  protected readonly totalSec = computed(() => this.uploads().reduce((s, u) => s + u.durationSec, 0));
  protected readonly ratio = computed(() => RATIOS[this.montage()?.format ?? 'story'] ?? '9 / 16');
  protected readonly processing = computed(() => this.montage()?.status === 'processing');
  protected readonly ready = computed(() => this.montage()?.status === 'ready');
  protected readonly rendering = computed(() => (this.montage()?.renders ?? []).some((r) => r.status === 'rendering'));
  protected readonly renderDone = computed(() => (this.montage()?.renders ?? []).find((r) => r.status === 'done' && r.url) ?? null);
  /** Le MP4 rendu correspond-il encore au montage (aucune retouche depuis) ? */
  protected readonly renderFresh = computed(() => {
    const m = this.montage();
    const r = this.renderDone();
    return !!m && !!r?.renderedAt && new Date(String(r.renderedAt)).getTime() >= new Date(m.updatedAt).getTime() - 5000;
  });
  protected readonly messages = computed<MontageMessage[]>(() => this.montage()?.messages ?? []);
  protected readonly canCreate = computed(() => this.uploads().length > 0 && !this.uploading() && !this.creating() && this.available() === true && this.totalSec() <= this.limits().maxDurationSec + 1);

  private poll: Subscription | null = null;
  private uploadSub: Subscription | null = null;
  private onMessage = (event: MessageEvent) => {
    const frame = this.frame()?.nativeElement;
    if (!frame || event.source !== frame.contentWindow) return;
    const data = event.data as { type?: string; t?: number };
    if (data?.type === 'montage:time' && typeof data.t === 'number') this.time.set(data.t);
  };

  constructor() {
    this.api.montageStatus().subscribe({
      next: (s) => {
        this.available.set(s.available);
        this.limits.set({ ...this.limits(), ...s.limits });
      },
      error: () => this.available.set(false),
    });
    effect(() => {
      const id = this.montageId();
      untracked(() => this.open(id));
    });
    // Le prix suit la durée totale et le cran.
    effect(() => {
      const d = this.totalSec();
      const level = this.creativity();
      if (!d) return this.price.set(null);
      untracked(() => this.api.montageQuote(d, level).subscribe({ next: (q) => this.price.set(q.cost), error: () => this.price.set(null) }));
    });
    // Le fil descend avec la conversation.
    effect(() => {
      this.messages();
      this.processing();
      untracked(() => queueMicrotask(() => this.log()?.nativeElement.scrollTo({ top: 1e9, behavior: 'smooth' })));
    });
    window.addEventListener('message', this.onMessage);
    this.destroyRef.onDestroy(() => {
      window.removeEventListener('message', this.onMessage);
      this.poll?.unsubscribe();
      this.uploadSub?.unsubscribe();
    });
  }

  private open(id: string | undefined): void {
    this.poll?.unsubscribe();
    this.poll = null;
    this.html.set(null);
    this.details.set(false);
    this.error.set(null);
    if (!id) {
      this.montage.set(null);
      return;
    }
    this.loading.set(true);
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

  /** Un montage reçu : aperçu si prêt, suivi si quelque chose tourne, marque chargée. */
  private apply(m: Montage, reloadPreview: boolean): void {
    const before = this.montage();
    this.montage.set(m);
    this.state.upsertMontage(m);
    if (this.brand()?.id !== m.brandId) {
      const listed = this.state.brands().find((b) => b.id === m.brandId);
      if (listed) this.brand.set(listed);
      else this.api.brand(m.brandId).subscribe({ next: (b) => this.brand.set(b), error: () => this.brand.set(null) });
    }
    const becameReady = m.status === 'ready' && before?.status !== 'ready';
    if (m.status === 'ready' && (reloadPreview || becameReady)) this.loadPreview();
    if (m.status === 'processing' || m.renders.some((r) => r.status === 'rendering')) this.watch();
    // Le rendu demandé par « Télécharger » vient de finir : le fichier part tout seul.
    if (this.autoDownload && m.renders.some((r) => r.status === 'done') && !m.renders.some((r) => r.status === 'rendering')) {
      this.autoDownload = false;
      this.download();
    }
  }

  private loadPreview(): void {
    const m = this.montage();
    if (!m) return;
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
          }
          this.apply(next, m.status === 'processing' && next.status === 'ready');
        },
        error: () => undefined,
      });
    });
  }

  // ── Les vidéos ──

  protected onFiles(event: Event): void {
    const files = Array.from((event.target as HTMLInputElement).files ?? []);
    (event.target as HTMLInputElement).value = '';
    this.upload(files);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    this.upload(Array.from(event.dataTransfer?.files ?? []).filter((f) => f.type.startsWith('video/') || /\.(mp4|mov|webm|m4v|3gp|mkv)$/i.test(f.name)));
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(true);
  }

  private upload(files: File[]): void {
    const room = this.limits().maxFiles - this.uploads().length;
    const picked = files.slice(0, Math.max(0, room));
    if (!picked.length) return;
    if (picked.some((f) => f.size > this.limits().maxBytes)) {
      this.error.set('montage.errors.tooBig');
      return;
    }
    this.uploading.set(true);
    this.uploadPercent.set(0);
    this.error.set(null);
    this.uploadSub = this.api.uploadMontageVideos(picked).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.UploadProgress && event.total) this.uploadPercent.set(Math.round((event.loaded / event.total) * 100));
        if (event.type === HttpEventType.Response && event.body) {
          this.uploading.set(false);
          this.uploads.update((list) => [...list, ...event.body!.uploads]);
        }
      },
      error: (err) => {
        this.uploading.set(false);
        this.error.set(err?.error?.message || 'montage.errors.upload');
      },
    });
  }

  protected removeUpload(i: number): void {
    this.uploads.update((list) => list.filter((_, k) => k !== i));
  }

  protected minutes(sec: number): string {
    return `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;
  }

  // ── Lancer ──

  protected create(): void {
    if (!this.canCreate()) return;
    this.creating.set(true);
    this.error.set(null);
    this.needCredits.set(false);
    this.api
      .createMontage({
        inputs: this.uploads().map((u) => ({ url: u.url, name: u.name, posterUrl: u.posterUrl })),
        prompt: this.text().trim(),
        ...(this.brand() ? { brandId: this.brand()!.id } : {}),
        format: this.format(),
        creativity: this.creativity(),
        cuts: this.removeSilences() ? 'tight' : 'none',
        music: this.music(),
      })
      .subscribe({
        next: (m) => {
          this.creating.set(false);
          this.uploads.set([]);
          this.text.set('');
          this.state.upsertMontage(m);
          this.state.refreshCredits();
          void this.router.navigate(['/studio/montage', m.id]);
        },
        error: (err) => {
          this.creating.set(false);
          if (err?.status === 402) this.needCredits.set(true);
          else this.error.set(err?.error?.message || 'errors.generic');
        },
      });
  }

  // ── La conversation ──

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      if (this.montage()) this.sendMessage();
      else this.create();
    }
  }

  protected suggest(key: string): void {
    this.text.set(this.translate.instant(`montage.suggestions.${key}`));
    this.sendMessage();
  }

  protected sendMessage(): void {
    const m = this.montage();
    const text = this.text().trim();
    if (!m || !text || this.sending() || this.processing()) return;
    this.sending.set(true);
    this.error.set(null);
    // Le message part tout de suite dans le fil (la réponse suit).
    this.montage.set({ ...m, messages: [...(m.messages ?? []), { id: `local-${Date.now()}`, role: 'user', text, createdAt: new Date().toISOString() }] });
    this.text.set('');
    this.api.sendMontageMessage(m.id, text).subscribe({
      next: (next) => {
        this.sending.set(false);
        this.apply(next, next.status === 'ready');
      },
      error: (err) => {
        this.sending.set(false);
        this.montage.set(m);
        this.text.set(text);
        this.error.set(err?.error?.message || 'errors.generic');
      },
    });
  }

  protected messageText(msg: MontageMessage): string {
    if (!msg.i18n) return msg.text;
    const t = this.translate.instant(msg.i18n.key, msg.i18n.params);
    return t && t !== msg.i18n.key ? t : msg.text;
  }

  protected stageState(stage: MontageStage): 'done' | 'running' | 'todo' {
    const a = ORDER.indexOf(stage);
    const b = ORDER.indexOf(this.montage()?.stage ?? 'prepare');
    return a < b ? 'done' : a === b ? 'running' : 'todo';
  }

  // ── Marque ──

  protected onBrand(brand: Brand): void {
    this.brand.set(brand);
    const m = this.montage();
    if (!m) return;
    this.api.updateMontage(m.id, { brandId: brand.id }).subscribe({ next: (next) => this.apply(next, true), error: () => this.error.set('errors.generic') });
  }

  // ── Aperçu, détails, téléchargement ──

  protected seek(t: number): void {
    this.frame()?.nativeElement.contentWindow?.postMessage({ type: 'montage:seek', t: Math.max(0, t) }, '*');
    this.time.set(t);
  }

  protected onDetailsChanged(m: Montage): void {
    this.apply(m, m.status === 'ready');
  }

  /** « Télécharger » : le MP4 s'il est à jour, sinon il est rendu puis enregistré tout seul. */
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
        else this.error.set(err?.error?.message || 'errors.generic');
      },
    });
  }

  protected download(): void {
    const m = this.montage();
    if (!m) return;
    this.downloading.set(true);
    this.api.saveFile(`/montages/${m.id}/file`, 'ivision-montage.mp4').subscribe({
      next: () => this.downloading.set(false),
      error: () => {
        this.downloading.set(false);
        this.error.set('errors.generic');
      },
    });
  }

  protected renderPercent(): number {
    const r = (this.montage()?.renders ?? [])[0];
    return r ? Math.round((r.status === 'done' ? 1 : r.progress || 0) * 100) : 0;
  }

  protected newMontage(): void {
    void this.router.navigate(['/studio/montage']);
  }

  protected openDrawer(): void {
    this.state.drawerOpen.set(true);
  }
}

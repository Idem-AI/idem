import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { IdemVideoEditorComponent } from '@idem/shared-video-editor/angular';
import { Subscription, timer } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiService } from '../../../core/api.service';
import { LanguageService } from '../../../core/language.service';
import { MotionVideo, VideoOptions } from '../../../core/models';
import { StudioState } from '../../../core/studio.state';
import { Illustration } from '../../../shared/components/illustration';

const RATIOS: Record<string, number> = { story: 9 / 16, square: 1, portrait: 4 / 5, landscape: 16 / 9 };
const FORMATS = ['story', 'square', 'portrait', 'landscape'];
const QUALITIES = ['standard', 'hd', 'premium'];
const MOODS = ['auto', 'upbeat', 'afro', 'calm', 'epic', 'corporate', 'none'];

/** Le minutage d'une vidéo : s'il change après une retouche (temps de lecture), l'aperçu est recomposé. */
const timing = (v: MotionVideo | null) => (v?.storyboard.scenes ?? []).map((s) => `${s.key}:${s.start}:${s.duration}`).join('|');

/**
 * Retoucher une vidéo : l'éditeur partagé avec IDEM (aperçu + textes en direct), la musique, les
 * effets sonores, et l'export MP4 (le premier inclus dans le prix de la vidéo).
 */
@Component({
  selector: 'iv-video-edit',
  imports: [RouterLink, TranslateModule, IdemLoaderComponent, IdemVideoEditorComponent, Illustration],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './video-edit.html',
})
export class VideoEditPage {
  private readonly api = inject(ApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly studio = inject(StudioState);
  protected readonly language = inject(LanguageService);
  protected readonly accountUrl = `${environment.services.dashboard.url}/account`;

  readonly brandId = input.required<string>();
  readonly videoId = input.required<string>();
  private readonly editor = viewChild(IdemVideoEditorComponent);

  protected readonly video = signal<MotionVideo | null>(null);
  protected readonly options = signal<VideoOptions | null>(null);
  protected readonly html = signal<string | null>(null);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly previewFormat = signal('story');
  protected readonly saving = signal<string | null>(null);
  protected readonly saved = signal(false);
  protected readonly exportFormats = signal<string[]>([]);
  protected readonly exportQuality = signal('hd');
  protected readonly exportPrice = signal<number | null>(null);
  protected readonly exporting = signal(false);
  protected readonly needCredits = signal(false);
  private replacing: string | null = null;

  protected readonly formats = FORMATS;
  protected readonly qualities = QUALITIES;
  protected readonly moods = MOODS;
  protected readonly ratio = computed(() => RATIOS[this.previewFormat()] ?? 9 / 16);
  protected readonly scenes = computed(() => this.video()?.storyboard.scenes ?? []);
  protected readonly renders = computed(() => (this.video()?.renders ?? []).filter((r) => r.status === 'done' && r.url));
  protected readonly rendering = computed(() => this.video()?.status === 'rendering');

  private poll: Subscription | null = null;

  constructor() {
    this.api.videoOptions().subscribe({ next: (o) => this.options.set(o), error: () => undefined });
    effect(() => {
      const brandId = this.brandId();
      const videoId = this.videoId();
      untracked(() => this.load(brandId, videoId));
    });
    // Prix d'un export pour le périmètre choisi (calculé par le serveur, aux prix d'IDEM).
    effect(() => {
      const scope = { formats: this.exportFormats(), quality: this.exportQuality() };
      const v = untracked(() => this.video());
      if (!v || !scope.formats.length) return;
      untracked(() => this.api.exportQuote(this.brandId(), v.id, scope).subscribe({ next: (q) => this.exportPrice.set(q.cost), error: () => this.exportPrice.set(null) }));
    });
    this.destroyRef.onDestroy(() => this.poll?.unsubscribe());
  }

  private load(brandId: string, videoId: string): void {
    this.loading.set(true);
    this.api.video(brandId, videoId).subscribe({
      next: (video) => {
        this.apply(video);
        this.previewFormat.set(video.scope.formats[0] ?? 'story');
        this.exportFormats.set([...video.scope.formats]);
        this.exportQuality.set(video.scope.quality);
        this.loading.set(false);
        this.loadPreview();
      },
      error: () => {
        this.loading.set(false);
        this.failed.set(true);
      },
    });
  }

  private apply(video: MotionVideo): void {
    this.video.set(video);
    if (video.status === 'rendering') this.watchRender();
  }

  protected loadPreview(): void {
    const v = this.video();
    if (!v) return;
    this.api.preview(this.brandId(), v.id, this.previewFormat()).subscribe({ next: ({ html }) => this.html.set(html), error: () => this.failed.set(true) });
  }

  protected setPreviewFormat(format: string): void {
    this.previewFormat.set(format);
    this.loadPreview();
  }

  /** Une retouche enregistrée ; si le minutage a bougé, l'aperçu est recomposé. */
  private save(kind: string, patch: Record<string, unknown>, reloadAlways = false): void {
    const v = this.video();
    if (!v) return;
    this.saving.set(kind);
    this.saved.set(false);
    this.api.updateVideo(this.brandId(), v.id, patch).subscribe({
      next: (next) => {
        const moved = timing(next) !== timing(v);
        this.apply(next);
        this.saving.set(null);
        this.saved.set(true);
        if (moved || reloadAlways) this.loadPreview();
      },
      error: () => {
        this.saving.set(null);
        this.failed.set(true);
      },
    });
  }

  protected saveTexts(edits: Record<string, Record<string, string>>): void {
    this.save('texts', { slots: edits });
  }

  protected setMood(mood: string): void {
    this.save('music', { musicMood: mood }, true);
  }

  protected setSfx(enabled: boolean): void {
    this.save('sfx', { sfx: enabled }, true);
  }

  /** Voix off : la couper la garde ; l'ajouter l'écrit et l'enregistre (le minutage se recale). */
  protected setVoice(enabled: boolean): void {
    this.save('voice', { voice: enabled }, true);
  }

  protected pickPhoto(key: string, input: HTMLInputElement): void {
    this.replacing = key;
    input.click();
  }

  protected onPhoto(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    (event.target as HTMLInputElement).value = '';
    const key = this.replacing;
    if (!file || !key) return;
    this.saving.set('photo');
    this.api.uploadMedia(this.brandId(), [file]).subscribe({
      next: ({ assets }) => {
        const url = assets[0]?.url;
        if (!url) return this.saving.set(null);
        this.editor()?.previewImage(key, url);
        this.save('photo', { images: { [key]: url } });
      },
      error: () => {
        this.saving.set(null);
        this.failed.set(true);
      },
    });
  }

  protected toggleExportFormat(format: string, checked: boolean): void {
    this.exportFormats.update((list) => (checked ? [...new Set([...list, format])] : list.filter((f) => f !== format)));
  }

  protected exportVideo(): void {
    const v = this.video();
    if (!v || !this.exportFormats().length) return;
    this.exporting.set(true);
    this.needCredits.set(false);
    this.api.exportVideo(this.brandId(), v.id, { formats: this.exportFormats(), quality: this.exportQuality() }).subscribe({
      next: (next) => {
        this.exporting.set(false);
        this.apply(next);
        this.studio.refreshCredits();
      },
      error: (err) => {
        this.exporting.set(false);
        if (err?.status === 402) this.needCredits.set(true);
        else this.failed.set(true);
      },
    });
  }

  /** Le rendu tourne sur le serveur : on relit la vidéo jusqu'à ce qu'il soit fini. */
  private watchRender(): void {
    if (this.poll) return;
    this.poll = timer(3000, 3000).subscribe(() => {
      const v = this.video();
      if (!v) return;
      this.api.video(this.brandId(), v.id).subscribe({
        next: (next) => {
          this.video.set(next);
          if (next.status !== 'rendering') {
            this.poll?.unsubscribe();
            this.poll = null;
          }
        },
        error: () => undefined,
      });
    });
  }

  protected progressOf(): number {
    const renders = this.video()?.renders ?? [];
    return renders.length ? Math.round((renders.reduce((s, r) => s + (r.status === 'done' ? 1 : r.progress || 0), 0) / renders.length) * 100) : 0;
  }
}

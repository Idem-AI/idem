import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { TranslateModule } from '@ngx-translate/core';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { MotionVideoService } from '../../../../services/ai-agents/motion-video.service';
import {
  MotionStyle,
  MotionVideo,
  MusicMood,
  MusicTrack,
  priceExport,
  VideoFormat,
  VideoOptions,
  VideoQuality,
  VideoScope,
} from '../../../../models/motion-video.model';

const RATIOS: Record<VideoFormat, number> = {
  story: 9 / 16,
  square: 1,
  portrait: 4 / 5,
  landscape: 16 / 9,
};

const MOODS: MusicMood[] = ['auto', 'upbeat', 'afro', 'calm', 'epic', 'corporate', 'none'];

type Edits = Record<string, Record<string, string>>;

/**
 * Une vidéo : l'aperçu (le même moteur que le MP4, joué dans le navigateur),
 * les retouches gratuites (textes, musique, style) et l'export.
 */
@Component({
  selector: 'app-video-detail',
  imports: [FormsModule, TranslateModule, IdemLoaderComponent],
  templateUrl: './video-detail.html',
  styleUrl: './video-detail.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VideoDetail {
  private readonly videos = inject(MotionVideoService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);

  readonly projectId = input.required<string>();
  readonly videoId = input.required<string>();
  readonly options = input.required<VideoOptions>();

  readonly back = output<void>();
  readonly changed = output<MotionVideo>();
  readonly deleted = output<string>();
  readonly failed = output<string>();
  readonly needsCredits = output<{ cost: number; balance: number }>();

  protected readonly moods = MOODS;
  protected readonly allFormats: VideoFormat[] = ['story', 'square', 'portrait', 'landscape'];
  protected readonly qualities: VideoQuality[] = ['standard', 'hd', 'premium'];
  protected readonly styleChoices: MotionStyle[] = ['energetic', 'premium', 'playful', 'corporate'];
  protected readonly directionChoices = computed(() => (this.options().directions ?? []).filter((d) => d !== 'auto'));

  protected readonly video = signal<MotionVideo | null>(null);
  protected readonly loading = signal(true);
  protected readonly previewFormat = signal<VideoFormat>('story');
  protected readonly previewHtml = signal<SafeHtml | null>(null);
  protected readonly previewLoading = signal(false);
  protected readonly saving = signal<'texts' | 'music' | 'style' | 'sfx' | null>(null);
  protected readonly edits = signal<Edits>({});
  protected readonly tracks = signal<MusicTrack[] | null>(null);
  protected readonly tracksLoading = signal(false);
  protected readonly exportFormats = signal<VideoFormat[]>([]);
  protected readonly exportQuality = signal<VideoQuality>('hd');
  protected readonly exporting = signal(false);
  protected readonly confirmDelete = signal(false);
  protected readonly copied = signal(false);

  protected readonly ratio = computed(() => RATIOS[this.previewFormat()]);
  protected readonly scenes = computed(() => this.video()?.storyboard.scenes ?? []);
  protected readonly rendering = computed(() => this.video()?.status === 'rendering');
  protected readonly sfxSounds = computed(() => Object.values(this.video()?.sfx?.sounds ?? {}).filter((s) => !!s));
  protected readonly mediaCredits = computed(() => (this.video()?.media ?? []).filter((m) => !!m.credit));
  protected readonly doneRenders = computed(() => (this.video()?.renders ?? []).filter((r) => r.status === 'done'));

  protected readonly exportScope = computed<VideoScope | null>(() => {
    const v = this.video();
    if (!v) return null;
    return { durationSec: v.scope.durationSec, formats: this.exportFormats(), quality: this.exportQuality() };
  });

  protected readonly exportPrice = computed(() => {
    const v = this.video();
    const scope = this.exportScope();
    return v && scope ? priceExport(this.options().pricing, v, scope) : 0;
  });

  protected readonly hasTextChanges = computed(() => {
    const v = this.video();
    if (!v) return false;
    const edits = this.edits();
    return v.storyboard.scenes.some((scene) =>
      Object.entries(edits[scene.key] || {}).some(([k, value]) => (scene.slots[k] || '') !== value),
    );
  });

  private pollTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      const projectId = this.projectId();
      const videoId = this.videoId();
      untracked(() => this.load(projectId, videoId));
    });
    this.destroyRef.onDestroy(() => this.stopPolling());
  }

  private load(projectId: string, videoId: string): void {
    this.loading.set(true);
    this.videos
      .get(projectId, videoId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (video) => {
          this.apply(video);
          this.previewFormat.set(video.scope.formats[0]);
          this.loading.set(false);
          this.loadPreview();
        },
        error: () => {
          this.loading.set(false);
          this.failed.emit('dashboard.showCommunication.video.errors.load');
        },
      });
  }

  /** Nouvel état de la vidéo : formulaire réaligné, suivi du rendu relancé si besoin. */
  private apply(video: MotionVideo): void {
    this.video.set(video);
    this.edits.set(
      Object.fromEntries(video.storyboard.scenes.map((scene) => [scene.key, { ...scene.slots }])),
    );
    this.exportFormats.set([...video.scope.formats]);
    this.exportQuality.set(video.scope.quality);
    this.changed.emit(video);
    if (video.status === 'rendering') this.schedulePoll();
  }

  protected loadPreview(): void {
    const v = this.video();
    if (!v) return;
    this.previewLoading.set(true);
    this.videos
      .preview(this.projectId(), v.id, this.previewFormat())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ html }) => {
          // HTML composé par l'API (textes échappés) et joué dans une iframe
          // isolée (`sandbox="allow-scripts"`, sans accès à cette page).
          this.previewHtml.set(this.sanitizer.bypassSecurityTrustHtml(html));
          this.previewLoading.set(false);
        },
        error: () => {
          this.previewLoading.set(false);
          this.failed.emit('dashboard.showCommunication.video.errors.preview');
        },
      });
  }

  protected setPreviewFormat(format: VideoFormat): void {
    if (format === this.previewFormat()) return;
    this.previewFormat.set(format);
    this.loadPreview();
  }

  // ── Textes ───────────────────────────────────────────────────────────────

  protected slotSpecs(sceneId: string) {
    return this.options().scenes[sceneId] ?? [];
  }

  protected slotValue(sceneKey: string, slot: string): string {
    return this.edits()[sceneKey]?.[slot] ?? '';
  }

  protected setSlot(sceneKey: string, slot: string, value: string): void {
    this.edits.update((all) => ({ ...all, [sceneKey]: { ...(all[sceneKey] || {}), [slot]: value } }));
  }

  protected saveTexts(): void {
    const v = this.video();
    if (!v || !this.hasTextChanges()) return;
    this.patch('texts', { slots: this.edits() });
  }

  // ── Musique & style ──────────────────────────────────────────────────────

  protected changeMood(mood: MusicMood): void {
    this.tracks.set(null);
    this.patch('music', { musicMood: mood });
  }

  /** Un autre morceau de la même ambiance (l'API évite le morceau actuel). */
  protected anotherTrack(): void {
    const v = this.video();
    if (!v) return;
    this.patch('music', { musicMood: v.brief.musicMood === 'none' ? 'auto' : v.brief.musicMood });
  }

  protected browseTracks(): void {
    const v = this.video();
    if (!v || this.tracksLoading()) return;
    this.tracksLoading.set(true);
    this.videos
      .music(this.projectId(), v.id, v.brief.musicMood === 'none' ? 'auto' : v.brief.musicMood)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (tracks) => {
          this.tracks.set(tracks);
          this.tracksLoading.set(false);
        },
        error: () => {
          this.tracksLoading.set(false);
          this.failed.emit('dashboard.showCommunication.video.errors.music');
        },
      });
  }

  protected chooseTrack(track: MusicTrack): void {
    const v = this.video();
    this.patch('music', { musicTrackId: track.id, musicMood: v?.brief.musicMood === 'none' ? 'auto' : v?.brief.musicMood });
  }

  protected toggleSfx(enabled: boolean): void {
    this.patch('sfx', { sfx: enabled });
  }

  /** Autre direction : composition, techniques, transitions et couleur changent. Gratuit. */
  protected changeDirection(direction: string): void {
    this.patch('style', { direction });
  }

  protected changeStyle(style: MotionStyle): void {
    this.patch('style', { style });
  }

  protected copyCredit(): void {
    const credit = this.video()?.music?.attribution;
    if (!credit || !navigator.clipboard) return;
    void navigator.clipboard.writeText(credit).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    });
  }

  private patch(kind: 'texts' | 'music' | 'style' | 'sfx', body: Parameters<MotionVideoService['update']>[2]): void {
    const v = this.video();
    if (!v || this.saving()) return;
    this.saving.set(kind);
    this.videos
      .update(this.projectId(), v.id, body)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (video) => {
          this.saving.set(null);
          this.apply(video);
          this.loadPreview();
        },
        error: () => {
          this.saving.set(null);
          this.failed.emit('dashboard.showCommunication.video.errors.update');
        },
      });
  }

  // ── Export ───────────────────────────────────────────────────────────────

  protected toggleExportFormat(format: VideoFormat): void {
    const current = this.exportFormats();
    if (current.includes(format)) {
      if (current.length > 1) this.exportFormats.set(current.filter((f) => f !== format));
    } else {
      this.exportFormats.set([...current, format]);
    }
  }

  protected startExport(): void {
    const v = this.video();
    const scope = this.exportScope();
    if (!v || !scope || this.exporting() || this.rendering()) return;
    this.exporting.set(true);
    this.videos
      .export(this.projectId(), v.id, { formats: scope.formats, quality: scope.quality })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (video) => {
          this.exporting.set(false);
          this.apply(video);
        },
        error: (err) => {
          this.exporting.set(false);
          if (err?.status === 402) {
            this.needsCredits.emit({ cost: err.error?.cost ?? this.exportPrice(), balance: err.error?.balance ?? 0 });
            return;
          }
          this.failed.emit('dashboard.showCommunication.video.errors.export');
        },
      });
  }

  private schedulePoll(): void {
    this.stopPolling();
    this.pollTimer = setTimeout(() => {
      const v = this.video();
      if (!v) return;
      this.videos
        .get(this.projectId(), v.id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (video) => {
            this.video.set(video);
            if (video.status === 'rendering') this.schedulePoll();
            else this.apply(video);
          },
          error: () => this.schedulePoll(),
        });
    }, 2500);
  }

  private stopPolling(): void {
    if (this.pollTimer) clearTimeout(this.pollTimer);
    this.pollTimer = null;
  }

  protected percent(progress: number): number {
    return Math.round((progress || 0) * 100);
  }

  protected size(bytes?: number): string {
    if (!bytes) return '';
    return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} Mo` : `${Math.round(bytes / 1024)} Ko`;
  }

  // ── Suppression ──────────────────────────────────────────────────────────

  protected remove(): void {
    const v = this.video();
    if (!v) return;
    this.videos
      .delete(this.projectId(), v.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.deleted.emit(v.id),
        error: () => this.failed.emit('dashboard.showCommunication.video.errors.delete'),
      });
  }
}

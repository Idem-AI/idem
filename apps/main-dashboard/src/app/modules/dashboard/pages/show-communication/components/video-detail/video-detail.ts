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
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { IdemVideoEditorComponent } from '@idem/shared-video-editor/angular';
import { editorScenes, SceneAction } from '@idem/shared-video-editor';
import { MotionVideoService } from '../../../../services/ai-agents/motion-video.service';
import {
  MotionVideo,
  MusicMood,
  MusicTrack,
  priceExport,
  VideoFormat,
  VideoOptions,
  VideoPatch,
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

/** Ce que l'aperçu montre : minutage et code des scènes. S'il change, l'aperçu est recomposé. */
const shape = (v: MotionVideo | null) => (v?.film?.scenes ?? []).map((s) => `${s.key}:${s.start}:${s.duration}:${s.code?.length ?? 0}:${s.author?.at ?? ''}`).join('|');

type SavingKind = 'texts' | 'photo' | 'music' | 'sfx' | 'voice' | 'captions' | 'revise';

/**
 * Une vidéo : l'éditeur partagé avec iVision (`@idem/shared-video-editor` : l'aperçu Motion Canvas
 * — le même paquet que le MP4 —, les textes de chaque scène vus en direct, et les demandes de
 * réécriture d'une scène par l'IA), la retouche écrite pour tout le film, la musique, les effets,
 * la voix et l'export. Une vidéo de l'ancien moteur reste téléchargeable, en lecture seule.
 */
@Component({
  selector: 'app-video-detail',
  imports: [FormsModule, TranslateModule, IdemLoaderComponent, IdemVideoEditorComponent],
  templateUrl: './video-detail.html',
  styleUrl: './video-detail.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VideoDetail {
  private readonly videos = inject(MotionVideoService);
  private readonly translate = inject(TranslateService);
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

  protected readonly video = signal<MotionVideo | null>(null);
  protected readonly loading = signal(true);
  protected readonly previewFormat = signal<VideoFormat>('story');
  protected readonly previewHtml = signal<string | null>(null);
  protected readonly editorLang = signal<'fr' | 'en'>('fr');
  protected readonly previewLoading = signal(false);
  protected readonly saving = signal<SavingKind | null>(null);
  /** Les scènes que l'IA réécrit (correction, consigne, nouvelle version). */
  protected readonly rewriting = signal<string[]>([]);
  /** La retouche écrite pour tout le film, et la réponse de l'IA. */
  protected readonly instruction = signal('');
  protected readonly reply = signal<string | null>(null);
  protected readonly tracks = signal<MusicTrack[] | null>(null);
  protected readonly tracksLoading = signal(false);
  protected readonly exportFormats = signal<VideoFormat[]>([]);
  protected readonly exportQuality = signal<VideoQuality>('hd');
  protected readonly exporting = signal(false);
  protected readonly confirmDelete = signal(false);
  protected readonly copied = signal(false);

  protected readonly ratio = computed(() => RATIOS[this.previewFormat()]);
  protected readonly scenes = computed(() => editorScenes(this.video()));
  protected readonly broken = computed(() => this.scenes().filter((sc) => sc.status === 'error'));
  protected readonly legacy = computed(() => !!this.video()?.legacy);
  protected readonly notes = computed(() => this.video()?.film?.fidelity?.notes ?? []);
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

  /** Retouches de texte arrivées pendant un enregistrement : envoyées juste après. */
  private queuedTexts: Edits | null = null;
  private replacing: string | null = null;

  private pollTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      const projectId = this.projectId();
      const videoId = this.videoId();
      untracked(() => this.load(projectId, videoId));
    });
    this.editorLang.set(this.translate.currentLang === 'en' ? 'en' : 'fr');
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((e) => this.editorLang.set(e.lang === 'en' ? 'en' : 'fr'));
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
          if (!video.legacy) this.loadPreview();
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
          // HTML composé par l'API (textes échappés), joué par l'éditeur partagé dans une
          // iframe isolée (`sandbox="allow-scripts"`, sans accès à cette page).
          this.previewHtml.set(html);
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

  // ── Textes et photos (éditeur partagé) ───────────────────────────────

  /** Les textes retouchés dans l'éditeur ; l'aperçu n'est recomposé que si le minutage a bougé. */
  protected saveTexts(edits: Edits): void {
    if (this.saving()) {
      this.queuedTexts = { ...(this.queuedTexts || {}), ...edits };
      return;
    }
    this.patch('texts', { texts: edits });
  }

  /**
   * Une demande sur une scène : la réécrire selon une consigne, en faire une nouvelle version, ou
   * corriger son code. L'IA réécrit SEULEMENT cette scène ; l'aperçu est recomposé ensuite.
   */
  protected sceneAction(action: SceneAction): void {
    const v = this.video();
    if (!v || this.rewriting().includes(action.key)) return;
    const body: VideoPatch = action.kind === 'revise' ? { visual: { [action.key]: action.instruction } } : action.kind === 'fix' ? { fix: [action.key] } : { regenerate: [action.key] };
    this.rewriting.update((keys) => [...keys, action.key]);
    this.videos
      .update(this.projectId(), v.id, body)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (video) => {
          this.rewriting.update((keys) => keys.filter((k) => k !== action.key));
          const moved = shape(video) !== shape(this.video());
          this.apply(video);
          if (moved) this.loadPreview();
        },
        error: () => {
          this.rewriting.update((keys) => keys.filter((k) => k !== action.key));
          this.failed.emit('dashboard.showCommunication.video.errors.update');
        },
      });
  }

  /** La retouche écrite pour tout le film (« plus lent », « sans musique », « le titre de la scène 2… »). */
  protected sendInstruction(): void {
    const v = this.video();
    const text = this.instruction().trim();
    if (!v || text.length < 3 || this.saving()) return;
    this.saving.set('revise');
    this.reply.set(null);
    this.videos
      .revise(this.projectId(), v.id, text)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.saving.set(null);
          if (result.newRequest) {
            this.reply.set(this.translate.instant('dashboard.showCommunication.video.revise.newRequest'));
            return;
          }
          this.instruction.set('');
          this.reply.set(result.reply || this.translate.instant(result.video ? 'dashboard.showCommunication.video.revise.done' : 'dashboard.showCommunication.video.revise.notUnderstood'));
          if (result.video) {
            const moved = shape(result.video) !== shape(this.video());
            this.apply(result.video);
            if (moved || result.report.voiced.length) this.loadPreview();
          }
        },
        error: () => {
          this.saving.set(null);
          this.failed.emit('dashboard.showCommunication.video.errors.update');
        },
      });
  }

  protected pickPhoto(key: string, input: HTMLInputElement): void {
    this.replacing = key;
    input.click();
  }

  /** Une autre photo pour une scène : importée, montrée tout de suite, puis enregistrée. */
  protected onPhoto(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    const key = this.replacing;
    if (!file || !key || this.saving()) return;
    this.saving.set('photo');
    this.videos
      .uploadMedia(this.projectId(), [file])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ assets }) => {
          this.saving.set(null);
          if (assets[0]?.url) this.patch('photo', { images: { [key]: assets[0].url } });
        },
        error: () => {
          this.saving.set(null);
          this.failed.emit('dashboard.showCommunication.video.errors.update');
        },
      });
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

  /** Voix off : la couper la garde ; l'ajouter l'écrit et l'enregistre (le minutage se recale). */
  protected toggleVoice(enabled: boolean): void {
    this.patch('voice', { voice: enabled });
  }

  /** Sous-titres de la voix off : posés au-dessus des scènes, sans toucher à leur code. */
  protected toggleCaptions(enabled: boolean): void {
    this.patch('captions', { captions: enabled });
  }

  protected copyCredit(): void {
    const credit = this.video()?.music?.attribution;
    if (!credit || !navigator.clipboard) return;
    void navigator.clipboard.writeText(credit).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    });
  }

  private patch(kind: SavingKind, body: VideoPatch): void {
    const v = this.video();
    if (!v || this.saving()) return;
    this.saving.set(kind);
    this.videos
      .update(this.projectId(), v.id, body)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (video) => {
          this.saving.set(null);
          const moved = shape(video) !== shape(v);
          this.apply(video);
          // Un texte ou une photo est déjà à l'écran (pont d'édition) : on ne recompose l'aperçu
          // que si le film a changé ; la musique, les effets et la voix, toujours.
          if ((kind !== 'texts' && kind !== 'photo') || moved) this.loadPreview();
          const queued = this.queuedTexts;
          this.queuedTexts = null;
          if (queued) this.saveTexts(queued);
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
    if (!v || !scope || this.exporting() || this.rendering() || this.broken().length) return;
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
          this.failed.emit(err?.error?.error === 'scene_errors' ? 'dashboard.showCommunication.video.errors.sceneErrors' : 'dashboard.showCommunication.video.errors.export');
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

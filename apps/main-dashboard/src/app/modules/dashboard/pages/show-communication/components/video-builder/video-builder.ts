import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { MotionVideoService } from '../../../../services/ai-agents/motion-video.service';
import { VideoComposing, VideoProgressState } from '../video-composing/video-composing';
import {
  MotionStyle,
  MotionVideo,
  MusicMood,
  priceVideo,
  VideoDuration,
  VideoFormat,
  VideoObjective,
  VideoOptions,
  VideoQuality,
  VideoScope,
  VideoMediaAsset,
  VideoMediaKind,
  VideoType,
} from '../../../../models/motion-video.model';

const OBJECTIVES: { id: VideoObjective; icon: string }[] = [
  { id: 'promotion', icon: 'pi pi-tag' },
  { id: 'product', icon: 'pi pi-box' },
  { id: 'announce', icon: 'pi pi-megaphone' },
  { id: 'event', icon: 'pi pi-calendar' },
  { id: 'opening', icon: 'pi pi-shop' },
  { id: 'testimonial', icon: 'pi pi-comments' },
  { id: 'recruitment', icon: 'pi pi-users' },
];

/** La forme réelle de chaque format, et où on le publie. */
const FORMATS: { id: VideoFormat; ratio: string; icons: string[] }[] = [
  { id: 'story', ratio: '9 / 16', icons: ['pi pi-whatsapp', 'pi pi-instagram', 'pi pi-tiktok'] },
  { id: 'square', ratio: '1 / 1', icons: ['pi pi-instagram', 'pi pi-facebook'] },
  { id: 'portrait', ratio: '4 / 5', icons: ['pi pi-instagram', 'pi pi-facebook'] },
  { id: 'landscape', ratio: '16 / 9', icons: ['pi pi-youtube', 'pi pi-linkedin', 'pi pi-globe'] },
];

const MOODS: MusicMood[] = ['auto', 'upbeat', 'afro', 'calm', 'epic', 'corporate', 'none'];

/** Ce que chaque type de média accepte à l'import. */
const MEDIA_INPUTS: { kind: VideoMediaKind; icon: string; accept: string }[] = [
  { kind: 'image', icon: 'pi pi-camera', accept: 'image/jpeg,image/png,image/webp' },
  { kind: 'video', icon: 'pi pi-video', accept: 'video/mp4,video/quicktime,video/webm' },
  { kind: 'model3d', icon: 'pi pi-box', accept: '.glb,model/gltf-binary' },
  { kind: 'lottie', icon: 'pi pi-sparkles', accept: '.json,application/json' },
];

const MAX_MEDIA = 8;

/**
 * Créer une vidéo en quatre étapes : le TYPE de motion, QUOI annoncer, les
 * DÉTAILS (et les médias de l'utilisateur), puis le PÉRIMÈTRE.
 *
 * Le périmètre (durée, formats, qualité) fixe le prix, affiché en direct à
 * partir du barème de l'API : on sait ce qu'on paie avant de cliquer.
 */
@Component({
  selector: 'app-video-builder',
  imports: [FormsModule, TranslateModule, IdemLoaderComponent, VideoComposing],
  templateUrl: './video-builder.html',
  styleUrls: ['../visual-builder/visual-builder.css', './video-builder.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VideoBuilder {
  private readonly videos = inject(MotionVideoService);
  private readonly destroyRef = inject(DestroyRef);

  readonly projectId = input.required<string>();
  readonly options = input.required<VideoOptions>();

  readonly created = output<MotionVideo>();
  readonly cancelled = output<void>();
  readonly failed = output<string>();
  readonly needsCredits = output<{ cost: number; balance: number }>();

  protected readonly objectives = OBJECTIVES;
  protected readonly formatChoices = FORMATS;
  protected readonly moods = MOODS;
  protected readonly qualities: VideoQuality[] = ['standard', 'hd', 'premium'];
  protected readonly mediaInputs = MEDIA_INPUTS;
  protected readonly steps = [1, 2, 3, 4];

  protected readonly step = signal(1);
  protected readonly type = signal<VideoType | null>(null);
  protected readonly media = signal<VideoMediaAsset[]>([]);
  protected readonly allowStock = signal(true);
  protected readonly allowGenerate = signal(true);
  protected readonly sfx = signal(true);
  protected readonly types = computed(() => this.options().types);
  protected readonly typeDef = computed(() => this.types().find((t) => t.id === this.type()) ?? null);
  protected readonly objective = signal<VideoObjective | null>(null);
  protected readonly message = signal('');
  protected readonly details = signal('');
  protected readonly uploading = signal(false);
  protected readonly duration = signal<VideoDuration>(15);
  protected readonly formats = signal<VideoFormat[]>(['story']);
  protected readonly quality = signal<VideoQuality>('hd');
  protected readonly mood = signal<MusicMood>('auto');
  protected readonly style = signal<MotionStyle | 'auto'>('auto');
  protected readonly busy = signal(false);
  /** Étapes réelles reçues du serveur pendant la création. */
  protected readonly progress = signal<VideoProgressState>({});

  protected readonly durations = computed(() => this.typeDef()?.durations ?? this.options().pricing.durations);
  protected readonly styles = computed(() => this.options().styles);

  protected readonly scope = computed<VideoScope>(() => ({
    durationSec: this.duration(),
    formats: this.formats(),
    quality: this.quality(),
  }));

  protected readonly price = computed(() => priceVideo(this.options().pricing, this.scope()));
  protected readonly referencePrice = computed(() => this.options().pricing.referenceCost);

  protected readonly canAdvance = computed(() => {
    switch (this.step()) {
      case 1:
        return !!this.type();
      case 2:
        return !!this.objective();
      case 3:
        return this.message().trim().length >= 3 && !this.uploading();
      default:
        return this.formats().length > 0 && !this.busy();
    }
  });

  protected chooseType(id: VideoType): void {
    this.type.set(id);
    // Une durée hors des durées du type (révélation de logo : 6 ou 15 s) est ramenée.
    const allowed = this.types().find((t) => t.id === id)?.durations;
    if (allowed && !allowed.includes(this.duration())) this.duration.set(allowed[allowed.length - 1]);
    this.step.set(2);
  }

  protected chooseObjective(id: VideoObjective): void {
    this.objective.set(id);
    this.step.set(3);
  }

  protected next(): void {
    if (this.canAdvance()) this.step.update((s) => Math.min(4, s + 1));
  }

  protected mediaOf(kind: VideoMediaKind): VideoMediaAsset[] {
    return this.media().filter((m) => m.kind === kind);
  }

  protected back(): void {
    if (this.step() === 1) {
      this.cancelled.emit();
      return;
    }
    this.step.update((s) => Math.max(1, s - 1));
  }

  protected goTo(step: number): void {
    if (step < this.step()) this.step.set(step);
  }

  protected toggleFormat(format: VideoFormat): void {
    const current = this.formats();
    if (current.includes(format)) {
      // Au moins un format : on ne retire pas le dernier.
      if (current.length > 1) this.formats.set(current.filter((f) => f !== format));
    } else {
      this.formats.set([...current, format]);
    }
  }

  protected onFiles(event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    const files = Array.from(inputEl.files || []).slice(0, MAX_MEDIA - this.media().length);
    inputEl.value = '';
    if (!files.length) return;
    this.uploading.set(true);
    this.videos
      .uploadMedia(this.projectId(), files)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ assets }) => {
          this.media.update((list) => [...list, ...assets].slice(0, MAX_MEDIA));
          this.uploading.set(false);
        },
        error: () => {
          this.uploading.set(false);
          this.failed.emit('dashboard.showCommunication.video.errors.upload');
        },
      });
  }

  protected removeMedia(id: string): void {
    this.media.update((list) => list.filter((m) => m.id !== id));
  }

  protected submit(): void {
    const objective = this.objective();
    const type = this.type();
    if (!objective || !type || this.busy() || !this.canAdvance()) return;
    this.busy.set(true);
    this.progress.set({});
    let finished = false;
    this.videos
      .createStream(this.projectId(), {
        brief: {
          objective,
          message: this.message().trim(),
          details: this.details().trim() || undefined,
          musicMood: this.mood(),
          style: this.style(),
          media: this.media(),
          allowStock: this.allowStock(),
          allowGenerate: this.allowGenerate(),
          sfx: this.sfx(),
        },
        scope: this.scope(),
        type,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (event) => {
          if (event.type === 'progress') {
            this.progress.update((p) => ({ ...p, [event.stage]: { state: event.state, data: event.data } }));
          } else if (event.type === 'complete') {
            finished = true;
            this.busy.set(false);
            this.created.emit(event.video);
          } else {
            finished = true;
            this.busy.set(false);
            if (event.status === 402) {
              this.needsCredits.emit({ cost: event.cost ?? this.price(), balance: event.balance ?? 0 });
              return;
            }
            this.failed.emit('dashboard.showCommunication.video.errors.create');
          }
        },
        complete: () => {
          // Flux coupé sans conclusion (réseau) : on le dit plutôt que de laisser tourner.
          if (!finished) {
            this.busy.set(false);
            this.failed.emit('dashboard.showCommunication.video.errors.create');
          }
        },
      });
  }
}

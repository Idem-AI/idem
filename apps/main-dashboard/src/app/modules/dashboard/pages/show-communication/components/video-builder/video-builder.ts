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
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { CreativityLevel, creativityCost, DEFAULT_CREATIVITY } from '@idem/shared-models';
import { CreativityPickerComponent } from '../../../../../../shared/components/creativity-picker/creativity-picker';
import { MotionVideoService } from '../../../../services/ai-agents/motion-video.service';
import { VideoComposing, VideoProgressState } from '../video-composing/video-composing';
import {
  MotionVideo,
  MusicMood,
  priceVideo,
  VideoDuration,
  VideoFormat,
  VideoMediaAsset,
  VideoMediaKind,
  VideoOptions,
  VideoQuality,
  VideoScope,
  VideoType,
} from '../../../../models/motion-video.model';

/** La forme réelle de chaque format, et où on le publie. */
const FORMATS: { id: VideoFormat; ratio: string; icons: string[] }[] = [
  { id: 'story', ratio: '9 / 16', icons: ['pi pi-whatsapp', 'pi pi-instagram', 'pi pi-tiktok'] },
  { id: 'square', ratio: '1 / 1', icons: ['pi pi-instagram', 'pi pi-facebook'] },
  { id: 'portrait', ratio: '4 / 5', icons: ['pi pi-instagram', 'pi pi-facebook'] },
  { id: 'landscape', ratio: '16 / 9', icons: ['pi pi-youtube', 'pi pi-linkedin', 'pi pi-globe'] },
];

const MOODS: { id: MusicMood; icon: string }[] = [
  { id: 'auto', icon: 'pi pi-sparkles' },
  { id: 'upbeat', icon: 'pi pi-bolt' },
  { id: 'afro', icon: 'pi pi-sun' },
  { id: 'calm', icon: 'pi pi-moon' },
  { id: 'epic', icon: 'pi pi-star' },
  { id: 'corporate', icon: 'pi pi-briefcase' },
  { id: 'none', icon: 'pi pi-volume-off' },
];

/** Tout ce que la vidéo sait utiliser, en un seul bouton « joindre ». */
const MEDIA_ACCEPT = 'image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm,.glb,.json,.lottie,.riv';
const MEDIA_ICON: Record<VideoMediaKind, string> = {
  image: 'pi pi-image',
  video: 'pi pi-video',
  model3d: 'pi pi-box',
  lottie: 'pi pi-sparkles',
  rive: 'pi pi-play-circle',
};

const MAX_MEDIA = 8;
const EXAMPLES = ['ex1', 'ex2', 'ex3'];

/**
 * Créer une vidéo en DEUX temps.
 *
 * 1. Décrire : un espace de discussion. L'utilisateur dit ce qu'il veut, avec ses
 *    mots, et joint ses médias. Le modèle choisit le type de vidéo — ou en combine
 *    plusieurs, une partie en 3D, une autre en clips… — d'après la demande.
 * 2. Configurer : où la publier, combien de temps, quelle qualité, quelle musique.
 *    Le reste (direction de motion, effets, banques d'images) est replié : les
 *    bons réglages sont déjà posés. Le prix se met à jour en direct.
 */
@Component({
  selector: 'app-video-builder',
  imports: [FormsModule, TranslateModule, IdemLoaderComponent, VideoComposing, CreativityPickerComponent],
  templateUrl: './video-builder.html',
  styleUrls: ['../visual-builder/visual-builder.css', './video-builder.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VideoBuilder {
  private readonly videos = inject(MotionVideoService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translate = inject(TranslateService);

  readonly projectId = input.required<string>();
  readonly options = input.required<VideoOptions>();

  readonly created = output<MotionVideo>();
  readonly cancelled = output<void>();
  readonly failed = output<string>();
  readonly needsCredits = output<{ cost: number; balance: number }>();

  protected readonly formatChoices = FORMATS;
  protected readonly moods = MOODS;
  protected readonly qualities: VideoQuality[] = ['standard', 'hd', 'premium'];
  protected readonly mediaAccept = MEDIA_ACCEPT;
  protected readonly mediaIcon = MEDIA_ICON;
  protected readonly examples = EXAMPLES;
  protected readonly maxMedia = MAX_MEDIA;

  protected readonly step = signal<1 | 2>(1);
  protected readonly request = signal('');
  protected readonly media = signal<VideoMediaAsset[]>([]);
  protected readonly uploading = signal(false);
  /** « auto » : le modèle choisit. Un type précis seulement si l'utilisateur l'impose. */
  protected readonly type = signal<VideoType | 'auto'>('auto');
  protected readonly showTypes = signal(false);
  protected readonly types = computed(() => this.options().types);

  protected readonly duration = signal<VideoDuration>(15);
  protected readonly formats = signal<VideoFormat[]>(['story']);
  protected readonly quality = signal<VideoQuality>('hd');
  protected readonly mood = signal<MusicMood>('auto');
  protected readonly direction = signal<string>('auto');
  protected readonly directions = computed(() => this.options().directions ?? ['auto']);
  protected readonly sfx = signal(true);
  /** Voix off : choisie par l'utilisateur, jamais imposée. */
  protected readonly voice = signal(false);
  protected readonly allowStock = signal(true);
  protected readonly allowGenerate = signal(true);
  protected readonly showMore = signal(false);

  protected readonly busy = signal(false);
  /** Étapes réelles reçues du serveur pendant la création. */
  protected readonly progress = signal<VideoProgressState>({});

  protected readonly durations = computed<VideoDuration[]>(() => {
    const t = this.type();
    const forced = t !== 'auto' ? this.types().find((d) => d.id === t)?.durations : undefined;
    return forced ?? this.options().pricing.durations;
  });

  protected readonly scope = computed<VideoScope>(() => ({
    durationSec: this.duration(),
    formats: this.formats(),
    quality: this.quality(),
  }));
  /** Prix du périmètre (cran Low / Medium), puis celui du cran de créativité choisi. */
  protected readonly basePrice = computed(() => priceVideo(this.options().pricing, this.scope()));
  protected readonly creativity = signal<CreativityLevel>(DEFAULT_CREATIVITY);
  protected readonly price = computed(() => creativityCost(this.basePrice(), this.creativity()));

  protected readonly canNext = computed(() => this.request().trim().length >= 8 && !this.uploading() && !this.enhancing());

  /** « Améliorer ma demande » : la version d'avant reste à un clic. */
  protected readonly enhancing = signal(false);
  protected readonly previousRequest = signal<string | null>(null);
  protected readonly canEnhance = computed(() => this.request().trim().length >= 3 && !this.enhancing());
  protected readonly canSubmit = computed(() => this.formats().length > 0 && !this.busy());

  // ── 1. Décrire ───────────────────────────────────────────────────────────

  protected useExample(key: string): void {
    this.request.set(this.translate.instant(`dashboard.showCommunication.video.builder.chat.examples.${key}`));
  }

  protected enhance(): void {
    if (!this.canEnhance()) return;
    const before = this.request();
    this.enhancing.set(true);
    this.videos
      .enhanceRequest(this.projectId(), before.trim(), this.media())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ prompt }) => {
          this.enhancing.set(false);
          if (prompt && prompt.trim() !== before.trim()) {
            this.previousRequest.set(before);
            this.request.set(prompt);
          }
        },
        error: () => {
          this.enhancing.set(false);
          this.failed.emit('dashboard.showCommunication.video.errors.enhance');
        },
      });
  }

  protected restoreRequest(): void {
    const before = this.previousRequest();
    if (before == null) return;
    this.request.set(before);
    this.previousRequest.set(null);
  }

  protected chooseType(id: VideoType | 'auto'): void {
    this.type.set(id);
    const allowed = this.durations();
    if (!allowed.includes(this.duration())) this.duration.set(allowed[allowed.length - 1]);
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

  protected next(): void {
    if (this.canNext()) this.step.set(2);
  }

  protected back(): void {
    if (this.step() === 1) this.cancelled.emit();
    else this.step.set(1);
  }

  // ── 2. Configurer ────────────────────────────────────────────────────────

  protected toggleFormat(format: VideoFormat): void {
    const current = this.formats();
    if (current.includes(format)) {
      // Au moins un format : on ne retire pas le dernier.
      if (current.length > 1) this.formats.set(current.filter((f) => f !== format));
    } else {
      this.formats.set([...current, format]);
    }
  }

  protected submit(): void {
    if (!this.canSubmit()) return;
    // Une demande longue : la première phrase sert de message, le tout de détails.
    const text = this.request().trim();
    const message = text.length <= 400 ? text : text.slice(0, 400).replace(/\s+\S*$/, '');
    this.busy.set(true);
    this.progress.set({});
    let finished = false;
    this.videos
      .createStream(this.projectId(), {
        brief: {
          message,
          details: text.length > message.length ? text.slice(0, 800) : undefined,
          musicMood: this.mood(),
          direction: this.direction() === 'auto' ? undefined : this.direction(),
          media: this.media(),
          allowStock: this.allowStock(),
          allowGenerate: this.allowGenerate(),
          sfx: this.sfx(),
          voice: this.voice(),
        },
        scope: this.scope(),
        type: this.type(),
        creativity: this.creativity(),
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

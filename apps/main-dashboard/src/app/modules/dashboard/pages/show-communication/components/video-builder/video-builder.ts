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

/**
 * Créer une vidéo en trois questions : QUOI, les DÉTAILS, et le PÉRIMÈTRE.
 *
 * Le périmètre (durée, formats, qualité) fixe le prix, affiché en direct à
 * partir du barème de l'API : on sait ce qu'on paie avant de cliquer.
 */
@Component({
  selector: 'app-video-builder',
  imports: [FormsModule, TranslateModule, IdemLoaderComponent],
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

  protected readonly step = signal(1);
  protected readonly objective = signal<VideoObjective | null>(null);
  protected readonly message = signal('');
  protected readonly details = signal('');
  protected readonly photos = signal<string[]>([]);
  protected readonly uploading = signal(false);
  protected readonly duration = signal<VideoDuration>(15);
  protected readonly formats = signal<VideoFormat[]>(['story']);
  protected readonly quality = signal<VideoQuality>('hd');
  protected readonly mood = signal<MusicMood>('auto');
  protected readonly style = signal<MotionStyle | 'auto'>('auto');
  protected readonly busy = signal(false);

  protected readonly durations = computed(() => this.options().pricing.durations);
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
        return !!this.objective();
      case 2:
        return this.message().trim().length >= 3 && !this.uploading();
      default:
        return this.formats().length > 0 && !this.busy();
    }
  });

  protected chooseObjective(id: VideoObjective): void {
    this.objective.set(id);
    this.step.set(2);
  }

  protected next(): void {
    if (this.canAdvance()) this.step.update((s) => Math.min(3, s + 1));
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

  protected onPhotos(event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    const files = Array.from(inputEl.files || []).slice(0, 6 - this.photos().length);
    inputEl.value = '';
    if (!files.length) return;
    this.uploading.set(true);
    this.videos
      .uploadPhotos(this.projectId(), files)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ urls }) => {
          this.photos.update((list) => [...list, ...urls].slice(0, 6));
          this.uploading.set(false);
        },
        error: () => {
          this.uploading.set(false);
          this.failed.emit('dashboard.showCommunication.video.errors.upload');
        },
      });
  }

  protected removePhoto(url: string): void {
    this.photos.update((list) => list.filter((u) => u !== url));
  }

  protected submit(): void {
    const objective = this.objective();
    if (!objective || this.busy() || !this.canAdvance()) return;
    this.busy.set(true);
    this.videos
      .create(this.projectId(), {
        brief: {
          objective,
          message: this.message().trim(),
          details: this.details().trim() || undefined,
          musicMood: this.mood(),
          style: this.style(),
          imageUrls: this.photos(),
        },
        scope: this.scope(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (video) => {
          this.busy.set(false);
          this.created.emit(video);
        },
        error: (err) => {
          this.busy.set(false);
          if (err?.status === 402) {
            this.needsCredits.emit({ cost: err.error?.cost ?? this.price(), balance: err.error?.balance ?? 0 });
            return;
          }
          this.failed.emit('dashboard.showCommunication.video.errors.create');
        },
      });
  }
}

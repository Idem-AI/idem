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
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { MotionVideoService } from '../../../../services/ai-agents/motion-video.service';
import { ivisionUrl } from '../../../../../../shared/utils/app-redirect';
import { MotionVideo, VideoOptions } from '../../../../models/motion-video.model';
import { VideoBuilder } from '../video-builder/video-builder';
import { VideoKora } from '../video-kora/video-kora';
import { urlFlag } from '../../url-state';
import { WriteOnlyDirective } from '../../../../../team/directives/write-only.directive';

type View = { kind: 'list' } | { kind: 'create' };

/**
 * MES VIDÉOS — vidéos de promotion en motion design, à la charte.
 *
 * Deux vues : la liste et la création en trois questions. Une vidéo s'ouvre sur
 * SA PROPRE PAGE (`/project/communication/videos/:id`, `VideoPage`).
 */
@Component({
  selector: 'app-video-panel',
  imports: [WriteOnlyDirective, TranslateModule, IdemLoaderComponent, VideoBuilder, VideoKora],
  templateUrl: './video-panel.html',
  styleUrl: './video-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VideoPanel {
  private readonly service = inject(MotionVideoService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);

  readonly projectId = input.required<string>();
  /** La même vidéo dans iVision (conversation), avec la charte de ce projet importée. */
  protected readonly ivisionLink = computed(() => `${ivisionUrl()}/studio/video?project=${encodeURIComponent(this.projectId())}`);
  /** Vidéo à ouvrir dès qu'elle est chargée (depuis le calendrier). */
  readonly openVideoId = input<string | null>(null);
  readonly openHandled = output<void>();
  readonly failed = output<string>();
  readonly needsCredits = output<{ cost: number; balance: number }>();

  /** La création en cours : `?new=1` (une actualisation y reste). */
  private readonly creating = urlFlag('new', { push: true });
  protected readonly view = computed<View>(() => (this.creating() ? { kind: 'create' } : { kind: 'list' }));
  protected readonly videos = signal<MotionVideo[]>([]);
  protected readonly options = signal<VideoOptions | null>(null);
  protected readonly loading = signal(true);

  constructor() {
    effect(() => {
      const projectId = this.projectId();
      untracked(() => this.load(projectId));
    });
    // Une vidéo demandée depuis le calendrier s'ouvre dès que la liste est là.
    effect(() => {
      const id = this.openVideoId();
      if (!id || this.loading()) return;
      untracked(() => {
        this.openHandled.emit();
        this.openPage(id);
      });
    });
  }

  private load(projectId: string): void {
    this.loading.set(true);
    forkJoin({ options: this.service.options(projectId), videos: this.service.list(projectId) })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ options, videos }) => {
          this.options.set(options);
          this.videos.set(this.sorted(videos));
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.failed.emit('dashboard.showCommunication.video.errors.load');
        },
      });
  }

  private sorted(videos: MotionVideo[]): MotionVideo[] {
    return [...videos].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }

  protected open(video: MotionVideo): void {
    this.openPage(video.id);
  }

  /** Une vidéo s'ouvre sur sa propre page. */
  private openPage(videoId: string): void {
    this.router.navigate(['/project/communication/videos', videoId]);
  }

  protected create(): void {
    this.creating.set(true);
  }

  protected toList(): void {
    this.creating.set(false);
  }

  protected onCreated(video: MotionVideo): void {
    this.videos.set(this.sorted([video, ...this.videos().filter((v) => v.id !== video.id)]));
    this.openPage(video.id);
  }

  /**
   * La miniature d'une vidéo : l'image de son MP4 exporté, sinon la vignette d'une scène (prise au contrôle
   * des scènes — le serveur photographie en tâche de fond celles qui n'en ont pas), sinon une de ses images.
   */
  protected poster(video: MotionVideo): string | undefined {
    return (
      video.renders.find((r) => r.status === 'done' && r.posterUrl)?.posterUrl ||
      video.film?.scenes.find((s) => s.thumbnail)?.thumbnail ||
      video.media?.find((m) => m.kind === 'image')?.url ||
      video.media?.find((m) => m.posterUrl)?.posterUrl
    );
  }

  /** Miniature introuvable (lien expiré) : la carte titrée prend le relais. */
  protected readonly brokenPosters = signal<ReadonlySet<string>>(new Set());

  protected posterFailed(video: MotionVideo): void {
    this.brokenPosters.update((set) => new Set([...set, video.id]));
  }
}

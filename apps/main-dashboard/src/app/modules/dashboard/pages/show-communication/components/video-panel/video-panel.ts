import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { MotionVideoService } from '../../../../services/ai-agents/motion-video.service';
import { MotionVideo, VideoOptions } from '../../../../models/motion-video.model';
import { VideoBuilder } from '../video-builder/video-builder';
import { VideoDetail } from '../video-detail/video-detail';
import { VideoKora } from '../video-kora/video-kora';

type View = { kind: 'list' } | { kind: 'create' } | { kind: 'detail'; videoId: string };

/**
 * MES VIDÉOS — vidéos de promotion en motion design, à la charte.
 *
 * Trois vues : la liste, la création en trois questions, et la vidéo (aperçu,
 * retouches gratuites, export MP4).
 */
@Component({
  selector: 'app-video-panel',
  imports: [TranslateModule, IdemLoaderComponent, VideoBuilder, VideoDetail, VideoKora],
  templateUrl: './video-panel.html',
  styleUrl: './video-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VideoPanel {
  private readonly service = inject(MotionVideoService);
  private readonly destroyRef = inject(DestroyRef);

  readonly projectId = input.required<string>();
  readonly failed = output<string>();
  readonly needsCredits = output<{ cost: number; balance: number }>();

  protected readonly view = signal<View>({ kind: 'list' });
  protected readonly videos = signal<MotionVideo[]>([]);
  protected readonly options = signal<VideoOptions | null>(null);
  protected readonly loading = signal(true);

  constructor() {
    effect(() => {
      const projectId = this.projectId();
      untracked(() => this.load(projectId));
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
    this.view.set({ kind: 'detail', videoId: video.id });
  }

  protected create(): void {
    this.view.set({ kind: 'create' });
  }

  protected toList(): void {
    this.view.set({ kind: 'list' });
  }

  protected onCreated(video: MotionVideo): void {
    this.videos.set(this.sorted([video, ...this.videos().filter((v) => v.id !== video.id)]));
    this.view.set({ kind: 'detail', videoId: video.id });
  }

  protected onChanged(video: MotionVideo): void {
    this.videos.update((list) => list.map((v) => (v.id === video.id ? video : v)));
  }

  protected onDeleted(videoId: string): void {
    this.videos.update((list) => list.filter((v) => v.id !== videoId));
    this.view.set({ kind: 'list' });
  }

  protected poster(video: MotionVideo): string | undefined {
    return video.renders.find((r) => r.status === 'done' && r.posterUrl)?.posterUrl;
  }

  protected detailId(): string | null {
    const view = this.view();
    return view.kind === 'detail' ? view.videoId : null;
  }
}

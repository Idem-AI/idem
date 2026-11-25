import { ChangeDetectionStrategy, Component, DestroyRef, DOCUMENT, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { CookieService } from '../../../../../shared/services/cookie.service';
import { MotionVideoService } from '../../../services/ai-agents/motion-video.service';
import { VideoOptions } from '../../../models/motion-video.model';
import { VideoDetail } from '../components/video-detail/video-detail';

/**
 * UNE VIDÉO, sur sa propre page (`/project/communication/videos/:videoId`) : un lien qui s'ouvre, se partage, se
 * retrouve par « Précédent ». Le détail (lecteur, retouches, téléchargement) est le composant `VideoDetail` ; la
 * page donne le projet, les prix, et le bandeau d'erreur / de crédits de la page Communication.
 */
@Component({
  selector: 'app-video-page',
  imports: [TranslateModule, IdemLoaderComponent, VideoDetail],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div>
      @if (errorMessage()) {
        <div class="glass m-3 flex items-start gap-2 rounded-xl border border-[var(--color-danger)]/40 px-3 py-2 text-sm text-[var(--color-danger)]" role="alert">
          <i class="pi pi-exclamation-triangle mt-0.5" aria-hidden="true"></i>
          <div class="flex-1">
            <p>{{ errorMessage() | translate }}</p>
            @if (creditsNeeded(); as credits) {
              <p class="mt-1 text-xs">{{ 'dashboard.showCommunication.errors.creditsDetail' | translate: { cost: credits.cost, balance: credits.balance } }}</p>
              <button type="button" class="inner-button button-sm mt-2" (click)="goToBilling()">
                <i class="pi pi-wallet" aria-hidden="true"></i>
                {{ 'dashboard.showCommunication.errors.topUp' | translate }}
              </button>
            }
          </div>
          <button type="button" class="button-icon" [attr.aria-label]="'common.close' | translate" (click)="errorMessage.set('')">
            <i class="pi pi-times" aria-hidden="true"></i>
          </button>
        </div>
      }

      @if (projectId() && options() && videoId()) {
        <app-video-detail
          [projectId]="projectId()!"
          [videoId]="videoId()!"
          [options]="options()!"
          (back)="toList()"
          (deleted)="toList()"
          (failed)="onError($event)"
          (needsCredits)="onNeedsCredits($event)"
        />
      } @else if (!errorMessage()) {
        <idem-loader block [label]="'common.loading' | translate" />
      }
    </div>
  `,
})
export class VideoPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cookies = inject(CookieService);
  private readonly videos = inject(MotionVideoService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly projectId = signal<string | null>(this.cookies.get('projectId'));
  protected readonly videoId = signal<string | null>(null);
  protected readonly options = signal<VideoOptions | null>(null);
  protected readonly errorMessage = signal('');
  protected readonly creditsNeeded = signal<{ cost: number; balance: number } | null>(null);

  constructor() {
    // Toute la place pour la vidéo : la mise en page retire ses marges et son cadre tant que cette page est ouverte.
    const root = inject(DOCUMENT).documentElement;
    root.classList.add('idem-flush');
    this.destroyRef.onDestroy(() => root.classList.remove('idem-flush'));
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.videoId.set(params.get('videoId'));
      this.errorMessage.set('');
    });
    const projectId = this.projectId();
    if (!projectId) {
      this.router.navigate(['/projects']);
      return;
    }
    this.videos
      .options(projectId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (options) => this.options.set(options),
        error: () => this.errorMessage.set('dashboard.showCommunication.video.errors.load'),
      });
  }

  /** Retour à « Mes vidéos » de la page Communication. */
  protected toList(): void {
    this.router.navigate(['/project/communication'], { queryParams: { screen: 'videos' } });
  }

  protected onError(message: string): void {
    this.creditsNeeded.set(null);
    this.errorMessage.set(message);
  }

  protected onNeedsCredits(detail: { cost: number; balance: number }): void {
    this.errorMessage.set('dashboard.showCommunication.errors.credits');
    this.creditsNeeded.set(detail);
  }

  protected goToBilling(): void {
    this.router.navigate(['/account']);
  }
}

import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { ApiService } from '../../../core/api.service';
import { MotionVideo } from '../../../core/models';

const RATIOS: Record<string, string> = { story: '9 / 16', square: '1 / 1', portrait: '4 / 5', landscape: '16 / 9' };

/** Une vidéo produite dans la conversation : l'aperçu à la demande, puis l'éditeur. */
@Component({
  selector: 'iv-video-result',
  imports: [RouterLink, TranslateModule, IdemLoaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mt-3 flex flex-col gap-3">
      @if (html(); as h) {
        <div class="w-full max-w-xs overflow-hidden rounded-xl border border-[var(--glass-border-subtle)]" [style.aspect-ratio]="ratio()">
          <iframe class="h-full w-full border-0" sandbox="allow-scripts" [srcdoc]="h" [attr.title]="'chat.result.previewTitle' | translate"></iframe>
        </div>
      } @else if (loading()) {
        <idem-loader size="sm" />
      }
      <div class="flex flex-wrap gap-2">
        @if (!html()) {
          <button type="button" class="outer-button button-sm" (click)="loadPreview()" [disabled]="loading()">
            <i class="pi pi-play" aria-hidden="true"></i> {{ 'chat.result.watch' | translate }}
          </button>
        }
        <a class="inner-button button-sm" [routerLink]="['/studio/video', brandId(), videoId()]">
          <i class="pi pi-pencil" aria-hidden="true"></i> {{ 'chat.result.edit' | translate }}
        </a>
      </div>
      @if (video()?.storyboard?.creative?.reference; as ref) {
        <p class="text-xs text-[var(--color-text-tertiary)]">{{ 'chat.result.fromReference' | translate: { shots: ref.shots } }}</p>
      }
    </div>
  `,
})
export class VideoResult {
  private readonly api = inject(ApiService);
  private readonly sanitizer = inject(DomSanitizer);
  readonly brandId = input.required<string>();
  readonly videoId = input.required<string>();
  readonly video = input<MotionVideo | undefined>();

  protected readonly html = signal<SafeHtml | null>(null);
  protected readonly loading = signal(false);
  protected readonly ratio = computed(() => RATIOS[this.video()?.scope.formats[0] ?? 'story'] ?? '9 / 16');

  protected loadPreview(): void {
    this.loading.set(true);
    this.api.preview(this.brandId(), this.videoId()).subscribe({
      next: ({ html }) => {
        // Page composée par l'API (textes échappés), jouée dans un iframe isolé (`allow-scripts` seul).
        this.html.set(this.sanitizer.bypassSecurityTrustHtml(html));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}

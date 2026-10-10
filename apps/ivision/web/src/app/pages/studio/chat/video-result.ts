import { ChangeDetectionStrategy, Component, ElementRef, OnInit, computed, inject, input, signal, viewChild } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { ApiService } from '../../../core/api.service';
import { MotionVideo } from '../../../core/models';

const RATIOS: Record<string, string> = { story: '9 / 16', square: '1 / 1', portrait: '4 / 5', landscape: '16 / 9' };

/**
 * Une vidéo produite dans la conversation. Dès qu'elle arrive à l'écran, son aperçu s'affiche
 * aux proportions du format : le MP4 exporté s'il est à jour (lecteur natif), sinon le lecteur
 * du moteur (le même que le rendu) — un clic lit la vidéo, « Plein écran » l'agrandit.
 */
@Component({
  selector: 'iv-video-result',
  imports: [RouterLink, TranslateModule, IdemLoaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .frame:fullscreen {
      width: 100vw;
      height: 100vh;
      max-width: none;
      aspect-ratio: auto !important;
      border: 0;
      border-radius: 0;
      background: var(--color-bg-dark);
    }
    .frame:fullscreen video {
      object-fit: contain;
    }
  `,
  template: `
    <div class="mt-3 flex flex-col items-start gap-3">
      <div #frame class="frame relative w-full overflow-hidden rounded-xl border border-[var(--glass-border-subtle)]" [style.aspect-ratio]="ratio()" [style.max-width]="maxWidth()">
        @if (mp4(); as file) {
          <video class="h-full w-full bg-[var(--color-bg-dark)]" [src]="file.url" [poster]="file.posterUrl || ''" controls playsinline preload="metadata"></video>
        } @else if (html(); as h) {
          <iframe class="h-full w-full border-0" sandbox="allow-scripts" allow="autoplay; fullscreen" [srcdoc]="h" [attr.title]="'chat.result.previewTitle' | translate"></iframe>
        } @else {
          <div class="skeleton flex h-full w-full items-center justify-center">
            @if (loading()) {
              <idem-loader size="sm" />
            } @else if (failed()) {
              <button type="button" class="outer-button button-sm" (click)="loadPreview()">
                <i class="pi pi-refresh" aria-hidden="true"></i> {{ 'chat.result.watch' | translate }}
              </button>
            }
          </div>
        }
      </div>
      <div class="flex flex-wrap gap-2">
        <button type="button" class="outer-button button-sm" (click)="toggleFullscreen()" [disabled]="!mp4() && !html()">
          <i class="pi pi-expand" aria-hidden="true"></i> {{ 'chat.result.fullscreen' | translate }}
        </button>
        @if (mp4()) {
          <button type="button" class="outer-button button-sm" (click)="download()" [disabled]="downloading()">
            @if (downloading()) {
              <idem-loader size="xs" />
            } @else {
              <i class="pi pi-download" aria-hidden="true"></i>
            }
            {{ 'chat.result.download' | translate }}
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
export class VideoResult implements OnInit {
  private readonly api = inject(ApiService);
  private readonly sanitizer = inject(DomSanitizer);
  readonly brandId = input.required<string>();
  readonly videoId = input.required<string>();
  readonly video = input<MotionVideo | undefined>();
  private readonly frame = viewChild.required<ElementRef<HTMLElement>>('frame');

  protected readonly html = signal<SafeHtml | null>(null);
  protected readonly loading = signal(false);
  protected readonly failed = signal(false);
  protected readonly downloading = signal(false);
  private readonly format = computed(() => this.video()?.scope.formats[0] ?? 'story');
  protected readonly ratio = computed(() => RATIOS[this.format()] ?? '9 / 16');
  /** Au plus 26rem de haut : un format vertical reste étroit, un paysage prend la largeur. */
  protected readonly maxWidth = computed(() => {
    const [w, h] = (this.ratio() || '9 / 16').split('/').map((n) => Number(n.trim()));
    return `min(100%, 34rem, calc(26rem * ${(w / h).toFixed(4)}))`;
  });
  /** Le MP4 exporté du format principal, s'il reflète la dernière retouche. */
  protected readonly mp4 = computed(() => {
    const v = this.video();
    if (!v || v.dirty) return null;
    return v.renders.find((r) => r.status === 'done' && r.url && r.format === this.format()) ?? null;
  });

  ngOnInit(): void {
    // Le composant n'est créé qu'une fois visible (`@defer (on viewport)` dans la conversation).
    if (!this.mp4()) this.loadPreview();
  }

  protected loadPreview(): void {
    this.loading.set(true);
    this.failed.set(false);
    this.api.preview(this.brandId(), this.videoId()).subscribe({
      next: ({ html }) => {
        // Page composée par l'API (textes échappés), jouée dans un iframe isolé (`allow-scripts` seul).
        this.html.set(this.sanitizer.bypassSecurityTrustHtml(html));
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.failed.set(true);
      },
    });
  }

  protected toggleFullscreen(): void {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void this.frame().nativeElement.requestFullscreen?.().catch(() => undefined);
  }

  protected download(): void {
    this.downloading.set(true);
    this.api.saveFile(`/brands/${this.brandId()}/videos/${this.videoId()}/file?format=${this.format()}`, `ivision-${this.format()}.mp4`).subscribe({
      next: () => this.downloading.set(false),
      error: () => this.downloading.set(false),
    });
  }
}

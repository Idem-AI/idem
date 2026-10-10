import { ChangeDetectionStrategy, Component, ElementRef, OnInit, computed, inject, input, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { EditTarget, FontHints, IdemDocumentPreviewComponent } from '@idem/shared-document-editor/angular';
import { VISUAL_PAGES } from '../visual-edit/visual-adapter';
import { TranslateModule } from '@ngx-translate/core';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { ApiService } from '../../../core/api.service';
import { Visual } from '../../../core/models';

/** Dimensions réelles des formats (celles du rendu, `core/src/visual/flyer.render.ts`). */
const SIZES: Record<string, [number, number]> = {
  square: [1080, 1080],
  story: [1080, 1920],
  banner: [1200, 630],
  post: [1200, 1500],
  a4: [1240, 1754],
};

/**
 * Un visuel produit dans la conversation, rendu par l'APERÇU ÉDITABLE PARTAGÉ d'IDEM
 * (`<idem-document-preview>`) : exactement le fichier produit, aux proportions du format.
 * Survoler cadre un élément ; cliquer ouvre « Modifier », qui mène à l'éditeur partagé SUR cet
 * élément — dans le chat comme dans la visionneuse modale. « Télécharger » enregistre le PNG.
 */
@Component({
  selector: 'iv-visual-result',
  imports: [TranslateModule, IdemLoaderComponent, IdemDocumentPreviewComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .lightbox {
      width: 100vw;
      height: 100dvh;
      max-width: none;
      max-height: none;
      margin: 0;
      padding: 0;
      border: 0;
      background: transparent;
      color: var(--color-text-primary);
    }
    .lightbox[open] {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 1rem;
      animation: lightbox-in 180ms ease-out;
    }
    .lightbox::backdrop {
      background: color-mix(in srgb, var(--color-bg-dark) 82%, transparent);
      backdrop-filter: blur(10px);
    }
    .lightbox-doc {
      max-width: 92vw;
      border-radius: 0.75rem;
      overflow: hidden;
      box-shadow: 0 24px 64px rgb(0 0 0 / 0.35);
    }
    .lightbox-bar {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.4rem;
      border-radius: 999px;
      background: color-mix(in srgb, var(--color-bg-dark) 70%, transparent);
      border: 1px solid var(--glass-border-subtle);
    }
    .lightbox-close {
      position: absolute;
      top: 1rem;
      right: 1rem;
    }
    @keyframes lightbox-in {
      from { opacity: 0; transform: scale(0.97); }
      to { opacity: 1; transform: none; }
    }
    @media (prefers-reduced-motion: reduce) {
      .lightbox[open] { animation: none; }
    }
  `,
  template: `
    <figure class="mt-3 flex flex-col items-start gap-2">
      <div class="overflow-hidden rounded-xl border border-[var(--glass-border-subtle)]" [style.width]="width()" [style.max-width.%]="100">
        <idem-document-preview
          [html]="html()"
          [section]="section()"
          [pageFormat]="page()"
          [fonts]="fonts()"
          [maxHeight]="448"
          [loading]="loading()"
          [failed]="loadFailed()"
          [showHint]="false"
          (editRequested)="edit($event)"
        />
      </div>
      <figcaption class="flex flex-wrap gap-2">
        <button type="button" class="outer-button button-sm" (click)="open()">
          <i class="pi pi-expand" aria-hidden="true"></i> {{ 'chat.result.fullscreen' | translate }}
        </button>
        <button type="button" class="outer-button button-sm" (click)="download()" [disabled]="downloading()">
          @if (downloading()) {
            <idem-loader size="xs" />
          } @else {
            <i class="pi pi-download" aria-hidden="true"></i>
          }
          {{ 'chat.result.download' | translate }}
        </button>
      </figcaption>
      @if (failed()) {
        <p class="text-xs text-[var(--color-text-tertiary)]" role="alert">{{ 'chat.result.downloadFailed' | translate }}</p>
      }
    </figure>

    <!-- La visionneuse : une fenêtre modale (Échap ou clic sur le fond pour fermer). -->
    <dialog #lightbox class="lightbox" [attr.aria-label]="visual().prompt" (click)="onBackdrop($event)" (close)="opened.set(false)">
      @if (opened()) {
        <button type="button" class="lightbox-close inner-button button-sm" (click)="close()" [attr.aria-label]="'chat.result.close' | translate">
          <i class="pi pi-times" aria-hidden="true"></i>
        </button>
        <div class="lightbox-doc" [style.width]="lightboxWidth()">
          <idem-document-preview
            [html]="html()"
            [section]="section()"
            [pageFormat]="page()"
            [fonts]="fonts()"
            [maxHeight]="lightboxHeight()"
            [loading]="loading()"
            [failed]="loadFailed()"
            (editRequested)="edit($event)"
          />
        </div>
        <div class="lightbox-bar">
          <span class="px-3 text-xs text-[var(--color-text-secondary)]">{{ 'formats.' + visual().format | translate }} · {{ size()[0] }} × {{ size()[1] }}</span>
          <button type="button" class="outer-button button-sm" (click)="download()" [disabled]="downloading()">
            @if (downloading()) {
              <idem-loader size="xs" />
            } @else {
              <i class="pi pi-download" aria-hidden="true"></i>
            }
            {{ 'chat.result.download' | translate }}
          </button>
        </div>
      }
    </dialog>
  `,
})
export class VisualResult implements OnInit {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  readonly visual = input.required<Visual>();
  /** Polices de la marque (sans elles, le rendu retomberait sur la police système). */
  readonly fonts = input<FontHints>({});

  /** Le HTML du visuel (l'aperçu éditable le rend dans l'iframe de l'éditeur). */
  protected readonly html = signal('');
  protected readonly loading = signal(false);
  protected readonly loadFailed = signal(false);
  protected readonly page = computed(() => VISUAL_PAGES[this.visual().format] ?? VISUAL_PAGES['square']);
  protected readonly section = computed(() => ({ id: this.visual().id, name: this.visual().prompt.slice(0, 60), type: `flyer-${this.visual().format}` }));
  /** Visionneuse : le document tient dans la fenêtre (barre et marges comprises). */
  protected readonly lightboxHeight = signal(720);
  protected readonly lightboxWidth = computed(() => {
    const [w, h] = this.size();
    return `min(92vw, ${Math.round((this.lightboxHeight() * w) / h)}px)`;
  });
  private readonly lightbox = viewChild.required<ElementRef<HTMLDialogElement>>('lightbox');
  protected readonly opened = signal(false);

  protected readonly size = computed(() => SIZES[this.visual().format] ?? SIZES['square']);
  /** Au plus 28rem de haut et 26rem de large : la largeur découle des proportions du format. */
  protected readonly width = computed(() => {
    const [w, h] = this.size();
    return `min(26rem, calc(28rem * ${(w / h).toFixed(4)}))`;
  });
  protected readonly downloading = signal(false);
  protected readonly failed = signal(false);

  ngOnInit(): void {
    this.loading.set(true);
    this.api.visual(this.visual().id).subscribe({
      next: (v) => {
        this.html.set(v.html || '');
        this.loading.set(false);
        this.loadFailed.set(!v.html);
      },
      error: () => {
        this.loading.set(false);
        this.loadFailed.set(true);
      },
    });
  }

  protected open(): void {
    this.lightboxHeight.set(Math.max(320, window.innerHeight - 160));
    this.opened.set(true);
    this.lightbox().nativeElement.showModal();
  }

  /** « Modifier » sur un élément : l'éditeur partagé s'ouvre sur lui. */
  protected edit(target: EditTarget): void {
    if (this.opened()) this.close();
    const v = this.visual();
    this.router.navigate(['/studio/visual', v.brandId, v.id], { queryParams: { section: target.sectionId, ...(target.path !== null ? { path: target.path } : {}) } });
  }

  protected close(): void {
    this.lightbox().nativeElement.close();
  }

  /** Un clic sur le fond (hors de l'image et de la barre) ferme la visionneuse. */
  protected onBackdrop(event: MouseEvent): void {
    if (event.target === this.lightbox().nativeElement) this.close();
  }

  protected download(): void {
    const v = this.visual();
    this.downloading.set(true);
    this.failed.set(false);
    this.api.saveFile(`/visuals/${v.id}/file`, `ivision-${v.format}.jpg`).subscribe({
      next: () => this.downloading.set(false),
      error: () => {
        this.downloading.set(false);
        this.failed.set(true);
      },
    });
  }
}

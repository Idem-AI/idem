import { ChangeDetectionStrategy, Component, ElementRef, OnInit, computed, inject, input, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { EditTarget, FontHints, IdemDocumentPreviewComponent } from '@idem/shared-document-editor/angular';
import { VISUAL_PAGES } from '../visual-edit/visual-adapter';
import { TranslateModule } from '@ngx-translate/core';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { Illustration } from '../../../shared/components/illustration';
import { ApiService } from '../../../core/api.service';
import { StudioState } from '../../../core/studio.state';
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
  imports: [TranslateModule, IdemLoaderComponent, IdemDocumentPreviewComponent, Illustration],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .viewer {
      width: 100vw;
      height: 100dvh;
      max-width: none;
      max-height: none;
      margin: 0;
      padding: 0;
      border: 0;
      background: transparent;
      color: var(--color-text-primary);
      overflow: hidden;
    }
    .viewer[open] {
      display: grid;
      grid-template-rows: auto minmax(0, 1fr);
      animation: viewer-fade 200ms ease-out;
    }
    .viewer::backdrop {
      background: color-mix(in srgb, var(--color-bg-darker) 90%, transparent);
      backdrop-filter: blur(18px) saturate(1.1);
    }
    .viewer-bar {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin: 0.75rem auto 0;
      width: min(100% - 1.5rem, 64rem);
      padding: 0.5rem 0.5rem 0.5rem 1rem;
      border-radius: 1rem;
      background: var(--color-surface-1);
      border: 1px solid var(--glass-border-subtle);
      box-shadow: 0 12px 32px rgb(0 0 0 / 0.25);
    }
    .viewer-stage {
      min-height: 0;
      display: grid;
      place-items: center;
      padding: 1rem 1.5rem 1.5rem;
      overflow: hidden;
    }
    .viewer-stage.zoomed {
      place-items: start center;
      overflow: auto;
    }
    /*
     * L'image tient dans l'écran : bornée à la largeur de la scène et à la hauteur de la fenêtre moins la
     * barre et les marges (un pourcentage de hauteur ne se résout pas dans la grille : l'image sortait à
     * sa taille réelle, 1080 × 1920 pour une story).
     */
    .viewer-img {
      width: auto;
      height: auto;
      max-width: min(100%, 64rem);
      max-height: calc(100dvh - 7.5rem);
      object-fit: contain;
      border-radius: 0.75rem;
      box-shadow: 0 30px 80px rgb(0 0 0 / 0.45);
      cursor: zoom-in;
      animation: viewer-in 240ms cubic-bezier(0.2, 0.8, 0.2, 1);
    }
    .zoomed .viewer-img {
      max-width: none;
      max-height: none;
      cursor: zoom-out;
    }
    .viewer-wait {
      height: min(calc(100dvh - 7.5rem), 40rem);
      max-width: 100%;
      border-radius: 0.75rem;
    }
    @keyframes viewer-fade {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes viewer-in {
      from { opacity: 0; transform: scale(0.96); }
      to { opacity: 1; transform: none; }
    }
    @media (prefers-reduced-motion: reduce) {
      .viewer[open], .viewer-img { animation: none; }
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
          {{ (exported() ? 'chat.result.downloadHd' : 'chat.result.downloadSigned') | translate }}
        </button>
        @if (!exported()) {
          <button type="button" class="inner-button button-sm" (click)="exportHd()" [disabled]="exporting()">
            @if (exporting()) {
              <idem-loader size="xs" />
            }
            {{ 'chat.result.exportHd' | translate: { price: state.exportVisualXaf() } }}
          </button>
        }
      </figcaption>
      @if (exportRefused(); as missing) {
        <p class="text-xs text-[var(--color-text-secondary)]" role="alert">
          {{ 'chat.result.exportMissing' | translate: { missing } }}
          <a class="underline" [href]="state.topUpUrl(missing)">{{ 'chat.payment.cta' | translate }}</a>
        </p>
      }
      @if (failed()) {
        <p class="text-xs text-[var(--color-text-tertiary)]" role="alert">{{ 'chat.result.downloadFailed' | translate }}</p>
      }
    </figure>

    <!--
      LA VISIONNEUSE : le fichier de l'image lui-même (pas l'aperçu éditable, qui ne se mesure pas dans une
      fenêtre modale). Barre d'actions en haut, l'image au centre ; cliquer l'image passe en taille réelle,
      cliquer à côté ou Échap ferme.
    -->
    <dialog #lightbox class="viewer" [attr.aria-label]="visual().prompt" (click)="onBackdrop($event)" (close)="opened.set(false)">
      @if (opened()) {
        <header class="viewer-bar">
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium">{{ visual().prompt }}</p>
            <p class="text-xs text-[var(--color-text-tertiary)]">{{ 'formats.' + visual().format | translate }} · {{ size()[0] }} × {{ size()[1] }} px</p>
          </div>
          <button type="button" class="button-ghost button-sm" [disabled]="!imgLoaded()" [attr.aria-pressed]="zoomed()" (click)="toggleZoom()">
            <i [class]="zoomed() ? 'pi pi-search-minus' : 'pi pi-search-plus'" aria-hidden="true"></i>
            <span class="hidden sm:inline">{{ (zoomed() ? 'chat.result.fit' : 'chat.result.actualSize') | translate }}</span>
          </button>
          <button type="button" class="outer-button button-sm" (click)="editWhole()">
            <i class="pi pi-pencil" aria-hidden="true"></i>
            <span class="hidden sm:inline">{{ 'chat.result.edit' | translate }}</span>
          </button>
          <button type="button" class="inner-button button-sm" (click)="download()" [disabled]="downloading()">
            @if (downloading()) {
              <idem-loader size="xs" />
            } @else {
              <i class="pi pi-download" aria-hidden="true"></i>
            }
            <span class="hidden sm:inline">{{ 'chat.result.download' | translate }}</span>
          </button>
          <button type="button" class="button-icon !p-2" (click)="close()" [attr.aria-label]="'chat.result.close' | translate" autofocus>
            <i class="pi pi-times" aria-hidden="true"></i>
          </button>
        </header>
        <div class="viewer-stage custom-scrollbar" [class.zoomed]="zoomed()" (click)="onStage($event)">
          @if (imgFailed()) {
            <div class="flex flex-col items-center gap-3 rounded-2xl bg-[var(--color-surface-1)] p-6 text-center" role="alert">
              <iv-illustration class="h-16 w-16 text-[var(--color-text-secondary)]" kind="cracked" />
              <p class="text-sm">{{ 'chat.result.imageFailed' | translate }}</p>
              <button type="button" class="outer-button button-sm" (click)="retryImage()">{{ 'chat.result.retry' | translate }}</button>
            </div>
          } @else {
            @if (!imgLoaded()) {
              <div class="viewer-wait skeleton" [style.aspect-ratio]="size()[0] + ' / ' + size()[1]" role="status" [attr.aria-label]="'common.loading' | translate"></div>
            }
            <img
              class="viewer-img"
              [class.hidden]="!imgLoaded()"
              [src]="imageSrc()"
              [alt]="visual().prompt"
              [attr.width]="size()[0]"
              [attr.height]="size()[1]"
              (load)="imgLoaded.set(true)"
              (error)="imgFailed.set(true)"
              (click)="toggleZoom(); $event.stopPropagation()"
            />
          }
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
  /** Visionneuse : l'image (fichier rendu), son chargement et la taille réelle. */
  protected readonly imgLoaded = signal(false);
  protected readonly imgFailed = signal(false);
  protected readonly zoomed = signal(false);
  private readonly retries = signal(0);
  protected readonly imageSrc = computed(() => {
    const url = this.visual().imageUrl;
    const n = this.retries();
    return n ? `${url}${url.includes('?') ? '&' : '?'}r=${n}` : url;
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
  protected readonly state = inject(StudioState);
  /** Export HD réglé (ou inclus) : le fichier sort sans « Créé avec iVision ». */
  protected readonly exported = signal(false);
  protected readonly exporting = signal(false);
  /** Ce qui manque au portefeuille quand l'export est refusé (402). */
  protected readonly exportRefused = signal<number | null>(null);

  ngOnInit(): void {
    this.exported.set(Boolean(this.visual().exported));
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
    this.zoomed.set(false);
    this.imgFailed.set(false);
    this.opened.set(true);
    this.lightbox().nativeElement.showModal();
  }

  protected toggleZoom(): void {
    if (this.imgLoaded()) this.zoomed.update((z) => !z);
  }

  protected retryImage(): void {
    this.imgLoaded.set(false);
    this.imgFailed.set(false);
    this.retries.update((n) => n + 1);
  }

  /** « Modifier » depuis la visionneuse : l'éditeur partagé, sur le visuel entier. */
  protected editWhole(): void {
    this.close();
    const v = this.visual();
    void this.router.navigate(['/studio/visual', v.brandId, v.id]);
  }

  /** Un clic à côté de l'image (sur la scène) ferme, sauf en taille réelle où l'on fait défiler. */
  protected onStage(event: MouseEvent): void {
    if (event.target === event.currentTarget && !this.zoomed()) this.close();
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

  /** Export HD sans signature : débité depuis le portefeuille IDEM, puis le fichier propre se télécharge. */
  protected exportHd(): void {
    this.exporting.set(true);
    this.exportRefused.set(null);
    this.api.exportVisual(this.visual().id).subscribe({
      next: () => {
        this.exporting.set(false);
        this.exported.set(true);
        this.state.refreshBalance();
        this.download();
      },
      error: (error) => {
        this.exporting.set(false);
        if (error?.status === 402) this.exportRefused.set(error?.error?.missingXaf ?? error?.error?.missing ?? 0);
        else this.failed.set(true);
      },
    });
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

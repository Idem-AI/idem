import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  input,
  OnDestroy,
  OnInit,
  runInInjectionContext,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { CookieService } from '../../../../shared/services/cookie.service';
import { TokenService } from '../../../../shared/services/token.service';
import { injectEditorAdapter } from '../../pages/document-editor/adapters/inject-editor-adapter';
import { EditorCanvasComponent } from '../../pages/document-editor/components/editor-canvas/editor-canvas';
import { ZoomControlComponent } from '../../pages/document-editor/components/zoom-control/zoom-control';
import {
  DocumentTypeAdapter,
  EDITOR_TARGET_PARAMS,
  EditableSection,
  EditorDocumentType,
  EditorSelection,
  FontHints,
  PageFormat,
} from '../../pages/document-editor/models/editor.types';

/** Documents qui ont une page d'affichage avec aperçu. */
export type PreviewDocumentType = Extract<EditorDocumentType, 'business-plan' | 'pitch-deck' | 'branding'>;

type DownloadState = 'idle' | 'working' | 'done' | 'error';

/** Nature lisible de l'élément cliqué, annoncée dans le menu contextuel. */
type ElementKind = 'page' | 'chart' | 'heading' | 'image' | 'table' | 'list' | 'text' | 'block';

const KIND_ICONS: Record<ElementKind, string> = {
  page: 'pi-file',
  chart: 'pi-chart-bar',
  heading: 'pi-bars',
  image: 'pi-image',
  table: 'pi-table',
  list: 'pi-list',
  text: 'pi-align-left',
  block: 'pi-stop',
};

/** Encombrement du menu contextuel, pour le garder dans la page. */
const POPOVER_WIDTH = 260;
const POPOVER_HEIGHT = 48;
const POPOVER_GAP = 10;
/** Au-delà (px à l'écran), l'élément dépasse la vue : le menu se pose dans son coin haut. */
const TALL_ELEMENT_PX = 420;
/** Place réservée sous le document pour que le dock ne recouvre pas la dernière page. */
const DOCK_INSET_PX = 104;
/** Hauteur minimale de la scène : en dessous, on ne lit plus une page. */
const STAGE_MIN_PX = 380;

function kindOf(selection: EditorSelection): ElementKind {
  if (selection.path === '') return 'page';
  if (selection.isChart) return 'chart';
  const tag = selection.tag;
  if (/^h[1-6]$/.test(tag)) return 'heading';
  if (['img', 'svg', 'picture', 'figure', 'video'].includes(tag)) return 'image';
  if (['table', 'thead', 'tbody', 'tr', 'td', 'th'].includes(tag)) return 'table';
  if (['ul', 'ol', 'li'].includes(tag)) return 'list';
  if (selection.isTextLeaf) return 'text';
  return 'block';
}

/**
 * Aperçu d'un document généré (business plan, pitch deck, charte graphique),
 * rendu comme dans l'éditeur plutôt qu'en PDF : même iframe, mêmes sections,
 * même survol. Cliquer un élément ouvre un menu « Éditer » qui mène à
 * l'éditeur avec cet élément déjà sélectionné et à l'écran.
 *
 * Le PDF n'est plus chargé à l'ouverture : il est demandé à l'API au clic sur
 * « Télécharger ». Les actions vivent dans un dock flottant (pages, zoom,
 * éditer, télécharger) qui reste à portée de pouce sur mobile.
 *
 * La hauteur de la scène se MESURE : elle va de sa position dans la page
 * jusqu'au bas de la fenêtre, marges des conteneurs déduites. Le document
 * tient donc à l'écran dès l'ouverture, quoi qu'il y ait au-dessus (panneau
 * de statut, en-tête…). Quand la place manque, le dock reste collé au bas de
 * la fenêtre.
 */
@Component({
  selector: 'app-document-preview',
  imports: [TranslateModule, EditorCanvasComponent, ZoomControlComponent],
  templateUrl: './document-preview.html',
  styleUrl: './document-preview.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block',
    '(document:pointerdown)': 'onOutsidePointer($event)',
  },
})
export class DocumentPreviewComponent implements OnInit, OnDestroy {
  readonly documentType = input.required<PreviewDocumentType>();
  /** Titre affiché au-dessus de l'aperçu. */
  readonly heading = input<string>('');

  private readonly router = inject(Router);
  private readonly cookieService = inject(CookieService);
  private readonly tokenService = inject(TokenService);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly canvas = viewChild(EditorCanvasComponent);
  private readonly stage = viewChild<ElementRef<HTMLElement>>('stage');
  private readonly popoverEdit = viewChild<ElementRef<HTMLButtonElement>>('popoverEdit');
  private readonly pagesControl = viewChild<ElementRef<HTMLElement>>('pagesControl');

  protected readonly dockInset = DOCK_INSET_PX;
  protected readonly loading = signal(true);
  protected readonly loadError = signal(false);
  protected readonly sections = signal<EditableSection[]>([]);
  protected readonly fonts = signal<FontHints>({});
  protected readonly pageFormat = signal<PageFormat>({ width: '210mm', height: '297mm' });
  protected readonly multiPage = signal(false);
  protected readonly dark = signal(false);
  protected readonly selection = signal<EditorSelection | null>(null);
  protected readonly pagesMenuOpen = signal(false);
  protected readonly downloadState = signal<DownloadState>('idle');
  protected readonly canDownload = signal(false);
  protected readonly stageHeight = signal<number | null>(null);

  protected readonly pageCount = computed(() => this.sections().length);
  protected readonly currentIndex = computed(() =>
    Math.max(0, this.canvas()?.currentSectionIndex() ?? 0),
  );
  protected readonly currentSection = computed(() => this.sections()[this.currentIndex()] ?? null);
  protected readonly ready = computed(() => !this.loading() && !this.loadError() && this.pageCount() > 0);

  protected readonly kind = computed(() => {
    const selection = this.selection();
    return selection ? kindOf(selection) : null;
  });
  protected readonly kindIcon = computed(() => {
    const kind = this.kind();
    return kind ? KIND_ICONS[kind] : '';
  });

  /** Position du menu contextuel dans le repère du document zoomé. */
  protected readonly popover = computed(() => {
    const selection = this.selection();
    const canvas = this.canvas();
    if (!selection || !canvas) return null;
    const z = canvas.zoom();
    const rect = selection.rect;
    const docWidth = canvas.scaledWidth();
    const docHeight = canvas.scaledHeight();
    const top = rect.top * z;
    const bottom = (rect.top + rect.height) * z;
    const left = Math.min(Math.max(8, rect.left * z), Math.max(8, docWidth - POPOVER_WIDTH - 8));

    if (rect.height * z > TALL_ELEMENT_PX) {
      return { left: left + 8, top: top + POPOVER_GAP, placement: 'inside' as const };
    }
    if (bottom + POPOVER_GAP + POPOVER_HEIGHT <= docHeight) {
      return { left, top: bottom + POPOVER_GAP, placement: 'below' as const };
    }
    return {
      left,
      top: Math.max(0, top - POPOVER_GAP - POPOVER_HEIGHT),
      placement: 'above' as const,
    };
  });

  protected readonly downloadLabel = computed(() => {
    switch (this.downloadState()) {
      case 'working':
        return 'dashboard.documentPreview.download.working';
      case 'done':
        return 'dashboard.documentPreview.download.done';
      case 'error':
        return 'dashboard.documentPreview.download.error';
      default:
        return 'dashboard.documentPreview.download.idle';
    }
  });

  private adapter: DocumentTypeAdapter | null = null;
  private projectId: string | null = null;
  private downloadTimer: ReturnType<typeof setTimeout> | null = null;
  private sizeObserver?: ResizeObserver;
  private treeObserver?: MutationObserver;
  private measureFrame = 0;
  private readonly onWindowResize = () => this.scheduleMeasure();

  constructor() {
    afterNextRender(() => {
      this.measureStage();
      window.addEventListener('resize', this.onWindowResize);
      this.watchLayoutAbove();
      // Les polices de marque changent la hauteur du titre sans rien redimensionner d'autre.
      document.fonts?.ready.then(() => this.scheduleMeasure());
    });
  }

  /**
   * Le haut de la scène bouge quand ce qui la précède change de taille après
   * coup : titre traduit, panneau de statut complété, barre du parcours
   * guidé. Observer `body` ne suffit pas — les conteneurs en `min-h-screen`
   * gardent leur hauteur. On observe donc exactement ce qui est AU-DESSUS :
   * chaque élément qui précède la scène ou l'un de ses conteneurs, et
   * l'arrivée d'un nouvel élément dans ces conteneurs. La mesure ne dépend pas
   * de la hauteur de la scène elle-même : elle se stabilise au premier passage.
   */
  private watchLayoutAbove(): void {
    const stage = this.stage()?.nativeElement;
    if (!stage || typeof ResizeObserver === 'undefined') return;
    const sizes = new ResizeObserver(() => this.scheduleMeasure());
    const bind = () => {
      sizes.disconnect();
      tree?.disconnect();
      sizes.observe(document.body);
      for (let el: Element | null = stage; el && el !== document.body; el = el.parentElement) {
        for (let sib = el.previousElementSibling; sib; sib = sib.previousElementSibling) {
          sizes.observe(sib);
        }
        if (el.parentElement) tree?.observe(el.parentElement, { childList: true });
      }
    };
    const tree =
      typeof MutationObserver !== 'undefined'
        ? new MutationObserver(() => {
            bind();
            this.scheduleMeasure();
          })
        : undefined;
    bind();
    this.sizeObserver = sizes;
    this.treeObserver = tree;
  }

  async ngOnInit(): Promise<void> {
    this.dark.set(document.documentElement.classList.contains('dark'));
    const adapter = runInInjectionContext(this.injector, () =>
      injectEditorAdapter(this.documentType()),
    );
    this.adapter = adapter;
    this.multiPage.set(adapter.multiPage);
    this.pageFormat.set(adapter.pageFormat);
    this.canDownload.set(!!adapter.downloadPdf);

    this.projectId = this.cookieService.get('projectId');
    if (!this.projectId) {
      this.loading.set(false);
      this.loadError.set(true);
      return;
    }

    await this.tokenService.waitForAuthReady();
    adapter
      .load(this.projectId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (doc) => {
          this.fonts.set(doc.fonts);
          if (doc.pageFormat) this.pageFormat.set(doc.pageFormat);
          this.sections.set(doc.sections);
          this.loading.set(false);
          // Les entrées du canvas (format, polices) doivent être à jour avant le rendu.
          setTimeout(() => this.canvas()?.render(doc.sections), 0);
        },
        error: (err) => {
          console.error('Error loading document preview:', err);
          this.loading.set(false);
          this.loadError.set(true);
        },
      });
  }

  ngOnDestroy(): void {
    if (this.downloadTimer) clearTimeout(this.downloadTimer);
    if (this.measureFrame) cancelAnimationFrame(this.measureFrame);
    this.sizeObserver?.disconnect();
    this.treeObserver?.disconnect();
    window.removeEventListener('resize', this.onWindowResize);
  }

  /* ------------------------------------------------------------------ */
  /* Hauteur de la scène                                                 */
  /* ------------------------------------------------------------------ */

  private scheduleMeasure(): void {
    if (this.measureFrame) return;
    this.measureFrame = requestAnimationFrame(() => {
      this.measureFrame = 0;
      this.measureStage();
    });
  }

  /**
   * Hauteur = bas de la fenêtre − haut de la scène − marges basses des
   * conteneurs (layout du tableau de bord, page). `clientHeight` plutôt
   * qu'`innerHeight` : sur mobile, il ne varie pas quand la barre d'adresse
   * se replie, la scène ne saute donc pas pendant le défilement.
   */
  private measureStage(): void {
    const stage = this.stage()?.nativeElement;
    if (!stage) return;
    const top = stage.getBoundingClientRect().top + window.scrollY;
    let below = 0;
    for (let el = stage.parentElement; el && el !== document.body; el = el.parentElement) {
      const style = getComputedStyle(el);
      below += (parseFloat(style.paddingBottom) || 0) + (parseFloat(style.borderBottomWidth) || 0);
    }
    const height = Math.round(document.documentElement.clientHeight - top - below);
    this.stageHeight.set(Math.max(STAGE_MIN_PX, height));
  }

  /* ------------------------------------------------------------------ */
  /* Sélection → éditer                                                  */
  /* ------------------------------------------------------------------ */

  protected onSelectionChange(selection: EditorSelection | null): void {
    this.selection.set(selection);
    this.pagesMenuOpen.set(false);
    if (!selection) return;
    // Le focus passe au bouton « Éditer » : Entrée ouvre l'éditeur, Échap referme.
    afterNextRender(() => this.popoverEdit()?.nativeElement.focus({ preventScroll: true }), {
      injector: this.injector,
    });
  }

  protected closePopover(): void {
    this.canvas()?.clearSelection();
    this.selection.set(null);
  }

  /**
   * Ouvre l'éditeur sur l'élément sélectionné ; sans sélection, sur la page
   * en cours de lecture.
   */
  protected edit(): void {
    const route = this.adapter?.editRoute;
    if (!route) return;
    const selection = this.selection();
    const queryParams: Record<string, string> = {};
    if (selection) {
      queryParams[EDITOR_TARGET_PARAMS.section] = selection.sectionId;
      queryParams[EDITOR_TARGET_PARAMS.path] = selection.path;
    } else if (this.currentSection()) {
      queryParams[EDITOR_TARGET_PARAMS.section] = this.currentSection()!.id;
    }
    this.router.navigate([route], { queryParams });
  }

  /* ------------------------------------------------------------------ */
  /* Pages                                                               */
  /* ------------------------------------------------------------------ */

  protected goToPage(index: number): void {
    const target = Math.min(Math.max(0, index), this.pageCount() - 1);
    this.canvas()?.scrollToSection(target);
    this.pagesMenuOpen.set(false);
  }

  protected onOutsidePointer(event: PointerEvent): void {
    const control = this.pagesControl()?.nativeElement;
    if (this.pagesMenuOpen() && control && !control.contains(event.target as Node)) {
      this.pagesMenuOpen.set(false);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Téléchargement                                                      */
  /* ------------------------------------------------------------------ */

  protected download(): void {
    const adapter = this.adapter;
    if (!adapter?.downloadPdf || !this.projectId || this.downloadState() === 'working') return;
    this.setDownloadState('working');
    adapter
      .downloadPdf(this.projectId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => {
          this.saveBlob(blob, adapter.pdfFileName ?? 'document.pdf');
          this.setDownloadState('done');
        },
        error: (err) => {
          console.error('PDF download failed:', err);
          this.setDownloadState('error');
        },
      });
  }

  private setDownloadState(state: DownloadState): void {
    this.downloadState.set(state);
    if (this.downloadTimer) clearTimeout(this.downloadTimer);
    if (state === 'done' || state === 'error') {
      this.downloadTimer = setTimeout(
        () => this.downloadState.set('idle'),
        state === 'error' ? 4000 : 2500,
      );
    }
  }

  private saveBlob(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

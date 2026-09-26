import {
  afterNextRender,
  afterRenderEffect,
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
  output,
  runInInjectionContext,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CookieService } from '../../../../shared/services/cookie.service';
import { TokenService } from '../../../../shared/services/token.service';
import { UiModeService } from '../../../../shared/services/ui-mode.service';
import { SectionCompletionItem } from '../../models/generation-completeness';
import { injectEditorAdapter } from '../../pages/document-editor/adapters/inject-editor-adapter';
import {
  DocumentActionEvent,
  EditorCanvasComponent,
} from '../../pages/document-editor/components/editor-canvas/editor-canvas';
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
import { PREVIEW_PAGE_GAP_PX } from '../../pages/document-editor/runtime/editor-iframe';
import { buildPlaceholderHtml, composePages, PreviewPage } from './preview-pages';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';

/** Documents qui ont une page d'affichage avec aperçu. */
export type PreviewDocumentType = Extract<
  EditorDocumentType,
  'business-plan' | 'pitch-deck' | 'branding' | 'legal-doc'
>;

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
const POPOVER_WIDTH = 340;
const POPOVER_HEIGHT = 48;
const POPOVER_GAP = 10;
/** Au-delà (px à l'écran), l'élément dépasse la vue : le menu se pose dans son coin haut. */
const TALL_ELEMENT_PX = 420;
/** Place réservée sous le document pour que le dock ne recouvre pas le dernier pied de page. */
const DOCK_INSET_PX = 104;
/** Hauteur du pied de page, posé dans l'espace entre deux pages. */
const FOOTER_HEIGHT_PX = 28;
/** Écart entre le bas d'une page et son pied. */
const FOOTER_OFFSET_PX = 6;
/** Hauteur plancher du pied tassé : en dessous, l'icône ne se vise plus au doigt. */
const FOOTER_MIN_HEIGHT_PX = 16;

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
 * même survol. Le document défile avec la page, rien ne le coupe.
 *
 *  - Cliquer un élément ouvre un menu : « Éditer » (l'éditeur s'ouvre sur cet
 *    élément) ou « Régénérer » sa section.
 *  - Sous chaque page, un pied discret : nom, alerte éventuelle, « Régénérer ».
 *  - Une section manquante ou en échec est remplacée, à sa place, par une
 *    page qui l'explique et propose de la régénérer.
 *  - Le dock (collé au bas de la fenêtre) regroupe pages, zoom, « Régénérer »
 *    (compléter / tout régénérer), éditer et télécharger. Le PDF n'est demandé
 *    à l'API qu'au téléchargement.
 *
 * La régénération elle-même appartient à la page hôte (routes et flux
 * différents selon le document) : l'aperçu n'émet que l'intention.
 */
@Component({
  selector: 'app-document-preview',
  imports: [TranslateModule, EditorCanvasComponent, ZoomControlComponent, IdemLoaderComponent],
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
  /**
   * Sections attendues, dans l'ordre du document, avec leur statut
   * (`analyzeGenerationCompleteness(...).items`). Vide : l'aperçu n'affiche ni
   * statut ni action de régénération.
   */
  readonly outline = input<readonly SectionCompletionItem[]>([]);
  /** Préfixe i18n des noms de section (se termine par un point). */
  readonly sectionLabelPrefix = input<string>('');
  /** Une génération est en cours : les régénérations sont désactivées. */
  readonly busy = input<boolean>(false);
  /**
   * Document affiché quand le projet en garde plusieurs (business plans, pitch
   * decks). Absent : le document le plus récent.
   */
  readonly documentId = input<string | null>(null);
  /**
   * Où l'aperçu est posé :
   *  - `page` : une page du tableau de bord. Le document prend sa hauteur
   *    naturelle et c'est la PAGE qui défile ; le dock colle au bas de la
   *    fenêtre.
   *  - `panel` : un panneau de hauteur fixe (tiroir du mode Chat). Le document
   *    défile DANS l'aperçu et le dock se pose au bas du panneau — la fenêtre,
   *    elle, ne défile pas.
   */
  readonly variant = input<'page' | 'panel'>('page');

  /** Régénérer une section (nom canonique). */
  readonly regenerateSection = output<string>();
  /** Compléter la génération (sections manquantes ou en échec). */
  readonly resumeGeneration = output<void>();
  /** Tout régénérer. */
  readonly regenerateAll = output<void>();

  private readonly router = inject(Router);
  private readonly uiMode = inject(UiModeService);
  private readonly translate = inject(TranslateService);
  private readonly cookieService = inject(CookieService);
  private readonly tokenService = inject(TokenService);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly canvas = viewChild(EditorCanvasComponent);
  private readonly popoverEdit = viewChild<ElementRef<HTMLButtonElement>>('popoverEdit');
  private readonly pagesControl = viewChild<ElementRef<HTMLElement>>('pagesControl');
  private readonly regenControl = viewChild<ElementRef<HTMLElement>>('regenControl');

  protected readonly dockInset = DOCK_INSET_PX;
  /** Le canvas défile avec la page (aperçu de page) ou sur lui-même (panneau). */
  protected readonly canvasVariant = computed(() =>
    this.variant() === 'panel' ? ('workspace' as const) : ('inline' as const),
  );
  protected readonly loading = signal(true);
  protected readonly loadError = signal(false);
  private readonly loadedSections = signal<EditableSection[]>([]);
  protected readonly fonts = signal<FontHints>({});
  protected readonly pageFormat = signal<PageFormat>({ width: '210mm', height: '297mm' });
  protected readonly multiPage = signal(false);
  protected readonly dark = signal(false);
  protected readonly selection = signal<EditorSelection | null>(null);
  protected readonly pagesMenuOpen = signal(false);
  protected readonly regenMenuOpen = signal(false);
  /** « Tout régénérer » demande un second clic : le contenu actuel sera remplacé. */
  protected readonly confirmRegenerateAll = signal(false);
  protected readonly downloadState = signal<DownloadState>('idle');
  protected readonly canDownload = signal(false);

  /** Pages dans l'ordre du document, pages de remplacement comprises. */
  protected readonly pages = computed(() =>
    composePages(this.loadedSections(), this.outline(), (name) => this.labelOf(name)),
  );

  /** Ce que l'iframe rend : les sections, et une page dessinée pour chaque manque. */
  private readonly slots = computed<EditableSection[]>(() => {
    const byId = new Map(this.loadedSections().map((section) => [section.id, section]));
    return this.pages().map((page) => {
      const section = page.kind === 'content' ? byId.get(page.id) : undefined;
      return (
        section ?? {
          id: page.id,
          name: page.name,
          type: 'placeholder',
          placeholder: true,
          html: this.placeholderHtml(page),
        }
      );
    });
  });

  protected readonly pageCount = computed(() => this.pages().length);
  protected readonly currentIndex = computed(() =>
    Math.max(0, this.canvas()?.currentSectionIndex() ?? 0),
  );
  protected readonly currentPage = computed(() => this.pages()[this.currentIndex()] ?? null);
  protected readonly ready = computed(() => !this.loading() && !this.loadError() && this.pageCount() > 0);

  /** La page hôte suit la génération : statut et régénération sont proposés. */
  protected readonly tracksGeneration = computed(() => this.outline().length > 0);
  /** Pages manquantes ou en échec. */
  protected readonly blockingPages = computed(() => this.pages().filter((page) => page.kind !== 'content'));
  protected readonly underfilledPages = computed(() =>
    this.pages().filter((page) => page.issue === 'underfilled'),
  );
  protected readonly resumeCount = computed(
    () => this.outline().filter((item) => item.status === 'missing' || item.status === 'empty').length,
  );

  /** L'utilisateur a fermé l'invitation à compléter (le temps de cette visite). */
  protected readonly nudgeDismissed = signal(false);
  /**
   * Invitation à compléter, posée au-dessus du dock dès l'ouverture : des pages
   * manquent, et c'est ici — pas sur la page d'aperçu de la marque — qu'on les
   * génère. Elle s'efface au premier choix, et ne gêne pas la lecture.
   */
  protected readonly showCompleteNudge = computed(
    () =>
      this.tracksGeneration() &&
      this.ready() &&
      this.resumeCount() > 0 &&
      !this.busy() &&
      !this.nudgeDismissed() &&
      !this.regenMenuOpen(),
  );

  /** Résumé d'une ligne dans l'en-tête, à la place de l'ancien panneau de statut. */
  protected readonly statusSummary = computed(() => {
    if (!this.tracksGeneration() || !this.ready()) return null;
    const blocking = this.blockingPages().length;
    if (blocking > 0) {
      return {
        warn: true,
        count: blocking,
        key: `dashboard.documentPreview.status.${blocking === 1 ? 'blockingOne' : 'blockingMany'}`,
      };
    }
    const underfilled = this.underfilledPages().length;
    if (underfilled > 0) {
      return {
        warn: true,
        count: underfilled,
        key: `dashboard.documentPreview.status.${underfilled === 1 ? 'underfilledOne' : 'underfilledMany'}`,
      };
    }
    return { warn: false, count: 0, key: 'dashboard.documentPreview.status.complete' };
  });

  /** Page de l'élément sélectionné. */
  protected readonly selectedPage = computed(() => {
    const selection = this.selection();
    return selection ? (this.pages().find((page) => page.id === selection.sectionId) ?? null) : null;
  });

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

  /** Pieds de page, posés dans l'espace sous chaque page (repère du document zoomé). */
  protected readonly footers = computed(() => {
    const canvas = this.canvas();
    if (!canvas || !this.ready() || !this.tracksGeneration()) return [];
    const z = canvas.zoom();
    const pages = this.pages();
    const gap = PREVIEW_PAGE_GAP_PX * z;
    // Document très réduit (mobile) : l'espace entre deux pages est plus bas
    // que le pied. Le pied se tasse (icône seule) au lieu de chevaucher les pages.
    const height = Math.max(FOOTER_MIN_HEIGHT_PX, Math.min(FOOTER_HEIGHT_PX, gap - 4));
    // Collé sous SA page plutôt que centré : il ne se lit pas comme l'en-tête de la suivante.
    const offset = Math.max(0, Math.min(FOOTER_OFFSET_PX, gap - height));
    return canvas.sectionLayouts().flatMap((layout) => {
      const index = pages.findIndex((page) => page.id === layout.id);
      if (index < 0) return [];
      return [
        {
          page: pages[index],
          index,
          left: layout.left * z,
          width: layout.width * z,
          top: (layout.top + layout.height) * z + offset,
          height,
          compact: height < FOOTER_HEIGHT_PX,
        },
      ];
    });
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
  private renderedKey = '';

  constructor() {
    // Rendu de l'iframe à l'ouverture, puis chaque fois que la liste des pages
    // change (une section attendue apparaît, un échec est connu). Après le
    // rendu de la vue : le canvas a déjà reçu format et polices.
    afterRenderEffect(() => {
      const canvas = this.canvas();
      const slots = this.slots();
      const format = this.pageFormat();
      if (!canvas || this.loading() || this.loadError()) return;
      const key = `${format.width}x${format.height}|${slots
        .map((slot) => (slot.placeholder ? `?${slot.id}` : slot.id))
        .join('|')}`;
      if (key === this.renderedKey) return;
      this.renderedKey = key;
      canvas.render(slots);
    });
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
      .load(this.projectId, this.documentId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (doc) => {
          this.fonts.set(doc.fonts);
          if (doc.pageFormat) this.pageFormat.set(doc.pageFormat);
          this.loadedSections.set(doc.sections);
          this.loading.set(false);
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
  }

  /* ------------------------------------------------------------------ */
  /* Pages                                                               */
  /* ------------------------------------------------------------------ */

  private labelOf(name: string): string {
    const prefix = this.sectionLabelPrefix();
    if (!prefix) return name;
    const key = prefix + name;
    const label: unknown = this.translate.instant(key);
    return typeof label === 'string' && label !== key ? label : name;
  }

  private placeholderHtml(page: PreviewPage): string {
    const kind = page.kind === 'error' ? 'error' : 'missing';
    const text = (key: string): string =>
      this.translate.instant(`dashboard.documentPreview.placeholder.${key}`);
    return buildPlaceholderHtml(kind, page.name, {
      section: page.label,
      title: text(`${kind}.title`),
      message: text(`${kind}.message`),
      action: text('action'),
    });
  }

  protected goToPage(index: number): void {
    const target = Math.min(Math.max(0, index), this.pageCount() - 1);
    this.canvas()?.scrollToSection(target);
    this.pagesMenuOpen.set(false);
  }

  /** Amène la première page à régénérer (à défaut, la première sous-remplie). */
  protected goToFirstIssue(): void {
    const target = this.blockingPages()[0] ?? this.underfilledPages()[0];
    if (target) this.goToPage(this.pages().indexOf(target));
  }

  protected togglePagesMenu(): void {
    this.pagesMenuOpen.update((open) => !open);
    this.regenMenuOpen.set(false);
  }

  /* ------------------------------------------------------------------ */
  /* Sélection → éditer / régénérer                                      */
  /* ------------------------------------------------------------------ */

  protected onSelectionChange(selection: EditorSelection | null): void {
    this.selection.set(selection);
    this.pagesMenuOpen.set(false);
    this.regenMenuOpen.set(false);
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
   * en cours de lecture (si elle existe dans le document).
   */
  protected edit(): void {
    const route = this.adapter?.editRoute;
    if (!route) return;
    const selection = this.selection();
    const current = this.currentPage();
    const queryParams: Record<string, string> = {};
    const documentId = this.documentId();
    if (documentId) queryParams[EDITOR_TARGET_PARAMS.document] = documentId;
    if (selection) {
      queryParams[EDITOR_TARGET_PARAMS.section] = selection.sectionId;
      queryParams[EDITOR_TARGET_PARAMS.path] = selection.path;
    } else if (current?.kind === 'content') {
      queryParams[EDITOR_TARGET_PARAMS.section] = current.id;
    }
    // Passe par le service de mode : ouvrir l'éditeur depuis le tiroir du mode
    // Chat doit basculer en mode Avancé, comme depuis une carte de livrable.
    this.uiMode.openInEditor(this.router.createUrlTree([route], { queryParams }).toString());
  }

  protected regenerate(page: PreviewPage | null): void {
    if (!page || this.busy()) return;
    this.closePopover();
    this.regenerateSection.emit(page.name);
  }

  /** Bouton « Régénérer cette section » d'une page de remplacement. */
  protected onDocumentAction(event: DocumentActionEvent): void {
    if (event.action === 'regenerate' && event.name && !this.busy()) {
      this.regenerateSection.emit(event.name);
    }
  }

  protected toggleRegenMenu(): void {
    this.regenMenuOpen.update((open) => !open);
    this.confirmRegenerateAll.set(false);
    this.pagesMenuOpen.set(false);
  }

  protected resume(): void {
    if (this.resumeCount() === 0 || this.busy()) return;
    this.regenMenuOpen.set(false);
    this.resumeGeneration.emit();
  }

  protected requestRegenerateAll(): void {
    if (this.busy()) return;
    if (!this.confirmRegenerateAll()) {
      this.confirmRegenerateAll.set(true);
      return;
    }
    this.confirmRegenerateAll.set(false);
    this.regenMenuOpen.set(false);
    this.regenerateAll.emit();
  }

  protected onOutsidePointer(event: PointerEvent): void {
    const target = event.target as Node;
    if (this.pagesMenuOpen() && !this.pagesControl()?.nativeElement.contains(target)) {
      this.pagesMenuOpen.set(false);
    }
    if (this.regenMenuOpen() && !this.regenControl()?.nativeElement.contains(target)) {
      this.regenMenuOpen.set(false);
      this.confirmRegenerateAll.set(false);
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
      .downloadPdf(this.projectId, this.documentId())
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

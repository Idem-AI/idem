import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { EditorCanvasComponent } from '../components/editor-canvas/editor-canvas';
import { EditorTranslatePipe } from '../i18n/editor-translate.pipe';
import { EditorSelection, FontHints, PageFormat } from '../models/editor.types';

/** Largeur/hauteur estimées du menu, pour le placer sans sortir de la page. */
const MENU_WIDTH = 190;
const MENU_HEIGHT = 44;
const MENU_GAP = 8;

/** Ce que l'aperçu désigne quand l'utilisateur demande à modifier. */
export interface EditTarget {
  sectionId: string;
  /** Chemin de l'élément cliqué dans la section ; `null` = la section entière. */
  path: string | null;
}

/**
 * L'APERÇU ÉDITABLE PARTAGÉ (IDEM, iVision) : un document rendu dans la même iframe que
 * l'éditeur, pixel pour pixel identique au fichier produit. Survoler un élément le cadre ;
 * cliquer ouvre un menu « Modifier » qui mène à l'éditeur SUR CET ÉLÉMENT.
 *
 * Ne charge rien et ne navigue nulle part : l'hôte donne le HTML (et dit s'il charge ou a
 * échoué), écoute `editRequested` et ouvre son éditeur (`<idem-document-editor>`) sur la cible.
 */
@Component({
  selector: 'idem-document-preview',
  imports: [EditorCanvasComponent, EditorTranslatePipe, IdemLoaderComponent],
  styleUrl: './document-preview.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="vp-frame" [style.max-height.px]="maxHeight()">
      @if (loading()) {
        <p class="vp-state" role="status" aria-live="polite">
          <idem-loader size="xs" />
          {{ 'preview.loading' | idemEditorT }}
        </p>
      } @else if (failed()) {
        <p class="vp-state">
          <i class="pi pi-exclamation-triangle" aria-hidden="true"></i>
          {{ 'preview.failed' | idemEditorT }}
        </p>
      }

      <app-editor-canvas
        mode="preview"
        variant="inline"
        [pageFormat]="pageFormat()"
        [fitRoot]="fitRoot()"
        [fonts]="fonts()"
        [label]="'preview.canvasLabel' | idemEditorT"
        (selectionChange)="onSelectionChange($event)"
        (escape)="closeMenu()"
      >
        <!-- Menu posé DANS le repère du document zoomé : il suit l'élément cliqué. -->
        @if (menu(); as position) {
          <div class="vp-menu" [style.left.px]="position.left" [style.top.px]="position.top" role="group" [attr.aria-label]="'preview.menuLabel' | idemEditorT">
            <span class="vp-menu-kind">{{ selectionLabel() | idemEditorT }}</span>
            <button #menuEdit type="button" class="vp-menu-edit" (click)="edit()">
              <i class="pi pi-pencil" aria-hidden="true"></i>
              {{ 'preview.edit' | idemEditorT }}
            </button>
            <button type="button" class="vp-menu-close" [attr.aria-label]="'preview.close' | idemEditorT" (click)="closeMenu()">
              <i class="pi pi-times" aria-hidden="true"></i>
            </button>
          </div>
        }
      </app-editor-canvas>
    </div>

    @if (showHint()) {
      <p class="vp-hint">
        <i class="pi pi-info-circle" aria-hidden="true"></i>
        {{ 'preview.hint' | idemEditorT }}
      </p>
    }
  `,
})
export class IdemDocumentPreviewComponent {
  private readonly injector = inject(Injector);

  /** HTML de la section à montrer (vide tant qu'il charge). */
  readonly html = input<string>('');
  /** Identité de la section (ce que l'éditeur ouvrira). */
  readonly section = input.required<{ id: string; name?: string; type?: string }>();
  readonly pageFormat = input.required<PageFormat>();
  /** Polices de la marque, sans quoi le rendu retombe sur la police système. */
  readonly fonts = input<FontHints>({});
  /** Conteneur racine forcé aux dimensions de la page (visuels : parité avec le PNG). */
  readonly fitRoot = input<boolean>(true);
  /** Hauteur maximale à l'écran (le zoom s'ajuste pour y tenir). */
  readonly maxHeight = input<number>(460);
  readonly loading = input<boolean>(false);
  readonly failed = input<boolean>(false);
  /** La phrase d'aide sous l'aperçu (« survolez, cliquez… »). */
  readonly showHint = input<boolean>(true);

  /** L'utilisateur veut modifier l'élément désigné (ou la section entière). */
  readonly editRequested = output<EditTarget>();

  private readonly canvas = viewChild(EditorCanvasComponent);
  private readonly menuEdit = viewChild<ElementRef<HTMLButtonElement>>('menuEdit');
  protected readonly selection = signal<EditorSelection | null>(null);

  /** Position du menu, dans le repère du document zoomé : sous l'élément, au-dessus sinon. */
  protected readonly menu = computed(() => {
    const selection = this.selection();
    const canvas = this.canvas();
    if (!selection || !canvas) return null;
    const zoom = canvas.zoom();
    const rect = selection.rect;
    const docWidth = canvas.scaledWidth();
    const docHeight = canvas.scaledHeight();
    const bottom = (rect.top + rect.height) * zoom;
    const left = Math.min(Math.max(8, rect.left * zoom), Math.max(8, docWidth - MENU_WIDTH - 8));
    return bottom + MENU_GAP + MENU_HEIGHT <= docHeight ? { left, top: bottom + MENU_GAP } : { left, top: Math.max(0, rect.top * zoom - MENU_GAP - MENU_HEIGHT) };
  });

  /** Ce que le clic a désigné, dit en mots — « ce texte », « cette image ». */
  protected readonly selectionLabel = computed(() => {
    const selection = this.selection();
    if (!selection) return '';
    if (selection.tag === 'IMG') return 'preview.kinds.image';
    if (selection.isTextLeaf) return 'preview.kinds.text';
    return 'preview.kinds.block';
  });

  constructor() {
    // Rendu dès que le HTML et l'iframe sont là, et à chaque changement (polices comprises).
    effect(() => {
      const html = this.html();
      const canvas = this.canvas();
      const section = this.section();
      this.fonts();
      if (!html || !canvas) return;
      canvas.render([{ id: section.id, name: section.name || section.id, type: section.type || 'section', html }]);
    });
  }

  protected onSelectionChange(selection: EditorSelection | null): void {
    this.selection.set(selection);
    if (!selection) return;
    // Le focus passe sur « Modifier » : Entrée ouvre l'éditeur, Échap referme.
    afterNextRender(() => this.menuEdit()?.nativeElement.focus({ preventScroll: true }), { injector: this.injector });
  }

  protected closeMenu(): void {
    this.canvas()?.clearSelection();
    this.selection.set(null);
  }

  /** Ouvre l'éditeur SUR l'élément cliqué (sinon l'utilisateur devrait le retrouver). */
  protected edit(): void {
    const selection = this.selection();
    this.editRequested.emit(selection ? { sectionId: selection.sectionId, path: selection.path } : { sectionId: this.section().id, path: null });
  }
}

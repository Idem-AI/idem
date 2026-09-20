import {
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
  afterNextRender,
} from '@angular/core';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { EditorCanvasComponent } from '../../../document-editor/components/editor-canvas/editor-canvas';
import {
  EDITOR_TARGET_PARAMS,
  EditorSelection,
  FontHints,
  PageFormat,
} from '../../../document-editor/models/editor.types';
import { CommunicationService } from '../../../../services/ai-agents/communication.service';
import { Flyer, FlyerFormat } from '../../../../models/communication.model';

/**
 * Dimensions réelles de chaque format, en pixels.
 *
 * Ce sont celles de `flyerRender.service.ts` côté API : l'aperçu doit montrer
 * exactement la page qui sera photographiée en PNG, sinon on modifierait à une
 * échelle qui n'est pas celle du fichier livré.
 */
const FORMAT_PAGE: Record<FlyerFormat, PageFormat> = {
  square: { width: '1080px', height: '1080px' },
  story: { width: '1080px', height: '1920px' },
  banner: { width: '1200px', height: '630px' },
  post: { width: '1200px', height: '1500px' },
  a4: { width: '1240px', height: '1754px' },
};

/** Largeur/hauteur estimées du menu, pour le placer sans sortir de la page. */
const MENU_WIDTH = 190;
const MENU_HEIGHT = 44;
const MENU_GAP = 8;

/**
 * Aperçu d'un visuel, avec sélection au survol et menu « Modifier ».
 *
 * Reprend exactement le geste de l'aperçu des documents (charte graphique,
 * business plan) : le visuel est rendu dans la même iframe que l'éditeur, donc
 * survoler un élément le désigne, et cliquer ouvre un menu qui mène à l'éditeur
 * SUR CET ÉLÉMENT — pas sur le début du document.
 *
 * Pourquoi la même iframe qu'ailleurs : c'est le seul moyen d'avoir un aperçu
 * pixel pour pixel identique au PNG produit, et de réutiliser le repérage
 * d'éléments déjà écrit une fois. Un `<img>` ne saurait ni surligner ni
 * désigner ce sur quoi on clique.
 *
 * Le HTML n'arrive pas avec la liste des visuels (trop lourd pour une grille de
 * vignettes) : il est demandé ici, visuel par visuel, à l'ouverture.
 */
@Component({
  selector: 'app-visual-preview',
  imports: [TranslateModule, EditorCanvasComponent],
  templateUrl: './visual-preview.html',
  styleUrl: './visual-preview.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class VisualPreview {
  private readonly communication = inject(CommunicationService);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);

  readonly projectId = input.required<string>();
  /** Visuel à montrer. Son `html` peut être vide : il est alors chargé ici. */
  readonly visual = input.required<Flyer>();
  /** Polices de la marque, sans quoi le rendu retombe sur la police système. */
  readonly fonts = input<FontHints>({});
  /** Hauteur maximale de l'aperçu à l'écran (le zoom s'ajuste pour y tenir). */
  readonly maxHeight = input<number>(460);

  /** L'utilisateur a demandé à retoucher : l'hôte peut fermer sa fenêtre avant. */
  readonly editRequested = output<void>();

  private readonly canvas = viewChild(EditorCanvasComponent);
  private readonly menuEdit = viewChild<ElementRef<HTMLButtonElement>>('menuEdit');

  protected readonly isLoading = signal(false);
  protected readonly loadFailed = signal(false);
  protected readonly selection = signal<EditorSelection | null>(null);

  /** HTML complet du visuel, chargé à la demande. */
  private readonly html = signal<string>('');

  protected readonly pageFormat = computed<PageFormat>(
    () => FORMAT_PAGE[this.visual().format] ?? FORMAT_PAGE.square,
  );

  /** Position du menu, dans le repère du document zoomé. */
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

    // Sous l'élément quand il y a la place, au-dessus sinon : un menu qui sort
    // de la page est un menu inatteignable.
    return bottom + MENU_GAP + MENU_HEIGHT <= docHeight
      ? { left, top: bottom + MENU_GAP }
      : { left, top: Math.max(0, rect.top * zoom - MENU_GAP - MENU_HEIGHT) };
  });

  /** Ce que le clic a désigné, dit en mots — « ce texte », « cette image ». */
  protected readonly selectionLabel = computed(() => {
    const selection = this.selection();
    if (!selection) return '';
    if (selection.tag === 'IMG') return 'dashboard.showCommunication.preview.kinds.image';
    if (selection.isTextLeaf) return 'dashboard.showCommunication.preview.kinds.text';
    return 'dashboard.showCommunication.preview.kinds.block';
  });

  constructor() {
    // Le visuel peut changer sans que le composant soit recréé (variante
    // suivante, déclinaison) : le HTML doit suivre.
    effect(() => {
      const visual = this.visual();
      if (!visual?.id) return;
      if (visual.html) {
        this.html.set(visual.html);
        return;
      }
      this.fetch(visual.id);
    });

    // Rendu dès que le HTML et l'iframe sont là, et à chaque changement de HTML.
    effect(() => {
      const html = this.html();
      const canvas = this.canvas();
      const visual = this.visual();
      // Les polices sont LUES ici pour que l'effet en dépende : elles arrivent
      // avec le projet, parfois après le premier rendu, et sans cette lecture le
      // visuel resterait affiché en police système.
      this.fonts();
      if (!html || !canvas) return;
      canvas.render([
        {
          id: visual.id,
          name: visual.id,
          type: `flyer-${visual.format}`,
          html,
        },
      ]);
    });
  }

  private fetch(visualId: string): void {
    this.isLoading.set(true);
    this.loadFailed.set(false);
    this.communication.getVisual(this.projectId(), visualId).subscribe({
      next: (visual) => {
        this.html.set(visual.html || '');
        this.isLoading.set(false);
        this.loadFailed.set(!visual.html);
      },
      error: () => {
        this.isLoading.set(false);
        this.loadFailed.set(true);
      },
    });
  }

  protected onSelectionChange(selection: EditorSelection | null): void {
    this.selection.set(selection);
    if (!selection) return;
    // Le focus passe sur « Modifier » : Entrée ouvre l'éditeur, Échap referme.
    afterNextRender(() => this.menuEdit()?.nativeElement.focus({ preventScroll: true }), {
      injector: this.injector,
    });
  }

  protected closeMenu(): void {
    this.canvas()?.clearSelection();
    this.selection.set(null);
  }

  /**
   * Ouvre l'éditeur SUR l'élément cliqué.
   *
   * Sans les paramètres de cible, l'utilisateur atterrirait en haut du visuel et
   * devrait retrouver lui-même ce qu'il venait de désigner.
   */
  protected edit(): void {
    const selection = this.selection();
    const queryParams: Record<string, string> = { flyerId: this.visual().id };
    if (selection) {
      queryParams[EDITOR_TARGET_PARAMS.section] = selection.sectionId;
      queryParams[EDITOR_TARGET_PARAMS.path] = selection.path;
    }
    this.editRequested.emit();
    this.router.navigate(['/project/communication/flyer/edit'], { queryParams });
  }
}

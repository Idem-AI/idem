import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { Router } from '@angular/router';
import { EDITOR_TARGET_PARAMS, EditTarget, FontHints, IdemDocumentPreviewComponent, PageFormat } from '@idem/shared-document-editor/angular';
import { CommunicationService } from '../../../../services/ai-agents/communication.service';
import { Flyer, FlyerFormat } from '../../../../models/communication.model';

/**
 * Dimensions réelles de chaque format, en pixels — celles du rendu PNG côté API : l'aperçu
 * montre exactement la page qui sera photographiée.
 */
const FORMAT_PAGE: Record<FlyerFormat, PageFormat> = {
  square: { width: '1080px', height: '1080px' },
  story: { width: '1080px', height: '1920px' },
  banner: { width: '1200px', height: '630px' },
  post: { width: '1200px', height: '1500px' },
  a4: { width: '1240px', height: '1754px' },
};

/**
 * Aperçu d'un visuel de Communication : l'aperçu éditable partagé (`<idem-document-preview>`,
 * le même qu'iVision) — survoler cadre un élément, cliquer ouvre « Modifier » qui mène à
 * l'éditeur SUR CET ÉLÉMENT. Ce composant ne fait que charger le HTML et ouvrir l'éditeur d'IDEM.
 *
 * Le HTML n'arrive pas avec la liste des visuels (trop lourd pour une grille de vignettes) :
 * il est demandé ici, visuel par visuel, à l'ouverture.
 */
@Component({
  selector: 'app-visual-preview',
  imports: [IdemDocumentPreviewComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <idem-document-preview
      [html]="html()"
      [section]="{ id: visual().id, name: visual().id, type: 'flyer-' + visual().format }"
      [pageFormat]="pageFormat()"
      [fonts]="fonts()"
      [maxHeight]="maxHeight()"
      [loading]="isLoading()"
      [failed]="loadFailed()"
      (editRequested)="edit($event)"
    />
  `,
})
export class VisualPreview {
  private readonly communication = inject(CommunicationService);
  private readonly router = inject(Router);

  readonly projectId = input.required<string>();
  /** Visuel à montrer. Son `html` peut être vide : il est alors chargé ici. */
  readonly visual = input.required<Flyer>();
  /** Polices de la marque, sans quoi le rendu retombe sur la police système. */
  readonly fonts = input<FontHints>({});
  /** Hauteur maximale de l'aperçu à l'écran (le zoom s'ajuste pour y tenir). */
  readonly maxHeight = input<number>(460);

  /** L'utilisateur a demandé à retoucher : l'hôte peut fermer sa fenêtre avant. */
  readonly editRequested = output<void>();

  protected readonly isLoading = signal(false);
  protected readonly loadFailed = signal(false);
  protected readonly html = signal<string>('');
  protected readonly pageFormat = computed<PageFormat>(() => FORMAT_PAGE[this.visual().format] ?? FORMAT_PAGE.square);

  constructor() {
    // Le visuel peut changer sans que le composant soit recréé (variante suivante, déclinaison).
    effect(() => {
      const visual = this.visual();
      if (!visual?.id) return;
      if (visual.html) this.html.set(visual.html);
      else this.fetch(visual.id);
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

  /** Ouvre l'éditeur d'IDEM sur l'élément cliqué. */
  protected edit(target: EditTarget): void {
    const queryParams: Record<string, string> = { flyerId: this.visual().id, [EDITOR_TARGET_PARAMS.section]: target.sectionId };
    if (target.path !== null) queryParams[EDITOR_TARGET_PARAMS.path] = target.path;
    this.editRequested.emit();
    this.router.navigate(['/project/communication/flyer/edit'], { queryParams });
  }
}

import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { DeliverableCardData } from '../../models/chat.model';

const MAX_VISIBLE_SECTIONS = 6;

/**
 * Carte de document affichée dans le fil de conversation.
 * Élément clé du mode Chat pour tous les livrables : icône + titre +
 * métadonnées + aperçu des sections + actions (Prévisualiser, Télécharger,
 * Ouvrir dans l'éditeur).
 */
@Component({
  selector: 'app-deliverable-card',
  standalone: true,
  imports: [DatePipe, TranslateModule],
  templateUrl: './deliverable-card.html',
  styleUrl: './deliverable-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeliverableCardComponent {
  readonly card = input.required<DeliverableCardData>();
  readonly busy = input<boolean>(false);

  readonly previewRequested = output<void>();
  readonly downloadRequested = output<void>();
  readonly generateRequested = output<void>();
  readonly editorRequested = output<void>();

  protected readonly visibleSections = computed(() =>
    this.card().sections.slice(0, MAX_VISIBLE_SECTIONS),
  );

  protected readonly hiddenSectionsCount = computed(() =>
    Math.max(0, this.card().sections.length - MAX_VISIBLE_SECTIONS),
  );

  protected readonly canUsePdf = computed(() => this.card().available && this.card().pdfSupported);

  /**
   * Lire le document dans le fil. Un livrable téléchargeable n'est pas
   * forcément lisible : le rapport financier est produit à la demande, il n'a
   * pas de pages à montrer avant d'être demandé.
   */
  protected readonly canPreview = computed(
    () => this.card().available && this.card().previewSupported,
  );

  protected readonly showGenerate = computed(
    () => !this.card().available && !!this.card().generateRoute,
  );
}

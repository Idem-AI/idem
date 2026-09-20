import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import {
  DocumentPreviewComponent,
  PreviewDocumentType,
} from '../../../dashboard/components/document-preview/document-preview';
import { SectionCompletionItem } from '../../../dashboard/models/generation-completeness';

/**
 * Tiroir de lecture d'un document généré, ouvert depuis le fil.
 *
 * Il ne montre plus un PDF : c'est l'aperçu du mode Avancé, le même qu'on
 * ouvre depuis le tableau de bord — mêmes pages que l'éditeur, pages
 * manquantes signalées à leur place, régénération page par page, zoom et
 * téléchargement. Le PDF n'est demandé à l'API qu'au téléchargement.
 *
 * Les régénérations ne sont pas traitées ici : elles repartent dans la
 * conversation, où l'utilisateur suit la progression comme pour toute autre
 * génération lancée depuis le chat.
 */
@Component({
  selector: 'app-document-preview-panel',
  standalone: true,
  imports: [TranslateModule, DocumentPreviewComponent],
  templateUrl: './document-preview-panel.html',
  styleUrl: './document-preview-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentPreviewPanelComponent {
  readonly title = input.required<string>();
  readonly documentType = input.required<PreviewDocumentType>();
  /** Document affiché quand le projet en garde plusieurs. */
  readonly documentId = input<string | null>(null);
  readonly outline = input<readonly SectionCompletionItem[]>([]);
  readonly sectionLabelPrefix = input<string>('');
  /** Une génération est déjà en cours : les régénérations sont désactivées. */
  readonly busy = input<boolean>(false);

  readonly closed = output<void>();
  /** Régénérer une section (nom canonique de l'étape côté API). */
  readonly regenerateSection = output<string>();
  /** Compléter : seules les pages manquantes ou en échec sont générées. */
  readonly resumeGeneration = output<void>();
  readonly regenerateAll = output<void>();
}

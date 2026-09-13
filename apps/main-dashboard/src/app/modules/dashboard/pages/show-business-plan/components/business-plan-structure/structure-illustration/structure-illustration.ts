import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { BusinessPlanAudience } from '../../../../../models/business-plan-structure.model';

/** Une illustration par destinataire, pour les tuiles du choix de structure. */
export type StructureIllustrationKind = BusinessPlanAudience;

/**
 * Petites illustrations SVG des destinataires d'un business plan.
 *
 * Sobres à dessein : elles aident à reconnaître une réponse d'un coup d'œil,
 * elles ne décorent pas. Tons neutres tirés du thème ; seul l'accent passe à
 * la couleur primaire quand la tuile est retenue.
 */
@Component({
  selector: 'app-structure-illustration',
  templateUrl: './structure-illustration.html',
  styleUrl: './structure-illustration.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StructureIllustrationComponent {
  readonly kind = input.required<StructureIllustrationKind>();
}

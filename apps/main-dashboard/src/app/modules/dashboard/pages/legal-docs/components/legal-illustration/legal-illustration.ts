import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { LegalFormCode } from '../../../../models/legalDocs.model';

/** Scènes illustrées de l'espace juridique. */
export type LegalScene =
  | 'hero'
  | 'writing'
  | 'ready'
  | 'solo'
  | 'solo-shield'
  | 'solo-growth'
  | 'partners'
  | 'startup'
  | 'corporate';

/** Chaque forme juridique a sa scène : on reconnaît la forme d'un coup d'œil. */
export const FORM_SCENES: Record<LegalFormCode, LegalScene> = {
  ei: 'solo',
  sole_trader: 'solo',
  sarlu: 'solo-shield',
  sasu: 'solo-growth',
  sarl: 'partners',
  ltd: 'partners',
  sas: 'startup',
  sa: 'corporate',
  plc: 'corporate',
};

/**
 * Illustrations SVG de l'espace juridique.
 *
 * Chaque scène est un objet de la culture africaine choisi pour ce qu'il
 * dit de la forme juridique (AGENTS.md § 4). Dessinées au trait en
 * `currentColor`, comme `app-mode-illustration` : elles suivent le thème et
 * la couleur primaire du produit.
 */
@Component({
  selector: 'app-legal-illustration',
  templateUrl: './legal-illustration.html',
  styleUrl: './legal-illustration.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LegalIllustrationComponent {
  readonly scene = input.required<LegalScene>();
}

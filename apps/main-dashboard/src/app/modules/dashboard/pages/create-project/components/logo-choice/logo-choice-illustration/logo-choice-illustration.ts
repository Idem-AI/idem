import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

/** Les deux façons d'obtenir un logo : importer le sien, ou en faire générer. */
export type LogoChoiceKind = 'import' | 'ai';

/**
 * Illustrations SVG de l'écran « Avez-vous déjà un logo ? ».
 *
 * Le tampon adinkra et ses empreintes (AGENTS.md § 4) : le logo, c'est le
 * signe qu'on imprime. Dessinées au trait comme celles des modes
 * d'interface : elles suivent le thème et la couleur primaire du produit.
 */
@Component({
  selector: 'app-logo-choice-illustration',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './logo-choice-illustration.html',
  styleUrl: './logo-choice-illustration.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LogoChoiceIllustrationComponent {
  readonly kind = input.required<LogoChoiceKind>();
}

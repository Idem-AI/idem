import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UiMode } from '../../models/ui-mode.model';

/**
 * Illustrations SVG des deux modes d'interface, chacune un objet de la
 * culture africaine (AGENTS.md § 4) : l'échelle dogon pour le mode assisté,
 * le plateau d'awalé pour le tableau de bord.
 *
 * Dessinées au trait en `currentColor` : elles suivent le thème clair/sombre
 * et la couleur primaire du produit.
 */
@Component({
  selector: 'app-mode-illustration',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './mode-illustration.html',
  styleUrl: './mode-illustration.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModeIllustrationComponent {
  readonly mode = input.required<UiMode>();
}

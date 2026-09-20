import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

/** Les deux façons de faire naître le logo. */
export type LogoModeKind = 'ai' | 'custom';

/**
 * Exemple visuel des deux modes de création.
 *
 * L'opposition est portée par l'image : d'un côté plusieurs concepts naissent
 * d'un coup de baguette, de l'autre un texte écrit à la main produit une
 * forme précise. Chacune reprend la couleur d'accent de sa carte.
 */
@Component({
  selector: 'app-logo-mode-sample',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './logo-mode-sample.html',
  styleUrl: './logo-mode-sample.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LogoModeSampleComponent {
  readonly kind = input.required<LogoModeKind>();
}

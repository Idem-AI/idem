import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LogoType } from '../../../../../models/logo.model';

/**
 * Exemple visuel d'un type de logo.
 *
 * Les trois variantes montrent **la même marque fictive** traitée de trois
 * façons — symbole seul, nom complet, monogramme — pour que la différence
 * saute aux yeux plutôt que d'être devinée depuis des marques réelles.
 * Dessinées en variables de thème, elles suivent le clair/sombre.
 */
@Component({
  selector: 'app-logo-type-sample',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './logo-type-sample.html',
  styleUrl: './logo-type-sample.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LogoTypeSampleComponent {
  readonly type = input.required<LogoType>();
}

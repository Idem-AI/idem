import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

/** Les deux façons de faire naître le logo. */
export type LogoModeKind = 'ai' | 'custom';

/**
 * Illustrations des deux modes de création du logo, au trait (AGENTS.md § 4),
 * autour du tampon adinkra en calebasse — le signe qu'on imprime, l'objet de
 * l'identité dans le répertoire :
 *  - IA : le tampon en plein geste a imprimé trois signes ; un est retenu ;
 *  - description : le tampon qu'on taille soi-même au couteau, d'après le
 *    motif tracé — le signe sera exactement celui qu'on a décrit. Les tampons
 *    adinkra sont taillés à la main dans la calebasse (Ntonso, Ghana).
 */
@Component({
  selector: 'app-logo-mode-sample',
  imports: [CommonModule],
  templateUrl: './logo-mode-sample.html',
  styleUrl: './logo-mode-sample.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LogoModeSampleComponent {
  readonly kind = input.required<LogoModeKind>();
}

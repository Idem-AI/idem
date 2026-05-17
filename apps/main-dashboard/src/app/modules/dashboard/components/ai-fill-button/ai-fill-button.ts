import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

/**
 * Bouton "Remplir avec l'IA" — réutilisable au niveau d'une section entière
 * ou en variante "icon" à côté d'un champ individuel.
 *
 * La logique de remplissage est gérée par le parent qui écoute l'évènement
 * `triggered`. Phase 2: bouton fonctionnel + animation; Phase 3: le parent
 * appellera le service IA pour remplir réellement.
 */
@Component({
  selector: 'app-ai-fill-button',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ai-fill-button.html',
})
export class AiFillButtonComponent {
  /** 'section' = bouton large, 'field' = icône discrète */
  readonly variant = input<'section' | 'field'>('section');
  /** État de chargement (parent contrôle quand l'IA répond) */
  readonly loading = input<boolean>(false);
  /** Désactive le bouton */
  readonly disabled = input<boolean>(false);
  /** Libellé custom (sinon traduction par défaut) */
  readonly labelKey = input<string>('dashboard.finance.aiFill.button');
  /** Tooltip pour la variante 'field' */
  readonly tooltipKey = input<string>('dashboard.finance.aiFill.tooltip');

  readonly triggered = output<void>();

  onClick(event: Event): void {
    event.stopPropagation();
    if (this.disabled() || this.loading()) return;
    this.triggered.emit();
  }
}

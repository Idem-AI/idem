import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { GenerationCompleteness } from '../../models/generation-completeness';

/**
 * Panneau d'état d'une génération IA par sections (business plan, pitch deck,
 * charte graphique).
 *
 * Les deux états partagent la même présentation (compteur, barre segmentée,
 * liste repliable) : seuls la couleur d'accent et les actions changent. Le
 * détail des sections est déplié d'office quand il manque quelque chose —
 * c'est le seul moment où l'utilisateur a besoin de le lire.
 */
@Component({
  selector: 'app-generation-status-panel',
  imports: [TranslateModule],
  templateUrl: './generation-status-panel.html',
  styleUrl: './generation-status-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GenerationStatusPanelComponent {
  /** Résultat de analyzeGenerationCompleteness pour le document affiché. */
  readonly completeness = input.required<GenerationCompleteness>();

  /**
   * Préfixe de clé de traduction pour les noms de sections (doit se terminer
   * par un point, ex: 'dashboard.generationPanel.sections.businessPlan.').
   * Vide → le nom brut de la section est affiché.
   */
  readonly sectionLabelPrefix = input<string>('');

  /** Désactive les actions pendant qu'une génération est en cours. */
  readonly disabled = input<boolean>(false);

  /** Reprendre la génération (sections manquantes/vides uniquement). */
  readonly resume = output<void>();
  /** Tout régénérer de zéro. */
  readonly regenerateAll = output<void>();
  /** Régénérer une seule section (nom canonique backend). */
  readonly regenerateSection = output<string>();

  /**
   * Déplié par défaut quand le document est incomplet ; se recale si la
   * complétude change (fin d'une reprise), tout en laissant l'utilisateur
   * replier ou déplier à la main entre-temps.
   */
  protected readonly expanded = linkedSignal(() => !this.completeness().isComplete);

  protected readonly headingKey = computed(() =>
    this.completeness().isComplete
      ? 'dashboard.generationPanel.completeTitle'
      : 'dashboard.generationPanel.incompleteTitle',
  );

  protected toggleExpanded(): void {
    this.expanded.update((value) => !value);
  }

  protected onRegenerateSection(name: string): void {
    if (!this.disabled()) {
      this.regenerateSection.emit(name);
    }
  }
}

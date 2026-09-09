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

  /** Sections ayant un avertissement de qualité (ex. sous-remplissage PDF). */
  readonly warningSections = input<string[]>([]);

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

  protected readonly hasWarnings = computed(() => (this.warningSections() ?? []).length > 0);

  /**
   * Déplié par défaut quand le document est incomplet ou présente des avertissements ;
   * se recale si la complétude ou les avertissements changent.
   */
  protected readonly expanded = linkedSignal(
    () => !this.completeness().isComplete || this.hasWarnings(),
  );

  protected readonly headingKey = computed(() => {
    if (!this.completeness().isComplete) {
      return 'dashboard.generationPanel.incompleteTitle';
    }
    if (this.hasWarnings()) {
      return 'dashboard.generationPanel.warningTitle';
    }
    return 'dashboard.generationPanel.completeTitle';
  });

  protected readonly subtitleKey = computed(() => {
    if (!this.completeness().isComplete) {
      return 'dashboard.generationPanel.incompleteSubtitle';
    }
    if (this.hasWarnings()) {
      return 'dashboard.generationPanel.warningSubtitle';
    }
    return 'dashboard.generationPanel.completeSubtitle';
  });

  protected toggleExpanded(): void {
    this.expanded.update((value) => !value);
  }

  protected onRegenerateSection(name: string): void {
    if (!this.disabled()) {
      this.regenerateSection.emit(name);
    }
  }
}

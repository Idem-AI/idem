import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { GenerationCompleteness } from '../../models/generation-completeness';

/**
 * Panneau d'état d'une génération IA par sections (business plan, pitch deck,
 * charte graphique).
 *
 * - Document incomplet : bannière d'avertissement listant les sections
 *   manquantes/vides, avec reprise de la génération, régénération complète et
 *   régénération section par section.
 * - Document complet : panneau replié donnant accès à la régénération d'une
 *   section particulière.
 */
@Component({
  selector: 'app-generation-status-panel',
  imports: [TranslateModule],
  templateUrl: './generation-status-panel.html',
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

  protected readonly expanded = signal(false);

  protected toggleExpanded(): void {
    this.expanded.update((value) => !value);
  }

  protected onRegenerateSection(name: string): void {
    if (!this.disabled()) {
      this.regenerateSection.emit(name);
    }
  }
}

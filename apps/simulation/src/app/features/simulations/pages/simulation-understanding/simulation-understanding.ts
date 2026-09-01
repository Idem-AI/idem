import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { EvidenceChip } from '../../components/evidence-chip/evidence-chip';
import { SimulationStore } from '../../data-access';
import { KnowledgeState, groupKnowledge } from '../../models';

/**
 * Ce que le moteur a compris du projet, et surtout ce qu'il n'a pas compris.
 * Les quatre états sont montrés côte à côte : masquer les trous ferait passer
 * une hypothèse pour une donnée.
 */
@Component({
  selector: 'sim-simulation-understanding',
  imports: [TranslatePipe, EvidenceChip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './simulation-understanding.html',
})
export class SimulationUnderstanding {
  private readonly store = inject(SimulationStore);

  protected readonly simulation = this.store.active;
  protected readonly understanding = computed(() => this.simulation()?.understanding ?? null);
  protected readonly evidence = computed(() => this.simulation()?.evidence ?? []);

  protected readonly profileRows = computed(() => {
    const profile = this.understanding()?.profile;
    if (!profile) {
      return [];
    }
    return [
      { key: 'sector', value: profile.sector },
      { key: 'businessModel', value: profile.businessModel },
      { key: 'product', value: profile.product },
      { key: 'targetCustomer', value: profile.targetCustomer },
      { key: 'market', value: profile.market },
      { key: 'location', value: `${profile.location}, ${profile.country}` },
      { key: 'pricePoint', value: profile.pricePoint },
      { key: 'plannedFunding', value: profile.plannedFunding },
      { key: 'teamSize', value: profile.teamSize },
    ].filter((row): row is { key: string; value: string } => Boolean(row.value));
  });

  protected readonly baselineRows = computed(() => {
    const baseline = this.understanding()?.baseline;
    if (!baseline) {
      return [];
    }
    const money = (value: number) =>
      `${value.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} ${baseline.currency}`;
    const percent = (value: number) => `${(value * 100).toFixed(1)} %`;
    return [
      { key: 'unitPrice', value: money(baseline.unitPrice) },
      { key: 'unitVariableCost', value: money(baseline.unitVariableCost) },
      { key: 'monthlyFixedCosts', value: money(baseline.monthlyFixedCosts) },
      { key: 'acquisitionCost', value: money(baseline.acquisitionCost) },
      { key: 'startingCapital', value: money(baseline.startingCapital) },
      { key: 'initialMonthlyCustomers', value: String(baseline.initialMonthlyCustomers) },
      { key: 'monthlyGrowthRate', value: percent(baseline.monthlyGrowthRate) },
      { key: 'monthlyRetentionRate', value: percent(baseline.monthlyRetentionRate) },
      { key: 'purchasesPerCustomerPerMonth', value: baseline.purchasesPerCustomerPerMonth.toFixed(1) },
    ];
  });

  /**
   * « Ce que nous savons » ne retient que ce que la source établit : une
   * estimation du moteur affichée au même endroit qu'une ligne du business
   * plan ferait passer l'une pour l'autre.
   */
  protected readonly groups = computed(() => groupKnowledge(this.understanding()?.items ?? []));

  /** Ce que la source dit et qu'aucun champ du profil n'accueille. */
  protected readonly extras = computed(() => this.understanding()?.extras ?? []);

  /** La phrase de catégorie nomme la source réellement lue. */
  protected knowledgeHintKey(state: KnowledgeState): string {
    if (state === 'known') {
      return this.simulation()?.origin === 'imported-document'
        ? 'knowledgeHint.knownDocument'
        : 'knowledgeHint.knownProject';
    }
    return `knowledgeHint.${state}`;
  }
}

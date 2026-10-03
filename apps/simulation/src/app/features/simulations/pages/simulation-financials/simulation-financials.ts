import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { DisclaimerNote } from '../../../../shared/components/disclaimer-note/disclaimer-note';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { CashflowChart } from '../../components/cashflow-chart/cashflow-chart';
import { SensitivityChart } from '../../components/sensitivity-chart/sensitivity-chart';
import { SimulationStore } from '../../data-access';
import { formatMoney } from '../../ui/tones';

interface Metric {
  key: string;
  value?: string;
  valueKey?: string;
  params?: Record<string, unknown>;
}

/**
 * « Votre argent » : combien il faut, quand on commence à gagner, combien de
 * temps la caisse tient. Chaque chiffre porte une phrase qui dit ce qu'il
 * mesure — personne n'a à savoir ce qu'est un point mort.
 */
@Component({
  selector: 'sim-simulation-financials',
  imports: [TranslatePipe, CashflowChart, SensitivityChart, DisclaimerNote, PageHeader, EmptyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './simulation-financials.html',
})
export class SimulationFinancials {
  private readonly store = inject(SimulationStore);

  protected readonly result = computed(() => this.store.active()?.result ?? null);
  protected readonly financials = computed(() => this.result()?.financials ?? null);

  protected readonly headline = computed<Metric[]>(() => {
    const financials = this.financials();
    if (!financials) {
      return [];
    }
    return [
      { key: 'capital', value: formatMoney(financials.capitalRequired, financials.currency) },
      financials.breakEvenMonth === null
        ? { key: 'breakEven', valueKey: 'financials.never' }
        : { key: 'breakEven', valueKey: 'financials.monthN', params: { month: financials.breakEvenMonth } },
      financials.runwayMonths === null
        ? { key: 'runway', valueKey: 'financials.beyondHorizon' }
        : { key: 'runway', valueKey: 'financials.monthsN', params: { months: financials.runwayMonths } },
      { key: 'burn', value: formatMoney(financials.monthlyBurnRate, financials.currency) },
    ];
  });

  protected readonly secondary = computed<Metric[]>(() => {
    const financials = this.financials();
    if (!financials) {
      return [];
    }
    return [
      { key: 'margin', value: `${Math.round(financials.grossMargin * 100)} %` },
      { key: 'revenueYear1', value: formatMoney(financials.revenueYear1, financials.currency) },
      { key: 'revenueYear3', value: formatMoney(financials.revenueYear3, financials.currency) },
    ];
  });
}

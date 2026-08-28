import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { DisclaimerNote } from '../../../../shared/components/disclaimer-note/disclaimer-note';
import { CashflowChart } from '../../components/cashflow-chart/cashflow-chart';
import { SensitivityChart } from '../../components/sensitivity-chart/sensitivity-chart';
import { SimulationStore } from '../../data-access';

/**
 * Les chiffres produits par le moteur déterministe : trajectoire de
 * trésorerie, sensibilité aux leviers, et seuils à franchir.
 */
@Component({
  selector: 'sim-simulation-financials',
  imports: [TranslatePipe, CashflowChart, SensitivityChart, DisclaimerNote],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './simulation-financials.html',
})
export class SimulationFinancials {
  private readonly store = inject(SimulationStore);

  protected readonly result = computed(() => this.store.active()?.result ?? null);
  protected readonly financials = computed(() => this.result()?.financials ?? null);

  protected readonly headline = computed(() => {
    const financials = this.financials();
    if (!financials) {
      return [];
    }
    const money = (value: number) =>
      `${Math.round(value).toLocaleString('fr-FR')} ${financials.currency}`;
    return [
      {
        key: 'breakEven',
        value:
          financials.breakEvenMonth === null
            ? null
            : String(financials.breakEvenMonth),
        suffixKey: financials.breakEvenMonth === null ? 'financials.never' : 'financials.monthUnit',
      },
      {
        key: 'runway',
        value: financials.runwayMonths === null ? null : String(financials.runwayMonths),
        suffixKey: financials.runwayMonths === null ? 'financials.beyondHorizon' : 'financials.monthsUnit',
      },
      { key: 'burn', value: money(financials.monthlyBurnRate), suffixKey: null },
      { key: 'capital', value: money(financials.capitalRequired), suffixKey: null },
      { key: 'margin', value: `${Math.round(financials.grossMargin * 100)} %`, suffixKey: null },
      { key: 'revenueYear1', value: money(financials.revenueYear1), suffixKey: null },
      { key: 'revenueYear3', value: money(financials.revenueYear3), suffixKey: null },
    ];
  });
}

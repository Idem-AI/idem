import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';

import { DisclaimerNote } from '../../../../shared/components/disclaimer-note/disclaimer-note';
import { CashflowChart } from '../../components/cashflow-chart/cashflow-chart';
import { EvidenceChip } from '../../components/evidence-chip/evidence-chip';
import { FactorImpactList } from '../../components/factor-impact-list/factor-impact-list';
import { ScenarioTable } from '../../components/scenario-table/scenario-table';
import { SensitivityChart } from '../../components/sensitivity-chart/sensitivity-chart';
import { VerdictBadge } from '../../components/verdict-badge/verdict-badge';
import { ViabilityGauge } from '../../components/viability-gauge/viability-gauge';
import { SimulationGateway, SimulationStore } from '../../data-access';
import { FactorTier, SimulationReport } from '../../models';

interface ReportSection {
  id: string;
  /** Translation key for the section heading. */
  labelKey: string;
}

/**
 * A definition-list row. `value` is literal content from the report;
 * `valueKey` is a translation key, so language switches stay reactive.
 */
interface ReportRow {
  labelKey: string;
  value?: string;
  valueKey?: string;
  valueParams?: Record<string, unknown>;
}

/**
 * The full report.
 *
 * Numbered sections here are the document's own structure, not decoration:
 * this is the artefact people export, quote and hand to an investor.
 */
@Component({
  selector: 'sim-simulation-report',
  imports: [
    RouterLink,
    DatePipe,
    TranslatePipe,
    ViabilityGauge,
    VerdictBadge,
    FactorImpactList,
    ScenarioTable,
    SensitivityChart,
    CashflowChart,
    EvidenceChip,
    DisclaimerNote,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './simulation-report.html',
})
export class SimulationReportPage {
  readonly id = input.required<string>();

  private readonly gateway = inject(SimulationGateway);
  private readonly store = inject(SimulationStore);

  protected readonly simulation = this.store.active;
  protected readonly report = signal<SimulationReport | null>(null);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);

  protected readonly sections: readonly ReportSection[] = [
    { id: 'summary', labelKey: 'report.section.summary' },
    { id: 'profile', labelKey: 'report.section.profile' },
    { id: 'factors', labelKey: 'report.section.factors' },
    { id: 'scenarios', labelKey: 'report.section.scenarios' },
    { id: 'financials', labelKey: 'report.section.financials' },
    { id: 'sensitivity', labelKey: 'report.section.sensitivity' },
    { id: 'conditions', labelKey: 'report.section.conditions' },
    { id: 'recommendations', labelKey: 'report.section.recommendations' },
    { id: 'evidence', labelKey: 'report.section.evidence' },
    { id: 'validation', labelKey: 'report.section.validation' },
  ];

  protected readonly factorGroups = computed<
    readonly { tier: FactorTier; count: number; factors: SimulationReport['factors'] }[]
  >(() => {
    const factors = this.report()?.factors ?? [];
    const tiers: FactorTier[] = ['critical', 'important', 'secondary', 'unknown'];
    return tiers.map((tier) => {
      const matching = factors.filter((factor) => factor.tier === tier);
      return { tier, count: matching.length, factors: matching };
    });
  });

  protected readonly scenarioRange = computed(() => {
    const scenarios = this.report()?.scenarios ?? [];
    if (!scenarios.length) {
      return null;
    }
    const values = scenarios.map((scenario) => scenario.viability);
    return { min: Math.min(...values), max: Math.max(...values) };
  });

  protected readonly profileRows = computed<readonly ReportRow[]>(() => {
    const profile = this.report()?.profile;
    if (!profile) {
      return [];
    }
    return [
      { labelKey: 'profile.sector', value: profile.sector },
      { labelKey: 'profile.businessModel', value: profile.businessModel },
      { labelKey: 'profile.product', value: profile.product },
      { labelKey: 'profile.targetCustomer', value: profile.targetCustomer },
      { labelKey: 'profile.market', value: profile.market },
      { labelKey: 'profile.location', value: `${profile.location}, ${profile.country}` },
      { labelKey: 'profile.pricePoint', value: profile.pricePoint ?? '—' },
      { labelKey: 'profile.plannedFunding', value: profile.plannedFunding ?? '—' },
      { labelKey: 'profile.teamSize', value: profile.teamSize ?? '—' },
    ];
  });

  protected readonly financialRows = computed<readonly ReportRow[]>(() => {
    const financials = this.report()?.financials;
    if (!financials) {
      return [];
    }
    return [
      {
        labelKey: 'report.financials.burnRate',
        value: this.money(financials.monthlyBurnRate, financials.currency),
      },
      {
        labelKey: 'report.financials.capitalRequired',
        value: this.money(financials.capitalRequired, financials.currency),
      },
      financials.breakEvenMonth === null
        ? { labelKey: 'report.financials.breakEvenMonth', valueKey: 'scenario.never' }
        : {
            labelKey: 'report.financials.breakEvenMonth',
            valueKey: 'scenario.monthN',
            valueParams: { month: financials.breakEvenMonth },
          },
      financials.runwayMonths === null
        ? { labelKey: 'report.financials.runway', value: '—' }
        : {
            labelKey: 'report.financials.runway',
            valueKey: 'scenario.monthsN',
            valueParams: { months: financials.runwayMonths },
          },
    ];
  });

  protected readonly unmetConditions = computed(
    () => (this.report()?.conditions ?? []).filter((condition) => condition.met === false).length,
  );

  constructor() {
    effect(() => {
      const id = this.id();
      void this.store.loadOne(id);
      void this.load(id);
    });
  }

  private async load(id: string): Promise<void> {
    this.loading.set(true);
    this.failed.set(false);
    try {
      this.report.set(await firstValueFrom(this.gateway.getReport(id)));
    } catch {
      this.failed.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  protected sectionNumber(index: number): string {
    return String(index + 1).padStart(2, '0');
  }

  protected money(value: number, currency: string): string {
    return `${value.toLocaleString('fr-FR')} ${currency}`;
  }

  protected print(): void {
    window.print();
  }
}

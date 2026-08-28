import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ToastService } from '../../../../core/ui/toast.service';
import { DisclaimerNote } from '../../../../shared/components/disclaimer-note/disclaimer-note';
import { FactorImpactList } from '../../components/factor-impact-list/factor-impact-list';
import { ScenarioTable } from '../../components/scenario-table/scenario-table';
import { VerdictBadge } from '../../components/verdict-badge/verdict-badge';
import { ViabilityGauge } from '../../components/viability-gauge/viability-gauge';
import { SimulationStore } from '../../data-access';
import { FactorTier } from '../../models';

/** What the run itself buys: the judgement, and enough of the reasoning to trust it. */
@Component({
  selector: 'sim-simulation-results',
  imports: [
    RouterLink,
    TranslatePipe,
    ViabilityGauge,
    VerdictBadge,
    FactorImpactList,
    ScenarioTable,
    DisclaimerNote,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './simulation-results.html',
})
export class SimulationResults {
  readonly id = input.required<string>();

  private readonly store = inject(SimulationStore);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);
  private readonly translate = inject(TranslateService);

  protected readonly simulation = this.store.active;
  protected readonly status = this.store.activeStatus;
  protected readonly error = this.store.error;
  protected readonly buying = signal(false);

  protected readonly result = computed(() => this.simulation()?.result ?? null);

  /** Spread of the index across scenarios, which the gauge draws as a band. */
  protected readonly scenarioRange = computed(() => {
    const scenarios = this.result()?.scenarios ?? [];
    if (!scenarios.length) {
      return null;
    }
    const values = scenarios.map((scenario) => scenario.viability);
    return { min: Math.min(...values), max: Math.max(...values) };
  });

  protected readonly tierCounts = computed<readonly { tier: FactorTier; count: number }[]>(() => {
    const summary = this.result()?.factorSummary;
    if (!summary) {
      return [];
    }
    return [
      { tier: 'critical' as const, count: summary.critical },
      { tier: 'important' as const, count: summary.important },
      { tier: 'secondary' as const, count: summary.secondary },
      { tier: 'unknown' as const, count: summary.unknown },
    ];
  });

  protected readonly brokenScenarios = computed(
    () => (this.result()?.scenarios ?? []).filter((scenario) => !scenario.survives).length,
  );

  constructor() {
    effect(() => {
      void this.store.loadOne(this.id());
    });
  }

  protected async buyReport(): Promise<void> {
    this.buying.set(true);
    try {
      await this.store.purchaseReport(this.id());
      await this.router.navigate(['/simulations', this.id(), 'report']);
    } catch (error) {
      this.toasts.error(
        this.translate.instant('results.reportFailed') as string,
        error instanceof Error ? error.message : undefined,
      );
    } finally {
      this.buying.set(false);
    }
  }
}

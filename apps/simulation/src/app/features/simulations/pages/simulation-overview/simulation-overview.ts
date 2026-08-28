import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ToastService } from '../../../../core/ui/toast.service';
import { DisclaimerNote } from '../../../../shared/components/disclaimer-note/disclaimer-note';
import { PipelineProgress } from '../../components/pipeline-progress/pipeline-progress';
import { ViabilityGauge } from '../../components/viability-gauge/viability-gauge';
import { SimulationStore } from '../../data-access';
import { FactorTier } from '../../models';

/**
 * Ce que l'exécution achète : le jugement, et assez du raisonnement pour
 * décider s'il mérite d'être suivi. Le détail vit dans les écrans dédiés.
 */
@Component({
  selector: 'sim-simulation-overview',
  imports: [RouterLink, TranslatePipe, ViabilityGauge, PipelineProgress, DisclaimerNote],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './simulation-overview.html',
})
export class SimulationOverview {
  private readonly store = inject(SimulationStore);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);
  private readonly translate = inject(TranslateService);

  protected readonly simulation = this.store.active;
  protected readonly isRunning = this.store.isRunning;
  protected readonly generating = signal(false);

  protected readonly result = computed(() => this.simulation()?.result ?? null);

  /** Dispersion de l'indice à travers les scénarios, tracée en bande. */
  protected readonly scenarioRange = computed(() => {
    const values = (this.result()?.scenarios ?? [])
      .map((scenario) => scenario.outcome?.viability)
      .filter((value): value is number => typeof value === 'number');
    return values.length ? { min: Math.min(...values), max: Math.max(...values) } : null;
  });

  protected readonly tierCounts = computed<readonly { tier: FactorTier; count: number }[]>(() => {
    const summary = this.result()?.factorSummary;
    return summary
      ? [
          { tier: 'critical' as const, count: summary.critical },
          { tier: 'important' as const, count: summary.important },
          { tier: 'secondary' as const, count: summary.secondary },
          { tier: 'unknown' as const, count: summary.unknown },
        ]
      : [];
  });

  protected readonly brokenScenarios = computed(
    () => (this.result()?.scenarios ?? []).filter((scenario) => scenario.outcome?.survives === false).length,
  );

  protected async openReport(): Promise<void> {
    const run = this.simulation();
    if (!run) {
      return;
    }
    if (run.hasReport) {
      await this.router.navigate(['/simulations', run.id, 'report']);
      return;
    }
    this.generating.set(true);
    try {
      const report = await this.store.generateReport(run.id);
      if (!report) {
        throw new Error(this.store.error() ?? 'unknown');
      }
      await this.router.navigate(['/simulations', run.id, 'report']);
    } catch (error) {
      this.toasts.error(
        this.translate.instant('results.reportFailed') as string,
        error instanceof Error ? error.message : undefined,
      );
    } finally {
      this.generating.set(false);
    }
  }
}

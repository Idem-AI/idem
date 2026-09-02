import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ToastService } from '../../../../core/ui/toast.service';
import { TourService } from '../../../../core/ui/tour.service';
import { DisclaimerNote } from '../../../../shared/components/disclaimer-note/disclaimer-note';
import { PipelineProgress } from '../../components/pipeline-progress/pipeline-progress';
import { ViabilityGauge } from '../../components/viability-gauge/viability-gauge';
import { ReportDownloadService, SimulationStore } from '../../data-access';
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
export class SimulationOverview implements OnInit {
  private readonly store = inject(SimulationStore);
  private readonly reportDownload = inject(ReportDownloadService);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);
  private readonly translate = inject(TranslateService);
  private readonly tour = inject(TourService);

  ngOnInit(): void {
    // L'aperçu est la porte d'entrée du simulateur : c'est ici qu'on
    // présente les lieux, la première fois seulement.
    this.tour.maybeStart();
  }

  protected readonly simulation = this.store.active;
  protected readonly isRunning = this.store.isRunning;
  protected readonly generating = signal(false);
  protected readonly downloading = this.reportDownload.downloading;

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

  /**
   * La couleur du verdict, et rien d'autre.
   *
   * Le verdict se lit sous la jauge, comme la conclusion du chiffre qu'elle
   * affiche — pas dans un encadré teinté à côté, qui aurait donné un jugement
   * détaché de ce qui le fonde. La couleur ne porte jamais le sens seule : la
   * phrase le dit, et se suffit en noir et blanc.
   */
  protected readonly verdictColor = computed(() => {
    switch (this.result()?.verdict) {
      case 'go':
        return 'text-verdict-go';
      case 'no-go':
        return 'text-verdict-stop';
      default:
        return 'text-verdict-warn';
    }
  });

  protected readonly brokenScenarios = computed(
    () => (this.result()?.scenarios ?? []).filter((scenario) => scenario.outcome?.survives === false).length,
  );

  /**
   * Le PDF sans passer par l'écran du rapport : une fois le rapport acquis,
   * c'est le fichier que l'on transmet, pas la page.
   */
  protected async downloadReport(): Promise<void> {
    const run = this.simulation();
    if (run?.hasReport) {
      await this.reportDownload.download(run.projectId, run.id);
    }
  }

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

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
import { FactorTier, Recommendation, Risk } from '../../models';

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
    void this.tour.maybeStart();
  }

  protected readonly simulation = this.store.active;
  protected readonly isRunning = this.store.isRunning;
  protected readonly generating = signal(false);
  protected readonly resuming = signal(false);
  protected readonly downloading = this.reportDownload.downloading;

  protected readonly result = computed(() => this.simulation()?.result ?? null);

  /** Dispersion de l'indice à travers les scénarios, tracée en bande. */
  /**
   * Les problèmes, chacun avec la réponse qui le traite.
   *
   * Les recommandations vivent dans le rapport (forfait payant) : tant qu'il
   * n'a pas été produit, la liste reste celle des problèmes seuls. Dès qu'il
   * existe, la réponse se lit SOUS son problème plutôt que dans un autre écran.
   */
  protected readonly issues = computed<
    readonly { risk: Risk; responses: readonly Recommendation[] }[]
  >(() => {
    const result = this.result();
    if (!result) return [];
    const recommendations = this.simulation()?.report?.recommendations ?? [];
    const rank = (severity: Risk['severity']) =>
      ['moderate', 'high', 'critical'].indexOf(severity);
    return [...result.risks]
      .sort((a, b) => rank(b.severity) - rank(a.severity))
      .map((risk) => ({
        risk,
        responses: recommendations.filter(
          (recommendation) => recommendation.addressesRiskId === risk.id,
        ),
      }));
  });

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

  /**
   * Reprend une simulation bloquée ou échouée depuis son dernier checkpoint.
   * Le pipeline repart de l'étape suivant la dernière terminée.
   */
  protected async resume(): Promise<void> {
    const run = this.simulation();
    if (!run || this.resuming()) return;
    this.resuming.set(true);
    try {
      await this.store.resume(run.id);
    } catch (error) {
      this.toasts.error(
        this.translate.instant('run.resumeFailed') as string,
        error instanceof Error ? error.message : undefined,
      );
    } finally {
      this.resuming.set(false);
    }
  }
}

import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { finalize } from 'rxjs';

import { CookieService } from '../../../../shared/services/cookie.service';
import { SimulationSummary, SimulationVerdict } from '../../models/simulation.model';
import { SimulationService } from '../../services/simulation.service';

/**
 * Récapitulatif des simulations du projet.
 *
 * Le dashboard ne simule rien : il montre ce qui existe et renvoie vers le
 * simulateur, qui partage la même session IDEM. Sans simulation, la page
 * n'affiche pas un tableau vide mais explique ce que l'outil apporte.
 */
@Component({
  selector: 'app-simulations-overview',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './simulations-overview.html',
})
export class SimulationsOverview implements OnInit {
  private readonly simulationService = inject(SimulationService);
  private readonly cookieService = inject(CookieService);

  protected readonly loading = signal(true);
  protected readonly simulations = signal<SimulationSummary[]>([]);
  protected readonly projectId = signal<string | null>(null);

  protected readonly isEmpty = computed(() => !this.loading() && this.simulations().length === 0);

  /** Dernière exécution terminée : c'est elle qui porte le verdict affiché. */
  protected readonly latestCompleted = computed(
    () => this.simulations().find((item) => item.status === 'completed') ?? null,
  );

  /** Les quatre chiffres du bandeau, calculés ici plutôt que dans le gabarit. */
  protected readonly statTiles = computed(() => {
    const items = this.simulations();
    return [
      { labelKey: 'dashboard.simulations.stats.total', value: items.length },
      {
        labelKey: 'dashboard.simulations.stats.completed',
        value: items.filter((item) => item.status === 'completed').length,
      },
      {
        labelKey: 'dashboard.simulations.stats.running',
        value: items.filter((item) => item.status === 'running').length,
      },
      {
        labelKey: 'dashboard.simulations.stats.reports',
        value: items.filter((item) => item.hasReport).length,
      },
    ];
  });

  ngOnInit(): void {
    const projectId = this.cookieService.get('projectId');
    this.projectId.set(projectId);

    if (!projectId) {
      this.loading.set(false);
      return;
    }

    this.simulationService
      .listSimulations(projectId)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe((items) => this.simulations.set(items));
  }

  /** Ouvre le simulateur : création d'une exécution, ou une exécution précise. */
  protected openSimulator(simulationId?: string): void {
    const projectId = this.projectId();
    if (!projectId) {
      return;
    }
    window.open(this.simulationService.simulatorUrl(projectId, simulationId), '_blank');
  }

  protected verdictClass(verdict: SimulationVerdict | undefined): string {
    switch (verdict) {
      case 'go':
        return 'text-green-500 border-green-500/40 bg-green-500/10';
      case 'go-with-conditions':
        return 'text-amber-500 border-amber-500/40 bg-amber-500/10';
      case 'no-go':
        return 'text-red-500 border-red-500/40 bg-red-500/10';
      default:
        return 'text-text-secondary border-[var(--glass-border)] bg-[var(--glass-bg-subtle)]';
    }
  }

  protected statusClass(status: SimulationSummary['status']): string {
    switch (status) {
      case 'completed':
        return 'text-green-500';
      case 'running':
        return 'text-primary';
      case 'failed':
        return 'text-red-500';
      default:
        return 'text-text-secondary';
    }
  }
}

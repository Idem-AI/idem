import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';

import { ToastService } from '../../../../core/ui/toast.service';
import { DisclaimerNote } from '../../../../shared/components/disclaimer-note/disclaimer-note';
import { ConsentDialog } from '../../components/consent-dialog/consent-dialog';
import { VerdictBadge } from '../../components/verdict-badge/verdict-badge';
import { SimulationGateway, SimulationStore } from '../../data-access';
import { Simulation, SimulationConsent } from '../../models';

/**
 * Two runs of the same project, side by side.
 *
 * The comparison is the point of the loop: build, simulate, change something,
 * simulate again. What it shows is that the model resists better, never that
 * the business is more likely to succeed.
 */
@Component({
  selector: 'sim-simulation-compare',
  imports: [TranslatePipe, VerdictBadge, DisclaimerNote, ConsentDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './simulation-compare.html',
})
export class SimulationCompare {
  private readonly gateway = inject(SimulationGateway);
  private readonly store = inject(SimulationStore);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);
  private readonly translate = inject(TranslateService);

  protected readonly current = this.store.active;
  protected readonly previous = signal<Simulation | null>(null);
  protected readonly loading = signal(true);
  protected readonly relaunching = signal(false);
  /**
   * Vrai pendant que l'accord est demandé. Une relance est une exécution comme
   * une autre : elle relit le projet et le confie aux moteurs d'IA, l'accord se
   * redonne donc ici aussi.
   */
  protected readonly askingConsent = signal(false);

  protected readonly delta = computed(() => {
    const before = this.previous()?.result?.viabilityIndex;
    const after = this.current()?.result?.viabilityIndex;
    if (before === undefined || after === undefined) {
      return null;
    }
    return after - before;
  });

  /** Scenarios that flipped between "holds" and "breaks" between the two runs. */
  protected readonly flipped = computed(() => {
    const before = this.previous()?.result?.scenarios ?? [];
    const after = this.current()?.result?.scenarios ?? [];
    return after
      .map((scenario) => {
        const match = before.find((candidate) => candidate.id === scenario.id);
        const nowHolds = scenario.outcome?.survives;
        const heldBefore = match?.outcome?.survives;
        if (nowHolds === undefined || heldBefore === undefined || heldBefore === nowHolds) {
          return null;
        }
        return { name: scenario.name, nowHolds };
      })
      .filter((entry): entry is { name: string; nowHolds: boolean } => entry !== null);
  });

  constructor() {
    effect(() => {
      const simulation = this.current();
      const projectId = this.store.projectId();
      untracked(() => void this.load(projectId, simulation?.previousRunId));
    });
  }

  private async load(projectId: string | null, previousRunId?: string): Promise<void> {
    this.loading.set(true);
    if (projectId && previousRunId) {
      try {
        this.previous.set(await firstValueFrom(this.gateway.getSimulation(projectId, previousRunId)));
      } catch {
        this.previous.set(null);
      }
    } else {
      this.previous.set(null);
    }
    this.loading.set(false);
  }

  /** Ouvre la demande d'accord ; la relance part de sa confirmation. */
  protected askToRelaunch(): void {
    if (this.current()) {
      this.askingConsent.set(true);
    }
  }

  /** Starts a fresh run from the current project state, chained to this one. */
  protected async relaunch(consent: SimulationConsent): Promise<void> {
    const simulation = this.current();
    this.askingConsent.set(false);
    if (!simulation) {
      return;
    }

    this.relaunching.set(true);
    try {
      const created = await this.store.create({
        name: simulation.name,
        origin: simulation.origin,
        projectId: simulation.projectId,
        documentName: simulation.documentName,
        tier: simulation.tier,
        previousRunId: simulation.id,
        consent,
      });
      await this.router.navigate(['/simulations', created.id]);
    } catch (error) {
      this.toasts.error(
        this.translate.instant('newRun.launchFailed') as string,
        error instanceof Error ? error.message : undefined,
      );
    } finally {
      this.relaunching.set(false);
    }
  }
}

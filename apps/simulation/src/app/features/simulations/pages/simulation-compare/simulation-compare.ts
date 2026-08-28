import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';

import { ToastService } from '../../../../core/ui/toast.service';
import { DisclaimerNote } from '../../../../shared/components/disclaimer-note/disclaimer-note';
import { VerdictBadge } from '../../components/verdict-badge/verdict-badge';
import { SimulationGateway, SimulationStore } from '../../data-access';
import { Simulation } from '../../models';

/**
 * Two runs of the same project, side by side.
 *
 * The comparison is the point of the loop: build, simulate, change something,
 * simulate again. What it shows is that the model resists better, never that
 * the business is more likely to succeed.
 */
@Component({
  selector: 'sim-simulation-compare',
  imports: [RouterLink, TranslatePipe, VerdictBadge, DisclaimerNote],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './simulation-compare.html',
})
export class SimulationCompare {
  readonly id = input.required<string>();

  private readonly gateway = inject(SimulationGateway);
  private readonly store = inject(SimulationStore);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);
  private readonly translate = inject(TranslateService);

  protected readonly current = this.store.active;
  protected readonly previous = signal<Simulation | null>(null);
  protected readonly loading = signal(true);
  protected readonly relaunching = signal(false);

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
        if (!match || match.survives === scenario.survives) {
          return null;
        }
        return { name: scenario.name, nowHolds: scenario.survives };
      })
      .filter((entry): entry is { name: string; nowHolds: boolean } => entry !== null);
  });

  constructor() {
    effect(() => {
      void this.load(this.id());
    });
  }

  private async load(id: string): Promise<void> {
    this.loading.set(true);
    const simulation = await this.store.loadOne(id);
    if (simulation?.previousRunId) {
      try {
        this.previous.set(await firstValueFrom(this.gateway.getSimulation(simulation.previousRunId)));
      } catch {
        this.previous.set(null);
      }
    } else {
      this.previous.set(null);
    }
    this.loading.set(false);
  }

  /** Starts a fresh run from the current project state, chained to this one. */
  protected async relaunch(): Promise<void> {
    const simulation = this.current();
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

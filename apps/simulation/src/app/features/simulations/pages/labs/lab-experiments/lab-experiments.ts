import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { LabPanel } from '../../../components/lab-panel/lab-panel';
import { SimulationStore } from '../../../data-access';

/**
 * Les expériences à mener pour transformer les hypothèses en données.
 *
 * Triées par priorité : la sortie utile est « laquelle faire en premier »,
 * pas la liste complète.
 */
@Component({
  selector: 'sim-lab-experiments',
  imports: [TranslatePipe, LabPanel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './lab-experiments.html',
})
export class LabExperiments {
  private readonly store = inject(SimulationStore);

  protected readonly report = computed(() => this.store.labs().experiments ?? null);

  protected readonly ordered = computed(() =>
    [...(this.report()?.experiments ?? [])].sort((a, b) => a.priority - b.priority),
  );
}

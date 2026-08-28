import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { LabPanel } from '../../../components/lab-panel/lab-panel';
import { SimulationStore } from '../../../data-access';
import { Timeline } from '../../../models';

/**
 * Le projet projeté sur cinq ans, une trajectoire par scénario.
 *
 * Une seule trajectoire est lisible à la fois : les afficher toutes
 * ensemble donnerait un faisceau que personne ne sait lire.
 */
@Component({
  selector: 'sim-lab-time-machine',
  imports: [TranslatePipe, LabPanel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './lab-time-machine.html',
})
export class LabTimeMachine {
  private readonly store = inject(SimulationStore);

  protected readonly report = computed(() => this.store.labs().timeMachine ?? null);
  private readonly selection = signal<string | null>(null);

  protected readonly selected = computed<Timeline | null>(() => {
    const timelines = this.report()?.timelines ?? [];
    const id = this.selection();
    return timelines.find((timeline) => timeline.id === id) ?? timelines[0] ?? null;
  });

  protected select(id: string): void {
    this.selection.set(id);
  }
}

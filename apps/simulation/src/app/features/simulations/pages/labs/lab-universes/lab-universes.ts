import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { LabPanel } from '../../../components/lab-panel/lab-panel';
import { SimulationStore } from '../../../data-access';

/**
 * Le même projet sous d'autres modèles économiques, passé dans les mêmes
 * scénarios : la comparaison n'a de sens qu'à moteur identique.
 */
@Component({
  selector: 'sim-lab-universes',
  imports: [TranslatePipe, LabPanel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './lab-universes.html',
})
export class LabUniverses {
  private readonly store = inject(SimulationStore);
  protected readonly report = computed(() => this.store.labs().universes ?? null);
}

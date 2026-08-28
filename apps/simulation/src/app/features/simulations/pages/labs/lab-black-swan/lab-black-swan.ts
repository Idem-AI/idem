import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { LabPanel } from '../../../components/lab-panel/lab-panel';
import { SimulationStore } from '../../../data-access';

/**
 * Chocs improbables mais possibles, rejoués dans le même moteur que les
 * scénarios : le taux d'absorption se lit donc sur la même échelle.
 */
@Component({
  selector: 'sim-lab-black-swan',
  imports: [TranslatePipe, LabPanel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './lab-black-swan.html',
})
export class LabBlackSwan {
  private readonly store = inject(SimulationStore);
  protected readonly report = computed(() => this.store.labs().blackSwan ?? null);
  protected readonly absorption = computed(() => {
    const rate = this.report()?.absorptionRate;
    return rate === undefined ? null : Math.round(rate * 100);
  });
}

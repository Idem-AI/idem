import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { LabPanel } from '../../../components/lab-panel/lab-panel';
import { SimulationStore } from '../../../data-access';

/** Le dossier passé devant quatre profils d'investisseurs, avec leurs objections. */
@Component({
  selector: 'sim-lab-investors',
  imports: [TranslatePipe, LabPanel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './lab-investors.html',
})
export class LabInvestors {
  private readonly store = inject(SimulationStore);
  protected readonly report = computed(() => this.store.labs().investors ?? null);
}

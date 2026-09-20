import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { DisclaimerNote } from '../../../../shared/components/disclaimer-note/disclaimer-note';
import { ScenarioTable } from '../../components/scenario-table/scenario-table';
import { SimulationStore } from '../../data-access';
import { Scenario } from '../../models';

/**
 * Les combinaisons testées, séparées des tests de résistance.
 *
 * Un scénario adverse répond à « et si le marché est plus dur » ; un test de
 * résistance répond à « à partir de quand ça casse ». Les mélanger ferait
 * lire un cas extrême comme une prévision.
 */
@Component({
  selector: 'sim-simulation-scenarios',
  imports: [TranslatePipe, ScenarioTable, DisclaimerNote],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './simulation-scenarios.html',
})
export class SimulationScenarios {
  private readonly store = inject(SimulationStore);

  private readonly scenarios = computed<readonly Scenario[]>(
    () => this.store.active()?.result?.scenarios ?? [],
  );

  protected readonly combinations = computed(() =>
    this.scenarios().filter((scenario) => scenario.kind !== 'stress' && scenario.kind !== 'extreme'),
  );

  protected readonly stressTests = computed(() =>
    this.scenarios().filter((scenario) => scenario.kind === 'stress' || scenario.kind === 'extreme'),
  );

  protected readonly survivalRate = computed(() => {
    const evaluated = this.scenarios().filter((scenario) => scenario.outcome);
    if (!evaluated.length) {
      return null;
    }
    const survived = evaluated.filter((scenario) => scenario.outcome!.survives).length;
    return Math.round((survived / evaluated.length) * 100);
  });
}

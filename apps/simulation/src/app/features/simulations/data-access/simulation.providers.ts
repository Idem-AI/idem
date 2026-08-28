import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';

import { isMockDataEnabled } from '../../../core/mock';

import { DemoSimulationGateway } from './demo-simulation.gateway';
import { HttpSimulationGateway } from './http-simulation.gateway';
import { SimulationGateway } from './simulation.gateway';

/**
 * Lie l'unique couture avec le backend.
 *
 * La source est résolue une fois au démarrage : `?mock=on|off` dans l'URL,
 * sinon le choix mémorisé, sinon `USE_MOCK_DATA` du `.env`. Aucune page ne
 * sait laquelle des deux implémentations est active.
 */
export function provideSimulationBackend(): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: SimulationGateway,
      useClass: isMockDataEnabled() ? DemoSimulationGateway : HttpSimulationGateway,
    },
  ]);
}

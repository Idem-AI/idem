import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';

import { HttpSimulationGateway } from './http-simulation.gateway';
import { SimulationGateway } from './simulation.gateway';

/**
 * Lie l'unique couture avec le backend.
 */
export function provideSimulationBackend(): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: SimulationGateway,
      useClass: HttpSimulationGateway,
    },
  ]);
}

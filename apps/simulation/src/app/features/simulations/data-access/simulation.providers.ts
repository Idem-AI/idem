import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';

import { environment } from '@env';

import { DemoSimulationGateway } from './demo-simulation.gateway';
import { HttpSimulationGateway } from './http-simulation.gateway';
import { SimulationGateway } from './simulation.gateway';

/**
 * Binds the single backend seam of the app.
 *
 * Swapping the demo dataset for the real API is a one-line environment
 * change, and no feature code moves.
 */
export function provideSimulationBackend(): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: SimulationGateway,
      useClass: environment.useMockData ? DemoSimulationGateway : HttpSimulationGateway,
    },
  ]);
}

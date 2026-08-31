import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { environment } from '../../../../../environments/environment';

/**
 * Opening statement of the simulator page: the promise on the left, and on the
 * right the product drawn as it actually behaves — one project, many
 * trajectories, most of them falling under the viability threshold.
 */
@Component({
  selector: 'app-simulation-hero',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './simulation-hero.html',
  styleUrl: './simulation-hero.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SimulationHero {
  protected readonly simulationUrl = environment.services.simulation.url;
}

import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { environment } from '../../../../../environments/environment';

/** Closing call to action of the simulator page. */
@Component({
  selector: 'app-simulation-cta',
  standalone: true,
  imports: [NgOptimizedImage, RouterLink],
  templateUrl: './simulation-cta.html',
  styleUrl: './simulation-cta.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SimulationCta {
  protected readonly simulationUrl = environment.services.simulation.url;
}

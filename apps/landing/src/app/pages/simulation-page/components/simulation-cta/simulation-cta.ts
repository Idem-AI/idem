import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { environment } from '../../../../../environments/environment';
import { PageArtComponent } from '../../../../shared/components/page-art/page-art';

/** L'appel final de la page Simulateur. */
@Component({
  selector: 'app-simulation-cta',
  imports: [RouterLink, PageArtComponent],
  templateUrl: './simulation-cta.html',
  styleUrls: ['../../../../shared/styles/editorial-page.css', './simulation-cta.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SimulationCta {
  protected readonly simulationUrl = environment.services.simulation.url;
}

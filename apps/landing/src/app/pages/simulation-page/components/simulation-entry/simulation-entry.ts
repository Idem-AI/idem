import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';

import { environment } from '../../../../../environments/environment';

interface Offer {
  id: string;
  name: string;
  body: string;
  highlight: boolean;
}

/**
 * The two ways into a simulation — an existing IDEM project, or an imported
 * business plan — and what the run is billed as.
 */
@Component({
  selector: 'app-simulation-entry',
  standalone: true,
  imports: [NgOptimizedImage],
  templateUrl: './simulation-entry.html',
  styleUrl: './simulation-entry.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SimulationEntry {
  protected readonly simulationUrl = environment.services.simulation.url;
  protected readonly dashboardUrl = environment.services.dashboard.url;

  protected readonly offers: Offer[] = [
    {
      id: 'run',
      name: $localize`:@@simulation.offers.run.name:Simulation`,
      body: $localize`:@@simulation.offers.run.body:The scenarios, the deciding factors, the major risks and the viability index.`,
      highlight: false,
    },
    {
      id: 'pack',
      name: $localize`:@@simulation.offers.pack.name:Simulation + report`,
      body: $localize`:@@simulation.offers.pack.body:The simulation and its full report, cheaper than buying both separately.`,
      highlight: true,
    },
    {
      id: 'report',
      name: $localize`:@@simulation.offers.report.name:Full report`,
      body: $localize`:@@simulation.offers.report.body:The detailed analysis and recommendations, for a simulation you already ran.`,
      highlight: false,
    },
  ];
}

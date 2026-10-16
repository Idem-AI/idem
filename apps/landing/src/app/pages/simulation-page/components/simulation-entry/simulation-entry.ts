import { ChangeDetectionStrategy, Component } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import { PageArtComponent } from '../../../../shared/components/page-art/page-art';

interface Offer {
  id: string;
  name: string;
  body: string;
}

/**
 * Les deux portes d'entrée d'une simulation — un projet IDEM existant, ou un
 * business plan importé — et ce que la course est facturée. Les trois offres
 * ne sont plus distinguées par une surface colorée : mettre l'une en avant par
 * la couleur recommande un achat au lieu de décrire trois choix.
 */
@Component({
  selector: 'app-simulation-entry',
  imports: [PageArtComponent],
  templateUrl: './simulation-entry.html',
  styleUrls: ['../../../../shared/styles/editorial-page.css', './simulation-entry.css'],
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
    },
    {
      id: 'pack',
      name: $localize`:@@simulation.offers.pack.name:Simulation + report`,
      body: $localize`:@@simulation.offers.pack.body:The simulation and its full report, cheaper than buying both separately.`,
    },
    {
      id: 'report',
      name: $localize`:@@simulation.offers.report.name:Full report`,
      body: $localize`:@@simulation.offers.report.body:The detailed analysis and recommendations, for a simulation you already ran.`,
    },
  ];
}

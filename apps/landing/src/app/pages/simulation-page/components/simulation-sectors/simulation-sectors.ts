import { ChangeDetectionStrategy, Component } from '@angular/core';

interface FactorColumn {
  id: string;
  sector: string;
  note: string;
  factors: string[];
}

/**
 * Deux secteurs dont les listes de facteurs ne partagent presque rien. Le
 * contraste est l'argument : une liste figée de vingt variables n'irait ni à
 * l'un ni à l'autre. Les colonnes n'ont ni icône ni couleur propre — une icône
 * de camionnette à côté du mot « livraison » ne dit rien de plus que le mot.
 */
@Component({
  selector: 'app-simulation-sectors',
  templateUrl: './simulation-sectors.html',
  styleUrls: ['../../../../shared/styles/editorial-page.css', './simulation-sectors.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SimulationSectors {
  protected readonly sectorFactors: FactorColumn[] = [
    {
      id: 'delivery',
      sector: $localize`:@@simulation.sectors.delivery.name:Urban delivery`,
      note: $localize`:@@simulation.sectors.delivery.note:Douala, B2C, commission per trip`,
      factors: [
        $localize`:@@simulation.sectors.delivery.f1:urban density`,
        $localize`:@@simulation.sectors.delivery.f2:fuel price`,
        $localize`:@@simulation.sectors.delivery.f3:courier cost`,
        $localize`:@@simulation.sectors.delivery.f4:road conditions`,
        $localize`:@@simulation.sectors.delivery.f5:payment methods`,
        $localize`:@@simulation.sectors.delivery.f6:acquisition cost`,
        $localize`:@@simulation.sectors.delivery.f7:retention rate`,
        $localize`:@@simulation.sectors.delivery.f8:courier employment status`,
      ],
    },
    {
      id: 'farming',
      sector: $localize`:@@simulation.sectors.farming.name:Farming`,
      note: $localize`:@@simulation.sectors.farming.note:Western Cameroon, short supply chain, B2B`,
      factors: [
        $localize`:@@simulation.sectors.farming.f1:rainy season`,
        $localize`:@@simulation.sectors.farming.f2:yield per hectare`,
        $localize`:@@simulation.sectors.farming.f3:input prices`,
        $localize`:@@simulation.sectors.farming.f4:cold chain`,
        $localize`:@@simulation.sectors.farming.f5:post-harvest losses`,
        $localize`:@@simulation.sectors.farming.f6:transport cost`,
        $localize`:@@simulation.sectors.farming.f7:storage capacity`,
        $localize`:@@simulation.sectors.farming.f8:commodity prices`,
      ],
    },
  ];
}

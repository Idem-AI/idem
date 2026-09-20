import { ChangeDetectionStrategy, Component } from '@angular/core';

interface FactorColumn {
  id: string;
  sector: string;
  note: string;
  /** Path data for the card glyph. Photos would misdescribe these sectors. */
  icon: string;
  factors: string[];
}

/**
 * Two sectors whose factor lists share almost nothing. The contrast is the
 * argument: a fixed list of twenty variables would fit neither.
 */
@Component({
  selector: 'app-simulation-sectors',
  standalone: true,
  templateUrl: './simulation-sectors.html',
  styleUrl: './simulation-sectors.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SimulationSectors {
  protected readonly sectorFactors: FactorColumn[] = [
    {
      id: 'delivery',
      icon: 'M4 16h1a2 2 0 1 0 4 0h6a2 2 0 1 0 4 0h1v-4l-3-4h-3V6H4z',
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
      icon: 'M12 21V11m0 0c0-3.5 2.5-6.5 7-7 0 4.5-3 7.5-7 7Zm0 4c0-3-2-5.5-6-6 0 3.5 2.5 6 6 6Z',
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

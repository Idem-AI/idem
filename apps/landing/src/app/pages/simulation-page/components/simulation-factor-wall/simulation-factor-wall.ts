import { ChangeDetectionStrategy, Component } from '@angular/core';

import { PageArtComponent } from '../../../../shared/components/page-art/page-art';

/**
 * Le mur de facteurs. Son argument est le nombre : une entreprise ne tient pas
 * sur cinq variables, et une page qui en liste cinq ment sur le problème.
 */
@Component({
  selector: 'app-simulation-factor-wall',
  imports: [PageArtComponent],
  templateUrl: './simulation-factor-wall.html',
  styleUrls: ['../../../../shared/styles/editorial-page.css', './simulation-factor-wall.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SimulationFactorWall {
  protected readonly factorWall = [
    $localize`:@@simulation.factorWall.1:real demand`,
    $localize`:@@simulation.factorWall.2:customer behaviour`,
    $localize`:@@simulation.factorWall.3:pricing`,
    $localize`:@@simulation.factorWall.4:competition`,
    $localize`:@@simulation.factorWall.5:costs`,
    $localize`:@@simulation.factorWall.6:acquisition`,
    $localize`:@@simulation.factorWall.7:retention`,
    $localize`:@@simulation.factorWall.8:funding`,
    $localize`:@@simulation.factorWall.9:regulation`,
    $localize`:@@simulation.factorWall.10:seasonality`,
    $localize`:@@simulation.factorWall.11:operating capacity`,
    $localize`:@@simulation.factorWall.12:staffing`,
    $localize`:@@simulation.factorWall.13:technology`,
    $localize`:@@simulation.factorWall.14:dependencies`,
    $localize`:@@simulation.factorWall.15:economic climate`,
    $localize`:@@simulation.factorWall.16:local environment`,
    $localize`:@@simulation.factorWall.17:purchasing power`,
    $localize`:@@simulation.factorWall.18:infrastructure`,
    $localize`:@@simulation.factorWall.19:payment methods`,
    $localize`:@@simulation.factorWall.20:supply chain`,
  ];
}

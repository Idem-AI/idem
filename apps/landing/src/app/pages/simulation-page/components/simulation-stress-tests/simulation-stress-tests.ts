import { ChangeDetectionStrategy, Component } from '@angular/core';

import { PageArtComponent } from '../../../../shared/components/page-art/page-art';

/**
 * Les questions dures que le moteur pose exprès au modèle. La section existe
 * pour dire que le simulateur n'est pas là pour rassurer.
 */
@Component({
  selector: 'app-simulation-stress-tests',
  imports: [PageArtComponent],
  templateUrl: './simulation-stress-tests.html',
  styleUrls: ['../../../../shared/styles/editorial-page.css', './simulation-stress-tests.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SimulationStressTests {
  protected readonly stressTests = [
    $localize`:@@simulation.stress.q1:What happens if your main competitor cuts prices by 30%?`,
    $localize`:@@simulation.stress.q2:What happens if your acquisition cost rises by 40%?`,
    $localize`:@@simulation.stress.q3:What happens if you grow half as fast as planned?`,
    $localize`:@@simulation.stress.q4:What happens if your funding lands six months late?`,
    $localize`:@@simulation.stress.q5:What happens if a new regulation comes into force?`,
  ];
}

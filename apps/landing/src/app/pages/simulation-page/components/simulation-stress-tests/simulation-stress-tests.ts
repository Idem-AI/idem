import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * The hard questions the engine puts to a model on purpose. The section exists
 * to say the simulator is not there to reassure anyone.
 */
@Component({
  selector: 'app-simulation-stress-tests',
  standalone: true,
  imports: [NgOptimizedImage],
  templateUrl: './simulation-stress-tests.html',
  styleUrl: './simulation-stress-tests.css',
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

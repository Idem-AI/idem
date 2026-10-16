import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Une simulation n'est pas un point final : construire, simuler, repérer, corriger, resimuler. */
@Component({
  selector: 'app-simulation-loop',
  templateUrl: './simulation-loop.html',
  styleUrls: ['../../../../shared/styles/editorial-page.css', './simulation-loop.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SimulationLoop {
  protected readonly loopSteps = [
    $localize`:@@simulation.loop.step1:Build`,
    $localize`:@@simulation.loop.step2:Simulate`,
    $localize`:@@simulation.loop.step3:Identify`,
    $localize`:@@simulation.loop.step4:Improve`,
    $localize`:@@simulation.loop.step5:Simulate again`,
  ];
}

import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';

/** A simulation is not an endpoint: build, simulate, identify, improve, repeat. */
@Component({
  selector: 'app-simulation-loop',
  standalone: true,
  imports: [NgOptimizedImage],
  templateUrl: './simulation-loop.html',
  styleUrl: './simulation-loop.css',
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

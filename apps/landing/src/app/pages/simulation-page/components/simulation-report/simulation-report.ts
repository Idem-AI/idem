import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';

/** The table of contents of the deliverable, and where it lands. */
@Component({
  selector: 'app-simulation-report',
  standalone: true,
  imports: [NgOptimizedImage],
  templateUrl: './simulation-report.html',
  styleUrl: './simulation-report.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SimulationReport {
  protected readonly reportSections = [
    $localize`:@@simulation.report.s1:Executive summary and verdict`,
    $localize`:@@simulation.report.s2:Project profile`,
    $localize`:@@simulation.report.s3:Factors analysed and ranked`,
    $localize`:@@simulation.report.s4:Scenarios, stress tests and extreme cases`,
    $localize`:@@simulation.report.s5:Simulated financial results`,
    $localize`:@@simulation.report.s6:Sensitivity analysis`,
    $localize`:@@simulation.report.s7:Conditions viability depends on`,
    $localize`:@@simulation.report.s8:Prioritised recommendations`,
    $localize`:@@simulation.report.s9:Data, assumptions and sources`,
    $localize`:@@simulation.report.s10:What to validate in the real world`,
  ];
}

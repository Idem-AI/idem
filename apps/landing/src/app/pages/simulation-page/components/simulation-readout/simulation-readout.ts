import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * The viability index, always shown next to what qualifies it: robustness,
 * confidence level and the uncertainties that remain. A number on its own
 * would be a marketing tile, not a readout.
 */
@Component({
  selector: 'app-simulation-readout',
  standalone: true,
  templateUrl: './simulation-readout.html',
  styleUrl: './simulation-readout.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SimulationReadout {}

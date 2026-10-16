import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * The viability index, always shown next to what qualifies it: robustness,
 * confidence level and the uncertainties that remain. A number on its own
 * would be a marketing tile, not a readout.
 */
@Component({
  selector: 'app-simulation-readout',
  templateUrl: './simulation-readout.html',
  styleUrls: ['../../../../shared/styles/editorial-page.css', './simulation-readout.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SimulationReadout {}

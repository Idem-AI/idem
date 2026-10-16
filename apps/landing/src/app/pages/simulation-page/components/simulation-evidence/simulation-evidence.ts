import { ChangeDetectionStrategy, Component } from '@angular/core';

/** How the engine labels what it used: observed data, estimate, or assumption. */
@Component({
  selector: 'app-simulation-evidence',
  templateUrl: './simulation-evidence.html',
  styleUrls: ['../../../../shared/styles/editorial-page.css', './simulation-evidence.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SimulationEvidence {}

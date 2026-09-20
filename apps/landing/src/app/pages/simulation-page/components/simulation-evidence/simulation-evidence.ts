import { ChangeDetectionStrategy, Component } from '@angular/core';

/** How the engine labels what it used: observed data, estimate, or assumption. */
@Component({
  selector: 'app-simulation-evidence',
  standalone: true,
  templateUrl: './simulation-evidence.html',
  styleUrl: './simulation-evidence.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SimulationEvidence {}

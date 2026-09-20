import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * The limits of the product, stated on the page rather than buried in terms.
 * A simulator that overpromises here is worse than no simulator.
 */
@Component({
  selector: 'app-simulation-honesty',
  standalone: true,
  templateUrl: './simulation-honesty.html',
  styleUrl: './simulation-honesty.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SimulationHonesty {}

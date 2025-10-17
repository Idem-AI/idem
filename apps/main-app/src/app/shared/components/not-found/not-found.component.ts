import { Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { inject } from '@angular/core';

@Component({
  selector: 'app-not-found',
  templateUrl: './not-found.component.html',
  standalone: true,
  imports: [RouterLink],
})
export class NotFoundComponent {
  // Component state
  // Animation state signals
  protected readonly animationActive = signal(false);
  protected readonly floatingActive = signal(false);

  // Interactive element states
  protected readonly hoverGlitch = signal(false);

  constructor() {
    // Start animations with staggered timing for visual interest
    setTimeout(() => this.animationActive.set(true), 300);
    setTimeout(() => this.floatingActive.set(true), 800);
  }

  protected toggleGlitch(): void {
    this.hoverGlitch.update((current) => !current);
    setTimeout(() => this.hoverGlitch.set(false), 700);
  }
}

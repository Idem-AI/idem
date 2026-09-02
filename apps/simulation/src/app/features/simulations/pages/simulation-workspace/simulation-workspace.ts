import { ChangeDetectionStrategy, Component, effect, inject, input, untracked } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { SimulationStore } from '../../data-access';

/**
 * Contexte commun à tous les écrans d'une exécution.
 *
 * Charge la simulation une fois et la suit tant qu'elle tourne ; les pages
 * enfants se contentent de lire le magasin. Le bandeau reprend l'identité de
 * l'exécution pour qu'aucun écran n'ait à la répéter.
 */
@Component({
  selector: 'sim-simulation-workspace',
  imports: [RouterOutlet, RouterLink, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './simulation-workspace.html',
})
export class SimulationWorkspace {
  readonly id = input.required<string>();

  private readonly store = inject(SimulationStore);

  protected readonly simulation = this.store.active;
  protected readonly status = this.store.activeStatus;
  protected readonly error = this.store.error;

  protected readonly isRunning = this.store.isRunning;

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => this.store.watch(id));
    });
  }
}

import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { AuthService } from '../../core/auth';
import { Topbar } from '../topbar/topbar';

/**
 * Coquille des écrans qui doivent occuper toute la largeur : l'entrée du
 * produit, où l'on choisit ce que l'on veut simuler.
 *
 * Pas de colonne de navigation. C'est un écran d'accueil autant qu'un
 * formulaire : la première chose qu'un visiteur sans compte voit du produit, et
 * une barre latérale de quinze destinations inaccessibles n'y a pas sa place.
 */
@Component({
  selector: 'sim-focus-shell',
  imports: [RouterOutlet, Topbar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-dvh">
      <sim-topbar />
      <main id="sim-main" class="pt-16">
        <router-outlet />
      </main>
    </div>
  `,
})
export class FocusShell {
  private readonly auth = inject(AuthService);

  constructor() {
    // Écran public : aucune garde n'a résolu la session avant d'arriver ici.
    void this.auth.ensureLoaded();
  }
}

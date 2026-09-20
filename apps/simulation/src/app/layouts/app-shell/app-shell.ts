import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { filter, map } from 'rxjs';

import { AuthService } from '../../core/auth';
import { SimulationStore } from '../../features/simulations/data-access';
import { Sidebar } from '../sidebar/sidebar';
import { Topbar } from '../topbar/topbar';

const COLLAPSE_KEY = 'idem-sim-sidebar-collapsed';
/** Doit suivre le point de rupture `md:` auquel la colonne apparaît. */
const SIDEBAR_BREAKPOINT = '(min-width: 768px)';

/**
 * Coquille de la surface authentifiée.
 *
 * Barre supérieure pour l'identité et le contexte, colonne de gauche pour la
 * navigation : le produit a une quinzaine de destinations, une barre
 * horizontale ne les tient plus. L'écran d'accueil, lui, n'a pas de colonne —
 * il utilise `FocusShell`.
 */
@Component({
  selector: 'sim-app-shell',
  imports: [RouterOutlet, TranslatePipe, Sidebar, Topbar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app-shell.html',
})
export class AppShell {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly store = inject(SimulationStore);

  protected readonly drawerOpen = signal(false);
  protected readonly collapsed = signal(readCollapsed());

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  /** L'exécution ouverte, lue dans l'URL : la coquille ne la charge pas. */
  protected readonly simulationId = computed(() => {
    const segment = /^\/simulations\/([^/?#]+)/.exec(this.url())?.[1];
    return segment && segment !== 'new' ? decodeURIComponent(segment) : null;
  });

  constructor() {
    // La coquille sert aussi des écrans publics : les projets ne se chargent
    // que s'il y a une identité derrière, sinon l'API répondrait 401 à chaque
    // visite anonyme.
    void this.auth.ensureLoaded().then((user) => {
      if (user) {
        void this.store.loadProjects();
      }
    });
  }

  /**
   * Un seul bouton pour la navigation : il replie la colonne là où elle
   * existe, et ouvre le tiroir là où elle n'existe pas.
   */
  protected toggleNav(): void {
    if (window.matchMedia(SIDEBAR_BREAKPOINT).matches) {
      this.collapsed.update((value) => !value);
      try {
        localStorage.setItem(COLLAPSE_KEY, String(this.collapsed()));
      } catch {
        // Navigation privée : la préférence ne survit pas à la session.
      }
      return;
    }
    this.drawerOpen.update((value) => !value);
  }
}

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === 'true';
  } catch {
    return false;
  }
}

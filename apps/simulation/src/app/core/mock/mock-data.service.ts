import { DOCUMENT, Injectable, computed, inject, signal } from '@angular/core';

import { environment } from '@env';

import {
  hasMockOverride,
  isMockDataEnabled,
  writeStoredPreference,
} from './mock-data';

/** Clé du jeu de démonstration modifié en session. */
export const DEMO_STATE_KEY = 'idem_simulation_demo_state';

/**
 * Expose et pilote le mode démonstration.
 *
 * La liaison du `SimulationGateway` se fait au démarrage : changer de source
 * en cours de session impose donc un rechargement, que ce service assume
 * plutôt que de laisser l'écran dans un état à moitié réel.
 */
@Injectable({ providedIn: 'root' })
export class MockDataService {
  private readonly document = inject(DOCUMENT);

  private readonly active = signal(isMockDataEnabled());

  /** Source de données réellement utilisée par la session en cours. */
  readonly enabled = this.active.asReadonly();

  /** Vrai si la valeur vient d'un choix explicite et non du `.env`. */
  readonly overridden = signal(hasMockOverride()).asReadonly();

  /** Valeur de repli issue de `USE_MOCK_DATA`. */
  readonly buildDefault = environment.useMockData;

  /**
   * Le bouton n'a de sens qu'en dehors de la production — sauf si la démo est
   * justement active, auquel cas il faut pouvoir en sortir.
   */
  readonly visible = computed(
    () => environment.environment !== 'prod' || this.active(),
  );

  setEnabled(value: boolean): void {
    if (value === this.active()) {
      return;
    }
    writeStoredPreference(value);
    if (!value) {
      this.clearDemoState();
    }
    this.reload();
  }

  /** Revient à la valeur du `.env` et oublie le choix mémorisé. */
  useBuildDefault(): void {
    writeStoredPreference(null);
    this.clearDemoState();
    this.reload();
  }

  /** Remet le jeu de démonstration dans son état initial. */
  resetDemoData(): void {
    this.clearDemoState();
    this.reload();
  }

  private clearDemoState(): void {
    try {
      this.document.defaultView?.localStorage.removeItem(DEMO_STATE_KEY);
    } catch {
      // Rien à nettoyer si le stockage est indisponible.
    }
  }

  private reload(): void {
    this.document.defaultView?.location.reload();
  }
}

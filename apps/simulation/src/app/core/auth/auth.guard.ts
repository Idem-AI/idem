import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';

import { isMockDataEnabled } from '../mock';

import { AuthService } from './auth.service';

/**
 * Protège la surface authentifiée.
 *
 * Il n'y a pas d'écran de connexion ici : sans session, l'utilisateur part sur
 * le login du dashboard IDEM, qui le ramènera sur la page demandée.
 */
export const authGuard: CanActivateFn = async (_route, state) => {
  // Mode démonstration : aucune requête ne part vers l'API, il n'y a donc
  // aucune identité à faire vérifier.
  if (isMockDataEnabled()) {
    return true;
  }

  // `inject` doit être appelé avant le premier `await` : passé celui-ci, le
  // contexte d'injection de la garde n'existe plus.
  const auth = inject(AuthService);

  if (await auth.ensureLoaded()) {
    return true;
  }

  auth.redirectToLogin(state.url);
  return false;
};

import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from './auth.service';

/**
 * Protège les écrans qui dépendent vraiment de l'identité.
 *
 * Elle n'est pas posée sur la coquille : la création d'une simulation se
 * visite sans compte, et c'est la page qui demande la connexion au moment où
 * l'action l'exige. Ici, sans session, l'utilisateur part sur le login du
 * dashboard IDEM, qui le ramènera sur la page demandée.
 */
export const authGuard: CanActivateFn = async (_route, state) => {
  // `inject` doit être appelé avant le premier `await` : passé celui-ci, le
  // contexte d'injection de la garde n'existe plus.
  const auth = inject(AuthService);

  if (await auth.ensureLoaded()) {
    return true;
  }

  auth.redirectToLogin(state.url);
  return false;
};

/**
 * Point d'entrée du simulateur.
 *
 * Sans session, on ouvre la création d'une simulation : le produit se découvre
 * en choisissant sa source — un projet IDEM ou son propre business plan — et
 * non en butant sur un écran de connexion. Avec une session, la liste des
 * exécutions passées est plus utile.
 */
export const entryRedirectGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const user = await auth.ensureLoaded();
  return router.parseUrl(user ? '/simulations' : '/simulations/new');
};

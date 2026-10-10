import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { AuthService } from './auth.service';

/** Les pages de l'atelier exigent une session IDEM ; sinon, connexion sur le tableau de bord. */
export const authGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  if (await auth.ensureLoaded()) return true;
  auth.redirectToLogin(`${window.location.origin}${state.url}`);
  return false;
};

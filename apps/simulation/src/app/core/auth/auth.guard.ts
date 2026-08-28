import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { environment } from '@env';

import { AuthService } from './auth.service';
import { FIREBASE_AUTH } from './firebase.providers';
import { TokenService } from './token.service';

async function resolveSession(): Promise<boolean> {
  const auth = inject(AuthService);
  const tokens = inject(TokenService);
  await tokens.ready;
  await auth.ready;
  return auth.isAuthenticated();
}

/** Protects the authenticated product surface. */
export const authGuard: CanActivateFn = async (_route, state) => {
  const router = inject(Router);
  const firebaseAvailable = inject(FIREBASE_AUTH) !== null;

  // A checkout with no Firebase credentials can still browse the demo
  // dataset; there is no identity to enforce against.
  if (!firebaseAvailable && environment.useMockData) {
    return true;
  }

  if (await resolveSession()) {
    return true;
  }

  return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

/** Keeps signed-in users out of the sign-in screen. */
export const anonymousGuard: CanActivateFn = async (route) => {
  const router = inject(Router);

  if (await resolveSession()) {
    const returnUrl = route.queryParamMap.get('returnUrl');
    return router.parseUrl(returnUrl && returnUrl.startsWith('/') ? returnUrl : '/simulations');
  }

  return true;
};

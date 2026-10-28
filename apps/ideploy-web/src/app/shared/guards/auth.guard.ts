import { inject } from '@angular/core';
import { CanActivateChildFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/** Where a signed-out visitor was going: the console's login only comes back to iDeploy's root. */
const RETURN_KEY = 'ideploy_return_to';

/**
 * Guard — requires an authenticated session (verified against the global Idem
 * API). Unauthenticated users are redirected to the central console login,
 * mirroring how landing handles auth. The page they asked for (a CLI approval
 * link, a shared application link) is opened once they are back.
 */
export const authGuard: CanActivateChildFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const user = await auth.ensureLoaded();
  if (user) {
    let back: string | null = null;
    try {
      back = localStorage.getItem(RETURN_KEY);
      localStorage.removeItem(RETURN_KEY);
    } catch {
      /* storage blocked */
    }
    // Only a path of this application, and only once.
    if (back && back.startsWith('/') && !back.startsWith('//') && back !== state.url) return router.parseUrl(back);
    return true;
  }
  try {
    if (state.url && state.url !== '/' && !state.url.startsWith('/dashboard')) localStorage.setItem(RETURN_KEY, state.url);
  } catch {
    /* storage blocked: the visitor lands on the dashboard */
  }
  auth.redirectToLogin();
  return false;
};

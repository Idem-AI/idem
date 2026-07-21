import { inject } from '@angular/core';
import { CanActivateChildFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Guard — requires an authenticated session (verified against the global Idem
 * API). Unauthenticated users are redirected to the central console login,
 * mirroring how landing handles auth.
 */
export const authGuard: CanActivateChildFn = async () => {
  const auth = inject(AuthService);
  const user = await auth.ensureLoaded();
  if (user) return true;
  auth.redirectToLogin();
  return false;
};

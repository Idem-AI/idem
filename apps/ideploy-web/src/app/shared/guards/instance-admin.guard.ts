import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../services/api.service';

/**
 * Instance roles that may reach the administration screens. Kept in step with
 * `INSTANCE_ADMIN_ROLES` in the API's authorize middleware.
 */
const INSTANCE_ADMIN_ROLES = new Set(['admin', 'owner', 'root', 'superadmin']);

/**
 * Guard — instance administrators only.
 *
 * This hides a screen; it does not protect the data. The API enforces the same
 * rule on every admin endpoint, which is what actually stops a non-admin who
 * types the URL or calls the endpoint directly. Both exist on purpose: the
 * guard so the interface does not offer what it cannot deliver, the server
 * check because a guard runs on the client and can simply be skipped.
 */
export const instanceAdminGuard: CanActivateFn = async () => {
  const api = inject(ApiService);
  const router = inject(Router);

  try {
    const me = await firstValueFrom(api.me());
    const role = me.idemRole?.toLowerCase() ?? null;
    if (role && INSTANCE_ADMIN_ROLES.has(role)) return true;
  } catch {
    /* fall through to the redirect */
  }

  return router.createUrlTree(['/dashboard']);
};

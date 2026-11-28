import { HttpInterceptorFn } from '@angular/common/http';
import { readLocaleCookie } from '../utils/locale-cookie';
import { storedSharedTeam } from '../services/shared-space.service';

/**
 * Auth interceptor — sends the httpOnly `session` cookie with API requests
 * (`withCredentials`). iDeploy does NOT manage tokens client-side: the central
 * Idem API owns authentication and sets the session cookie; iDeploy's backend
 * verifies it. So we only need to forward credentials.
 *
 * It also advertises the user's UI language via `Accept-Language` so the backend
 * can localize its responses (validation/error messages).
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const lang = readLocaleCookie() ?? 'en';
  // Espace d'un projet IDEM partagé : l'équipe du propriétaire, sauf pour la
  // requête qui liste justement ses propres partages.
  const ownSpace = req.headers.has('X-Ideploy-Own-Space');
  const sharedTeam = ownSpace ? null : storedSharedTeam();
  const headers: Record<string, string> = { 'Accept-Language': lang };
  if (sharedTeam !== null) headers['X-Current-Team'] = String(sharedTeam);
  return next(
    req.clone({
      withCredentials: true,
      setHeaders: headers,
      headers: (ownSpace ? req.headers.delete('X-Ideploy-Own-Space') : req.headers),
    })
  );
};

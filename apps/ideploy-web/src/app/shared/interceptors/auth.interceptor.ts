import { HttpInterceptorFn } from '@angular/common/http';
import { readLocaleCookie } from '../utils/locale-cookie';

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
  return next(
    req.clone({
      withCredentials: true,
      setHeaders: { 'Accept-Language': lang },
    })
  );
};

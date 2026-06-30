import { HttpInterceptorFn } from '@angular/common/http';

/**
 * Auth interceptor — sends the httpOnly `session` cookie with API requests
 * (`withCredentials`). iDeploy does NOT manage tokens client-side: the central
 * Idem API owns authentication and sets the session cookie; iDeploy's backend
 * verifies it. So we only need to forward credentials.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req.clone({ withCredentials: true }));
};

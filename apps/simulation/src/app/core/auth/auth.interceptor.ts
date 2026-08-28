import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';

import { environment } from '@env';

import { TokenService } from './token.service';

const PUBLIC_AUTH_PATHS = ['/auth/login', '/auth/register', '/auth/refresh'];

/**
 * Attaches the IDEM bearer token to API calls, and retries once with a fresh
 * token when the server rejects a cached one.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const isApiCall = req.url.startsWith(environment.services.api.url);
  const isPublicAuthCall = PUBLIC_AUTH_PATHS.some((path) => req.url.includes(path));

  // Local assets (i18n bundles, icons) must not resolve TokenService: doing so
  // pulls Firebase Auth into the bootstrap path before it is ready.
  if (!isApiCall || isPublicAuthCall || req.headers.has('Authorization')) {
    return next(req);
  }

  const tokens = inject(TokenService);

  return from(tokens.ready).pipe(
    switchMap(() => {
      const cached = tokens.getToken();
      if (!cached) {
        return from(tokens.getValidToken()).pipe(
          switchMap((token) => next(token ? withBearer(req, token) : req)),
        );
      }

      return next(withBearer(req, cached)).pipe(
        catchError((error: unknown) => {
          if (!isExpiredTokenError(error)) {
            return throwError(() => error);
          }
          return from(tokens.refresh()).pipe(
            switchMap((token) => {
              if (!token) {
                return throwError(() => error);
              }
              return next(withBearer(req, token));
            }),
          );
        }),
      );
    }),
  );
};

function withBearer(req: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return req.clone({ headers: req.headers.set('Authorization', `Bearer ${token}`) });
}

function isExpiredTokenError(error: unknown): boolean {
  return error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403);
}

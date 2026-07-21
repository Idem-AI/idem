import { HttpEvent, HttpHandlerFn, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { PLATFORM_ID, inject } from '@angular/core';
import { TokenService } from '../services/token.service';
import { isPlatformServer } from '@angular/common';
import { Observable, from, of } from 'rxjs';
import { switchMap, catchError, timeout } from 'rxjs/operators';
import { readLocaleCookie } from '../utils/locale-cookie';

/**
 * Interceptor function to add JWT to requests.
 *
 * This function intercepts outgoing HTTP requests and adds an Authorization header
 * with a bearer token if one is available. It's designed to work with Angular's
 * functional interceptor pattern. It will automatically add the 'Authorization' header
 * to all HTTP requests. It also handles Server-Side Rendering (SSR) by checking
 * the platform and skipping auth logic in a server context.
 */
export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
): Observable<HttpEvent<unknown>> => {
  const platformId = inject(PLATFORM_ID);

  // Skip interception for server-side rendering
  if (isPlatformServer(platformId)) {
    return next(req);
  }

  // Skip static assets (i18n JSON, images, fonts…). These never need an auth
  // header, and intercepting them would inject TokenService → Firebase Auth
  // synchronously during bootstrap (the translate loader fires at startup),
  // which triggers an NG0200 circular dependency on `Auth`. Resolve them early.
  if (req.url.includes('/assets/') || req.url.startsWith('assets/')) {
    return next(req);
  }

  // Exclude auth endpoints from interception
  if (
    req.url.includes('/auth/login') ||
    req.url.includes('/auth/register') ||
    req.url.includes('/auth/refresh')
  ) {
    return next(req);
  }

  // Advertise the user's UI language on every real API request so backend AI
  // generation replies in the right language. SSE streaming bypasses HttpClient
  // (and thus this interceptor) — it carries the language as a `lang` query param
  // instead (see SSEService callers).
  const lang = readLocaleCookie() ?? 'en';
  req = req.clone({ headers: req.headers.set('Accept-Language', lang) });

  // Skip if the request already carries its own Authorization header (e.g. iDeploy API)
  if (req.headers.has('Authorization')) {
    return next(req);
  }

  // Only now resolve TokenService (which injects Firebase Auth) — i.e. only for
  // real API requests, in a clean injection context.
  const tokenService = inject(TokenService);

  // 1. FAST PATH: If we already have a valid cached token, use it immediately
  const cachedToken = tokenService.getToken();
  if (cachedToken) {
    console.log('Auth Interceptor (Fast path): Using cached token for request:', req.url);
    const authReq = req.clone({
      headers: req.headers.set('Authorization', `Bearer ${cachedToken}`),
    });

    return next(authReq).pipe(
      catchError((error) => {
        // If we get 401/403, the cached token might be expired/revoked
        if (error.status === 401 || error.status === 403) {
          console.log('Auth Interceptor (Fast path): Cached token failed, refreshing...');
          return from(tokenService.refreshToken()).pipe(
            switchMap((refreshedToken: string | null) => {
              if (!refreshedToken) {
                console.error('Auth Interceptor: Token refresh failed');
                throw error;
              }

              console.log('Auth Interceptor: Retrying request with refreshed token');
              const retryReq = req.clone({
                headers: req.headers.set('Authorization', `Bearer ${refreshedToken}`),
              });

              return next(retryReq);
            }),
            catchError(() => {
              console.error('Auth Interceptor: Token refresh failed, throwing original error');
              throw error;
            }),
          );
        }
        throw error;
      }),
    );
  }

  // 2. SLOW PATH: Wait for auth to be ready with a timeout
  return from(tokenService.waitForAuthReady()).pipe(
    timeout(5000), // 5 seconds timeout max to avoid hanging requests
    switchMap(() => {
      // Try to get cached token again (in case auth loaded it during wait)
      const token = tokenService.getToken();
      if (token) {
        const authReq = req.clone({
          headers: req.headers.set('Authorization', `Bearer ${token}`),
        });
        return next(authReq);
      }

      // If still no token, try to fetch it async
      return from(tokenService.getTokenAsync()).pipe(
        switchMap((asyncToken: string | null) => {
          if (!asyncToken) {
            console.warn('Auth Interceptor: No auth token available after initialization');
            return next(req);
          }
          const authReq = req.clone({
            headers: req.headers.set('Authorization', `Bearer ${asyncToken}`),
          });
          return next(authReq);
        }),
        catchError((asyncError) => {
          console.error('Auth Interceptor: Error getting token async:', asyncError);
          return next(req);
        })
      );
    }),
    catchError((error) => {
      console.error('Auth Interceptor: Error waiting for auth ready or timeout:', error);
      // Fallback: if we have a token stored, try it anyway before giving up
      const fallbackToken = tokenService.getToken();
      if (fallbackToken) {
        const authReq = req.clone({
          headers: req.headers.set('Authorization', `Bearer ${fallbackToken}`),
        });
        return next(authReq);
      }
      return next(req);
    }),
  );
};

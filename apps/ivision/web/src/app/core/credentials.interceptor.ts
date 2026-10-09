import { HttpInterceptorFn } from '@angular/common/http';
import { readLocaleCookie } from './locale-cookie';

/** Le cookie de session voyage avec chaque appel ; la langue aussi (messages de l'API). */
export const credentialsInterceptor: HttpInterceptorFn = (req, next) =>
  next(req.clone({ withCredentials: true, setHeaders: { 'Accept-Language': readLocaleCookie() ?? 'fr' } }));

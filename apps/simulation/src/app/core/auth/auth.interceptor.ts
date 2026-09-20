import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

import { environment } from '@env';

import { LanguageService } from '../i18n/language.service';

/**
 * L'API IDEM authentifie par le cookie de session `httpOnly` posé au login
 * central : cette application n'a aucun jeton à porter, il lui suffit
 * d'envoyer les credentials. On annonce aussi la langue active pour que l'API
 * localise ses messages (validation, erreurs).
 *
 * Les ressources locales (bundles i18n, icônes) sortent tôt : elles n'ont
 * besoin ni de cookie ni du service de langue, qu'elles chargent justement.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(environment.services.api.url)) {
    return next(req);
  }

  const language = inject(LanguageService).language();

  return next(
    req.clone({
      withCredentials: true,
      setHeaders: { 'Accept-Language': language },
    }),
  );
};

import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject, Injector } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { catchError, throwError } from 'rxjs';
import { NotificationService } from '../services/notification.service';

/**
 * Un membre d'équipe en lecture seule qui tente de modifier reçoit de l'API un
 * **403 `read_only`**. Sans ce message, l'écran afficherait une erreur
 * générique et la personne croirait à une panne : on lui dit ce qui se passe et
 * qui peut changer ses droits.
 *
 * `TranslateService` n'est PAS injecté à l'entrée : son chargeur passe lui-même
 * par `HttpClient`, donc par cet intercepteur. L'injecter ici créait une
 * dépendance circulaire au démarrage, et plus aucun texte ne se chargeait (les
 * clés s'affichaient). Il est demandé à l'injecteur seulement quand un refus
 * arrive, bien après le démarrage.
 *
 * L'erreur continue sa route, comme pour le paywall : le composant remet son
 * état de chargement en place.
 */
export const readOnlyInterceptor: HttpInterceptorFn = (req, next) => {
  const injector = inject(Injector);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 403 && (error.error as { error?: string } | null)?.error === 'read_only') {
        const translate = injector.get(TranslateService);
        injector.get(NotificationService).showInfo({
          title: translate.instant('team.readOnly.title'),
          message: translate.instant('team.readOnly.blocked'),
        });
      }
      return throwError(() => error);
    }),
  );
};

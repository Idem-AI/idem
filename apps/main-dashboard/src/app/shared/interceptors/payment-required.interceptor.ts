import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { PaywallService } from '../../modules/billing/services/paywall.service';
import { PaymentRequiredPayload } from '../../modules/billing/models/billing.model';

/**
 * Transforme un refus de l'API en écran de paiement.
 *
 * L'API répond **402** quand une génération dépasse les crédits disponibles ou
 * qu'une fonction appartient à un plan supérieur, et **429 `quota_exceeded`**
 * quand un quota d'usage (jour, semaine ou mois) est atteint. Le corps de la
 * réponse porte tout ce qu'il faut dire : le coût, le solde ou la date de
 * renouvellement, et les offres qui débloquent l'action. L'intercepteur ne fait
 * que l'acheminer vers l'hôte du paywall.
 *
 * L'erreur continue sa route : un composant qui sait mieux quoi faire (annuler
 * un état de chargement, par exemple) garde la main. On ajoute un écran, on ne
 * retire pas une erreur.
 */
export const paymentRequiredInterceptor: HttpInterceptorFn = (req, next) => {
  const paywall = inject(PaywallService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 402 || error.status === 429) {
        // Un téléchargement (`responseType: 'blob'`) reçoit le refus JSON sous forme de Blob :
        // il est relu ici, sinon le fichier final verrouillé échouerait sans rien dire.
        if (error.error instanceof Blob) {
          void error.error
            .text()
            .then((text) => {
              const parsed = JSON.parse(text) as PaymentRequiredPayload;
              if (parsed?.error) paywall.open(parsed);
            })
            .catch(() => undefined);
          return throwError(() => error);
        }

        const payload = error.error as PaymentRequiredPayload;

        if (
          payload?.error === 'payment_required' ||
          payload?.error === 'deliverable_locked' ||
          payload?.error === 'plan_upgrade_required' ||
          payload?.error === 'quota_exceeded'
        ) {
          paywall.open(payload);
        }
      }

      return throwError(() => error);
    }),
  );
};

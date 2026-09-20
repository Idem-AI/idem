import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { PaywallService } from '../../modules/billing/services/paywall.service';
import { PaymentRequiredPayload } from '../../modules/billing/models/billing.model';

/**
 * Transforme un refus de l'API en écran de paiement.
 *
 * L'API répond **402** quand une génération dépasse les crédits disponibles ou
 * qu'une fonction appartient à un plan supérieur. Le corps de la réponse porte
 * tout ce qu'il faut dire : le coût, le solde, et les offres qui débloquent
 * l'action. L'intercepteur ne fait que l'acheminer vers l'hôte du paywall.
 *
 * L'erreur continue sa route : un composant qui sait mieux quoi faire (annuler
 * un état de chargement, par exemple) garde la main. On ajoute un écran, on ne
 * retire pas une erreur.
 */
export const paymentRequiredInterceptor: HttpInterceptorFn = (req, next) => {
  const paywall = inject(PaywallService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 402) {
        const payload = error.error as PaymentRequiredPayload;

        if (payload?.error === 'payment_required' || payload?.error === 'plan_upgrade_required') {
          paywall.open(payload);
        }
      }

      return throwError(() => error);
    }),
  );
};

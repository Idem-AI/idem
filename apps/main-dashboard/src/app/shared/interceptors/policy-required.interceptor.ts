import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { PolicyConsentService } from '../services/policy-consent.service';

/**
 * Transforme le refus « projet non finalisé » (403 `POLICY_ACCEPTANCE_REQUIRED`) en fenêtre d'accord des
 * politiques, au lieu du message brut. L'erreur continue sa route : la page arrête son chargement.
 */
export const policyRequiredInterceptor: HttpInterceptorFn = (req, next) => {
  const consent = inject(PolicyConsentService);
  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      const body = error.error as { code?: string; projectId?: string } | null;
      if (error.status === 403 && body?.code === 'POLICY_ACCEPTANCE_REQUIRED' && body.projectId) consent.open(body.projectId);
      return throwError(() => error);
    }),
  );
};

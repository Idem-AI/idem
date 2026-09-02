import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { OnboardingSurveyService } from '../shared/services/onboarding-survey.service';

/**
 * Redirige vers le sondage d'accueil tant que l'utilisateur n'y a pas répondu
 * (ou ne l'a pas explicitement passé).
 *
 * Il est posé sur `/console`, la destination commune de toutes les entrées
 * (login e-mail, popup Google/GitHub, retour de redirection mobile) : peu
 * importe le chemin d'arrivée, le sondage n'est proposé qu'une seule fois.
 */
export const surveyGuard: CanActivateFn = () => {
  const survey = inject(OnboardingSurveyService);
  const router = inject(Router);

  // L'état est stocké par uid : on le relit à l'entrée pour couvrir le cas
  // d'un changement de compte sur le même navigateur.
  survey.reload();

  return survey.isSettled() ? true : router.createUrlTree(['/welcome']);
};

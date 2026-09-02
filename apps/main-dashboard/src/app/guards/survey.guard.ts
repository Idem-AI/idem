import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { OnboardingSurveyService } from '../shared/services/onboarding-survey.service';

/**
 * Le sondage d'accueil est un préalable à l'usage d'IDEM.
 *
 * Posé sur toutes les routes authentifiées, ce garde couvre aussi bien les
 * nouvelles inscriptions que les comptes créés avant la fonctionnalité :
 * ceux-là n'ont pas de profil en base et sont donc invités à répondre à leur
 * prochaine ouverture.
 *
 * Une panne réseau ne doit jamais enfermer quelqu'un dehors : si le profil
 * n'a pas pu être lu, on laisse passer et on redemandera plus tard.
 */
export const surveyGuard: CanActivateFn = async (_route, state) => {
  const survey = inject(OnboardingSurveyService);
  const router = inject(Router);

  await survey.load();

  if (survey.isCompleted()) return true;
  if (!survey.isLoaded()) return true;

  return router.createUrlTree(['/welcome'], {
    queryParams: state.url && state.url !== '/console' ? { returnUrl: state.url } : {},
  });
};

import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { UiModeService } from '../shared/services/ui-mode.service';
import { GuidedJourneyService } from '../modules/guided/services/guided-journey.service';

/**
 * Verrouille les pages qui n'appartiennent pas encore au parcours.
 *
 * En mode Assisté, seules les pages des étapes terminées et de l'étape en
 * cours sont accessibles. Une adresse tapée à la main ramène au parcours et
 * ouvre une modale d'explication — plutôt qu'un écran vide ou, pire, une page
 * que l'utilisateur n'est pas prêt à utiliser.
 *
 * Dans les modes Chat et Avancé, ce garde laisse tout passer.
 */
export const guidedAccessGuard: CanActivateFn = async (_route, state) => {
  const uiMode = inject(UiModeService);
  const journey = inject(GuidedJourneyService);
  const router = inject(Router);

  if (uiMode.mode() !== 'guided') return true;

  // Le parcours doit connaître le projet actif pour savoir ce qui est ouvert.
  // Sans `force`, un projet déjà chargé ne redéclenche aucun appel réseau.
  await journey.loadFromCookie();

  // Sans projet, il n'y a pas encore de parcours à protéger.
  if (!journey.project()?.id) return true;

  if (journey.isRouteAllowed(state.url)) return true;

  journey.reportBlocked(state.url);
  return router.createUrlTree(['/guided']);
};

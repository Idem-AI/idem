import { inject } from '@angular/core';
import { CanActivateFn, Route, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { CurrentProjectService } from '../shared/services/current-project.service';
import { canOpenRoute, routeSpace } from '../shared/utils/project-space-routes';

/**
 * Ferme les pages d'un espace que la personne n'a pas le droit d'ouvrir.
 *
 * Le menu n'affiche déjà pas ces entrées ; cette garde couvre l'adresse tapée
 * ou collée. Réponse : la page 404, comme pour une page qui n'existe pas —
 * on ne confirme pas à un membre l'existence d'un espace qu'on lui cache.
 * L'API refuse de son côté, cette garde n'est que la politesse de l'écran.
 */
export const projectAccessGuard: CanActivateFn = async (_route, state) => {
  const projects = inject(CurrentProjectService);
  const router = inject(Router);

  try {
    await firstValueFrom(projects.load());
  } catch {
    // Réseau en échec : l'écran affichera son erreur, l'API reste la barrière.
    return true;
  }

  // Aucun projet : la barre latérale renvoie déjà vers la création.
  if (!projects.selected()) return true;

  if (canOpenRoute(projects.access(), state.url)) return true;
  return router.createUrlTree(['/not-found']);
};

/**
 * Pose la garde sur toutes les pages d'un projet, une fois pour toutes : une
 * page ajoutée plus tard sous `project/` est protégée sans y penser.
 */
export function withProjectAccess(routes: Route[]): Route[] {
  return routes.map((route) => {
    if (!route.path || route.redirectTo || !routeSpace(route.path)) return route;
    return { ...route, canActivate: [...(route.canActivate ?? []), projectAccessGuard] };
  });
}

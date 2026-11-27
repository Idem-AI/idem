import { computed, inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';
import { CurrentProjectService } from '../../../shared/services/current-project.service';
import { isReadOnlyRoute, routeSpace } from '../../../shared/utils/project-space-routes';

/**
 * Ce que l'écran courant permet à la personne connectée : la page est-elle,
 * pour elle, en lecture seule ? Lu par la directive `appWriteOnly` (qui masque
 * les actions d'écriture) et par l'avis « Lecture seule ».
 */
@Injectable({ providedIn: 'root' })
export class ProjectAccessUiService {
  private readonly router = inject(Router);
  private readonly projects = inject(CurrentProjectService);

  readonly url = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  /** Membre d'équipe sur un espace qu'il peut voir sans le modifier. */
  readonly readOnly = computed(() => isReadOnlyRoute(this.projects.access(), this.url()));

  /** L'espace de la page courante (pour nommer ce qui est en lecture seule). */
  readonly space = computed(() => routeSpace(this.url()));
}

import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';

/**
 * L'appel final de la page d'accueil.
 *
 * Il n'observe plus le défilement : ses éléments étaient posés à
 * `opacity: 0` et n'apparaissaient qu'au passage d'un `IntersectionObserver`,
 * ce qui rendait la section invisible au pré-rendu, sur une vignette de
 * partage et pour qui arrive par un lien profond. Plus d'observateur, plus de
 * `@HostBinding` (interdit par `.claude/CLAUDE.md`) : le bloc est complet dès
 * le chargement.
 */
@Component({
  selector: 'app-cta',
  imports: [RouterLink],
  templateUrl: './cta.html',
  styleUrls: ['../../shared/styles/editorial-page.css', './cta.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Cta {
  protected readonly dashboardUrl = environment.services.dashboard.url;
}

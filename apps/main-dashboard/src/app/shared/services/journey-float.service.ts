import { Injectable, signal } from '@angular/core';
import type { JourneyCardOptions, JourneyUrls, Recommendation } from '@idem/shared-journey';

/** Une carte de la boucle IDEM à poser dans la pile flottante de la mise en page. */
export interface FloatingJourney {
  recommendation: Recommendation;
  urls: JourneyUrls;
  beforeOpen?: JourneyCardOptions['beforeOpen'];
  /** Écartée depuis le haut de l'écran : la carte de la page s'efface aussi. */
  dismissed: () => void;
}

/**
 * La carte de la boucle IDEM qui flotte EN HAUT AU CENTRE du dashboard. La page qui la reçoit (`app-journey-next`)
 * la garde à sa place et la confie ici ; la mise en page la pose dans SA pile flottante (`.idem-float-stack`), avec
 * l'étape suivante et la promotion — jamais une deuxième pile au même endroit.
 */
@Injectable({ providedIn: 'root' })
export class JourneyFloatService {
  readonly current = signal<FloatingJourney | null>(null);

  show(card: FloatingJourney): void {
    this.current.set(card);
  }

  /** Retire la carte, seulement si c'est encore celle-là (une autre page a pu en poser une depuis). */
  clear(recommendationId?: string): void {
    const current = this.current();
    if (!current || (recommendationId && current.recommendation.id !== recommendationId)) return;
    this.current.set(null);
  }
}

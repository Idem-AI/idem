import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { startTour, type TourHandle, type TourStep } from '@idem/shared-tour';

/** Identifiant de la visite : préfixé par l'app, comme sur les autres produits Idem. */
const TOUR_ID = 'ideploy-web:main';
const STORAGE_KEY = 'idem_tours_seen_v1';
/** Le temps que la vue se peigne avant de mesurer les éléments à pointer. */
const START_DELAY_MS = 600;

/** Étapes de la visite : la cible est un `data-tour` posé dans les vues. */
const STEPS: Array<{ key: string; target?: string; placement?: TourStep['placement']; celebrate?: boolean }> = [
  { key: 'welcome' },
  { key: 'team', target: '[data-tour="ideploy-team"]', placement: 'right' },
  { key: 'nav', target: '[data-tour="ideploy-nav-servers"]', placement: 'right' },
  { key: 'apps', target: '[data-tour="ideploy-nav-applications"]', placement: 'right' },
  { key: 'plan', target: '[data-tour="ideploy-plan"]', placement: 'bottom' },
  { key: 'done', celebrate: true },
];

/**
 * Visite guidée de première utilisation.
 *
 * Elle s'appuie sur le moteur partagé `@idem/shared-tour`, commun à toutes les
 * applications Idem. La mémoire est locale à l'appareil : contrairement au
 * tableau de bord, cette application n'a pas de profil d'accueil en base où
 * l'inscrire.
 */
@Injectable({ providedIn: 'root' })
export class TourService {
  private readonly translate = inject(TranslateService);
  private active: TourHandle | null = null;

  /** Lance la visite si l'utilisateur ne l'a jamais vue. */
  maybeStart(): void {
    if (this.seen().includes(TOUR_ID)) return;
    this.start();
  }

  /** Lance la visite sans condition. */
  start(): void {
    if (this.active) return;

    const steps: TourStep[] = STEPS.map(({ key, ...rest }) => ({
      ...rest,
      title: this.translate.instant(`tour.steps.${key}.title`),
      body: this.translate.instant(`tour.steps.${key}.body`),
    }));

    // Laisse la page se peindre : les positions se mesurent sur du réel.
    setTimeout(() => {
      this.active = startTour({
        id: TOUR_ID,
        steps,
        labels: {
          next: this.translate.instant('tour.common.next'),
          back: this.translate.instant('tour.common.back'),
          skip: this.translate.instant('tour.common.skip'),
          finish: this.translate.instant('tour.common.finish'),
          stepOf: this.translate.instant('tour.common.stepOf'),
          dialogLabel: this.translate.instant('tour.common.dialogLabel'),
        },
        onFinish: () => {
          this.active = null;
          // Vue jusqu'au bout ou passée : dans les deux cas on ne la repropose pas.
          this.markSeen();
        },
      });
    }, START_DELAY_MS);
  }

  private seen(): string[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private markSeen(): void {
    const ids = this.seen();
    if (ids.includes(TOUR_ID)) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids, TOUR_ID]));
    } catch {
      // Stockage indisponible : la visite se reproposera, sans casse
    }
  }
}

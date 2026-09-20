import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { startTour, type TourHandle, type TourStep } from '@idem/shared-tour';
import { environment } from '../../../environments/environment';

/** Identifiant de la visite : préfixé par l'app, comme sur les autres produits Idem. */
const TOUR_ID = 'simulation:main';

/** Cache local : évite d'attendre le réseau quand la réponse est déjà connue. */
const STORAGE_KEY = 'idem_tours_seen_v1';

/** Le temps que la vue se peigne avant de mesurer les éléments à pointer. */
const START_DELAY_MS = 600;

/** Étapes de la visite : la cible est un `data-tour` posé dans les vues. */
const STEPS: Array<{
  key: string;
  target?: string;
  placement?: TourStep['placement'];
  celebrate?: boolean;
}> = [
  { key: 'welcome' },
  { key: 'nav', target: '[data-tour="sim-nav"]', placement: 'right' },
  { key: 'glance', target: '[data-tour="sim-glance"]', placement: 'top' },
  { key: 'risks', target: '[data-tour="sim-risks"]', placement: 'top' },
  { key: 'next', target: '[data-tour="sim-next"]', placement: 'top' },
  { key: 'done', celebrate: true },
];

/**
 * Visite guidée de première utilisation.
 *
 * Elle s'appuie sur le moteur partagé `@idem/shared-tour`, commun à toutes les
 * applications Idem, et mémorise son passage sur le **compte** via l'API IDEM
 * globale — celle dont le simulateur partage déjà la session. Changer de
 * navigateur ou de machine ne rejoue donc pas un didacticiel déjà suivi. Le
 * stockage local ne sert que de cache.
 */
@Injectable({ providedIn: 'root' })
export class TourService {
  private readonly translate = inject(TranslateService);
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.services.api.url}/auth/tours`;

  private active: TourHandle | null = null;
  /**
   * Vrai dès l'appel, avant même le délai d'affichage : `active` n'est
   * renseigné qu'à l'expiration du minuteur, et deux appels rapprochés
   * lanceraient sinon deux visites concurrentes.
   */
  private pending = false;

  /** Liste serveur mémorisée pour la session, pour n'interroger qu'une fois. */
  private remoteSeen: string[] | null = null;

  /**
   * Lance la visite si le compte ne l'a jamais vue.
   *
   * Le cache local tranche immédiatement quand il sait ; sinon on interroge le
   * compte avant de décider, faute de quoi un nouveau navigateur rejouerait
   * une visite déjà suivie ailleurs.
   */
  async maybeStart(): Promise<void> {
    if (this.readLocal().includes(TOUR_ID)) return;

    const seen = await this.fetchSeen();
    if (seen.includes(TOUR_ID)) {
      this.writeLocal([...this.readLocal(), TOUR_ID]);
      return;
    }

    this.start();
  }

  /** Lance la visite sans condition. */
  start(): void {
    if (this.active || this.pending) return;
    this.pending = true;

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
          this.pending = false;
          // Vue jusqu'au bout ou passée : dans les deux cas on ne la repropose pas.
          void this.markSeen();
        },
      });
    }, START_DELAY_MS);
  }

  // ─────────────────────────────────────────────────────────── mémoire

  /**
   * Visites vues d'après le compte IDEM, partagé par toutes les applications.
   * Une panne réseau renvoie une liste vide : mieux vaut reproposer la visite
   * que de la supprimer définitivement sur une erreur passagère.
   */
  private async fetchSeen(): Promise<string[]> {
    if (this.remoteSeen) return this.remoteSeen;
    try {
      const response = await firstValueFrom(
        this.http.get<{ toursSeen: string[] }>(this.apiUrl, { withCredentials: true }),
      );
      this.remoteSeen = response?.toursSeen ?? [];
      return this.remoteSeen;
    } catch (error) {
      console.error('Tour: could not read the seen tours', error);
      return [];
    }
  }

  private async markSeen(): Promise<void> {
    const local = this.readLocal();
    if (!local.includes(TOUR_ID)) this.writeLocal([...local, TOUR_ID]);
    if (this.remoteSeen && !this.remoteSeen.includes(TOUR_ID)) this.remoteSeen.push(TOUR_ID);

    try {
      await firstValueFrom(
        this.http.post<{ toursSeen: string[] }>(
          this.apiUrl,
          { tourId: TOUR_ID },
          { withCredentials: true },
        ),
      );
    } catch (error) {
      console.error('Tour: could not record the tour', error);
    }
  }

  private readLocal(): string[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private writeLocal(ids: string[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    } catch {
      // Stockage indisponible : le compte reste la mémoire de référence
    }
  }
}

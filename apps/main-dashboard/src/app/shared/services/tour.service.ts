import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { startTour, type TourHandle, type TourLabels, type TourStep } from '@idem/shared-tour';
import { environment } from '../../../environments/environment';
import { UiMode } from '../../modules/chat/models/chat.model';

/** Préfixe des identifiants, pour que chaque app ait les siens. */
const APP = 'main-dashboard';

/** Cache local : évite de rejouer la visite entre deux réponses du serveur. */
const LOCAL_KEY = 'idem_tours_seen_v1';

/** Le temps que la vue se peigne avant de mesurer les éléments à pointer. */
const START_DELAY_MS = 600;

/**
 * Visite guidée de première utilisation.
 *
 * Une visite par mode : ce qu'on montre à quelqu'un qui découvre le parcours
 * assisté n'a rien à voir avec ce qu'on montre dans le chat ou le tableau de
 * bord. Chaque visite se termine par le sélecteur de mode — c'est la commande
 * que les utilisateurs ne trouvaient pas.
 *
 * La mémoire vit sur le compte : changer de navigateur ou de machine ne doit
 * pas rejouer un didacticiel déjà suivi. Le stockage local ne sert que de
 * cache, pour ne pas attendre le réseau quand la réponse est déjà connue.
 */
@Injectable({ providedIn: 'root' })
export class TourService {
  private readonly translate = inject(TranslateService);
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.services.api.url}/auth/tours`;

  private active: TourHandle | null = null;
  /**
   * Vrai dès l'appel, avant même le délai d'affichage.
   *
   * `active` n'est renseigné qu'à l'expiration du minuteur : sans ce drapeau,
   * deux appels rapprochés — un composant monté deux fois, une navigation
   * aller-retour — passaient tous deux la garde et lançaient deux visites.
   */
  private pending = false;

  /** Liste serveur mémorisée pour la session, pour n'interroger qu'une fois. */
  private remoteSeen: string[] | null = null;

  /** Étapes de chaque mode : la cible est un `data-tour` posé dans les vues. */
  private steps(mode: UiMode): Array<Omit<TourStep, 'title' | 'body'> & { key: string }> {
    switch (mode) {
      case 'guided':
        return [
          { key: 'welcome' },
          { key: 'progress', target: '[data-tour="guided-progress"]', placement: 'bottom' },
          { key: 'steps', target: '[data-tour="guided-steps"]', placement: 'right' },
          { key: 'current', target: '[data-tour="guided-current"]', placement: 'right' },
          { key: 'switch', target: '[data-tour="mode-switcher"]', placement: 'bottom' },
          { key: 'done', celebrate: true },
        ];
      case 'chat':
        return [
          { key: 'welcome' },
          { key: 'composer', target: '[data-tour="chat-composer"]', placement: 'top' },
          { key: 'conversations', target: '[data-tour="chat-sidebar"]', placement: 'right' },
          { key: 'export', target: '[data-tour="chat-export"]', placement: 'bottom' },
          { key: 'switch', target: '[data-tour="mode-switcher"]', placement: 'bottom' },
          { key: 'done', celebrate: true },
        ];
      default:
        return [
          { key: 'welcome' },
          { key: 'project', target: '[data-tour="project-selector"]', placement: 'bottom' },
          { key: 'nav', target: '[data-tour="dashboard-nav"]', placement: 'right' },
          { key: 'switch', target: '[data-tour="mode-switcher"]', placement: 'bottom' },
          { key: 'done', celebrate: true },
        ];
    }
  }

  private labels(): TourLabels {
    return {
      next: this.translate.instant('tour.common.next'),
      back: this.translate.instant('tour.common.back'),
      skip: this.translate.instant('tour.common.skip'),
      finish: this.translate.instant('tour.common.finish'),
      stepOf: this.translate.instant('tour.common.stepOf'),
      dialogLabel: this.translate.instant('tour.common.dialogLabel'),
    };
  }

  private tourId(mode: UiMode): string {
    return `${APP}:${mode}`;
  }

  /**
   * Lance la visite si le compte ne l'a jamais vue.
   *
   * Le cache local tranche immédiatement quand il sait ; sinon on interroge le
   * compte avant de décider, faute de quoi un nouveau navigateur rejouerait
   * une visite déjà suivie ailleurs.
   */
  async maybeStart(mode: UiMode): Promise<void> {
    const id = this.tourId(mode);
    if (this.readLocal().includes(id)) return;

    const seen = await this.fetchSeen();
    if (seen.includes(id)) {
      this.writeLocal([...this.readLocal(), id]);
      return;
    }

    this.start(mode);
  }

  /** Lance la visite sans condition (relance depuis le profil, par exemple). */
  start(mode: UiMode): void {
    if (this.active || this.pending) return;
    this.pending = true;

    const id = this.tourId(mode);
    const steps: TourStep[] = this.steps(mode).map(({ key, ...rest }) => ({
      ...rest,
      title: this.translate.instant(`tour.${mode}.${key}.title`),
      body: this.translate.instant(`tour.${mode}.${key}.body`),
    }));

    // Laisse la page se peindre : les positions se mesurent sur du réel.
    setTimeout(() => {
      this.active = startTour({
        id,
        steps,
        labels: this.labels(),
        onFinish: () => {
          this.active = null;
          this.pending = false;
          // Vue jusqu'au bout ou passée : dans les deux cas on ne la repropose pas.
          void this.markSeen(id);
        },
      });
    }, START_DELAY_MS);
  }

  /** Efface la mémoire locale pour rejouer les visites (aide au débogage). */
  resetLocal(): void {
    this.remoteSeen = null;
    try {
      localStorage.removeItem(LOCAL_KEY);
    } catch {
      // ignore
    }
  }

  // ─────────────────────────────────────────────────────────── mémoire

  /**
   * Visites vues d'après le compte.
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

  private async markSeen(id: string): Promise<void> {
    const local = this.readLocal();
    if (!local.includes(id)) this.writeLocal([...local, id]);
    if (this.remoteSeen && !this.remoteSeen.includes(id)) this.remoteSeen.push(id);

    try {
      await firstValueFrom(
        this.http.post<{ toursSeen: string[] }>(
          this.apiUrl,
          { tourId: id },
          { withCredentials: true },
        ),
      );
    } catch (error) {
      console.error('Tour: could not record the tour', error);
    }
  }

  private readLocal(): string[] {
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private writeLocal(ids: string[]): void {
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(ids));
    } catch {
      // Stockage indisponible : le compte reste la mémoire de référence
    }
  }
}

import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { startTour, type TourHandle, type TourLabels, type TourStep } from '@idem/shared-tour';
import { UiMode } from '../../modules/chat/models/chat.model';
import { OnboardingSurveyService } from './onboarding-survey.service';

/** Préfixe des identifiants, pour que chaque app ait les siens. */
const APP = 'main-dashboard';

/** Repli local : évite un second passage avant la réponse du serveur. */
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
 */
@Injectable({ providedIn: 'root' })
export class TourService {
  private readonly translate = inject(TranslateService);
  private readonly survey = inject(OnboardingSurveyService);

  private active: TourHandle | null = null;

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

  /** Lance la visite si c'est la première venue dans ce mode. */
  maybeStart(mode: UiMode): void {
    if (this.hasSeen(this.tourId(mode))) return;
    this.start(mode);
  }

  /** Lance la visite sans condition (relance depuis le profil, par exemple). */
  start(mode: UiMode): void {
    if (this.active) return;

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
          // Vue jusqu'au bout ou passée : dans les deux cas on ne la repropose pas.
          this.markSeen(id);
        },
      });
    }, START_DELAY_MS);
  }

  /** Efface la mémoire locale pour rejouer les visites (aide au débogage). */
  resetLocal(): void {
    try {
      localStorage.removeItem(LOCAL_KEY);
    } catch {
      // ignore
    }
  }

  // ─────────────────────────────────────────────────────────── mémoire

  private hasSeen(id: string): boolean {
    return this.survey.toursSeen().includes(id) || this.readLocal().includes(id);
  }

  private markSeen(id: string): void {
    const local = this.readLocal();
    if (!local.includes(id)) {
      this.writeLocal([...local, id]);
    }
    void this.survey.markTourSeen(id);
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
      // Stockage indisponible : le serveur reste la mémoire de référence
    }
  }
}

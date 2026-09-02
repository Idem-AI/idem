import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthService } from '../../modules/auth/services/auth.service';
import { UiMode } from '../../modules/chat/models/chat.model';
import {
  ModeRecommendation,
  OnboardingSurveyState,
  SURVEY_QUESTIONS,
  SurveyAnswers,
  SurveyQuestionId,
} from '../models/onboarding-survey.model';

const STORAGE_PREFIX = 'idem_profile_survey_v1';

/** Poids de chaque réponse par mode. Une réponse absente ne compte pour rien. */
const SCORING: Record<SurveyQuestionId, Record<string, Partial<Record<UiMode, number>>>> = {
  stage: {
    idea: { guided: 2, chat: 1 },
    starting: { guided: 1, chat: 1 },
    running: { advanced: 2 },
  },
  clarity: {
    lost: { guided: 3 },
    partial: { guided: 1, chat: 2 },
    clear: { advanced: 3 },
  },
  workStyle: {
    stepByStep: { guided: 3 },
    conversation: { chat: 3 },
    autonomy: { advanced: 3 },
  },
  comfort: {
    beginner: { guided: 2, chat: 1 },
    intermediate: { chat: 1, advanced: 1 },
    expert: { advanced: 3 },
  },
};

/** Départage les ex æquo : on privilégie l'accompagnement le plus fort. */
const TIE_BREAK_ORDER: UiMode[] = ['guided', 'chat', 'advanced'];

const EMPTY_STATE: OnboardingSurveyState = {
  version: 1,
  answers: {},
  completed: false,
  skipped: false,
  recommendedMode: null,
  updatedAt: '',
};

/**
 * Sondage d'accueil : stockage des réponses et calcul du mode recommandé.
 *
 * Les réponses sont conservées par utilisateur (clé suffixée par l'uid) afin
 * que deux comptes sur le même navigateur ne se marchent pas dessus.
 */
@Injectable({ providedIn: 'root' })
export class OnboardingSurveyService {
  private readonly authService = inject(AuthService);

  readonly questions = SURVEY_QUESTIONS;

  private readonly state = signal<OnboardingSurveyState>(this.read());

  readonly answers = computed<SurveyAnswers>(() => this.state().answers);
  /** Le sondage a été répondu ou explicitement passé : ne plus le proposer. */
  readonly isSettled = computed(() => this.state().completed || this.state().skipped);
  readonly isCompleted = computed(() => this.state().completed);
  /** Nombre de questions répondues (pour la barre de progression). */
  readonly answeredCount = computed(
    () => this.questions.filter((q) => !!this.state().answers[q.id]).length,
  );

  /**
   * Mode recommandé. `null` tant qu'aucune réponse n'a été donnée : les écrans
   * de choix retombent alors sur leur recommandation par défaut.
   */
  readonly recommendation = computed<ModeRecommendation | null>(() => {
    const answers = this.state().answers;
    if (!Object.values(answers).some(Boolean)) return null;
    return this.score(answers);
  });

  readonly recommendedMode = computed<UiMode | null>(() => this.recommendation()?.mode ?? null);

  // ───────────────────────────────────────────────────────── actions

  /** Enregistre la réponse d'une question et persiste immédiatement. */
  setAnswer(questionId: SurveyQuestionId, value: string): void {
    this.update((current) => ({
      ...current,
      answers: { ...current.answers, [questionId]: value } as SurveyAnswers,
    }));
  }

  /** Clôture le sondage en figeant le mode recommandé. */
  complete(): ModeRecommendation {
    const recommendation = this.score(this.state().answers);
    this.update((current) => ({
      ...current,
      completed: true,
      skipped: false,
      recommendedMode: recommendation.mode,
    }));
    return recommendation;
  }

  /** L'utilisateur passe le sondage : on ne le lui reproposera plus. */
  skip(): void {
    this.update((current) => ({ ...current, skipped: true }));
  }

  /** Repart de zéro (utile depuis le profil pour refaire le sondage). */
  reset(): void {
    this.state.set({ ...EMPTY_STATE });
    try {
      localStorage.removeItem(this.storageKey());
    } catch {
      // ignore
    }
  }

  /** Recharge l'état depuis le stockage (après un changement de compte). */
  reload(): void {
    this.state.set(this.read());
  }

  // ───────────────────────────────────────────────────────── scoring

  /** Calcule le mode conseillé à partir des réponses connues. */
  score(answers: SurveyAnswers): ModeRecommendation {
    const scores: Record<UiMode, number> = { guided: 0, chat: 0, advanced: 0 };

    for (const question of this.questions) {
      const value = answers[question.id];
      if (!value) continue;
      const weights = SCORING[question.id]?.[value];
      if (!weights) continue;
      for (const [mode, weight] of Object.entries(weights)) {
        scores[mode as UiMode] += weight ?? 0;
      }
    }

    const best = TIE_BREAK_ORDER.reduce((winner, mode) =>
      scores[mode] > scores[winner] ? mode : winner,
    );

    return { mode: best, reasonKey: `onboarding.survey.reasons.${best}`, scores };
  }

  // ───────────────────────────────────────────────────────── persistance

  private storageKey(): string {
    const uid = this.authService.getCurrentUser()?.uid;
    return uid ? `${STORAGE_PREFIX}_${uid}` : STORAGE_PREFIX;
  }

  private read(): OnboardingSurveyState {
    try {
      const raw = localStorage.getItem(this.storageKey());
      if (!raw) return { ...EMPTY_STATE };
      const parsed = JSON.parse(raw) as OnboardingSurveyState;
      if (parsed?.version !== 1) return { ...EMPTY_STATE };
      return { ...EMPTY_STATE, ...parsed, answers: parsed.answers ?? {} };
    } catch {
      return { ...EMPTY_STATE };
    }
  }

  private update(patch: (current: OnboardingSurveyState) => OnboardingSurveyState): void {
    const next = { ...patch(this.state()), updatedAt: new Date().toISOString() };
    this.state.set(next);
    try {
      localStorage.setItem(this.storageKey(), JSON.stringify(next));
    } catch {
      // Stockage indisponible : le sondage reste valable pour la session
    }
  }
}

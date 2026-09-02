import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { OnboardingProfile } from '@idem/shared-models';
import { environment } from '../../../environments/environment';
import { UiMode } from '../../modules/chat/models/chat.model';
import {
  ModeRecommendation,
  SURVEY_QUESTIONS,
  SurveyAnswers,
  SurveyQuestionId,
} from '../models/onboarding-survey.model';

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

/**
 * Sondage d'accueil : réponses, mode recommandé, persistance sur le compte.
 *
 * Le profil vit en base, pas dans le navigateur : il suit l'utilisateur d'un
 * appareil à l'autre, et son absence identifie sans ambiguïté les comptes
 * créés avant la fonctionnalité — qui doivent répondre au sondage avant de
 * continuer à utiliser IDEM.
 */
@Injectable({ providedIn: 'root' })
export class OnboardingSurveyService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.services.api.url}/auth/onboarding-profile`;

  readonly questions = SURVEY_QUESTIONS;

  /** Profil enregistré ; `null` = sondage jamais rempli. */
  private readonly profile = signal<OnboardingProfile | null>(null);
  /** Le profil a été récupéré au moins une fois depuis le serveur. */
  private readonly loaded = signal(false);
  /** Réponses en cours de saisie, avant enregistrement. */
  private readonly draft = signal<SurveyAnswers>({});
  private inFlight: Promise<OnboardingProfile | null> | null = null;

  readonly isSaving = signal(false);
  readonly saveError = signal<string | null>(null);

  /** Réponses à afficher : le brouillon prime, sinon celles enregistrées. */
  readonly answers = computed<SurveyAnswers>(() => {
    const draft = this.draft();
    if (Object.values(draft).some(Boolean)) return draft;
    return (this.profile()?.answers ?? {}) as SurveyAnswers;
  });

  /** Le sondage a été rempli : l'utilisateur peut accéder à IDEM. */
  readonly isCompleted = computed(() => !!this.profile());

  /** Nombre de questions répondues (barre de progression). */
  readonly answeredCount = computed(
    () => this.questions.filter((q) => !!this.answers()[q.id]).length,
  );

  readonly allAnswered = computed(() => this.answeredCount() === this.questions.length);

  /**
   * Mode recommandé d'après les réponses connues. `null` tant que rien n'a
   * été répondu ni enregistré : les écrans de choix retombent alors sur leur
   * recommandation par défaut.
   */
  readonly recommendation = computed<ModeRecommendation | null>(() => {
    const answers = this.answers();
    if (!Object.values(answers).some(Boolean)) return null;
    return this.score(answers);
  });

  readonly recommendedMode = computed<UiMode | null>(() => this.recommendation()?.mode ?? null);

  /** Mode retenu par l'utilisateur lors du sondage, s'il l'a déjà passé. */
  readonly selectedMode = computed<UiMode | null>(
    () => (this.profile()?.selectedMode as UiMode | undefined) ?? null,
  );

  // ───────────────────────────────────────────────────────── chargement

  /**
   * Récupère le profil depuis le compte. Le résultat est mémorisé pour la
   * session ; les appels concurrents partagent la même requête.
   */
  async load(force = false): Promise<OnboardingProfile | null> {
    if (this.loaded() && !force) return this.profile();
    if (this.inFlight && !force) return this.inFlight;

    this.inFlight = firstValueFrom(
      this.http.get<{ profile: OnboardingProfile | null }>(this.apiUrl, {
        withCredentials: true,
      }),
    )
      .then((response) => {
        const profile = response?.profile ?? null;
        this.profile.set(profile);
        this.loaded.set(true);
        return profile;
      })
      .catch((error) => {
        console.error('OnboardingSurvey: could not load the profile', error);
        // On ne bloque pas l'utilisateur sur une panne réseau : le garde
        // laissera passer plutôt que d'enfermer un compte déjà complété.
        this.loaded.set(false);
        return null;
      })
      .finally(() => {
        this.inFlight = null;
      });

    return this.inFlight;
  }

  /** Le profil a-t-il pu être récupéré ? (distingue « pas rempli » de « hors ligne ») */
  isLoaded(): boolean {
    return this.loaded();
  }

  /** Repart de zéro (changement de compte). */
  reset(): void {
    this.profile.set(null);
    this.draft.set({});
    this.loaded.set(false);
    this.inFlight = null;
    this.saveError.set(null);
  }

  // ───────────────────────────────────────────────────────── saisie

  /** Enregistre localement la réponse d'une question. */
  setAnswer(questionId: SurveyQuestionId, value: string): void {
    this.draft.update((current) => ({ ...current, [questionId]: value }) as SurveyAnswers);
  }

  /**
   * Clôture le sondage : les quatre réponses partent sur le compte.
   * Résout `false` si l'enregistrement a échoué — l'écran reste alors ouvert
   * plutôt que de laisser croire que c'est fait.
   */
  async complete(selectedMode: UiMode): Promise<boolean> {
    const answers = this.answers();
    if (!this.allAnswered() || this.isSaving()) return false;

    this.isSaving.set(true);
    this.saveError.set(null);

    try {
      const response = await firstValueFrom(
        this.http.put<{ profile: OnboardingProfile }>(
          this.apiUrl,
          {
            answers,
            recommendedMode: this.score(answers).mode,
            selectedMode,
          },
          { withCredentials: true },
        ),
      );
      this.profile.set(response?.profile ?? null);
      this.loaded.set(true);
      this.draft.set({});
      return !!response?.profile;
    } catch (error) {
      console.error('OnboardingSurvey: could not save the profile', error);
      this.saveError.set('onboarding.survey.result.saveError');
      return false;
    } finally {
      this.isSaving.set(false);
    }
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
}

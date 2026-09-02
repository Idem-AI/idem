import { UiMode } from '../../modules/chat/models/chat.model';

/**
 * Sondage d'accueil (4 questions maximum, 100 % cliquable).
 *
 * Il est présenté une seule fois, juste après l'inscription, et sert à
 * recommander le mode d'interface le plus adapté au profil de l'utilisateur.
 * Aucune saisie libre : chaque question se répond en un clic.
 */

/** Identifiants des questions (l'ordre du tableau fait foi pour l'affichage). */
export type SurveyQuestionId = 'stage' | 'clarity' | 'workStyle' | 'comfort';

/** Où en est l'utilisateur dans son projet ? */
export type SurveyStage = 'idea' | 'starting' | 'running';
/** Sait-il par où commencer ? */
export type SurveyClarity = 'lost' | 'partial' | 'clear';
/** Comment préfère-t-il avancer ? */
export type SurveyWorkStyle = 'stepByStep' | 'conversation' | 'autonomy';
/** Aisance avec les outils numériques. */
export type SurveyComfort = 'beginner' | 'intermediate' | 'expert';

export interface SurveyAnswers {
  stage?: SurveyStage;
  clarity?: SurveyClarity;
  workStyle?: SurveyWorkStyle;
  comfort?: SurveyComfort;
}

/** Une option cliquable d'une question. */
export interface SurveyOption {
  /** Valeur stockée dans les réponses */
  value: string;
  /** Clé i18n du libellé court */
  labelKey: string;
  /** Clé i18n de la précision affichée sous le libellé */
  hintKey: string;
  /** Icône PrimeIcons */
  icon: string;
}

export interface SurveyQuestion {
  id: SurveyQuestionId;
  labelKey: string;
  options: SurveyOption[];
}

/**
 * Les 4 questions. Volontairement courtes et concrètes : elles doivent se
 * répondre sans réfléchir, en 4 clics au total.
 */
export const SURVEY_QUESTIONS: readonly SurveyQuestion[] = [
  {
    id: 'stage',
    labelKey: 'onboarding.survey.questions.stage.label',
    options: [
      {
        value: 'idea',
        labelKey: 'onboarding.survey.questions.stage.options.idea.label',
        hintKey: 'onboarding.survey.questions.stage.options.idea.hint',
        icon: 'pi pi-lightbulb',
      },
      {
        value: 'starting',
        labelKey: 'onboarding.survey.questions.stage.options.starting.label',
        hintKey: 'onboarding.survey.questions.stage.options.starting.hint',
        icon: 'pi pi-flag',
      },
      {
        value: 'running',
        labelKey: 'onboarding.survey.questions.stage.options.running.label',
        hintKey: 'onboarding.survey.questions.stage.options.running.hint',
        icon: 'pi pi-chart-line',
      },
    ],
  },
  {
    id: 'clarity',
    labelKey: 'onboarding.survey.questions.clarity.label',
    options: [
      {
        value: 'lost',
        labelKey: 'onboarding.survey.questions.clarity.options.lost.label',
        hintKey: 'onboarding.survey.questions.clarity.options.lost.hint',
        icon: 'pi pi-compass',
      },
      {
        value: 'partial',
        labelKey: 'onboarding.survey.questions.clarity.options.partial.label',
        hintKey: 'onboarding.survey.questions.clarity.options.partial.hint',
        icon: 'pi pi-map',
      },
      {
        value: 'clear',
        labelKey: 'onboarding.survey.questions.clarity.options.clear.label',
        hintKey: 'onboarding.survey.questions.clarity.options.clear.hint',
        icon: 'pi pi-check-circle',
      },
    ],
  },
  {
    id: 'workStyle',
    labelKey: 'onboarding.survey.questions.workStyle.label',
    options: [
      {
        value: 'stepByStep',
        labelKey: 'onboarding.survey.questions.workStyle.options.stepByStep.label',
        hintKey: 'onboarding.survey.questions.workStyle.options.stepByStep.hint',
        icon: 'pi pi-list-check',
      },
      {
        value: 'conversation',
        labelKey: 'onboarding.survey.questions.workStyle.options.conversation.label',
        hintKey: 'onboarding.survey.questions.workStyle.options.conversation.hint',
        icon: 'pi pi-comments',
      },
      {
        value: 'autonomy',
        labelKey: 'onboarding.survey.questions.workStyle.options.autonomy.label',
        hintKey: 'onboarding.survey.questions.workStyle.options.autonomy.hint',
        icon: 'pi pi-th-large',
      },
    ],
  },
  {
    id: 'comfort',
    labelKey: 'onboarding.survey.questions.comfort.label',
    options: [
      {
        value: 'beginner',
        labelKey: 'onboarding.survey.questions.comfort.options.beginner.label',
        hintKey: 'onboarding.survey.questions.comfort.options.beginner.hint',
        icon: 'pi pi-heart',
      },
      {
        value: 'intermediate',
        labelKey: 'onboarding.survey.questions.comfort.options.intermediate.label',
        hintKey: 'onboarding.survey.questions.comfort.options.intermediate.hint',
        icon: 'pi pi-thumbs-up',
      },
      {
        value: 'expert',
        labelKey: 'onboarding.survey.questions.comfort.options.expert.label',
        hintKey: 'onboarding.survey.questions.comfort.options.expert.hint',
        icon: 'pi pi-bolt',
      },
    ],
  },
];

/** Résultat de la recommandation : le mode conseillé + la raison affichée. */
export interface ModeRecommendation {
  mode: UiMode;
  /** Clé i18n de la phrase qui justifie la recommandation */
  reasonKey: string;
  /** Score par mode, utile pour l'affichage debug / analytics */
  scores: Record<UiMode, number>;
}

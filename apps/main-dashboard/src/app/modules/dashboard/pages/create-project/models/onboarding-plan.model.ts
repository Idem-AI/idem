/** Champ projet ciblé par une question du plan IA */
export type OnboardingFieldKey =
  | 'name'
  | 'type'
  | 'targets'
  | 'scope'
  | 'teamSize'
  | 'budgetIntervals'
  | 'currency'
  | 'constraints';

/** Question du plan d'onboarding généré par l'IA (déjà localisée) */
export interface OnboardingPlanQuestion {
  id: string;
  field: OnboardingFieldKey;
  kind: 'choice' | 'open';
  optional: boolean;
  /** Texte de la question, déjà dans la langue de l'utilisateur */
  prompt: string;
  /** Options cliquables pour les questions à choix */
  chips?: Array<{ label: string; value: string }>;
}

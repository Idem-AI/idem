/**
 * Modèles du mode Chat (dual-mode UI).
 * Tout est additif : aucun modèle existant n'est modifié.
 */

/** Mode d'interface : 'advanced' = dashboard classique, 'chat' = interface conversationnelle */
export type UiMode = 'advanced' | 'chat';

/** Livrables affichables sous forme de carte dans le chat */
export type DeliverableKind =
  | 'businessPlan'
  | 'branding'
  | 'pitchDeck'
  | 'diagrams'
  | 'legalDocs'
  | 'finance';

export type DeliverableSectionStatus = 'ready' | 'inProgress' | 'missing';

export interface DeliverableSectionPreview {
  name: string;
  status: DeliverableSectionStatus;
}

/**
 * Données d'une carte de livrable affichée dans le fil de conversation.
 * Structure commune à tous les livrables : icône + titre + métadonnées + aperçu + actions.
 */
export interface DeliverableCardData {
  kind: DeliverableKind;
  titleKey: string;
  icon: string;
  updatedAt?: string;
  sections: DeliverableSectionPreview[];
  /** Au moins une partie du contenu existe */
  available: boolean;
  /** Prévisualisation / téléchargement PDF possibles pour ce livrable */
  pdfSupported: boolean;
  /** Route du mode avancé pour "Ouvrir dans l'éditeur" */
  editorRoute: string;
  /** Route de génération en mode avancé quand le livrable est manquant */
  generateRoute?: string;
}

/** Actions déclenchées par une chip de suggestion */
export type ChatChipAction =
  | 'send'
  | 'show'
  | 'download'
  | 'editor'
  | 'export-all'
  | 'status'
  | 'answer'
  | 'skip'
  | 'new-project';

export interface ChatChip {
  /** Clé i18n du label (prioritaire sur label) */
  labelKey?: string;
  /** Label brut si déjà résolu */
  label?: string;
  icon?: string;
  action: ChatChipAction;
  /** Selon l'action : texte à envoyer, kind de livrable, valeur d'onboarding… */
  payload?: string;
}

/** Récapitulatif d'onboarding affiché sous forme de carte avant création du projet */
export interface OnboardingRecapData {
  name: string;
  description: string;
  typeKey: string;
  targetsKey?: string;
  scopeKey?: string;
  teamSizeKey?: string;
  budgetKey?: string;
}

export interface ChatMessageModel {
  id: string;
  role: 'user' | 'assistant';
  /** Markdown pour l'assistant, texte brut pour l'utilisateur */
  content: string;
  createdAt: string;
  card?: DeliverableCardData;
  recap?: OnboardingRecapData;
  /** Suggestions rapides affichées sous le message (uniquement le dernier message assistant) */
  chips?: ChatChip[];
}

/** Étapes de l'onboarding conversationnel */
export type OnboardingStepId =
  | 'description'
  | 'name'
  | 'type'
  | 'targets'
  | 'scope'
  | 'teamSize'
  | 'budget'
  | 'recap';

export interface OnboardingAnswers {
  description?: string;
  name?: string;
  type?: string;
  targets?: string;
  scope?: string;
  teamSize?: string;
  budgetIntervals?: string;
}

/** État persisté de l'onboarding conversationnel (reprise après interruption) */
export interface OnboardingState {
  version: 1;
  stepId: OnboardingStepId;
  answers: OnboardingAnswers;
  updatedAt: string;
}

export interface OnboardingPolicyAcceptances {
  privacy: boolean;
  terms: boolean;
  beta: boolean;
  marketing: boolean;
}

/**
 * Modèles du mode Chat (dual-mode UI).
 * Tout est additif : aucun modèle existant n'est modifié.
 */
import { ColorModel, TypographyModel } from '../../dashboard/models/brand-identity.model';
import { LogoModel } from '../../dashboard/models/logo.model';

/** Mode d'interface : 'advanced' = dashboard classique, 'chat' = interface conversationnelle */
export type UiMode = 'advanced' | 'chat';

/** Catégories de rangement intelligent des conversations dans la sidebar */
export type ChatConversationCategory =
  | 'business'
  | 'marketing'
  | 'finance'
  | 'legal'
  | 'branding'
  | 'tech'
  | 'general';

/** Métadonnées d'une conversation (plusieurs conversations par projet) */
export interface ChatConversationMeta {
  id: string;
  /** Titre dérivé du premier message utilisateur ('' tant que vide) */
  title: string;
  category: ChatConversationCategory;
  createdAt: string;
  updatedAt: string;
}

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
  | 'new-project'
  | 'branding-start'
  | 'branding-ai'
  | 'branding-import'
  | 'branding-later'
  | 'branding-logo-type'
  | 'branding-skip-description'
  | 'generate'
  | 'bp-fill-form'
  | 'bp-free-text'
  | 'bp-generate'
  | 'download-logos-zip'
  | 'preview'
  | 'charte-regenerate';

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

/** Progression d'une génération SSE affichée dans le fil */
export interface GenerationProgressData {
  /** Titre du livrable (déjà résolu) */
  title: string;
  status: 'running' | 'done' | 'error';
  completedSteps: string[];
  stepsInProgress: string[];
  totalSteps?: number;
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
  /** Cartes de sélection du flux branding conversationnel */
  colorOptions?: ColorModel[];
  typographyOptions?: TypographyModel[];
  logoOptions?: LogoModel[];
  /** Option choisie dans une carte de sélection (fige la carte) */
  selectedOptionId?: string;
  /** Mini-formulaire d'informations supplémentaires (business plan) */
  infoForm?: boolean;
  /** Carte de progression d'une génération SSE */
  generation?: GenerationProgressData;
  /** Choix du format de la charte graphique (portrait / paysage) */
  formatChoice?: boolean;
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

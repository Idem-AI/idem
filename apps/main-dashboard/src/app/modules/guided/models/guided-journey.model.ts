import { ProjectModel } from '@idem/shared-models';

/**
 * Modèle du mode Assisté : un parcours ordonné où chaque étape se débloque
 * quand la précédente est terminée (ou explicitement passée si elle est
 * facultative).
 */

export type GuidedStepId =
  | 'project'
  | 'branding'
  | 'businessPlan'
  | 'finance'
  | 'pitchDeck'
  | 'legalDocs'
  | 'communication';

/**
 * - `done`    : l'étape est terminée
 * - `current` : c'est l'étape sur laquelle l'utilisateur doit travailler
 * - `locked`  : verrouillée tant que les précédentes ne sont pas terminées
 * - `skipped` : étape facultative volontairement passée
 */
export type GuidedStepStatus = 'done' | 'current' | 'locked' | 'skipped';

/**
 * Données que le parcours ne peut pas lire dans le projet : ces modules ont
 * leur propre endpoint et sont sondés à part.
 */
export interface GuidedExternalState {
  hasFinance: boolean;
  hasCommunication: boolean;
}

export interface GuidedStepDefinition {
  id: GuidedStepId;
  /** Icône PrimeIcons affichée dans la pastille de l'étape */
  icon: string;
  /** Page à ouvrir pour travailler l'étape */
  route: string;
  /** Page de génération quand rien n'existe encore (sinon `route`) */
  generateRoute?: string;
  /**
   * Étape obligatoire : elle ne peut pas être passée. C'est ce qui « contraint »
   * le débutant à poser les fondations avant d'aller plus loin.
   */
  required: boolean;
  /** Durée indicative en minutes, affichée pour rassurer */
  estimatedMinutes: number;
  /** L'étape est-elle terminée, d'après l'état connu du projet ? */
  isDone: (project: ProjectModel | null, external: GuidedExternalState) => boolean;
}

/** Étape enrichie de son statut, prête à être affichée. */
export interface GuidedStep extends GuidedStepDefinition {
  index: number;
  status: GuidedStepStatus;
  /** Raccourci : `status !== 'locked'` */
  unlocked: boolean;
}

/** État persisté du parcours pour un projet donné. */
export interface GuidedJourneyState {
  version: 1;
  /** Étapes facultatives volontairement passées */
  skipped: GuidedStepId[];
  updatedAt: string;
}

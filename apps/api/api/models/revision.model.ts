import { JsonPatchOp } from '../utils/json-patch.util';
import { RevisionAuthorType } from '../utils/revision-context.util';

/**
 * Sections versionnées d'un projet. Chaque section est un artefact autonome
 * (branding, business plan, …) avec sa propre timeline de versions — l'agent
 * IA peut interroger l'historique section par section, comme des fichiers dans
 * git.
 */
export type ProjectSectionKey =
  | 'overview'
  | 'branding'
  | 'businessPlan'
  | 'pitchDeck'
  | 'legalDocs'
  | 'design'
  | 'landing'
  | 'architectures'
  | 'development'
  | 'communication'
  | 'finance'
  | 'deployments';

export interface RevisionAuthor {
  type: RevisionAuthorType;
  /** Firebase UID of the user behind the request. */
  userId?: string;
}

/**
 * Une révision = un commit sur une section d'un projet.
 *
 * Modèle temporel (inspiré des graphes de connaissances bi-temporels) :
 * - `createdAt` est le "transaction time" (quand le système a enregistré le fait) ;
 * - une version est valide de son `createdAt` jusqu'au `createdAt` de la
 *   version suivante de la même section (fenêtre de validité implicite).
 *
 * Stockage (pattern MongoDB "Document Versioning") :
 * - `snapshot` : état complet de la section, présent sur v1 puis périodiquement ;
 * - `patch` : delta RFC 6902 depuis la version précédente (absent sur les snapshots purs).
 * La reconstruction d'une version = snapshot le plus proche ≤ v + patches successifs.
 */
export interface ProjectRevisionModel {
  id?: string;
  projectId: string;
  userId: string;
  section: ProjectSectionKey;
  /** Numéro de version monotone par (projectId, section), démarre à 1. */
  version: number;
  author: RevisionAuthor;
  /** Origine de l'écriture, ex. "POST /project/branding/generate". */
  source: string;
  /** Message de commit (généré automatiquement ou fourni par le service). */
  summary: string;
  /** Chemins modifiés (aperçu rapide pour le log, sans reconstruire le diff). */
  changedPaths: string[];
  /** Delta RFC 6902 depuis la version précédente. */
  patch?: JsonPatchOp[];
  /** État complet de la section (v1 + une version sur SNAPSHOT_INTERVAL). */
  snapshot?: unknown;
  /** Taille approximative de la section à cette version (octets). */
  sizeBytes: number;
  createdAt?: Date;
  updatedAt?: Date;
}

/** Entrée de log compacte renvoyée aux agents/au dashboard (token-efficient). */
export interface RevisionLogEntry {
  section: ProjectSectionKey;
  version: number;
  author: RevisionAuthor;
  source: string;
  summary: string;
  changedPaths: string[];
  createdAt: Date;
}

export interface SectionDiffResult {
  section: ProjectSectionKey;
  fromVersion: number;
  toVersion: number;
  patch: JsonPatchOp[];
  summary: string;
}

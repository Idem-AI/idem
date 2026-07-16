import { ProjectSectionKey } from './revision.model';

/**
 * Système de cohérence inter-artefacts ("Coherence Guard").
 *
 * Quand une section versionnée change (détecté par le hook Chronicle), les
 * règles de cohérence liées sont vérifiées par IA : les incohérences détectées
 * deviennent des alertes avec propositions d'action. L'application est
 * explicite (un clic / une confirmation) — jamais d'écrasement silencieux des
 * données de l'utilisateur.
 */

export type CoherenceAlertStatus = 'open' | 'applied' | 'dismissed' | 'superseded';

export type CoherenceProposalKind =
  /** Remplir/synchroniser le module Finance depuis le business plan (autofill IA existant). */
  | 'finance_autofill'
  /** Action à réaliser manuellement par l'utilisateur (description guidée). */
  | 'manual';

export interface CoherenceIssue {
  description: string;
  targetSection: ProjectSectionKey;
  suggestedAction: string;
}

export interface CoherenceProposal {
  id: string;
  kind: CoherenceProposalKind;
  targetSection: ProjectSectionKey;
  description: string;
}

export interface CoherenceAlertModel {
  id?: string;
  projectId: string;
  userId: string;
  /** Identifiant de la règle, ex: "businessPlan-finance". */
  ruleId: string;
  status: CoherenceAlertStatus;
  /** Analyse en langage naturel produite par l'IA. */
  analysis: string;
  issues: CoherenceIssue[];
  proposals: CoherenceProposal[];
  /** Section dont la modification a déclenché la vérification. */
  triggeredBySection: ProjectSectionKey;
  createdAt?: Date;
  updatedAt?: Date;
}

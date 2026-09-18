/**
 * Programme bêta premium.
 *
 * Une liste d'adresses, tenue par l'équipe, qui ouvre gratuitement les offres
 * les plus complètes jusqu'à une date décidée dans le panel admin.
 *
 * Le point délicat est l'ordre des événements : une adresse peut être ajoutée
 * **avant** que la personne ait un compte IDEM. Le programme doit donc
 * fonctionner dans les deux sens — on invite ceux qui ont déjà un compte, et
 * on reconnaît les autres à l'inscription. D'où un statut explicite plutôt
 * qu'un simple drapeau.
 */

export type BetaTesterStatus =
  /** Adresse enregistrée, aucun compte IDEM ne lui correspond encore. */
  | 'pending_account'
  /** Compte trouvé, droits pas encore ouverts. */
  | 'account_found'
  /** Droits ouverts et invitation envoyée. */
  | 'invited'
  /** Droits actifs et utilisés (au moins une connexion depuis l'invitation). */
  | 'active'
  /** Retiré du programme par un administrateur. */
  | 'revoked'
  /** Fin de la bêta atteinte. */
  | 'expired';

export interface BetaTesterEmailState {
  sentAt?: Date;
  messageId?: string;
  error?: string;
  attempts?: number;
}

export interface BetaTesterModel {
  id?: string;
  /** Adresse en minuscules — clé unique du programme. */
  email: string;
  name?: string;
  /** Mot écrit par l'équipe, repris tel quel dans l'invitation. */
  personalMessage?: string;
  source: 'csv' | 'manual';
  /** Lot d'import, pour pouvoir annuler ou auditer une campagne. */
  importBatchId?: string;
  status: BetaTesterStatus;
  /** Compte IDEM rattaché, une fois trouvé. */
  userId?: string;
  invitedAt?: Date;
  grantedAt?: Date;
  revokedAt?: Date;
  revokedReason?: string;
  /**
   * Mois de la dernière recharge de crédits (`YYYY-MM`).
   *
   * C'est ce qui rend la recharge mensuelle idempotente : la tâche tourne
   * toutes les heures, et sans ce repère elle rechargerait à chaque passage.
   */
  lastCreditedMonth?: string;
  email_state?: BetaTesterEmailState;
  addedBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

/** Statuts qui donnent effectivement accès aux offres premium. */
export const ACTIVE_BETA_STATUSES: BetaTesterStatus[] = ['invited', 'active'];

/**
 * Validation d'adresse, volontairement permissive.
 *
 * Elle écarte les saisies manifestement fautives d'un fichier CSV (cellule
 * vide, nom collé, point-virgule oublié) sans prétendre décider de la validité
 * réelle d'une adresse — seul un envoi le dira.
 */
export function isValidEmail(value: string): boolean {
  const email = value.trim();
  if (email.length < 6 || email.length > 254) return false;
  return /^[^\s@,;]+@[^\s@,;.]+\.[^\s@,;]{2,}$/.test(email);
}

/** Forme canonique : minuscules, sans espaces ni chevrons. */
export function normalizeEmail(value: string): string {
  return value
    .trim()
    .replace(/^.*<|>.*$/g, '')
    .toLowerCase();
}

/** Mois courant au format `YYYY-MM`, en UTC. */
export function monthKey(date = new Date()): string {
  return date.toISOString().slice(0, 7);
}

export interface BetaImportRow {
  email: string;
  name?: string;
  message?: string;
}

export interface BetaImportReport {
  /** Lignes reçues. */
  received: number;
  /** Adresses valides et uniques. */
  accepted: number;
  /** Adresses correspondant à un compte IDEM existant. */
  matched: number;
  /** Adresses sans compte, gardées en attente. */
  pending: number;
  /** Doublons dans le fichier ou déjà présents dans la liste. */
  duplicates: number;
  /** Lignes écartées, avec leur motif. */
  invalid: { email: string; reason: string }[];
  /** Identifiant du lot, présent seulement si l'import a été appliqué. */
  batchId?: string;
  dryRun: boolean;
}

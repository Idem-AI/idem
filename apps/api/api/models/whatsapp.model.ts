/**
 * Publier depuis WhatsApp — règles et constantes.
 *
 * Le principe de sécurité tient en une phrase : **rien n'est publié sans un « oui » explicite de
 * l'utilisateur, venu du numéro WhatsApp qu'il a lié, sur la version exacte qu'on lui a montrée.**
 * Tout le reste (génération, retouches, relances) est borné et sans effet public.
 */

export type WhatsappLinkStatus = 'pending' | 'active' | 'revoked';

export type ApprovalStatus =
  /** Le visuel ou la vidéo se prépare. */
  | 'generating'
  /** Envoyé à l'utilisateur, en attente de son avis. */
  | 'awaiting'
  /** Une retouche demandée est en cours. */
  | 'revising'
  /** L'utilisateur a validé cette version : plus rien ne change, la publication part. */
  | 'approved'
  | 'publishing'
  | 'published'
  /** Publié sur une partie des réseaux seulement. */
  | 'partial'
  | 'failed'
  | 'cancelled'
  | 'expired';

/** États où une demande peut encore recevoir une réponse de l'utilisateur. */
export const OPEN_APPROVAL_STATUSES: ApprovalStatus[] = ['awaiting'];
/** États qu'aucune réponse ne peut plus modifier. */
export const FINAL_APPROVAL_STATUSES: ApprovalStatus[] = ['published', 'partial', 'failed', 'cancelled', 'expired'];

export const WHATSAPP_LIMITS = {
  /** Durée de vie du code de liaison (clic sur le lien wa.me). */
  linkTokenTtlMs: 10 * 60_000,
  /** Essais de liaison par code et par compte avant d'en exiger un nouveau. */
  linkMaxAttempts: 5,
  /** Une demande de validation sans réponse expire : on ne publie JAMAIS par défaut. */
  approvalTtlMs: 48 * 3_600_000,
  /** Retouches par demande : borne le coût et coupe les boucles. */
  maxRevisions: 5,
  /** Créations ponctuelles par jour et par compte. */
  adhocPerDay: 10,
  /** Messages entrants traités par minute et par numéro. */
  inboundPerMinute: 20,
  /** Longueur maximale d'un message entrant lu (le reste est ignoré). */
  maxInboundChars: 1_000,
  /** Fenêtre de service de WhatsApp : au-delà, seul un modèle approuvé peut être envoyé. */
  serviceWindowMs: 24 * 3_600_000,
  /** Délai d'attente d'un rendu vidéo. */
  videoRenderTimeoutMs: 12 * 60_000,
  /** Plafond de taille d'un média téléversé à WhatsApp. */
  maxVideoBytes: 16 * 1024 * 1024,
} as const;

/**
 * Réponses qui valent « oui, publiez ». Liste FERMÉE, comparée à l'identique après
 * normalisation : ni modèle de langage, ni « contient ». Une phrase ambiguë (« ok mais change le
 * titre ») n'y figure pas et part en retouche.
 */
export const APPROVE_PHRASES = [
  'ok', 'oui', 'yes', 'go', 'valide', 'valider', 'je valide', 'cest bon', 'c bon', 'parfait',
  'publie', 'publier', 'publiez', 'vas y', 'allez y', 'approuve', 'approved', 'approve', 'looks good',
  'tout est bon', 'ok publie', 'ok publiez', 'oui publie', 'oui publiez', 'ok go',
];
export const CANCEL_PHRASES = ['annule', 'annuler', 'non', 'no', 'cancel', 'stop publication', 'ne publie pas', 'pas maintenant', 'plus tard'];
/** Retire le consentement aux propositions automatiques (la liaison reste). */
export const STOP_PHRASES = ['stop', 'arret', 'arreter', 'desactiver', 'unsubscribe'];
/** Délie le numéro du compte. */
export const UNLINK_PHRASES = ['delier', 'dissocier', 'unlink', 'supprimer mon numero'];
export const HELP_PHRASES = ['aide', 'help', 'menu', '?'];

/** Normalise un message pour le comparer aux listes ci-dessus. */
export function normalizeReply(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9? ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Préfixe du code de liaison, posé dans le message pré-rempli du lien wa.me. */
export const LINK_CODE_PREFIX = 'IDEM';

/** Les identifiants de boutons : `<action>:<approvalId>:<version>`. */
export type ButtonAction = 'approve' | 'revise' | 'cancel' | 'show';
export function buttonId(action: ButtonAction, approvalId: string, version: number): string {
  return `${action}:${approvalId}:${version}`;
}
export function parseButtonId(id: string): { action: ButtonAction; approvalId: string; version: number } | null {
  const match = /^(approve|revise|cancel|show):([a-f0-9]{24}):(\d{1,3})$/.exec(id || '');
  return match ? { action: match[1] as ButtonAction, approvalId: match[2], version: Number(match[3]) } : null;
}

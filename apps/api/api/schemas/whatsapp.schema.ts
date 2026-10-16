import mongoose, { Document, Schema } from 'mongoose';
import type { ApprovalStatus, WhatsappLinkStatus } from '../models/whatsapp.model';
import type { SocialNetwork } from '../models/communication.model';

/**
 * Collections de « Publier depuis WhatsApp » :
 *  - `whatsapp_links`     : le numéro lié à un compte (chiffré + empreinte), ses préférences ;
 *  - `whatsapp_approvals` : une demande de validation = une version exacte d'un contenu ;
 *  - `whatsapp_events`    : messages déjà traités (anti-rejeu), purgés au bout de 7 jours ;
 *  - `social_accounts`    : les comptes de réseaux sociaux connectés (jetons chiffrés).
 */

// ============================================
// LIAISON D'UN NUMÉRO
// ============================================

export interface WhatsappLinkDocument extends Document {
  userId: string;
  status: WhatsappLinkStatus;
  /** Numéro (chiffres seuls, format international) chiffré, avec l'identifiant du compte en AAD. */
  phoneEnc?: string;
  /** Empreinte du numéro : retrouver un compte depuis un message entrant sans le stocker en clair. */
  phoneHash?: string;
  phoneLast4?: string;
  /** Empreinte du code de liaison à usage unique (jamais le code lui-même). */
  tokenHash?: string;
  tokenExpiresAt?: Date;
  tokenAttempts: number;
  /** Projet sur lequel les créations ponctuelles sont faites. */
  defaultProjectId?: string;
  /** Propositions automatiques les jours de publication (consentement explicite). */
  dailyProposals: boolean;
  consentAt?: Date;
  /** Heure locale d'envoi des propositions (0-23) et décalage UTC du fuseau, en minutes. */
  sendHour: number;
  utcOffsetMinutes: number;
  language: 'fr' | 'en';
  linkedAt?: Date;
  lastInboundAt?: Date;
  /** Créations ponctuelles du jour (borne le coût). */
  adhocDay?: string;
  adhocCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const WhatsappLinkSchema = new Schema<WhatsappLinkDocument>(
  {
    userId: { type: String, required: true },
    status: { type: String, required: true, default: 'pending' },
    phoneEnc: { type: String },
    phoneHash: { type: String },
    phoneLast4: { type: String },
    tokenHash: { type: String },
    tokenExpiresAt: { type: Date },
    tokenAttempts: { type: Number, default: 0 },
    defaultProjectId: { type: String },
    dailyProposals: { type: Boolean, default: false },
    consentAt: { type: Date },
    sendHour: { type: Number, default: 8 },
    utcOffsetMinutes: { type: Number, default: 60 },
    language: { type: String, default: 'fr' },
    linkedAt: { type: Date },
    lastInboundAt: { type: Date },
    adhocDay: { type: String },
    adhocCount: { type: Number, default: 0 },
  },
  { timestamps: true, collection: 'whatsapp_links' }
);

WhatsappLinkSchema.index({ userId: 1 }, { unique: true, name: 'one_link_per_user' });
/** Un numéro actif ne sert qu'un compte : empêche de capter les messages d'un autre. */
WhatsappLinkSchema.index(
  { phoneHash: 1 },
  { unique: true, name: 'one_active_link_per_phone', partialFilterExpression: { status: 'active' } }
);
WhatsappLinkSchema.index({ tokenHash: 1 }, { name: 'link_token', sparse: true });

export const WhatsappLink = mongoose.model<WhatsappLinkDocument>('WhatsappLink', WhatsappLinkSchema);

// ============================================
// DEMANDES DE VALIDATION
// ============================================

export interface ApprovalResult {
  network: SocialNetwork | string;
  status: 'published' | 'failed' | 'manual';
  externalUrl?: string;
  error?: string;
  at: Date;
}

export interface ApprovalHistoryEntry {
  at: Date;
  action: string;
  version: number;
  /** Empreinte de ce que l'utilisateur voyait à cet instant. */
  hash: string;
}

export interface WhatsappApprovalDocument extends Document {
  userId: string;
  projectId: string;
  /** Contenu du calendrier concerné ; absent pour une création ponctuelle. */
  contentId?: string;
  kind: 'planned' | 'adhoc';
  /** Jour (YYYY-MM-DD) de publication prévu : rend la proposition du jour idempotente. */
  forDay?: string;
  mediaKind: 'image' | 'video';
  flyerId?: string;
  videoId?: string;
  caption: string;
  hashtags: string[];
  /** Réseaux visés (réseaux de publication connus d'IDEM). */
  networks: string[];
  /** Canaux du calendrier où IDEM ne publie pas (TikTok, YouTube…) : l'utilisateur publie à la main. */
  manualChannels: string[];
  /** Incrémentée à chaque retouche : les boutons d'une ancienne version ne marchent plus. */
  version: number;
  /** Empreinte de la version montrée (légende + média + réseaux). Fixée à l'envoi. */
  contentHash: string;
  status: ApprovalStatus;
  revisions: number;
  /** L'utilisateur a touché « Modifier » : son prochain message est la consigne. */
  awaitingInstruction: boolean;
  expiresAt: Date;
  /** Identifiants WhatsApp des messages envoyés (suivi, pas d'autorité). */
  waMessageIds: string[];
  results: ApprovalResult[];
  history: ApprovalHistoryEntry[];
  failureReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const WhatsappApprovalSchema = new Schema<WhatsappApprovalDocument>(
  {
    userId: { type: String, required: true },
    projectId: { type: String, required: true },
    contentId: { type: String },
    kind: { type: String, required: true },
    forDay: { type: String },
    mediaKind: { type: String, required: true },
    flyerId: { type: String },
    videoId: { type: String },
    caption: { type: String, default: '' },
    hashtags: { type: [String], default: [] },
    networks: { type: [String], default: [] },
    manualChannels: { type: [String], default: [] },
    version: { type: Number, required: true, default: 1 },
    contentHash: { type: String, default: '' },
    status: { type: String, required: true, default: 'generating' },
    revisions: { type: Number, default: 0 },
    awaitingInstruction: { type: Boolean, default: false },
    expiresAt: { type: Date, required: true },
    waMessageIds: { type: [String], default: [] },
    results: { type: [Object], default: [] },
    history: { type: [Object], default: [] },
    failureReason: { type: String },
  },
  { timestamps: true, collection: 'whatsapp_approvals' }
);

WhatsappApprovalSchema.index({ userId: 1, status: 1, createdAt: -1 }, { name: 'open_by_user' });
WhatsappApprovalSchema.index({ status: 1, expiresAt: 1 }, { name: 'expiry' });
/** Une seule proposition par contenu et par jour : relancer le job ne renvoie rien en double. */
WhatsappApprovalSchema.index(
  { userId: 1, projectId: 1, contentId: 1, forDay: 1 },
  { unique: true, name: 'one_proposal_per_content_day', partialFilterExpression: { kind: 'planned' } }
);

export const WhatsappApproval = mongoose.model<WhatsappApprovalDocument>('WhatsappApproval', WhatsappApprovalSchema);

// ============================================
// ANTI-REJEU
// ============================================

export interface WhatsappEventDocument extends Document {
  wamid: string;
  createdAt: Date;
}

const WhatsappEventSchema = new Schema<WhatsappEventDocument>(
  { wamid: { type: String, required: true }, createdAt: { type: Date, default: Date.now } },
  { collection: 'whatsapp_events' }
);
/** Meta rejoue un webhook non acquitté : un message ne s'exécute qu'une fois. */
WhatsappEventSchema.index({ wamid: 1 }, { unique: true, name: 'one_event_per_message' });
WhatsappEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 3600, name: 'event_ttl' });

export const WhatsappEvent = mongoose.model<WhatsappEventDocument>('WhatsappEvent', WhatsappEventSchema);

// ============================================
// COMPTES DE RÉSEAUX SOCIAUX
// ============================================

export interface SocialAccountDocument extends Document {
  userId: string;
  projectId: string;
  network: string;
  status: 'active' | 'expired' | 'revoked';
  /** Identifiant du compte, de la page ou de l'organisation sur lequel on publie. */
  accountId: string;
  accountName?: string;
  /** Jetons chiffrés (AES-GCM, AAD = utilisateur + réseau) : jamais renvoyés au client. */
  accessTokenEnc: string;
  refreshTokenEnc?: string;
  expiresAt?: Date;
  scopes: string[];
  /** Détails propres au réseau (identifiant du compte Instagram lié à une page, par exemple). */
  meta?: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

const SocialAccountSchema = new Schema<SocialAccountDocument>(
  {
    userId: { type: String, required: true },
    projectId: { type: String, required: true },
    network: { type: String, required: true },
    status: { type: String, required: true, default: 'active' },
    accountId: { type: String, required: true },
    accountName: { type: String },
    accessTokenEnc: { type: String, required: true },
    refreshTokenEnc: { type: String },
    expiresAt: { type: Date },
    scopes: { type: [String], default: [] },
    meta: { type: Schema.Types.Mixed },
  },
  { timestamps: true, collection: 'social_accounts' }
);

SocialAccountSchema.index({ userId: 1, projectId: 1, network: 1 }, { unique: true, name: 'one_account_per_network_project' });

export const SocialAccount = mongoose.model<SocialAccountDocument>('SocialAccount', SocialAccountSchema);

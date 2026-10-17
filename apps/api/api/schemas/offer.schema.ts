import mongoose, { Document, Schema } from 'mongoose';
import type { DeliverableKey, IdemCodeKind, MeterOption, MeterTier } from '../models/offer.model';

/**
 * Collections du modèle « Créer, Garder, Faire tourner, Grandir » :
 *  - `deliverable_unlocks` : les versions finales possédées, par projet ;
 *  - `idem_codes`          : les codes vendus par les agents ou offerts (packs à plusieurs) ;
 *  (les commandes de domaines `domain_orders` ont été reprises par iDomain : `npm run import:idem-orders`
 *  dans apps/idomain/api les copie une fois ; la collection n'est plus écrite.)
 *  - `deploy_meters`       : les compteurs prépayés des applications iDeploy.
 */

// ============================================
// VERSIONS FINALES POSSÉDÉES
// ============================================

export type UnlockTier = 'final' | 'signature';
export type UnlockSource = 'purchase' | 'kit' | 'pack' | 'beta' | 'grant' | 'legacy' | 'code';

export interface DeliverableUnlockDocument extends Document {
  userId: string;
  projectId: string;
  deliverable: DeliverableKey;
  tier: UnlockTier;
  source: UnlockSource;
  /** Prix payé pour ce livrable (0 quand il vient du plafond ou d'un pack). */
  paidXaf: number;
  unlockedAt: Date;
  /** Dernière génération en version finale, après le déblocage. */
  finalGeneratedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const DeliverableUnlockSchema = new Schema<DeliverableUnlockDocument>(
  {
    userId: { type: String, required: true },
    projectId: { type: String, required: true },
    deliverable: { type: String, required: true },
    tier: { type: String, required: true, default: 'final' },
    source: { type: String, required: true },
    paidXaf: { type: Number, required: true, default: 0 },
    unlockedAt: { type: Date, required: true },
    finalGeneratedAt: { type: Date },
  },
  { timestamps: true, collection: 'deliverable_unlocks' }
);

/** Un livrable se possède une fois par projet : c'est ce qui rend le déblocage idempotent. */
DeliverableUnlockSchema.index({ userId: 1, projectId: 1, deliverable: 1 }, { unique: true, name: 'one_unlock_per_deliverable' });

export const DeliverableUnlock = mongoose.model<DeliverableUnlockDocument>('DeliverableUnlock', DeliverableUnlockSchema);

// ============================================
// CODES IDEM
// ============================================

export interface IdemCodeDocument extends Document {
  code: string;
  kind: IdemCodeKind;
  /** Valeur en francs d'un code portefeuille ; prix du pack pour un code pack. */
  valueXaf: number;
  batchId: string;
  /** Qui a créé le lot : administrateur, ou acheteur d'un pack « À plusieurs ». */
  createdBy: string;
  /** Agent qui vend le lot, pour sa commission. */
  agentId?: string;
  redeemedBy?: string;
  redeemedAt?: Date;
  /** Projet auquel un code pack a été appliqué. */
  redeemedProjectId?: string;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const IdemCodeSchema = new Schema<IdemCodeDocument>(
  {
    code: { type: String, required: true },
    kind: { type: String, required: true },
    valueXaf: { type: Number, required: true },
    batchId: { type: String, required: true },
    createdBy: { type: String, required: true },
    agentId: { type: String },
    redeemedBy: { type: String },
    redeemedAt: { type: Date },
    redeemedProjectId: { type: String },
    expiresAt: { type: Date },
  },
  { timestamps: true, collection: 'idem_codes' }
);

IdemCodeSchema.index({ code: 1 }, { unique: true });
IdemCodeSchema.index({ batchId: 1 });
IdemCodeSchema.index({ agentId: 1, redeemedAt: 1 }, { sparse: true });
IdemCodeSchema.index({ createdBy: 1, createdAt: -1 });

export const IdemCode = mongoose.model<IdemCodeDocument>('IdemCode', IdemCodeSchema);

// ============================================
// COMPTEURS iDEPLOY
// ============================================

export type MeterStatus = 'active' | 'asleep' | 'archived';

export interface DeployMeterDocument extends Document {
  userId: string;
  /** Identifiant de l'application côté iDeploy. */
  appUuid: string;
  appName?: string;
  tier: MeterTier;
  options: MeterOption[];
  status: MeterStatus;
  /** Recharge automatique depuis le portefeuille quand le solde baisse. */
  autoRecharge: boolean;
  /** Dernier jour (UTC, `YYYY-MM-DD`) débité ou couvert. */
  lastChargedDay?: string;
  /** Ce qui a couvert le dernier jour : portefeuille, forfait, jours prépayés. */
  lastCoveredBy?: 'wallet' | 'pass' | 'prepaid' | 'free';
  sleepingSince?: Date;
  /** Dernière alerte de solde envoyée. */
  alertSentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const DeployMeterSchema = new Schema<DeployMeterDocument>(
  {
    userId: { type: String, required: true },
    appUuid: { type: String, required: true },
    appName: { type: String },
    tier: { type: String, required: true, default: 'veille' },
    options: [{ type: String }],
    status: { type: String, required: true, default: 'active' },
    autoRecharge: { type: Boolean, default: false },
    lastChargedDay: { type: String },
    lastCoveredBy: { type: String },
    sleepingSince: { type: Date },
    alertSentAt: { type: Date },
  },
  { timestamps: true, collection: 'deploy_meters' }
);

DeployMeterSchema.index({ appUuid: 1 }, { unique: true });
DeployMeterSchema.index({ userId: 1, status: 1 });
DeployMeterSchema.index({ status: 1, lastChargedDay: 1 });

export const DeployMeter = mongoose.model<DeployMeterDocument>('DeployMeter', DeployMeterSchema);

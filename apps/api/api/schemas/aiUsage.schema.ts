import mongoose, { Schema, Document } from 'mongoose';
import { AiUsageEventModel } from '../models/aiUsage.model';

export interface AiUsageEventDocument extends Omit<AiUsageEventModel, 'id'>, Document {}

const AiUsageEventSchema = new Schema<AiUsageEventDocument>(
  {
    userId: { type: String },
    projectId: { type: String },
    feature: { type: String, required: true },
    element: { type: String },
    operation: { type: String, required: true, default: 'other' },

    variantCount: { type: Number },
    variantIndex: { type: Number },
    batchId: { type: String },

    provider: { type: String, required: true },
    modelName: { type: String, required: true },
    pricingEstimated: { type: Boolean, default: false },

    inputTokens: { type: Number, required: true, default: 0 },
    outputTokens: { type: Number, required: true, default: 0 },
    cachedInputTokens: { type: Number, default: 0 },
    totalTokens: { type: Number, required: true, default: 0 },
    tokensEstimated: { type: Boolean, default: false },
    estimatedCostUsd: { type: Number, required: true, default: 0 },

    status: { type: String, required: true, default: 'success' },
    errorMessage: { type: String },
    durationMs: { type: Number },
    promptType: { type: String },
    requestId: { type: String },
    source: { type: String },

    day: { type: String, required: true },
  },
  {
    timestamps: true,
    collection: 'ai_usage_events',
  }
);

// ============================================
// INDEX
// ============================================
// Chaque index correspond à une question posée par le panel admin. Les
// agrégations de coût étant des scans par période, `day` (ou `createdAt`) est
// systématiquement en tête ou en second champ.

// Consommation globale sur une période (dashboard, séries journalières).
AiUsageEventSchema.index({ day: 1 });
AiUsageEventSchema.index({ createdAt: -1 });

// Consommation d'un utilisateur sur une période (fiche utilisateur).
AiUsageEventSchema.index({ userId: 1, day: 1 });

// Consommation d'un projet sur une période (visualiseur de projet).
AiUsageEventSchema.index({ projectId: 1, day: 1 });

// Consommation par élément d'un projet ("combien a coûté le logo de ce projet").
AiUsageEventSchema.index({ projectId: 1, feature: 1, element: 1 });

// Coût par fonctionnalité sur la plateforme (quelle feature coûte le plus).
AiUsageEventSchema.index({ feature: 1, day: 1 });

// Répartition génération / régénération / variantes.
AiUsageEventSchema.index({ operation: 1, day: 1 });

// Coût par modèle (arbitrage fournisseur).
AiUsageEventSchema.index({ modelName: 1, day: 1 });

// Reconstitution d'un lot de variantes (les 4 logos d'un même geste).
AiUsageEventSchema.index({ batchId: 1 }, { sparse: true });

// Corrélation avec les logs applicatifs.
AiUsageEventSchema.index({ requestId: 1 }, { sparse: true });

// Taux d'échec des générations.
AiUsageEventSchema.index({ status: 1, day: 1 });

/**
 * Purge automatique. Le journal grossit d'un document par appel de modèle :
 * sans TTL il devient la plus grosse collection de la base. `AI_USAGE_TTL_DAYS`
 * (0 = conservation illimitée) pilote la rétention ; les rollups journaliers de
 * `token_usage` restent, eux, conservés indéfiniment.
 */
const ttlDays = Number(process.env.AI_USAGE_TTL_DAYS ?? 400);
if (Number.isFinite(ttlDays) && ttlDays > 0) {
  AiUsageEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: ttlDays * 24 * 60 * 60 });
}

export const AiUsageEvent = mongoose.model<AiUsageEventDocument>(
  'AiUsageEvent',
  AiUsageEventSchema
);

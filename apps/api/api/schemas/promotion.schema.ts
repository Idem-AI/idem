import mongoose, { Schema, Document } from 'mongoose';
import type {
  PromotionAudience,
  PromotionDiscount,
  PromotionDisplay,
  PromotionKind,
  PromotionLimits,
  PromotionQuotas,
  PromotionScope,
  PromotionState,
  PromotionStats,
} from '../../../../packages/shared-promotions/src/model';

/**
 * Les promotions (campagnes et coupons), réglées depuis le panel admin.
 *
 * Quatre collections :
 *  - `promotions`            : la règle, ses compteurs globaux (`stats`), modifiés par `$inc` conditionnel
 *                              pour qu'une limite totale ou un budget ne soit jamais dépassé à plusieurs ;
 *  - `promotion_usages`      : un compteur par compte et par promotion (limite « par compte ») ;
 *  - `promotion_claims`      : les coupons saisis par un compte (un coupon ne s'applique qu'après saisie) ;
 *  - `promotion_redemptions` : le journal de chaque remise accordée (achat, montant, écriture du relevé),
 *                              append-only, pour l'audit et le coût réel d'une campagne.
 *
 * Une promotion n'est jamais supprimée une fois lancée : on y met fin. Seul un brouillon s'efface.
 */

export interface PromotionDocument extends Document {
  slug: string;
  name: string;
  description?: string;
  kind: PromotionKind;
  state: PromotionState;
  code?: string | null;
  startsAt: Date;
  endsAt: Date | null;
  priority: number;
  stackable: boolean;
  discount: PromotionDiscount;
  scope: PromotionScope;
  audience: Omit<PromotionAudience, 'newUsersSince'> & { newUsersSince?: Date | null };
  limits: PromotionLimits;
  display: PromotionDisplay;
  quotas?: PromotionQuotas | null;
  walletCreditXaf?: number;
  topupBonusPercent?: number;
  stats: PromotionStats;
  createdBy?: string;
  updatedBy?: string;
  endedAt?: Date | null;
  endedBy?: string | null;
  endReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const PromotionSchema = new Schema<PromotionDocument>(
  {
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String },
    kind: { type: String, enum: ['campaign', 'coupon'], required: true },
    state: { type: String, enum: ['draft', 'active', 'paused', 'ended'], default: 'draft', index: true },
    // Unique parmi les coupons seulement : une campagne n'a pas de code.
    code: { type: String, default: null },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, default: null },
    priority: { type: Number, default: 0 },
    stackable: { type: Boolean, default: false },
    discount: {
      type: { type: String, enum: ['free', 'percent', 'fixed'], required: true },
      value: { type: Number, default: 0 },
    },
    scope: {
      all: { type: Boolean, default: false },
      services: [{ type: String }],
      items: [{ type: String }],
      excludeItems: [{ type: String }],
    },
    audience: {
      everyone: { type: Boolean, default: true },
      newUsersSince: { type: Date, default: null },
      emails: [{ type: String }],
      userIds: [{ type: String }],
    },
    limits: {
      perUser: { type: Number, default: null },
      total: { type: Number, default: null },
      budgetXaf: { type: Number, default: null },
      claims: { type: Number, default: null },
    },
    display: {
      banner: { type: Boolean, default: false },
      title: { type: String, default: '' },
      message: { type: String, default: '' },
      strikethrough: { type: Boolean, default: true },
      badge: { type: String, default: '' },
      en: {
        title: { type: String, default: '' },
        message: { type: String, default: '' },
        badge: { type: String, default: '' },
      },
    },
    // Groupe → fenêtre → limite : `Mixed`, comme les surcharges de quotas des réglages.
    quotas: { type: Schema.Types.Mixed, default: null },
    walletCreditXaf: { type: Number, default: 0 },
    topupBonusPercent: { type: Number, default: 0 },
    stats: {
      redemptions: { type: Number, default: 0 },
      discountXaf: { type: Number, default: 0 },
      claims: { type: Number, default: 0 },
      topupBonusXaf: { type: Number, default: 0 },
      walletCreditXaf: { type: Number, default: 0 },
    },
    createdBy: { type: String },
    updatedBy: { type: String },
    endedAt: { type: Date, default: null },
    endedBy: { type: String, default: null },
    endReason: { type: String, default: null },
  },
  { timestamps: true, collection: 'promotions' }
);

PromotionSchema.index({ code: 1 }, { unique: true, partialFilterExpression: { code: { $type: 'string' } } });
PromotionSchema.index({ state: 1, startsAt: 1, endsAt: 1 });

export const Promotion = mongoose.model<PromotionDocument>('Promotion', PromotionSchema);

// ── Compteur par compte ──────────────────────────────────────────────────────

export interface PromotionUsageDocument extends Document {
  promotionId: string;
  userId: string;
  count: number;
  discountXaf: number;
  updatedAt: Date;
}

const PromotionUsageSchema = new Schema<PromotionUsageDocument>(
  {
    promotionId: { type: String, required: true },
    userId: { type: String, required: true },
    count: { type: Number, default: 0 },
    discountXaf: { type: Number, default: 0 },
  },
  { timestamps: true, collection: 'promotion_usages' }
);
PromotionUsageSchema.index({ promotionId: 1, userId: 1 }, { unique: true });

export const PromotionUsage = mongoose.model<PromotionUsageDocument>('PromotionUsage', PromotionUsageSchema);

// ── Coupons saisis ───────────────────────────────────────────────────────────

export interface PromotionClaimDocument extends Document {
  promotionId: string;
  userId: string;
  code: string;
  walletCreditXaf: number;
  createdAt: Date;
}

const PromotionClaimSchema = new Schema<PromotionClaimDocument>(
  {
    promotionId: { type: String, required: true },
    userId: { type: String, required: true, index: true },
    code: { type: String, required: true },
    walletCreditXaf: { type: Number, default: 0 },
  },
  { timestamps: true, collection: 'promotion_claims' }
);
PromotionClaimSchema.index({ promotionId: 1, userId: 1 }, { unique: true });

export const PromotionClaim = mongoose.model<PromotionClaimDocument>('PromotionClaim', PromotionClaimSchema);

// ── Journal des remises ──────────────────────────────────────────────────────

export interface PromotionRedemptionDocument extends Document {
  promotionId: string;
  userId: string;
  /** `discount` (achat remisé), `topup_bonus`, `wallet_credit` (coupon). */
  kind: 'discount' | 'topup_bonus' | 'wallet_credit';
  item?: string | null;
  action?: string;
  projectId?: string;
  originalXaf: number;
  discountXaf: number;
  paidXaf: number;
  ledgerEntryId?: string;
  /** Vrai si l'achat a finalement échoué (solde insuffisant) : la remise a été rendue. */
  released?: boolean;
  createdAt: Date;
}

const PromotionRedemptionSchema = new Schema<PromotionRedemptionDocument>(
  {
    promotionId: { type: String, required: true },
    userId: { type: String, required: true },
    kind: { type: String, enum: ['discount', 'topup_bonus', 'wallet_credit'], default: 'discount' },
    item: { type: String, default: null },
    action: { type: String },
    projectId: { type: String },
    originalXaf: { type: Number, default: 0 },
    discountXaf: { type: Number, default: 0 },
    paidXaf: { type: Number, default: 0 },
    ledgerEntryId: { type: String },
    released: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'promotion_redemptions' }
);
PromotionRedemptionSchema.index({ promotionId: 1, createdAt: -1 });
PromotionRedemptionSchema.index({ userId: 1, createdAt: -1 });

export const PromotionRedemption = mongoose.model<PromotionRedemptionDocument>('PromotionRedemption', PromotionRedemptionSchema);

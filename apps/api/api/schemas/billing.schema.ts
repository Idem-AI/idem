import mongoose, { Schema, Document } from 'mongoose';
import {
  BillingInvoiceModel,
  BillingProductModel,
  BillingPurchaseModel,
  BillingSubscriptionModel,
  CreditLedgerEntryModel,
} from '../models/billing.model';

/**
 * Collections de facturation. Voir models/billing.model.ts pour le modèle et
 * apps/api/docs/BILLING.md pour la vue d'ensemble.
 *
 * Les index servent deux usages : l'exécution (résoudre l'abonnement et le
 * solde de crédits d'un utilisateur sur un moteur donné) et l'analyse (chiffre
 * d'affaires par période, moteur et type de produit, à comparer au coût des
 * tokens).
 */

// ============================================
// CATALOGUE
// ============================================

export interface BillingProductDocument extends Omit<BillingProductModel, 'id'>, Document {}

const BillingProductSchema = new Schema<BillingProductDocument>(
  {
    code: { type: String, required: true, unique: true },
    kind: { type: String, required: true },
    engine: { type: String, default: null },
    name: { type: String, required: true },
    description: { type: String },
    priceXaf: { type: Number, required: true, default: 0 },
    interval: { type: String, required: true, default: 'month' },
    credits: { type: Number, required: true, default: 0 },
    validityHours: { type: Number },
    subscriptionTier: { type: String },
    highlighted: { type: Boolean, default: false },
    features: [{ type: String }],
    discountLabel: { type: String },
    localAlternative: { type: String },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true, collection: 'billing_products' }
);

// Affichage du catalogue, filtré par moteur et par nature.
BillingProductSchema.index({ engine: 1, kind: 1, sortOrder: 1 });
BillingProductSchema.index({ isActive: 1, sortOrder: 1 });

export const BillingProduct = mongoose.model<BillingProductDocument>(
  'BillingProduct',
  BillingProductSchema
);

// ============================================
// ABONNEMENTS
// ============================================

export interface BillingSubscriptionDocument
  extends Omit<BillingSubscriptionModel, 'id'>,
    Document {}

const BillingSubscriptionSchema = new Schema<BillingSubscriptionDocument>(
  {
    userId: { type: String, required: true },
    engine: { type: String, required: true },
    productCode: { type: String, required: true },
    status: { type: String, required: true, default: 'active' },
    priceXaf: { type: Number, required: true, default: 0 },
    interval: { type: String, required: true, default: 'month' },
    installments: { type: Number, default: 1 },
    currentPeriodStart: { type: Date, required: true },
    currentPeriodEnd: { type: Date, required: true },
    canceledAt: { type: Date },
    consecutivePeriods: { type: Number, default: 0 },
    provider: { type: String, required: true, default: 'manual' },
    providerSubscriptionId: { type: String },
    providerCustomerId: { type: String },
  },
  { timestamps: true, collection: 'billing_subscriptions' }
);

/**
 * Un seul abonnement actif par (utilisateur, MOTEUR), garanti EN BASE.
 *
 * La clé porte sur le couple et non sur le seul utilisateur : un même client
 * peut légitimement être abonné à Business, AppGen et iDeploy simultanément —
 * c'est même le but des bundles. L'index partiel unique empêche en revanche
 * deux abonnements actifs sur le MÊME moteur, donc la double facturation, y
 * compris sous requêtes concurrentes.
 */
BillingSubscriptionSchema.index(
  { userId: 1, engine: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['active', 'trialing'] } },
    name: 'one_active_subscription_per_user_engine',
  }
);

// Renouvellements à traiter (tâche planifiée).
BillingSubscriptionSchema.index({ status: 1, currentPeriodEnd: 1 });

// Répartition des abonnés par produit / moteur (dashboard admin).
BillingSubscriptionSchema.index({ productCode: 1, status: 1 });
BillingSubscriptionSchema.index({ engine: 1, status: 1 });

// Historique d'un utilisateur.
BillingSubscriptionSchema.index({ userId: 1, createdAt: -1 });

export const BillingSubscription = mongoose.model<BillingSubscriptionDocument>(
  'BillingSubscription',
  BillingSubscriptionSchema
);

// ============================================
// ACHATS PONCTUELS
// ============================================

export interface BillingPurchaseDocument extends Omit<BillingPurchaseModel, 'id'>, Document {}

const BillingPurchaseSchema = new Schema<BillingPurchaseDocument>(
  {
    userId: { type: String, required: true },
    productCode: { type: String, required: true },
    kind: { type: String, required: true },
    engine: { type: String, default: null },
    priceXaf: { type: Number, required: true, default: 0 },
    creditsGranted: { type: Number, default: 0 },
    projectId: { type: String },
    expiresAt: { type: Date },
    provider: { type: String, required: true, default: 'manual' },
    providerPaymentId: { type: String },
    day: { type: String, required: true },
  },
  { timestamps: true, collection: 'billing_purchases' }
);

// Chiffre d'affaires ponctuel par période / produit — le pendant du MRR.
BillingPurchaseSchema.index({ day: 1, kind: 1 });
BillingPurchaseSchema.index({ productCode: 1, day: 1 });
BillingPurchaseSchema.index({ userId: 1, createdAt: -1 });

/**
 * Un seul Project Pass par (utilisateur, projet) : le pass débloque un projet
 * une fois pour toutes, le racheter serait une erreur de facturation.
 */
BillingPurchaseSchema.index(
  { userId: 1, projectId: 1 },
  {
    unique: true,
    partialFilterExpression: { kind: 'project_pass' },
    name: 'one_project_pass_per_project',
  }
);

// Passes actifs d'un utilisateur (contrôle d'accès AppGen).
BillingPurchaseSchema.index({ userId: 1, expiresAt: 1 });

export const BillingPurchase = mongoose.model<BillingPurchaseDocument>(
  'BillingPurchase',
  BillingPurchaseSchema
);

// ============================================
// FACTURES
// ============================================

export interface BillingInvoiceDocument extends Omit<BillingInvoiceModel, 'id'>, Document {}

const BillingInvoiceSchema = new Schema<BillingInvoiceDocument>(
  {
    userId: { type: String, required: true },
    subscriptionId: { type: String },
    purchaseId: { type: String },
    productCode: { type: String, required: true },
    kind: { type: String, required: true },
    engine: { type: String, default: null },
    number: { type: String, required: true, unique: true },
    status: { type: String, required: true, default: 'draft' },
    amountXaf: { type: Number, required: true, default: 0 },
    amountUsd: { type: Number, required: true, default: 0 },
    xafPerUsd: { type: Number, required: true, default: 577 },
    periodStart: { type: Date },
    periodEnd: { type: Date },
    day: { type: String, required: true },
    issuedAt: { type: Date, required: true },
    paidAt: { type: Date },
    provider: { type: String, required: true, default: 'manual' },
    providerInvoiceId: { type: String },
  },
  { timestamps: true, collection: 'billing_invoices' }
);

// Chiffre d'affaires par période — la requête du calcul de rentabilité.
BillingInvoiceSchema.index({ status: 1, day: 1 });
BillingInvoiceSchema.index({ day: 1 });

// CA par moteur et par type de produit (récurrent vs ponctuel).
BillingInvoiceSchema.index({ engine: 1, day: 1 });
BillingInvoiceSchema.index({ kind: 1, day: 1 });

BillingInvoiceSchema.index({ userId: 1, issuedAt: -1 });

// Idempotence : une seule facture par (abonnement, période). Rejouer la tâche
// de renouvellement ne double-facture pas.
BillingInvoiceSchema.index(
  { subscriptionId: 1, periodStart: 1 },
  { unique: true, sparse: true, name: 'one_invoice_per_subscription_period' }
);

export const BillingInvoice = mongoose.model<BillingInvoiceDocument>(
  'BillingInvoice',
  BillingInvoiceSchema
);

// ============================================
// GRAND LIVRE DE CRÉDITS
// ============================================

export interface CreditLedgerEntryDocument
  extends Omit<CreditLedgerEntryModel, 'id'>,
    Document {}

const CreditLedgerEntrySchema = new Schema<CreditLedgerEntryDocument>(
  {
    userId: { type: String, required: true },
    engine: { type: String, required: true },
    delta: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    reason: { type: String, required: true },
    action: { type: String },
    projectId: { type: String },
    feature: { type: String },
    element: { type: String },
    aiUsageEventId: { type: String },
    subscriptionId: { type: String },
    purchaseId: { type: String },
    expiresAt: { type: Date },
    note: { type: String },
    day: { type: String, required: true },
  },
  { timestamps: true, collection: 'credit_ledger' }
);

/**
 * Solde et relevé par MOTEUR : les compteurs étant séparés, toute lecture de
 * solde est nécessairement filtrée sur (userId, engine).
 */
CreditLedgerEntrySchema.index({ userId: 1, engine: 1, createdAt: -1 });

// Consommation par période, moteur et livrable (analyse).
CreditLedgerEntrySchema.index({ day: 1, engine: 1, reason: 1 });
CreditLedgerEntrySchema.index({ action: 1, day: 1 });

// Crédits consommés par projet.
CreditLedgerEntrySchema.index({ projectId: 1, createdAt: -1 });

// Péremption des crédits reportés (rollover de 2 mois).
CreditLedgerEntrySchema.index({ expiresAt: 1 }, { sparse: true });

export const CreditLedgerEntry = mongoose.model<CreditLedgerEntryDocument>(
  'CreditLedgerEntry',
  CreditLedgerEntrySchema
);

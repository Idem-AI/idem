import mongoose, { Schema, Document } from 'mongoose';
import {
  BillingInvoiceModel,
  BillingPlanModel,
  BillingSubscriptionModel,
  CreditLedgerEntryModel,
} from '../models/billing.model';

/**
 * Collections de facturation. Voir models/billing.model.ts pour le modèle.
 *
 * Les index sont choisis pour les deux usages réels :
 *  - l'exécution (résoudre l'abonnement et le solde de crédits d'un user) ;
 *  - l'analyse (chiffre d'affaires par période, à comparer au coût des tokens).
 */

// ============================================
// PLANS
// ============================================

export interface BillingPlanDocument extends Omit<BillingPlanModel, 'id'>, Document {}

const BillingPlanSchema = new Schema<BillingPlanDocument>(
  {
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String },
    price: { type: Number, required: true, default: 0 },
    currency: { type: String, required: true, default: 'USD' },
    interval: { type: String, required: true, default: 'month' },
    creditsPerPeriod: { type: Number, required: true, default: 0 },
    subscriptionTier: { type: String, required: true, default: 'free' },
    highlighted: { type: Boolean, default: false },
    features: [{ type: String }],
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true, collection: 'billing_plans' }
);

// L'unicité de `code` est déjà déclarée sur le champ ; on n'indexe ici que
// l'affichage du catalogue.
BillingPlanSchema.index({ isActive: 1, sortOrder: 1 });

export const BillingPlan = mongoose.model<BillingPlanDocument>('BillingPlan', BillingPlanSchema);

// ============================================
// ABONNEMENTS
// ============================================

export interface BillingSubscriptionDocument
  extends Omit<BillingSubscriptionModel, 'id'>,
    Document {}

const BillingSubscriptionSchema = new Schema<BillingSubscriptionDocument>(
  {
    userId: { type: String, required: true },
    planCode: { type: String, required: true },
    status: { type: String, required: true, default: 'active' },
    price: { type: Number, required: true, default: 0 },
    currency: { type: String, required: true, default: 'USD' },
    interval: { type: String, required: true, default: 'month' },
    currentPeriodStart: { type: Date, required: true },
    currentPeriodEnd: { type: Date, required: true },
    canceledAt: { type: Date },
    provider: { type: String, required: true, default: 'manual' },
    providerSubscriptionId: { type: String },
    providerCustomerId: { type: String },
  },
  { timestamps: true, collection: 'billing_subscriptions' }
);

/**
 * Un seul abonnement ACTIF par utilisateur, garanti EN BASE.
 *
 * Index partiel unique plutôt qu'un contrôle applicatif : deux requêtes
 * concurrentes de souscription créeraient sinon deux abonnements actifs, et
 * l'utilisateur serait facturé deux fois.
 */
BillingSubscriptionSchema.index(
  { userId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['active', 'trialing'] } },
    name: 'one_active_subscription_per_user',
  }
);

// Renouvellements à traiter (tâche planifiée).
BillingSubscriptionSchema.index({ status: 1, currentPeriodEnd: 1 });

// Répartition des abonnés par plan (dashboard admin).
BillingSubscriptionSchema.index({ planCode: 1, status: 1 });

// Historique d'un utilisateur.
BillingSubscriptionSchema.index({ userId: 1, createdAt: -1 });

export const BillingSubscription = mongoose.model<BillingSubscriptionDocument>(
  'BillingSubscription',
  BillingSubscriptionSchema
);

// ============================================
// FACTURES
// ============================================

export interface BillingInvoiceDocument extends Omit<BillingInvoiceModel, 'id'>, Document {}

const BillingInvoiceSchema = new Schema<BillingInvoiceDocument>(
  {
    userId: { type: String, required: true },
    subscriptionId: { type: String },
    planCode: { type: String, required: true },
    number: { type: String, required: true, unique: true },
    status: { type: String, required: true, default: 'draft' },
    amount: { type: Number, required: true, default: 0 },
    currency: { type: String, required: true, default: 'USD' },
    amountUsd: { type: Number, required: true, default: 0 },
    fxRateToUsd: { type: Number, required: true, default: 1 },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
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

// Factures d'un utilisateur.
BillingInvoiceSchema.index({ userId: 1, issuedAt: -1 });

// Idempotence de la facturation périodique : une seule facture par
// (abonnement, période). Empêche une double émission si la tâche de
// renouvellement est rejouée.
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
    delta: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    reason: { type: String, required: true },
    action: { type: String },
    projectId: { type: String },
    feature: { type: String },
    element: { type: String },
    aiUsageEventId: { type: String },
    subscriptionId: { type: String },
    note: { type: String },
    day: { type: String, required: true },
  },
  { timestamps: true, collection: 'credit_ledger' }
);

// Reconstitution du solde et relevé d'un utilisateur.
CreditLedgerEntrySchema.index({ userId: 1, createdAt: -1 });

// Consommation de crédits par période / par action (analyse).
CreditLedgerEntrySchema.index({ day: 1, reason: 1 });
CreditLedgerEntrySchema.index({ action: 1, day: 1 });

// Crédits consommés par projet.
CreditLedgerEntrySchema.index({ projectId: 1, createdAt: -1 });

export const CreditLedgerEntry = mongoose.model<CreditLedgerEntryDocument>(
  'CreditLedgerEntry',
  CreditLedgerEntrySchema
);

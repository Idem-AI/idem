import mongoose, { Schema, Document } from 'mongoose';
import { PaymentEventModel, PaymentTransactionModel } from '../models/payment.model';
import { BillingEngine } from '../models/billing.model';

/**
 * Collections d'encaissement. Voir `models/payment.model.ts` pour le modèle et
 * `docs/PAYMENTS.md` pour la vue d'ensemble.
 *
 * Les index répondent à quatre usages, dans cet ordre de fréquence :
 * l'idempotence (un `depositId` = une transaction), la relecture périodique
 * (les transactions en attente et leur échéance), la recherche support (par
 * référence, identifiant opérateur ou empreinte de numéro) et l'analyse.
 */

// ============================================
// TRANSACTIONS
// ============================================

export interface PaymentTransactionDocument
  extends Omit<PaymentTransactionModel, 'id'>,
    Document {}

const PaymentTransactionSchema = new Schema<PaymentTransactionDocument>(
  {
    reference: { type: String, required: true, unique: true },
    depositId: { type: String, required: true, unique: true },
    userId: { type: String, required: true },
    userEmail: { type: String },

    intent: {
      type: { type: String, required: true },
      productCode: { type: String, required: true },
      engine: { type: String, default: null },
      projectId: { type: String },
      interval: { type: String },
      subscriptionId: { type: String },
      installmentIndex: { type: Number },
      simulationTier: { type: String },
      label: { type: String, required: true },
    },

    amount: { type: Number, required: true },
    currency: { type: String, required: true },
    amountXaf: { type: Number, required: true },
    country: { type: String, required: true },
    provider: { type: String, required: true },

    phoneMasked: { type: String, required: true },
    phoneHash: { type: String, required: true },
    phoneEncrypted: { type: String },

    status: { type: String, required: true, default: 'CREATED' },
    pawapayStatus: { type: String },
    failureCode: { type: String },
    failureMessage: { type: String },
    providerTransactionId: { type: String },
    authorizationUrl: { type: String },

    fulfillment: {
      state: { type: String, required: true, default: 'pending' },
      at: { type: Date },
      purchaseId: { type: String },
      subscriptionId: { type: String },
      invoiceId: { type: String },
      consumedBySimulationId: { type: String },
      error: { type: String },
      attempts: { type: Number, default: 0 },
    },

    refund: {
      refundId: { type: String },
      status: { type: String },
      amount: { type: Number },
      requestedBy: { type: String },
      reason: { type: String },
      at: { type: Date },
    },

    polling: {
      count: { type: Number, default: 0 },
      lastAt: { type: Date },
      nextPollAt: { type: Date, default: null },
    },

    idempotencyKey: { type: String },
    requestId: { type: String },
    client: {
      app: { type: String },
      ip: { type: String },
      userAgent: { type: String },
    },

    day: { type: String, required: true },
    finalizedAt: { type: Date },
  },
  { timestamps: true, collection: 'payment_transactions' }
);

// Relecture périodique : la requête du réconciliateur, appelée chaque minute.
PaymentTransactionSchema.index({ status: 1, 'polling.nextPollAt': 1 });

// Livraisons à rattraper : encaissé mais pas encore livré.
PaymentTransactionSchema.index({ status: 1, 'fulfillment.state': 1 });

// Historique d'un utilisateur.
PaymentTransactionSchema.index({ userId: 1, createdAt: -1 });

// Recherche support.
PaymentTransactionSchema.index({ providerTransactionId: 1 }, { sparse: true });
PaymentTransactionSchema.index({ phoneHash: 1 });
PaymentTransactionSchema.index({ userEmail: 1, createdAt: -1 });

// Analyse : volume et taux de succès par jour, opérateur et pays.
PaymentTransactionSchema.index({ day: 1, status: 1 });
PaymentTransactionSchema.index({ provider: 1, status: 1, day: 1 });

// Un projet ne se débloque qu'une fois : deux Project Pass payés pour le même
// projet seraient une erreur de facturation, pas une vente.
PaymentTransactionSchema.index(
  { userId: 1, 'intent.projectId': 1, 'intent.productCode': 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'COMPLETED', 'intent.type': 'purchase' },
    name: 'one_completed_purchase_per_project_product',
    sparse: true,
  }
);

/**
 * Anti double-clic : la même clé d'idempotence ne crée qu'une transaction.
 *
 * L'index porte la garantie plutôt que le code : deux requêtes parties
 * simultanément depuis deux onglets passeraient toutes deux le contrôle
 * applicatif, et l'abonné serait débité deux fois.
 */
PaymentTransactionSchema.index(
  { userId: 1, idempotencyKey: 1 },
  { unique: true, sparse: true, name: 'one_transaction_per_idempotency_key' }
);

export const PaymentTransaction = mongoose.model<PaymentTransactionDocument>(
  'PaymentTransaction',
  PaymentTransactionSchema
);

// ============================================
// ÉVÉNEMENTS
// ============================================

export interface PaymentEventDocument extends Omit<PaymentEventModel, 'id'>, Document {}

const PaymentEventSchema = new Schema<PaymentEventDocument>(
  {
    transactionId: { type: String, required: true },
    depositId: { type: String, required: true },
    type: { type: String, required: true },
    source: { type: String, required: true },
    level: { type: String, required: true, default: 'info' },
    message: { type: String, required: true },
    httpStatus: { type: Number },
    durationMs: { type: Number },
    requestId: { type: String },
    data: { type: Schema.Types.Mixed },
    at: { type: Date, required: true, default: Date.now },
  },
  // Pas de `timestamps` : `at` est posé par l'émetteur de l'événement, et une
  // seconde horloge n'apporterait qu'une occasion de divergence.
  { collection: 'payment_events' }
);

// La timeline d'une transaction — la requête du panel admin.
PaymentEventSchema.index({ transactionId: 1, at: 1 });
PaymentEventSchema.index({ depositId: 1, at: 1 });

// Diagnostic transverse : « tous les échecs de livraison de la semaine ».
PaymentEventSchema.index({ type: 1, at: -1 });
PaymentEventSchema.index({ level: 1, at: -1 });

export const PaymentEvent = mongoose.model<PaymentEventDocument>(
  'PaymentEvent',
  PaymentEventSchema
);

// ============================================
// CALLBACKS BRUTS
// ============================================

export interface PaymentCallbackRawDocument extends Document {
  kind: 'deposit' | 'refund';
  depositId?: string;
  body: unknown;
  headers: Record<string, string>;
  ip?: string;
  signature: {
    mode: 'enforce' | 'log' | 'off';
    verdict: 'valid' | 'invalid' | 'absent' | 'skipped';
    keyId?: string;
    error?: string;
  };
  ipAllowed: boolean;
  receivedAt: Date;
  processedAt?: Date;
  processingError?: string;
}

const PaymentCallbackRawSchema = new Schema<PaymentCallbackRawDocument>(
  {
    kind: { type: String, required: true },
    depositId: { type: String },
    body: { type: Schema.Types.Mixed },
    headers: { type: Schema.Types.Mixed },
    ip: { type: String },
    signature: {
      mode: { type: String },
      verdict: { type: String },
      keyId: { type: String },
      error: { type: String },
    },
    ipAllowed: { type: Boolean, default: true },
    receivedAt: { type: Date, required: true, default: Date.now },
    processedAt: { type: Date },
    processingError: { type: String },
  },
  { collection: 'payment_callbacks_raw' }
);

/**
 * Tout callback est écrit ici AVANT d'être interprété, y compris celui dont le
 * `depositId` nous est inconnu ou dont la signature est invalide.
 *
 * C'est ce qui rend un incident rejouable : sans la trace brute, un callback
 * mal traité serait perdu et l'encaissement invisible.
 */
PaymentCallbackRawSchema.index({ depositId: 1, receivedAt: -1 });
PaymentCallbackRawSchema.index({ receivedAt: -1 });
PaymentCallbackRawSchema.index({ 'signature.verdict': 1, receivedAt: -1 });

export const PaymentCallbackRaw = mongoose.model<PaymentCallbackRawDocument>(
  'PaymentCallbackRaw',
  PaymentCallbackRawSchema
);

// ============================================
// SOLDES DE CRÉDITS
// ============================================

export interface CreditBalanceDocument extends Document {
  userId: string;
  engine: BillingEngine;
  balance: number;
  updatedAt: Date;
}

const CreditBalanceSchema = new Schema<CreditBalanceDocument>(
  {
    userId: { type: String, required: true },
    engine: { type: String, required: true },
    balance: { type: Number, required: true, default: 0 },
  },
  { timestamps: true, collection: 'credit_balances' }
);

/**
 * Le solde vit ici, le grand livre reste l'historique.
 *
 * Le solde était jusqu'ici relu depuis la dernière écriture du livre, puis
 * réécrit : deux débits simultanés calculaient le même `balanceAfter` et l'un
 * des deux était offert. Un document par (utilisateur, moteur) permet un
 * `$inc` conditionnel — atomique côté MongoDB, donc juste même sous
 * concurrence, et sans transaction (la base n'est pas en replica set).
 */
CreditBalanceSchema.index({ userId: 1, engine: 1 }, { unique: true });

export const CreditBalance = mongoose.model<CreditBalanceDocument>(
  'CreditBalance',
  CreditBalanceSchema
);

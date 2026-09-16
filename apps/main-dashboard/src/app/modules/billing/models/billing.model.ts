/**
 * Contrats de la facturation, côté dashboard.
 *
 * Transcrits de l'API (`idem/apps/api/api/controllers/billing.controller.ts`).
 * Deux principes s'y lisent directement :
 *
 *  - **trois compteurs de crédits séparés** (iBusiness, iCode, iDeploy) : un
 *    crédit iBusiness ne paie pas une génération iCode ;
 *  - **le montant ne circule jamais depuis le client** : l'interface envoie un
 *    code produit, l'API calcule le prix.
 */

export type BillingEngine = 'business' | 'appgen' | 'ideploy';

export type BillingProductKind =
  | 'subscription'
  | 'pack'
  | 'recharge'
  | 'project_pass'
  | 'day_pass'
  | 'addon'
  | 'bundle'
  | 'overage';

export interface BillingProduct {
  code: string;
  kind: BillingProductKind;
  engine: BillingEngine | null;
  name: string;
  description?: string;
  priceXaf: number;
  interval: 'month' | 'year' | 'one_time';
  credits: number;
  validityHours?: number;
  highlighted?: boolean;
  features?: string[];
  discountLabel?: string;
  /** Prix d'un prestataire local équivalent, pour l'argumentaire. */
  localAlternative?: string;
  sortOrder?: number;
}

export interface PaymentCountry {
  code: string;
  name: string;
  prefix: string;
  currency: string;
  decimals: 0 | 2;
}

export interface BillingCatalog {
  currency: string;
  countries: PaymentCountry[];
  products: BillingProduct[];
}

// ============================================
// DROITS
// ============================================

export interface EngineSubscription {
  engine: BillingEngine;
  productCode: string;
  status: 'active' | 'trialing' | 'past_due';
  interval: string;
  priceXaf: number;
  currentPeriodEnd?: string;
  /** Tolérance en cours après une échéance impayée. */
  graceEndsAt?: string;
  cancelAtPeriodEnd: boolean;
  bundleId?: string;
  /** Accès offert (bêta premium) : il a une date de fin, pas un renouvellement. */
  complimentary: boolean;
}

export interface ActivePass {
  productCode: string;
  engine: BillingEngine | null;
  expiresAt?: string;
}

export interface BillingMe {
  credits: Record<BillingEngine, number>;
  subscriptions: EngineSubscription[];
  passes: ActivePass[];
  beta: { windowOpen: boolean; endsAt?: string | null };
  enforcement: 'off' | 'log' | 'enforce';
}

// ============================================
// MOYENS DE PAIEMENT
// ============================================

export interface PaymentProviderOption {
  provider: string;
  displayName: string;
  logo?: string;
  currency: string;
  available: boolean;
  minAmount: number | null;
  maxAmount: number | null;
  /** `PROVIDER_AUTH` (code sur le téléphone) ou `REDIRECT_AUTH` (page opérateur). */
  authType?: string;
  pinPrompt?: string;
  /** L'abonné peut-il faire réapparaître la demande de code ? */
  pinPromptRevivable: boolean;
  pinPromptInstructions?: string;
}

export interface PaymentMethods {
  country: PaymentCountry;
  providers: PaymentProviderOption[];
}

export interface ProviderPrediction {
  country: string | null;
  provider: string | null;
  phoneNumber: string | null;
}

// ============================================
// PAIEMENT
// ============================================

export type PaymentStatus =
  | 'CREATED'
  | 'ACCEPTED'
  | 'SUBMITTED'
  | 'PROCESSING'
  | 'IN_RECONCILIATION'
  | 'COMPLETED'
  | 'FAILED'
  | 'REJECTED'
  | 'NOT_FOUND'
  | 'EXPIRED';

export const FINAL_PAYMENT_STATUSES: PaymentStatus[] = [
  'COMPLETED',
  'FAILED',
  'REJECTED',
  'NOT_FOUND',
  'EXPIRED',
];

export interface PaymentFailure {
  code: string;
  /** Message en français, prêt à afficher. */
  message: string;
  /** Ce que l'utilisateur peut faire ; `null` s'il n'y a rien à faire. */
  hint: string | null;
  retryable: boolean;
}

export interface PaymentView {
  reference: string;
  status: PaymentStatus;
  amount: number;
  currency: string;
  amountXaf: number;
  country: string;
  provider: string;
  phoneMasked: string;
  label?: string;
  productCode?: string;
  intentType?: string;
  /** Flux à redirection (Wave) : page d'autorisation de l'abonné. */
  authorizationUrl?: string;
  providerTransactionId?: string;
  failure: PaymentFailure | null;
  fulfilled: boolean;
  createdAt: string;
  finalizedAt?: string;
}

export interface Quote {
  productCode: string;
  label: string;
  amount: number;
  currency: string;
  amountXaf: number;
  country: string;
  credits: number;
}

export interface CheckoutRequest {
  productCode: string;
  phoneNumber: string;
  country?: string;
  provider?: string;
  engine?: BillingEngine;
  projectId?: string;
  interval?: 'month' | 'year';
  simulationTier?: string;
  app?: 'dashboard' | 'appgen' | 'simulation' | 'ideploy';
}

// ============================================
// PAYWALL
// ============================================

/**
 * Réponse 402 de l'API : ce qui manque et comment le débloquer.
 * Le serveur envoie les offres adaptées, l'interface ne les devine pas.
 */
export interface PaymentRequiredPayload {
  error: 'payment_required' | 'plan_upgrade_required';
  message: string;
  engine?: BillingEngine;
  action?: string;
  cost?: number;
  balance?: number;
  missing?: number;
  feature?: string;
  currentPlan?: string;
  suggestions?: { productCode: string; name: string; priceXaf: number; credits: number }[];
}

export interface CreditLedgerRow {
  engine: BillingEngine;
  delta: number;
  balanceAfter: number;
  reason: string;
  action?: string;
  note?: string;
  createdAt: string;
}

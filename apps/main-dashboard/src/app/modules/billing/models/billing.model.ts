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
  /** Le modèle au portefeuille : solde en francs, forfaits, droits prépayés. */
  offer?: WalletOffer;
  walletXaf?: number;
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
  /** Recharge du portefeuille : bonus accordé pour ce montant. */
  bonusXaf?: number;
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
  /** Recharge du portefeuille (`wallet-topup`) : montant en francs. */
  amountXaf?: number;
  /** Achat à faire depuis le portefeuille une fois la recharge encaissée. */
  then?: BuyOfferRequest;
}

// ============================================
// PAYWALL
// ============================================

/**
 * Réponse 402 de l'API : ce qui manque et comment le débloquer.
 * Le serveur envoie les offres adaptées, l'interface ne les devine pas.
 */
export interface PaymentRequiredPayload {
  /**
   * `quota_exceeded` : refus 429 d'un quota d'usage (jour, semaine ou mois).
   * `deliverable_locked` : le fichier final d'un livrable encore en esquisse.
   */
  error: 'payment_required' | 'plan_upgrade_required' | 'quota_exceeded' | 'deliverable_locked';
  message: string;
  /** Ce qui est acheté, son prix, le solde du portefeuille et ce qui manque (en francs). */
  label?: string;
  priceXaf?: number;
  balanceXaf?: number;
  missingXaf?: number;
  /** La plus petite recharge suggérée qui couvre le manque. */
  topupXaf?: number;
  deliverable?: DeliverableKey;
  projectId?: string;
  kit?: OwnershipStatus['kit'];
  /** Offres du portefeuille qui débloquent l'action (pack de modifications iCode…). */
  offers?: { kind: BuyOfferRequest['kind']; label: string; priceXaf: number }[];
  /** Quota d'usage : la fenêtre atteinte et la date à laquelle elle se renouvelle. */
  window?: QuotaWindow;
  resetsAt?: string;
  engine?: BillingEngine;
  action?: string;
  cost?: number;
  balance?: number;
  missing?: number;
  feature?: string;
  currentPlan?: string;
  suggestions?: { productCode: string; name: string; priceXaf: number; credits: number }[];
}

export type QuotaWindow = 'day' | 'week' | 'month';

/** Une fenêtre d'un groupe de quota : utilisé, limite de l'offre (`null` = sans limite). */
export interface QuotaWindowStatus {
  window: QuotaWindow;
  used: number;
  limit: number | null;
  remaining: number | null;
  resetsAt: string;
}

export interface QuotaGroupStatus {
  group: string;
  label: string;
  tier: string;
  windows: QuotaWindowStatus[];
}

/** `GET /billing/quotas` : les quotas d'usage IA du compte, par groupe de fonctionnalités. */
export interface UsageQuotaStatus {
  groups: QuotaGroupStatus[];
  /** Part consommée de la capacité de génération IA de l'offre, par fenêtre (0-100). */
  capacity: Record<QuotaWindow, number>;
  tier: string;
  enforcement: 'off' | 'log' | 'enforce';
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

// ============================================
// PORTEFEUILLE (modèle « Créer, Garder, Faire tourner »)
// ============================================

export type DeliverableKey =
  | 'logo_brand'
  | 'business_plan'
  | 'pitch_deck'
  | 'legal_kit'
  | 'financial_forecast'
  | 'business_card';

export type PassCode = 'croissance' | 'entreprise' | 'createur';
export type PackCode = 'lancement' | 'lancement_domaine' | 'a_plusieurs';

export interface WalletOffer {
  walletXaf: number;
  /** Fin de chaque forfait actif. */
  passes: Partial<Record<PassCode, string>>;
  /** Modifications iCode incluses restantes. */
  modifications: number;
  projectPassVouchers: number;
  vitrineDays: number;
  croissance: boolean;
  createur: boolean;
  recentBuyer: boolean;
}

export interface WalletEntry {
  engine: string;
  delta: number;
  balanceAfter: number;
  reason: string;
  action?: string;
  note?: string;
  projectId?: string;
  createdAt: string;
}

export interface WalletView extends WalletOffer {
  balanceXaf: number;
  beta: { active: boolean; endsAt?: string | null };
  statement: WalletEntry[];
}

export type BuyOfferRequest =
  | { kind: 'pass'; code: PassCode; interval?: 'month' | 'year' }
  | { kind: 'pack'; code: PackCode; projectId?: string; domain?: string }
  | { kind: 'icode_project_pass'; projectId: string }
  | { kind: 'icode_pack_100' }
  | { kind: 'unlock'; projectId: string; deliverable: DeliverableKey; tier?: 'final' | 'signature' }
  | { kind: 'domain'; domain: string; appUuid?: string };

export interface BuyOfferResult {
  ok: true;
  message: string;
  chargedXaf: number;
  balanceXaf: number;
  details?: Record<string, unknown>;
}

export interface OffersCatalog {
  currency: string;
  /** Prix local de 1 000 F dans le pays demandé. */
  perThousand: { amount: number; currency: string; country: string } | null;
  topup: {
    minXaf: number;
    maxXaf: number;
    stepXaf: number;
    suggestedXaf: number[];
    bonusExamples: { amountXaf: number; bonusXaf: number }[];
  };
  deliverables: { key: DeliverableKey; label: string; priceXaf: number }[];
  kit: { capXaf: number; sumXaf: number };
  signaturePriceXaf: number;
  editPriceXaf: number;
  editWindowDays: number;
  communication: Record<string, number>;
  passes: { code: PassCode; label: string; monthlyXaf: number; annualXaf: number; covers: string[] }[];
  monthlyCaps: Record<string, number>;
  welcomePass: { code: PassCode; days: number };
  icode: Record<string, number>;
  meters: { tier: string; label: string; perDayXaf: number; description: string }[];
  meterOptions: { code: string; label: string; perDayXaf: number }[];
  simulations: Record<string, { idemXaf: number; publicXaf: number; label: string }>;
  packs: { code: PackCode; label: string; priceXaf: number; description: string }[];
  domains: Record<string, { registrar: string; priceXaf: number; renewalXaf: number; packXaf: number }>;
}

export interface DeliverableStatus {
  key: DeliverableKey;
  label: string;
  priceXaf: number;
  owned: boolean;
  tier?: 'final' | 'signature';
  unlockedAt?: string;
  editableUntil?: string;
  finalGenerated: boolean;
}

export interface OwnershipStatus {
  projectId: string;
  deliverables: DeliverableStatus[];
  kit: { capXaf: number; sumXaf: number; spentXaf: number; remainingXaf: number; complete: boolean };
  signaturePriceXaf: number;
}

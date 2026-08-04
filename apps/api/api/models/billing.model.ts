/**
 * Modèle de facturation.
 *
 * Traduit l'offre affichée sur la landing page (`apps/landing/.../pricing.html`)
 * en données exploitables : catalogue de plans, abonnements, factures et
 * grand livre de crédits.
 *
 * Aucun prestataire de paiement n'est branché pour l'instant : les abonnements
 * et factures sont créés en mode `manual`, et les champs `provider*` attendent
 * l'intégration (Stripe, Paystack, Flutterwave…). La structure est en place
 * pour que le panel admin puisse déjà mesurer le chiffre d'affaires et le
 * comparer au coût des tokens.
 */

// ============================================
// PLANS
// ============================================

/**
 * Codes de plan de l'offre publique. `starter` n'existe PAS dans
 * `users.subscription` (qui ne connaît que free/pro/enterprise) : la
 * correspondance est portée par `BillingPlanModel.subscriptionTier`, pour
 * pouvoir faire évoluer le catalogue commercial sans migrer la collection users.
 */
export type BillingPlanCode = 'free' | 'starter' | 'pro' | 'enterprise';

export type BillingInterval = 'month' | 'year' | 'one_time';

export interface BillingPlanModel {
  id?: string;
  code: BillingPlanCode;
  name: string;
  description?: string;
  /** Prix affiché, dans `currency`. */
  price: number;
  currency: string;
  interval: BillingInterval;
  /** Crédits accordés à chaque période (ou une seule fois si `interval` = one_time). */
  creditsPerPeriod: number;
  /** Valeur de `users.subscription` correspondant à ce plan. */
  subscriptionTier: 'free' | 'pro' | 'enterprise';
  /** Plan mis en avant sur la landing page. */
  highlighted?: boolean;
  features?: string[];
  /** Un plan retiré du catalogue reste référencé par les abonnements passés. */
  isActive: boolean;
  sortOrder?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

// ============================================
// ABONNEMENTS
// ============================================

export type SubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'expired';

export interface BillingSubscriptionModel {
  id?: string;
  userId: string;
  planCode: BillingPlanCode;
  status: SubscriptionStatus;
  /** Montant réellement facturé (peut différer du prix catalogue : remise, grandfathering). */
  price: number;
  currency: string;
  interval: BillingInterval;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  canceledAt?: Date;
  /** Prestataire de paiement ; `manual` tant qu'aucun n'est branché. */
  provider: 'manual' | 'stripe' | 'paystack' | 'flutterwave';
  providerSubscriptionId?: string;
  providerCustomerId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// ============================================
// FACTURES
// ============================================

export type InvoiceStatus = 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';

export interface BillingInvoiceModel {
  id?: string;
  userId: string;
  subscriptionId?: string;
  planCode: BillingPlanCode;
  /** Numéro lisible, unique. */
  number: string;
  status: InvoiceStatus;
  amount: number;
  currency: string;
  /** Montant converti en USD, pour agréger un CA multi-devises. */
  amountUsd: number;
  /** Taux appliqué pour la conversion (1 si déjà en USD). */
  fxRateToUsd: number;
  periodStart: Date;
  periodEnd: Date;
  /** Jour `YYYY-MM-DD` de reconnaissance du revenu — clé d'agrégation. */
  day: string;
  issuedAt: Date;
  paidAt?: Date;
  provider: 'manual' | 'stripe' | 'paystack' | 'flutterwave';
  providerInvoiceId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// ============================================
// GRAND LIVRE DE CRÉDITS
// ============================================

/**
 * Mouvements de crédits. `delta` positif = octroi (abonnement, offre de
 * bienvenue, geste commercial), négatif = consommation.
 *
 * Un grand livre append-only plutôt qu'un simple solde sur l'utilisateur :
 * c'est ce qui permet de justifier un solde, de rejouer un litige, et de relier
 * une consommation de crédits à la génération IA correspondante.
 */
export type CreditEntryReason =
  | 'plan_grant'
  | 'signup_bonus'
  | 'manual_adjustment'
  | 'consumption'
  | 'refund'
  | 'expiration';

export interface CreditLedgerEntryModel {
  id?: string;
  userId: string;
  delta: number;
  /** Solde après application, pour auditer sans rejouer tout le livre. */
  balanceAfter: number;
  reason: CreditEntryReason;
  /** Action facturée, alignée sur le barème de la landing page. */
  action?: CreditedAction;
  projectId?: string;
  feature?: string;
  element?: string;
  /** Relie l'écriture à l'appel de modèle correspondant (`ai_usage_events`). */
  aiUsageEventId?: string;
  subscriptionId?: string;
  note?: string;
  /** Jour `YYYY-MM-DD`. */
  day: string;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Barème de crédits, repris tel quel de la landing page :
 * « Logo (7 credits) • Business Plan (20 credits) • Full App (30 credits) •
 * Complete Project (64 credits) ».
 */
export type CreditedAction = 'logo' | 'business_plan' | 'full_app' | 'complete_project';

export const CREDIT_COSTS: Record<CreditedAction, number> = {
  logo: 7,
  business_plan: 20,
  full_app: 30,
  complete_project: 64,
};

/**
 * Catalogue par défaut, aligné sur la landing page. Sert de graine : les plans
 * existants en base ne sont jamais écrasés (un prix négocié ne doit pas être
 * réinitialisé au redémarrage).
 */
export const DEFAULT_PLANS: Omit<BillingPlanModel, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    code: 'free',
    name: 'Free',
    description: 'Essai de toutes les fonctionnalités, 1 projet complet.',
    price: 0,
    currency: 'USD',
    // Crédits offerts une seule fois, pas rechargés chaque mois.
    interval: 'one_time',
    creditsPerPeriod: 10,
    subscriptionTier: 'free',
    features: ['Try all features', 'Generate 1 complete project', 'Logo + Business Plan', 'Community support'],
    isActive: true,
    sortOrder: 1,
  },
  {
    code: 'starter',
    name: 'Starter',
    description: '~2-3 projets complets par mois.',
    price: 15,
    currency: 'USD',
    interval: 'month',
    creditsPerPeriod: 150,
    subscriptionTier: 'pro',
    highlighted: true,
    features: [
      'All features included',
      'Deployment capabilities',
      'African cloud infrastructure',
      'Priority support',
    ],
    isActive: true,
    sortOrder: 2,
  },
  {
    code: 'pro',
    name: 'Pro',
    description: '~10 projets complets par mois.',
    price: 50,
    currency: 'USD',
    interval: 'month',
    creditsPerPeriod: 600,
    subscriptionTier: 'pro',
    features: [
      'Everything in Starter',
      'Advanced deployment options',
      'On-premise deployment',
      'Dedicated support',
    ],
    isActive: true,
    sortOrder: 3,
  },
  {
    code: 'enterprise',
    name: 'Enterprise',
    description: 'Volume et engagement négociés.',
    price: 0,
    currency: 'USD',
    interval: 'month',
    creditsPerPeriod: 0,
    subscriptionTier: 'enterprise',
    features: ['Custom volume', 'Dedicated infrastructure', 'SLA'],
    isActive: true,
    sortOrder: 4,
  },
];

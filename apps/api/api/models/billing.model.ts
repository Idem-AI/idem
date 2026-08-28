/**
 * Modèle économique de la plateforme.
 *
 * Transcription de la page de tarification publique
 * (`apps/landing/src/app/pages/pricing-page/`). Toute évolution de cette page
 * doit être répercutée ici — c'est la source de vérité commerciale.
 *
 * Trois principes structurent tout le reste :
 *
 *  1. **La devise de référence est le F CFA (XAF)**, pas le dollar. Les prix
 *     sont affichés en F, les montants USD ne sont que des approximations de
 *     comparaison. Les montants sont stockés en XAF entiers (le F CFA n'a pas
 *     de subdivision) et convertis en USD pour être comparés au coût des
 *     tokens, qui est facturé en dollars par les fournisseurs.
 *
 *  2. **Trois moteurs aux compteurs de crédits SÉPARÉS** : Business, AppGen et
 *     iDeploy. Un crédit Business ne paie pas une génération AppGen. Le grand
 *     livre est donc indexé par (utilisateur, moteur), et non par utilisateur.
 *
 *  3. **Le revenu n'est pas seulement de l'abonnement.** Packs à l'unité,
 *     recharges de crédits, Project Pass, passes 24 h/7 j, options managées et
 *     bundles pèsent autant dans le chiffre d'affaires : le modèle les traite
 *     tous comme des achats facturables.
 *
 * Aucun prestataire de paiement n'est branché : Mobile Money (MTN MoMo, Orange
 * Money) et carte sont déclarés mais aucun encaissement n'a lieu.
 */

// ============================================
// MOTEURS
// ============================================

/**
 * Les trois produits de la plateforme. Chacun a son propre compteur de crédits
 * et ses propres plans : un même utilisateur peut être abonné aux trois.
 */
export type BillingEngine = 'business' | 'appgen' | 'ideploy';

export const BILLING_ENGINES: BillingEngine[] = ['business', 'appgen', 'ideploy'];

// ============================================
// DEVISE
// ============================================

/**
 * Devise de référence. Les montants sont stockés en unités entières de XAF —
 * le franc CFA n'a pas de centimes, donc pas de conversion en sous-unité.
 */
export const BASE_CURRENCY = 'XAF';

/**
 * Taux XAF → USD utilisé pour rapprocher le revenu du coût des tokens (facturé
 * en dollars). Surchargeable par `XAF_USD_RATE` sans redéploiement, car le taux
 * bouge et un taux figé faussrait le calcul de marge dans le temps.
 *
 * Valeur par défaut alignée sur les équivalences de la page publique
 * (2 999 F ≈ 5,2 $ → ~577 F/$).
 */
export const DEFAULT_XAF_PER_USD = 577;

export function getXafPerUsd(): number {
  const parsed = Number(process.env.XAF_USD_RATE);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_XAF_PER_USD;
}

/** Convertit un montant XAF en USD, pour comparaison avec le coût d'inférence. */
export function xafToUsd(amountXaf: number): number {
  return Math.round((amountXaf / getXafPerUsd()) * 100) / 100;
}

// ============================================
// PRODUITS
// ============================================

/**
 * Nature d'un produit facturable. Distinguer ces types est indispensable au
 * pilotage : un pack à l'unité et un abonnement ne se comparent pas (l'un est
 * ponctuel, l'autre récurrent) et seul le second alimente le MRR.
 */
export type BillingProductKind =
  /** Abonnement récurrent (mensuel ou annuel). */
  | 'subscription'
  /** Achat unique donnant des livrables + des crédits (Identity Pack…). */
  | 'pack'
  /** Achat de crédits secs (Boost, Standard, Growth, Power). */
  | 'recharge'
  /** Project Pass AppGen : débloque un projet (téléchargement, GitHub, déploiement). */
  | 'project_pass'
  /** Passe à durée limitée (24 h, 7 j). */
  | 'day_pass'
  /** Option mensuelle (WAF, autoscaling, sauvegardes, Social Starter/Pro…). */
  | 'addon'
  /** Offre groupée multi-moteurs à tarif remisé. */
  | 'bundle'
  /** Consommation hors forfait (bande passante, déploiement supplémentaire). */
  | 'overage';

export type BillingInterval = 'month' | 'year' | 'one_time';

export interface BillingProductModel {
  id?: string;
  /** Identifiant stable, référencé par les abonnements et les factures. */
  code: string;
  kind: BillingProductKind;
  /** `null` pour un bundle, qui couvre plusieurs moteurs. */
  engine: BillingEngine | null;
  name: string;
  description?: string;
  /** Prix en XAF (entier). */
  priceXaf: number;
  interval: BillingInterval;
  /** Crédits accordés (par période pour un abonnement, une fois sinon). */
  credits: number;
  /** Durée de validité d'un passe, en heures. */
  validityHours?: number;
  /** Valeur de `users.subscription` impliquée par ce produit, s'il en implique une. */
  subscriptionTier?: 'free' | 'pro' | 'enterprise';
  /** Mis en avant sur la page publique. */
  highlighted?: boolean;
  features?: string[];
  /** Remise annoncée par rapport à l'achat séparé (ex. `-33%`). */
  discountLabel?: string;
  /** Alternative locale, pour l'argumentaire de la page publique. */
  localAlternative?: string;
  isActive: boolean;
  sortOrder?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

// ============================================
// CRÉDITS
// ============================================

/**
 * Barème Business : ce que coûte chaque livrable, en crédits.
 * Repris de la section « price list » de la page publique.
 */
export const BUSINESS_CREDIT_COSTS = {
  revision: 1,
  flyer: 2,
  business_card: 10,
  editorial_calendar: 15,
  pitch_deck: 35,
  financial_forecast: 40,
  logo_brand: 60,
  business_plan: 70,
} as const;

export type BusinessCreditedAction = keyof typeof BUSINESS_CREDIT_COSTS;

/**
 * Crédits inclus dans un Project Pass AppGen (999 F) : ils couvrent les
 * modifications IA une fois le projet débloqué.
 */
export const APPGEN_PROJECT_PASS_CREDITS = 30;

/** Report de crédits non consommés, en mois (« 2-month rollover »). */
export const CREDIT_ROLLOVER_MONTHS = 2;

/** Bonus de fidélité maximal sur les crédits mensuels (« up to +30% »). */
export const MAX_LOYALTY_BONUS_RATE = 0.3;

// ============================================
// FACTURATION
// ============================================

/**
 * Remise annuelle : « annual billing, 2 months free (-16%) ».
 * 10 mois payés sur 12 ⇒ 16,67 % de remise.
 */
export const ANNUAL_DISCOUNT_RATE = 2 / 12;

/** Nombre d'échéances acceptées pour un paiement annuel (1 ou 3). */
export const ALLOWED_INSTALLMENTS = [1, 3] as const;

/** Moyens de paiement de la page publique. `manual` = saisie admin. */
export type PaymentProvider = 'manual' | 'mtn_momo' | 'orange_money' | 'card';

/** Tarifs hors forfait, en XAF. */
export const OVERAGE_RATES = {
  /** Bande passante iDeploy au-delà du quota. */
  bandwidth_gb: 25,
  /** Déploiement au-delà des 5 gratuits (pack de 10 à 900 F). */
  deployment: 100,
} as const;

export type OverageKind = keyof typeof OVERAGE_RATES;

// ============================================
// ABONNEMENTS
// ============================================

export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'expired';

export interface BillingSubscriptionModel {
  id?: string;
  userId: string;
  engine: BillingEngine;
  productCode: string;
  status: SubscriptionStatus;
  /** Montant réellement facturé par période, en XAF. */
  priceXaf: number;
  interval: BillingInterval;
  /** Échéances du paiement annuel (1 ou 3). */
  installments?: number;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  canceledAt?: Date;
  /** Périodes consécutives payées — alimente le bonus de fidélité. */
  consecutivePeriods?: number;
  provider: PaymentProvider;
  providerSubscriptionId?: string;
  providerCustomerId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// ============================================
// ACHATS PONCTUELS
// ============================================

/**
 * Achat unique : pack, recharge, passe ou option. Séparé des abonnements pour
 * que le chiffre d'affaires ponctuel soit mesurable indépendamment du récurrent
 * (le mix des deux est un indicateur clé de ce modèle).
 */
export interface BillingPurchaseModel {
  id?: string;
  userId: string;
  productCode: string;
  kind: BillingProductKind;
  engine: BillingEngine | null;
  priceXaf: number;
  creditsGranted: number;
  /** Projet concerné, pour un Project Pass AppGen. */
  projectId?: string;
  /** Fin de validité, pour un passe à durée limitée. */
  expiresAt?: Date;
  provider: PaymentProvider;
  providerPaymentId?: string;
  /** Jour `YYYY-MM-DD` de l'achat. */
  day: string;
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
  purchaseId?: string;
  productCode: string;
  kind: BillingProductKind;
  engine: BillingEngine | null;
  number: string;
  status: InvoiceStatus;
  /** Montant en XAF — devise de référence. */
  amountXaf: number;
  /** Équivalent USD au taux du jour, pour la comparaison au coût des tokens. */
  amountUsd: number;
  /** Taux XAF/USD appliqué, conservé pour pouvoir auditer la conversion. */
  xafPerUsd: number;
  periodStart?: Date;
  periodEnd?: Date;
  /** Jour `YYYY-MM-DD` de reconnaissance du revenu — clé d'agrégation. */
  day: string;
  issuedAt: Date;
  paidAt?: Date;
  provider: PaymentProvider;
  providerInvoiceId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// ============================================
// GRAND LIVRE DE CRÉDITS
// ============================================

export type CreditEntryReason =
  | 'plan_grant'
  | 'pack_grant'
  | 'recharge'
  | 'pass_grant'
  | 'loyalty_bonus'
  | 'rollover_expiry'
  | 'manual_adjustment'
  | 'consumption'
  | 'refund';

/**
 * Mouvement de crédits sur le compteur d'UN moteur.
 *
 * Append-only, avec `balanceAfter` : permet de justifier un solde, de rejouer un
 * litige, et de relier une consommation à la génération IA correspondante
 * (`aiUsageEventId`) — donc de comparer le prix payé en crédits au coût réel en
 * tokens, livrable par livrable.
 */
export interface CreditLedgerEntryModel {
  id?: string;
  userId: string;
  engine: BillingEngine;
  delta: number;
  /** Solde du compteur de CE moteur après application. */
  balanceAfter: number;
  reason: CreditEntryReason;
  /** Livrable facturé, selon le barème du moteur. */
  action?: string;
  projectId?: string;
  feature?: string;
  element?: string;
  aiUsageEventId?: string;
  subscriptionId?: string;
  purchaseId?: string;
  /** Péremption des crédits reportés (rollover de 2 mois). */
  expiresAt?: Date;
  note?: string;
  day: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// ============================================
// CATALOGUE PAR DÉFAUT
// ============================================

type SeedProduct = Omit<BillingProductModel, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * Catalogue complet, transcrit de la page publique. Sert de graine :
 * `seedProducts()` n'écrase jamais un produit existant, pour qu'un prix ajusté
 * en production survive au redémarrage.
 */
export const DEFAULT_PRODUCTS: SeedProduct[] = [
  // ── A. IDEM Business ─────────────────────────────────────────────────────
  {
    code: 'business-discovery',
    kind: 'subscription',
    engine: 'business',
    name: 'Discovery',
    description: 'Explorer chaque livrable avant de payer (aperçus filigranés).',
    priceXaf: 0,
    interval: 'month',
    credits: 5,
    subscriptionTier: 'free',
    features: ['Aperçu filigrané de chaque livrable', '1 projet actif', 'Support communautaire'],
    isActive: true,
    sortOrder: 10,
  },
  {
    code: 'business-essential',
    kind: 'subscription',
    engine: 'business',
    name: 'Essential',
    description: "Le back-office virtuel de l'entrepreneur actif.",
    priceXaf: 2999,
    interval: 'month',
    credits: 150,
    subscriptionTier: 'pro',
    highlighted: true,
    features: [
      '150 crédits/mois, report sur 2 mois',
      'Documents légaux : génération + mises à jour',
      'Exports sans filigrane (Word, PPT, PDF)',
      'Bonus de fidélité jusqu’à +30 % de crédits',
    ],
    isActive: true,
    sortOrder: 20,
  },
  {
    code: 'business-growth',
    kind: 'subscription',
    engine: 'business',
    name: 'Growth',
    description: 'Pour les PME structurées qui pilotent leur activité dans IDEM.',
    priceXaf: 7999,
    interval: 'month',
    credits: 500,
    subscriptionTier: 'pro',
    features: [
      '500 crédits/mois (16 F le crédit)',
      '3 projets actifs',
      'Suivi prévisionnel vs réalisé + alertes',
      'Veille juridique OHADA incluse',
      'IDEM Social Starter inclus',
    ],
    isActive: true,
    sortOrder: 30,
  },
  {
    code: 'business-cabinet',
    kind: 'subscription',
    engine: 'business',
    name: 'Cabinet',
    description: 'Pour les agences, consultants et comptables à clientèle.',
    priceXaf: 19999,
    interval: 'month',
    credits: 1500,
    subscriptionTier: 'enterprise',
    features: [
      '1 500 crédits/mois (13,3 F le crédit)',
      '10 projets actifs (multi-clients)',
      'Livrables en marque blanche',
      'IDEM Social Pro inclus',
    ],
    isActive: true,
    sortOrder: 40,
  },

  // ── Packs Business (achat unique) ────────────────────────────────────────
  {
    code: 'pack-identity',
    kind: 'pack',
    engine: 'business',
    name: 'Identity Pack',
    description: 'Logo HD + charte graphique + cartes de visite personnalisables.',
    priceXaf: 1999,
    interval: 'one_time',
    credits: 80,
    localAlternative: '50 000 – 95 000 F chez un graphiste',
    isActive: true,
    sortOrder: 50,
  },
  {
    code: 'pack-strategy',
    kind: 'pack',
    engine: 'business',
    name: 'Strategy Pack',
    description: 'Business plan + pitch deck + prévisions financières sur 3 ans.',
    priceXaf: 2999,
    interval: 'one_time',
    credits: 155,
    localAlternative: '225 000 – 700 000 F chez un consultant',
    isActive: true,
    sortOrder: 60,
  },
  {
    code: 'pack-compliance',
    kind: 'pack',
    engine: 'business',
    name: 'Compliance Pack',
    description: 'Kit juridique OHADA (statuts, pacte d’associés, CGU) + manuel de procédures.',
    priceXaf: 2499,
    interval: 'one_time',
    credits: 120,
    localAlternative: '300 000 F et plus en cabinet',
    isActive: true,
    sortOrder: 70,
  },
  {
    code: 'pack-complete',
    kind: 'pack',
    engine: 'business',
    name: 'Full Business Pack',
    description: 'Identity + Strategy + Compliance : tout pour lancer crédible.',
    priceXaf: 4999,
    interval: 'one_time',
    credits: 265,
    discountLabel: '-33 % vs packs séparés',
    localAlternative: '500 000 – 1 000 000 F avec des prestataires locaux',
    highlighted: true,
    isActive: true,
    sortOrder: 80,
  },

  // ── Options Social ───────────────────────────────────────────────────────
  {
    code: 'social-starter',
    kind: 'addon',
    engine: 'business',
    name: 'IDEM Social Starter',
    description: '2 réseaux connectés, 30 publications programmées/mois.',
    priceXaf: 1999,
    interval: 'month',
    credits: 0,
    isActive: true,
    sortOrder: 90,
  },
  {
    code: 'social-pro',
    kind: 'addon',
    engine: 'business',
    name: 'IDEM Social Pro',
    description: '6 réseaux, publications illimitées, rapport mensuel.',
    priceXaf: 4999,
    interval: 'month',
    credits: 0,
    highlighted: true,
    isActive: true,
    sortOrder: 100,
  },

  // ── B. IDEM AppGen ───────────────────────────────────────────────────────
  {
    code: 'appgen-discovery',
    kind: 'subscription',
    engine: 'appgen',
    name: 'Discovery',
    description: '3 générations complètes par jour, aperçu navigateur illimité.',
    priceXaf: 0,
    interval: 'month',
    credits: 0,
    subscriptionTier: 'free',
    features: ['3 générations complètes/jour', 'Project Pass à 999 F par projet'],
    isActive: true,
    sortOrder: 110,
  },
  {
    code: 'appgen-starter',
    kind: 'subscription',
    engine: 'appgen',
    name: 'Starter',
    description: '7× moins cher au crédit que Lovable Pro.',
    priceXaf: 2999,
    interval: 'month',
    credits: 150,
    subscriptionTier: 'pro',
    highlighted: true,
    features: [
      'Générations initiales illimitées',
      'Project Pass inclus sur tous les projets',
      '150 crédits/mois, report sur 2 mois',
    ],
    isActive: true,
    sortOrder: 120,
  },
  {
    code: 'appgen-pro',
    kind: 'subscription',
    engine: 'appgen',
    name: 'Pro',
    description: 'Pour les builders qui livrent chaque semaine.',
    priceXaf: 9999,
    interval: 'month',
    credits: 550,
    subscriptionTier: 'pro',
    features: ['550 crédits/mois', 'Modèles IA premium', 'Support prioritaire'],
    isActive: true,
    sortOrder: 130,
  },
  {
    code: 'appgen-studio',
    kind: 'subscription',
    engine: 'appgen',
    name: 'Studio',
    description: 'Pour les agences qui construisent pour leurs clients.',
    priceXaf: 24999,
    interval: 'month',
    credits: 1500,
    subscriptionTier: 'enterprise',
    features: ['1 500 crédits/mois', '5 sièges', 'Accès API', 'Marque blanche'],
    isActive: true,
    sortOrder: 140,
  },
  {
    code: 'appgen-project-pass',
    kind: 'project_pass',
    engine: 'appgen',
    name: 'Project Pass',
    description:
      'Débloque un projet : modifications IA, téléchargement ZIP, push GitHub, déploiement.',
    priceXaf: 999,
    interval: 'one_time',
    credits: APPGEN_PROJECT_PASS_CREDITS,
    isActive: true,
    sortOrder: 150,
  },
  {
    code: 'appgen-pass-24h',
    kind: 'day_pass',
    engine: 'appgen',
    name: 'Passe 24 h',
    description: '« Je teste mon idée ce soir. »',
    priceXaf: 500,
    interval: 'one_time',
    credits: 25,
    validityHours: 24,
    isActive: true,
    sortOrder: 160,
  },
  {
    code: 'appgen-pass-7d',
    kind: 'day_pass',
    engine: 'appgen',
    name: 'Passe 7 jours',
    description: '« Je prépare la démo de vendredi. »',
    priceXaf: 1499,
    interval: 'one_time',
    credits: 90,
    validityHours: 24 * 7,
    isActive: true,
    sortOrder: 170,
  },

  // ── C. iDeploy ───────────────────────────────────────────────────────────
  {
    code: 'ideploy-hobby',
    kind: 'subscription',
    engine: 'ideploy',
    name: 'Hobby',
    description: 'Première mise en production gratuite, usage commercial autorisé.',
    priceXaf: 0,
    interval: 'month',
    credits: 0,
    subscriptionTier: 'free',
    features: [
      '2 apps (mise en veille après 30 min), 512 Mo',
      '5 déploiements gratuits, puis 100 F',
      '50 Go de trafic/mois',
    ],
    isActive: true,
    sortOrder: 180,
  },
  {
    code: 'ideploy-starter',
    kind: 'subscription',
    engine: 'ideploy',
    name: 'Deploy Starter',
    description: 'Vos apps restent éveillées, vos données sauvegardées.',
    priceXaf: 2999,
    interval: 'month',
    credits: 0,
    subscriptionTier: 'pro',
    highlighted: true,
    features: [
      '3 apps toujours actives',
      'Déploiements illimités',
      '100 Go de trafic/mois',
      '1 base persistante (2 Go) + sauvegardes hebdomadaires',
    ],
    isActive: true,
    sortOrder: 190,
  },
  {
    code: 'ideploy-pro',
    kind: 'subscription',
    engine: 'ideploy',
    name: 'Deploy Pro',
    description: 'Pour les produits en croissance réelle.',
    priceXaf: 9999,
    interval: 'month',
    credits: 0,
    subscriptionTier: 'pro',
    features: [
      '10 apps, pool de 8 Go de RAM',
      '500 Go de trafic/mois',
      '5 bases (10 Go) + sauvegardes quotidiennes',
      'Monitoring complet + alertes',
    ],
    isActive: true,
    sortOrder: 200,
  },
  {
    code: 'ideploy-scale',
    kind: 'subscription',
    engine: 'ideploy',
    name: 'Deploy Scale',
    description: 'Haute disponibilité pour charges sérieuses.',
    priceXaf: 24999,
    interval: 'month',
    credits: 0,
    subscriptionTier: 'enterprise',
    features: [
      '25 apps, pool de 24 Go, 2 To de trafic',
      'Haute disponibilité + autoscaling',
      'Bases illimitées (50 Go) + sauvegardes S3',
      'SLA 99,9 %',
    ],
    isActive: true,
    sortOrder: 210,
  },

  // ── Options managées iDeploy ─────────────────────────────────────────────
  { code: 'svc-waf', kind: 'addon', engine: 'ideploy', name: 'Pare-feu managé / WAF', priceXaf: 1499, interval: 'month', credits: 0, isActive: true, sortOrder: 220 },
  { code: 'svc-autoscaling', kind: 'addon', engine: 'ideploy', name: 'Autoscaling', priceXaf: 1999, interval: 'month', credits: 0, isActive: true, sortOrder: 230 },
  { code: 'svc-backups', kind: 'addon', engine: 'ideploy', name: 'Sauvegardes quotidiennes', priceXaf: 999, interval: 'month', credits: 0, isActive: true, sortOrder: 240 },
  { code: 'svc-monitoring', kind: 'addon', engine: 'ideploy', name: 'Monitoring avancé + alertes', priceXaf: 999, interval: 'month', credits: 0, isActive: true, sortOrder: 250 },
  { code: 'svc-database', kind: 'addon', engine: 'ideploy', name: 'Base managée supplémentaire', priceXaf: 999, interval: 'month', credits: 0, isActive: true, sortOrder: 260 },
  { code: 'svc-logs', kind: 'addon', engine: 'ideploy', name: 'Rétention de logs étendue', priceXaf: 499, interval: 'month', credits: 0, isActive: true, sortOrder: 270 },
  { code: 'svc-static-ip', kind: 'addon', engine: 'ideploy', name: 'IP statique dédiée', priceXaf: 1999, interval: 'month', credits: 0, isActive: true, sortOrder: 280 },
  { code: 'svc-sovereign', kind: 'addon', engine: 'ideploy', name: 'Hébergement souverain local', priceXaf: 1999, interval: 'month', credits: 0, isActive: true, sortOrder: 290 },
  {
    code: 'ideploy-deploy-pack-10',
    kind: 'pack',
    engine: 'ideploy',
    name: 'Pack 10 déploiements',
    description: 'Au-delà des 5 déploiements gratuits.',
    priceXaf: 900,
    interval: 'one_time',
    credits: 0,
    isActive: true,
    sortOrder: 300,
  },

  // ── Recharges de crédits (Business & AppGen, compteurs séparés) ──────────
  // `engine: null` : la même recharge alimente l'un ou l'autre compteur, le
  // moteur étant choisi à l'achat.
  { code: 'recharge-boost', kind: 'recharge', engine: null, name: 'Boost', description: '25 crédits — 20 F le crédit', priceXaf: 500, interval: 'one_time', credits: 25, isActive: true, sortOrder: 310 },
  { code: 'recharge-standard', kind: 'recharge', engine: null, name: 'Standard', description: '55 crédits — 18 F le crédit', priceXaf: 999, interval: 'one_time', credits: 55, isActive: true, sortOrder: 320 },
  { code: 'recharge-growth', kind: 'recharge', engine: null, name: 'Growth', description: '145 crédits — 17 F le crédit', priceXaf: 2499, interval: 'one_time', credits: 145, isActive: true, sortOrder: 330 },
  { code: 'recharge-power', kind: 'recharge', engine: null, name: 'Power', description: '320 crédits — 15,6 F le crédit', priceXaf: 4999, interval: 'one_time', credits: 320, isActive: true, sortOrder: 340 },

  // ── Bundles multi-moteurs ────────────────────────────────────────────────
  {
    code: 'bundle-launch',
    kind: 'bundle',
    engine: null,
    name: 'Launch Pack',
    description: 'Business Essential + AppGen Starter + Deploy Starter.',
    priceXaf: 7499,
    interval: 'month',
    // 150 Business + 150 AppGen : la répartition par moteur est faite à
    // l'octroi, ce total ne sert qu'à l'affichage.
    credits: 300,
    discountLabel: '-17 %',
    subscriptionTier: 'pro',
    isActive: true,
    sortOrder: 350,
  },
  {
    code: 'bundle-complete',
    kind: 'bundle',
    engine: null,
    name: 'IDEM Complete',
    description: 'Business Growth + AppGen Pro + Deploy Pro + Advisory Premium.',
    priceXaf: 29999,
    interval: 'month',
    credits: 1050,
    discountLabel: '-21 %',
    subscriptionTier: 'enterprise',
    isActive: true,
    sortOrder: 360,
  },
];

/**
 * Composition des bundles : quels crédits vont sur quel compteur. Nécessaire
 * parce que les compteurs sont séparés — un total global ne suffirait pas à
 * créditer correctement.
 */
export const BUNDLE_CREDIT_SPLIT: Record<string, Partial<Record<BillingEngine, number>>> = {
  'bundle-launch': { business: 150, appgen: 150 },
  'bundle-complete': { business: 500, appgen: 550 },
};

/** Prix annuel d'un produit mensuel, remise « 2 mois offerts » appliquée. */
export function annualPriceXaf(monthlyPriceXaf: number): number {
  return Math.round(monthlyPriceXaf * 12 * (1 - ANNUAL_DISCOUNT_RATE));
}

/**
 * LE MODÈLE ÉCONOMIQUE — « Créer, Garder, Faire tourner, Grandir ».
 *
 * Source de vérité des prix de la plateforme, en F CFA (zone CFA) :
 * `Idem-bp/business model/07-modele-economique.md` en donne la justification, et
 * `config/generation-budgets.ts` le coût de chaque génération.
 *
 *  - **Créer** est gratuit : chaque livrable existe d'abord en ESQUISSE (petits modèles,
 *    sans recherche web, aucun fichier final) ;
 *  - **Garder** se paie au livrable, et le total d'un projet est PLAFONNÉ au Kit Entreprise ;
 *  - **Faire tourner** se paie au jour (compteurs iDeploy) ou au mois, avec un plafond
 *    automatique : les achats du mois qui atteignent le prix d'un forfait deviennent ce forfait ;
 *  - **Grandir** : commission sur les ventes, payeurs tiers, services humains.
 *
 * Plus de crédits : un seul PORTEFEUILLE en francs, rechargé par mobile money ou par code
 * IDEM, paie tous les services. Chaque service garde son unité (le livrable, la modification,
 * le jour, l'export, la simulation).
 */

// ============================================
// PORTEFEUILLE
// ============================================

/** Compte du grand livre qui porte le solde en francs (montants en F CFA entiers). */
export const WALLET_ACCOUNT = 'wallet' as const;

/**
 * Comptes de « droits prépayés », tenus dans le même grand livre que le portefeuille :
 *  - `appgen`         : modifications iCode incluses (Pass Projet, packs) — 1 unité = 1 modification ;
 *  - `icode_pass`     : Pass Projet iCode prépayés (packs), à appliquer à un projet ;
 *  - `vitrine_days`   : jours de compteur Vitrine prépayés (Pack Lancement).
 */
export const PREPAID_ACCOUNTS = ['appgen', 'icode_pass', 'vitrine_days'] as const;
export type PrepaidAccount = (typeof PREPAID_ACCOUNTS)[number];

/** Les comptes du grand livre : moteurs historiques, portefeuille et droits prépayés. */
export type LedgerAccount = 'business' | 'appgen' | 'ideploy' | typeof WALLET_ACCOUNT | 'icode_pass' | 'vitrine_days';

/** Valeur d'un ancien crédit à la conversion en francs (prix de référence du crédit). */
export const LEGACY_CREDIT_XAF = 13;

/** Recharge du portefeuille : bornes et paliers de bonus. */
export const TOPUP = {
  minXaf: 100,
  maxXaf: 500_000,
  /** Les montants se règlent par pas de 50 F (pièces et monnaie mobile). */
  stepXaf: 50,
  /** Bonus de recharge, du plus haut palier au plus bas. */
  bonuses: [
    { fromXaf: 10_000, rate: 0.1 },
    { fromXaf: 5_000, rate: 0.05 },
  ],
  /** Montants proposés à l'écran. */
  suggestedXaf: [500, 1_000, 2_500, 5_000, 10_000],
} as const;

/** Bonus accordé pour une recharge de ce montant. */
export function topupBonusXaf(amountXaf: number): number {
  const tier = TOPUP.bonuses.find((bonus) => amountXaf >= bonus.fromXaf);
  return tier ? Math.round(amountXaf * tier.rate) : 0;
}

/** Montant valide pour une recharge ? */
export function isValidTopup(amountXaf: number): boolean {
  return Number.isInteger(amountXaf) && amountXaf >= TOPUP.minXaf && amountXaf <= TOPUP.maxXaf && amountXaf % TOPUP.stepXaf === 0;
}

/** Plus petite recharge suggérée qui couvre un manque (sinon le manque arrondi au pas). */
export function topupFor(missingXaf: number): number {
  const suggested = TOPUP.suggestedXaf.find((amount) => amount >= missingXaf);
  if (suggested) return suggested;
  return Math.ceil(missingXaf / TOPUP.stepXaf) * TOPUP.stepXaf;
}

// ============================================
// IDEM — LIVRABLES (Garder)
// ============================================

export type DeliverableKey =
  | 'logo_brand'
  | 'business_plan'
  | 'pitch_deck'
  | 'legal_kit'
  | 'financial_forecast'
  | 'business_card';

export interface DeliverableOffer {
  key: DeliverableKey;
  label: string;
  /** Prix de la version finale, à l'unité. */
  priceXaf: number;
}

/** Les livrables du Kit Entreprise, au prix de leur version finale. */
export const DELIVERABLES: Record<DeliverableKey, DeliverableOffer> = {
  logo_brand: { key: 'logo_brand', label: 'Logo + charte graphique', priceXaf: 1500 },
  business_plan: { key: 'business_plan', label: 'Business plan', priceXaf: 2000 },
  pitch_deck: { key: 'pitch_deck', label: 'Pitch deck', priceXaf: 1000 },
  legal_kit: { key: 'legal_kit', label: 'Kit juridique OHADA', priceXaf: 1500 },
  financial_forecast: { key: 'financial_forecast', label: 'Prévisionnel 3 ans', priceXaf: 1000 },
  business_card: { key: 'business_card', label: 'Cartes de visite', priceXaf: 500 },
};

export const DELIVERABLE_KEYS = Object.keys(DELIVERABLES) as DeliverableKey[];

export function isDeliverable(value: unknown): value is DeliverableKey {
  return typeof value === 'string' && value in DELIVERABLES;
}

/** Plafond d'un projet : au-delà, tout le Kit Entreprise est débloqué. */
export const KIT_CAP_XAF = 2500;

/** Somme des versions finales à l'unité (ancrage affiché à côté du Kit). */
export const KIT_SUM_XAF = DELIVERABLE_KEYS.reduce((sum, key) => sum + DELIVERABLES[key].priceXaf, 0);

/** Version Signature (modèles les plus puissants), par livrable, hors plafond. */
export const SIGNATURE_PRICE_XAF = 1000;

/** Retouches gratuites sur une version finale, après son achat. */
export const FINAL_EDIT_WINDOW_DAYS = 30;

/** Une retouche hors fenêtre et hors forfait. */
export const EDIT_PRICE_XAF = 100;

/** Nouvelle mise en page d'un document déjà rédigé, hors fenêtre et hors forfait. */
export const RELAYOUT_PRICE_XAF: Partial<Record<DeliverableKey, number>> = {
  business_plan: 500,
  pitch_deck: 300,
};

// ============================================
// IDEM — COMMUNICATION (Faire tourner)
// ============================================

/** Contenus de communication, à l'unité ; leur total du mois est plafonné au forfait Croissance. */
export const COMMUNICATION_PRICES = {
  flyer: 100,
  ai_visual: 100,
  carousel: 200,
  /** Vidéo motion design au périmètre de référence (15 s, un format, HD). */
  motion_video: 300,
  motion_video_rerender: 100,
  /** Un plan filmé par l'IA (5 s), toujours en option et affiché à part. */
  ai_clip: 1000,
  editorial_calendar: 500,
  communication_plan: 500,
  communication_strategy: 1000,
  short_video: 1500,
} as const;

export type CommunicationItem = keyof typeof COMMUNICATION_PRICES;

// ============================================
// FORFAITS ET PLAFONDS MENSUELS
// ============================================

export type PassCode = 'croissance' | 'entreprise' | 'createur';

export interface PassOffer {
  code: PassCode;
  label: string;
  monthlyXaf: number;
  /** 2 mois offerts sur 12. */
  annualXaf: number;
  /** Ce que le forfait couvre. */
  covers: string[];
}

export const PASSES: Record<PassCode, PassOffer> = {
  croissance: {
    code: 'croissance',
    label: 'IDEM Croissance',
    monthlyXaf: 3000,
    annualXaf: 30000,
    covers: [
      'Communication sans limite (usage loyal)',
      'Retouches illimitées sur tous les livrables',
      'Site vitrine toujours allumé',
      '20 modifications iCode par mois',
      'Une simulation par trimestre',
    ],
  },
  entreprise: {
    code: 'entreprise',
    label: 'IDEM Entreprise',
    monthlyXaf: 7500,
    annualXaf: 75000,
    covers: [
      'Tout IDEM Croissance',
      'Compteur Application iDeploy inclus',
      'iVision Créateur inclus',
      'Un domaine inclus (formule annuelle)',
    ],
  },
  createur: {
    code: 'createur',
    label: 'iVision Créateur',
    monthlyXaf: 2000,
    annualXaf: 20000,
    covers: ['Exports HD sans signature (usage loyal : 60 visuels, 6 vidéos)'],
  },
};

/** Le forfait qu'un plafond mensuel accorde, et la clé de plafond correspondante. */
export const MONTHLY_CAPS: Record<'croissance' | 'createur', number> = {
  croissance: PASSES.croissance.monthlyXaf,
  createur: PASSES.createur.monthlyXaf,
};

/** Clé de plafond mensuel : `croissance:2026-10`. */
export function monthlyCapKey(cap: 'croissance' | 'createur', at = new Date()): string {
  return `${cap}:${at.toISOString().slice(0, 7)}`;
}

/** Clé de plafond d'un projet : `kit:<projectId>`. */
export function kitCapKey(projectId: string): string {
  return `kit:${projectId}`;
}

/** Fin du mois civil (UTC) d'une date. */
export function endOfMonth(at = new Date()): Date {
  return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + 1, 1));
}

/** Forfait offert à l'inscription. */
export const WELCOME_PASS = { code: 'croissance' as PassCode, days: 7 };

// ============================================
// iCODE
// ============================================

export const ICODE = {
  /** Posséder le code : téléchargement, GitHub, déploiement en un clic. */
  projectPassXaf: 1000,
  /** Modifications incluses dans le Pass Projet. */
  projectPassModifications: 30,
  /** Une modification, « le prix d'un SMS ». */
  modificationXaf: 25,
  /** Une modification avec le modèle le plus puissant. */
  premiumModificationXaf: 75,
  /** Unités de modification consommées par une action premium. */
  premiumUnits: 3,
  /** Pack de 100 modifications. */
  pack100Xaf: 2000,
  pack100Modifications: 100,
  /** Modifications incluses chaque mois dans le forfait Croissance. */
  croissanceModificationsPerMonth: 20,
  /** Image générée pour un site : une modification. */
  siteImageUnits: 1,
  /** Clip vidéo généré pour un site : un plan filmé par l'IA. */
  siteVideoXaf: COMMUNICATION_PRICES.ai_clip,
} as const;

// ============================================
// iDEPLOY — COMPTEURS
// ============================================

export type MeterTier = 'veille' | 'vitrine' | 'application' | 'application_plus' | 'boutique';

export interface MeterOffer {
  tier: MeterTier;
  label: string;
  /** Prix par jour, en F. */
  perDayXaf: number;
  description: string;
}

export const METERS: Record<MeterTier, MeterOffer> = {
  veille: { tier: 'veille', label: 'Veille', perDayXaf: 0, description: 'Site sur monprojet.idem.africa, réveillé à la visite' },
  vitrine: { tier: 'vitrine', label: 'Vitrine', perDayXaf: 10, description: 'Site toujours allumé' },
  application: { tier: 'application', label: 'Application', perDayXaf: 50, description: 'Application + base de données' },
  application_plus: { tier: 'application_plus', label: 'Application+', perDayXaf: 150, description: '2 Go, sauvegardes quotidiennes' },
  boutique: { tier: 'boutique', label: 'Boutique', perDayXaf: 0, description: 'Vitrine + paiement mobile money, 4 % par vente' },
};

export const METER_TIERS = Object.keys(METERS) as MeterTier[];

export type MeterOption = 'waf' | 'autoscaling' | 'backups' | 'monitoring' | 'database' | 'logs' | 'static_ip' | 'sovereign';

/** Options du compteur, par jour. */
export const METER_OPTIONS: Record<MeterOption, { label: string; perDayXaf: number }> = {
  waf: { label: 'Pare-feu avancé', perDayXaf: 50 },
  autoscaling: { label: 'Montée en charge automatique', perDayXaf: 70 },
  backups: { label: 'Sauvegardes quotidiennes', perDayXaf: 35 },
  monitoring: { label: 'Surveillance avancée + alertes', perDayXaf: 35 },
  database: { label: 'Base de données supplémentaire', perDayXaf: 35 },
  logs: { label: 'Journaux conservés 90 jours', perDayXaf: 15 },
  static_ip: { label: 'IP statique dédiée', perDayXaf: 70 },
  sovereign: { label: 'Résidence nationale des données', perDayXaf: 70 },
};

/** Commission de la Boutique sur chaque vente encaissée, frais mobile money compris. */
export const BOUTIQUE_COMMISSION_RATE = 0.04;

/** Alerte de solde avant mise en veille, en jours. */
export const METER_ALERT_DAYS = 3;

/** Durée pendant laquelle une application endormie se réveille à la recharge, avant archivage. */
export const METER_SLEEP_GRACE_DAYS = 30;

/** Espace équipe iDeploy (jusqu'à 5 membres), par mois. */
export const DEPLOY_TEAM_SPACE_XAF = 1500;

/** Prix d'un compteur pour une journée, options comprises. */
export function meterDailyXaf(tier: MeterTier, options: MeterOption[] = []): number {
  return METERS[tier].perDayXaf + options.reduce((sum, option) => sum + (METER_OPTIONS[option]?.perDayXaf ?? 0), 0);
}

// ============================================
// iSIMULATE
// ============================================

export type SimulationOffer = 'run' | 'report' | 'rerun' | 'deep';

/** Prix projet IDEM / prix public (business plan importé). */
export const SIMULATION_PRICES: Record<SimulationOffer, { idemXaf: number; publicXaf: number; label: string }> = {
  run: { idemXaf: 1500, publicXaf: 2500, label: 'Simulation complète' },
  report: { idemXaf: 2000, publicXaf: 2000, label: 'Rapport pour la banque' },
  rerun: { idemXaf: 500, publicXaf: 500, label: 'Re-simulation (sous 90 jours)' },
  deep: { idemXaf: 7500, publicXaf: 9500, label: 'Simulation approfondie' },
};

/** Le niveau de simulation demandé par l'ancienne API, ramené aux offres. */
export function simulationOfferForTier(tier: string): SimulationOffer {
  if (tier === 'rerun' || tier === 'sim-rerun') return 'rerun';
  if (tier === 'deep' || tier === 'sim-deep') return 'deep';
  return 'run';
}

// ============================================
// PACKS
// ============================================

export type PackCode = 'lancement' | 'lancement_domaine' | 'a_plusieurs';

export interface PackOffer {
  code: PackCode;
  label: string;
  priceXaf: number;
  description: string;
}

export const PACKS: Record<PackCode, PackOffer> = {
  lancement: {
    code: 'lancement',
    label: 'Pack Lancement',
    priceXaf: 5000,
    description: 'Kit Entreprise + Pass Projet iCode (30 modifications) + 3 mois de site vitrine allumé',
  },
  lancement_domaine: {
    code: 'lancement_domaine',
    label: 'Pack Lancement + domaine',
    priceXaf: 9900,
    description: 'Pack Lancement + un domaine .africa pendant un an, au coût',
  },
  a_plusieurs: {
    code: 'a_plusieurs',
    label: 'À plusieurs',
    priceXaf: 20000,
    description: '5 Packs Lancement à offrir (le 5ᵉ offert) : association, tontine, coopérative',
  },
};

/** Jours de Vitrine prépayés par un Pack Lancement. */
export const PACK_VITRINE_DAYS = 90;

/** Packs Lancement remis sous forme de codes par le pack « À plusieurs ». */
export const PACK_GROUP_SIZE = 5;

// ============================================
// NOMS DE DOMAINE
// ============================================

// Les prix et les commandes de domaines vivent dans iDomain (`apps/idomain`), seule source :
// l'API IDEM les lit par `services/idomain/idomain.client.ts`.

// ============================================
// CODES IDEM (agents, cadeaux)
// ============================================

export type IdemCodeKind = 'wallet' | 'pack_lancement';

/** Commission d'un agent sur les codes qu'il vend. */
export const AGENT_COMMISSION_RATE = 0.08;

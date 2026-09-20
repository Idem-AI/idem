import { BillingEngine } from './billing.model';

/**
 * Ce que chaque plan autorise, au-delà des crédits.
 *
 * Les crédits paient les livrables ; ces limites-ci définissent le cadre :
 * combien de projets on peut mener de front, si les exports sortent sans
 * filigrane, combien d'applications restent en ligne. Le business plan les
 * énonce plan par plan ; sans cette table, elles resteraient des promesses de
 * page de tarifs que rien n'applique.
 *
 * Deux principes de lecture :
 *  - `null` signifie **illimité**, jamais « zéro » ;
 *  - un plan absent de la table retombe sur le plan gratuit de son moteur, ce
 *    qui est le comportement sûr : un produit mal orthographié ne doit pas
 *    ouvrir des droits, il doit les restreindre.
 */

export interface BusinessLimits {
  /** Projets menés simultanément. */
  activeProjects: number | null;
  /** Les aperçus et exports portent-ils un filigrane ? */
  watermark: boolean;
  /** Exports bureautiques (Word, PPT, PDF) sans filigrane. */
  unwatermarkedExports: boolean;
  /** Membres pouvant recevoir une carte de visite. */
  teamCards: number | null;
  /** Comptes sociaux connectables (add-on iMedia). */
  socialAccounts: number;
  /** Publications programmées par mois ; `null` = illimité. */
  scheduledPosts: number | null;
  /** Livrables à la marque du client. */
  whiteLabel: boolean;
  /** Suivi prévisionnel contre réalisé. */
  forecastTracking: boolean;
}

export interface AppgenLimits {
  /** Générations initiales par jour ; `null` = illimité. */
  dailyGenerations: number | null;
  /** Le Pass Projet est-il inclus sur tous les projets ? */
  projectPassIncluded: boolean;
  /** Accès aux modèles premium (actions à 3 crédits). */
  premiumModels: boolean;
  seats: number;
  apiAccess: boolean;
  whiteLabel: boolean;
}

export interface IdeployLimits {
  apps: number | null;
  /** Déploiements gratuits au total, avant facturation à l'acte. */
  freeDeployments: number | null;
  /** Mise en veille après inactivité. */
  sleepsWhenIdle: boolean;
  /** Trafic sortant inclus, en Go. */
  bandwidthGb: number;
  databases: number | null;
  teamMembers: number;
  /** Rétention des logs, en heures. */
  logRetentionHours: number;
}

/** Plan gratuit de chaque moteur — le repli quand rien n'est souscrit. */
export const FREE_PLAN_CODES: Record<BillingEngine, string> = {
  business: 'business-discovery',
  appgen: 'appgen-discovery',
  ideploy: 'ideploy-hobby',
};

const BUSINESS_LIMITS: Record<string, BusinessLimits> = {
  'business-discovery': {
    activeProjects: 1,
    // Le filigrane EST le modèle d'acquisition : on montre le livrable avant
    // de le faire payer, plutôt que de le cacher derrière un paywall.
    watermark: true,
    unwatermarkedExports: false,
    teamCards: 0,
    socialAccounts: 0,
    scheduledPosts: 0,
    whiteLabel: false,
    forecastTracking: false,
  },
  'business-essential': {
    activeProjects: 1,
    watermark: false,
    unwatermarkedExports: true,
    teamCards: 2,
    socialAccounts: 0,
    scheduledPosts: 0,
    whiteLabel: false,
    forecastTracking: false,
  },
  'business-growth': {
    activeProjects: 3,
    watermark: false,
    unwatermarkedExports: true,
    teamCards: 10,
    // Croissance inclut Social Starter.
    socialAccounts: 2,
    scheduledPosts: 30,
    whiteLabel: false,
    forecastTracking: true,
  },
  'business-cabinet': {
    activeProjects: 10,
    watermark: false,
    unwatermarkedExports: true,
    teamCards: null,
    // Cabinet inclut Social Pro.
    socialAccounts: 6,
    scheduledPosts: null,
    whiteLabel: true,
    forecastTracking: true,
  },
};

const APPGEN_LIMITS: Record<string, AppgenLimits> = {
  'appgen-discovery': {
    dailyGenerations: 3,
    projectPassIncluded: false,
    premiumModels: false,
    seats: 1,
    apiAccess: false,
    whiteLabel: false,
  },
  'appgen-starter': {
    dailyGenerations: null,
    projectPassIncluded: true,
    premiumModels: false,
    seats: 1,
    apiAccess: false,
    whiteLabel: false,
  },
  'appgen-pro': {
    dailyGenerations: null,
    projectPassIncluded: true,
    premiumModels: true,
    seats: 1,
    apiAccess: false,
    whiteLabel: false,
  },
  'appgen-studio': {
    dailyGenerations: null,
    projectPassIncluded: true,
    premiumModels: true,
    seats: 5,
    apiAccess: true,
    whiteLabel: true,
  },
};

const IDEPLOY_LIMITS: Record<string, IdeployLimits> = {
  'ideploy-hobby': {
    apps: 2,
    freeDeployments: 5,
    sleepsWhenIdle: true,
    bandwidthGb: 50,
    databases: 1,
    teamMembers: 1,
    logRetentionHours: 1,
  },
  'ideploy-starter': {
    apps: 3,
    freeDeployments: null,
    sleepsWhenIdle: false,
    bandwidthGb: 100,
    databases: 1,
    teamMembers: 1,
    logRetentionHours: 24 * 7,
  },
  'ideploy-pro': {
    apps: 10,
    freeDeployments: null,
    sleepsWhenIdle: false,
    bandwidthGb: 500,
    databases: 5,
    teamMembers: 3,
    logRetentionHours: 24 * 30,
  },
  'ideploy-scale': {
    apps: 25,
    freeDeployments: null,
    sleepsWhenIdle: false,
    bandwidthGb: 2048,
    databases: null,
    teamMembers: 10,
    logRetentionHours: 24 * 90,
  },
};

/**
 * Limites d'un plan. Un code inconnu retombe sur le plan gratuit du moteur —
 * jamais sur des limites permissives.
 */
export function limitsForPlan(engine: 'business', productCode?: string): BusinessLimits;
export function limitsForPlan(engine: 'appgen', productCode?: string): AppgenLimits;
export function limitsForPlan(engine: 'ideploy', productCode?: string): IdeployLimits;
export function limitsForPlan(
  engine: BillingEngine,
  productCode?: string
): BusinessLimits | AppgenLimits | IdeployLimits {
  const code = productCode ?? FREE_PLAN_CODES[engine];

  switch (engine) {
    case 'business':
      return BUSINESS_LIMITS[code] ?? BUSINESS_LIMITS[FREE_PLAN_CODES.business];
    case 'appgen':
      return APPGEN_LIMITS[code] ?? APPGEN_LIMITS[FREE_PLAN_CODES.appgen];
    case 'ideploy':
      return IDEPLOY_LIMITS[code] ?? IDEPLOY_LIMITS[FREE_PLAN_CODES.ideploy];
  }
}

/**
 * Coût en crédits d'une action iCode, selon la complexité.
 *
 * Repris du business plan : « message/planification : 1 ; build standard :
 * 1-2 ; action premium : 3 ».
 */
export const APPGEN_CREDIT_COSTS = {
  message: 1,
  build: 2,
  premium: 3,
} as const;

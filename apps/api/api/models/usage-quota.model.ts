import type { BillingEngine } from './billing.model';

/**
 * Quotas d'usage IA : combien de générations un compte peut lancer par jour,
 * par semaine et par mois, et combien de coût IA il peut engager.
 *
 * Remplace l'ancien compteur unique (50 requêtes/jour, 200/semaine, tous usages
 * confondus) qui datait d'avant les paiements : il comptait une révision d'une
 * phrase comme un business plan complet, ne connaissait pas l'offre souscrite et
 * se contentait de deux fenêtres.
 *
 * **Crédits et quotas ne répondent pas à la même question.**
 *  - Les **crédits** disent ce que l'utilisateur PAIE : un livrable coûte un
 *    nombre connu de crédits, au barème.
 *  - Les **quotas** disent ce que la plateforme ACCEPTE DE DÉPENSER pour lui sur
 *    une période. Ils protègent trois choses que les crédits ne protègent pas :
 *    les aides IA gratuites (onboarding, suggestions, analyses…), les crédits
 *    offerts (bêta premium, bienvenue) et la plateforme contre une boucle ou un
 *    script qui enchaîne les générations.
 *
 * Les limites sont posées par GROUPE de fonctionnalités, parce qu'une limite par
 * action rendrait la grille illisible pour l'utilisateur, et une limite globale
 * mettrait sur le même plan une retouche à 1 crédit et une vidéo à 120. Le groupe
 * d'une action vient de son poids économique (cf. `config/generation-budgets.ts`).
 *
 * Trois fenêtres CALENDAIRES en UTC — pas glissantes : « se réinitialise à
 * minuit, le lundi, le 1er du mois » se comprend, une fenêtre glissante non.
 *
 * Toutes ces valeurs sont des défauts : le panneau d'administration peut les
 * surcharger sans redéploiement (`billing_settings.usageQuotas`).
 */

// ============================================
// GROUPES
// ============================================

export type QuotaGroup =
  /** Aides IA gratuites : onboarding, suggestions, analyses, assistant, amélioration de prompt. */
  | 'assist'
  /** Retouches et révisions (1 à 3 crédits) : édition IA d'une section, chat, palette, couleurs. */
  | 'edit'
  /** Créations courantes : visuel, flyer, carte de visite, calendrier, période de communication, stratégie. */
  | 'create'
  /** Livrables phares : business plan, pitch deck, logo et charte, kit juridique, prévisionnel, nouvelle mise en page. */
  | 'flagship'
  /** Vidéo : motion design, nouvel export, clips générés. */
  | 'video'
  /** iCode : génération initiale d'une application (gratuite). */
  | 'appgen_initial'
  /** iCode : modifications, builds, actions premium, médias de site. */
  | 'appgen_edit'
  /** iSimulate : exécutions, rapport, laboratoires. */
  | 'simulation';

export const QUOTA_GROUPS: QuotaGroup[] = [
  'assist',
  'edit',
  'create',
  'flagship',
  'video',
  'appgen_initial',
  'appgen_edit',
  'simulation',
];

/** Libellés affichés à l'utilisateur, dans l'ordre où il les lit. */
export const QUOTA_GROUP_LABELS: Record<QuotaGroup, string> = {
  assist: 'Aides IA',
  edit: 'Retouches IA',
  create: 'Créations',
  flagship: 'Livrables complets',
  video: 'Vidéos',
  appgen_initial: 'Applications générées',
  appgen_edit: 'Modifications iCode',
  simulation: 'Simulations',
};

/** Moteur dont l'offre fixe le palier d'un groupe ; `null` = meilleure offre tous moteurs confondus. */
export const QUOTA_GROUP_ENGINE: Record<QuotaGroup, BillingEngine | null> = {
  assist: null,
  edit: 'business',
  create: 'business',
  flagship: 'business',
  video: 'business',
  appgen_initial: 'appgen',
  appgen_edit: 'appgen',
  simulation: null,
};

// ============================================
// ACTIONS → GROUPES
// ============================================

/**
 * Groupe de chaque action facturée. Une action absente retombe sur `edit`
 * (le groupe le moins permissif des actions payantes courantes) et l'écart est
 * signalé par `npm run check:quotas`.
 */
export const ACTION_QUOTA_GROUP: Record<BillingEngine, Record<string, QuotaGroup>> = {
  business: {
    revision: 'edit',
    brand_regenerate: 'edit',
    flyer: 'create',
    ai_visual: 'create',
    carousel: 'create',
    business_card: 'create',
    editorial_calendar: 'create',
    communication_plan: 'create',
    communication_strategy: 'create',
    logo_relaunch: 'create',
    logo_regenerate: 'create',
    logo_variations: 'create',
    short_video: 'video',
    motion_video: 'video',
    motion_video_rerender: 'video',
    pitch_deck: 'flagship',
    pitch_deck_relayout: 'flagship',
    business_plan: 'flagship',
    business_plan_relayout: 'flagship',
    logo_brand: 'flagship',
    legal_kit: 'flagship',
    financial_forecast: 'flagship',
    procedures_manual: 'flagship',
  },
  appgen: {
    initial_generation: 'appgen_initial',
    message: 'appgen_edit',
    build: 'appgen_edit',
    premium: 'appgen_edit',
    site_image: 'appgen_edit',
    site_video: 'appgen_edit',
  },
  ideploy: {},
};

export function quotaGroupOf(engine: BillingEngine, action: string): QuotaGroup {
  return ACTION_QUOTA_GROUP[engine]?.[action] ?? 'edit';
}

// ============================================
// PALIERS
// ============================================

/**
 * Palier d'un compte, déduit de l'offre souscrite sur le moteur concerné.
 * La bêta premium est un palier à part : elle ouvre les offres les plus hautes
 * GRATUITEMENT, ses limites bornent donc le coût du programme.
 */
export type QuotaTier = 'free' | 'starter' | 'growth' | 'top' | 'beta';

export const QUOTA_TIERS: QuotaTier[] = ['free', 'starter', 'growth', 'top', 'beta'];

/** Rang de chaque palier payant, pour retenir le meilleur quand plusieurs moteurs comptent. */
export const TIER_RANK: Record<QuotaTier, number> = { free: 0, beta: 1, starter: 2, growth: 3, top: 4 };

/** Offre → palier. Un code inconnu vaut `free` : un produit mal orthographié ne doit pas ouvrir de droits. */
export const PLAN_TIER: Record<string, QuotaTier> = {
  'business-discovery': 'free',
  'business-essential': 'starter',
  'business-growth': 'growth',
  'business-cabinet': 'top',
  'appgen-discovery': 'free',
  'appgen-starter': 'starter',
  'appgen-pro': 'growth',
  'appgen-studio': 'top',
  'ideploy-hobby': 'free',
  'ideploy-starter': 'starter',
  'ideploy-pro': 'growth',
  'ideploy-scale': 'top',
};

// ============================================
// FENÊTRES ET LIMITES
// ============================================

export type QuotaWindow = 'day' | 'week' | 'month';

export const QUOTA_WINDOWS: QuotaWindow[] = ['day', 'week', 'month'];

/** Limite par fenêtre ; `null` = pas de limite sur cette fenêtre. */
export type WindowLimits = Record<QuotaWindow, number | null>;

const w = (day: number | null, week: number | null, month: number | null): WindowLimits => ({ day, week, month });

/**
 * Nombre de générations par groupe, palier et fenêtre.
 *
 * Calibrage : un usage normal ne touche jamais la limite (un abonné Croissance
 * qui produit tout son mois de contenus reste sous 30 % de ses plafonds) ; un
 * script qui boucle la touche en quelques minutes. Les groupes payants sont
 * déjà bornés par les crédits : leurs limites sont des garde-fous, larges. Les
 * groupes gratuits (`assist`, `appgen_initial`) et la bêta sont ceux que la
 * limite protège vraiment.
 *
 * Un compte gratuit qui a acheté un pack (Pack Complet : plan, deck, logo,
 * kit juridique) doit pouvoir tout produire dans la journée : d'où 5 livrables
 * phares par jour même en Découverte.
 */
export const DEFAULT_QUOTA_LIMITS: Record<QuotaTier, Record<QuotaGroup, WindowLimits>> = {
  free: {
    assist: w(30, 120, 300),
    edit: w(30, 120, 300),
    create: w(15, 40, 80),
    flagship: w(5, 10, 20),
    video: w(2, 4, 8),
    appgen_initial: w(3, 10, 25),
    appgen_edit: w(40, 150, 400),
    simulation: w(3, 6, 10),
  },
  starter: {
    assist: w(80, 400, 1200),
    edit: w(120, 600, 1800),
    create: w(40, 200, 500),
    flagship: w(8, 25, 60),
    video: w(4, 12, 25),
    appgen_initial: w(20, 100, 300),
    appgen_edit: w(200, 900, 2500),
    simulation: w(5, 15, 30),
  },
  growth: {
    assist: w(150, 800, 2500),
    edit: w(250, 1200, 3500),
    create: w(80, 400, 1200),
    flagship: w(15, 50, 120),
    video: w(8, 25, 60),
    appgen_initial: w(40, 200, 600),
    appgen_edit: w(400, 1800, 5000),
    simulation: w(8, 25, 60),
  },
  top: {
    assist: w(300, 1500, 5000),
    edit: w(500, 2500, 8000),
    create: w(200, 1000, 3000),
    flagship: w(40, 150, 400),
    video: w(20, 60, 150),
    appgen_initial: w(100, 500, 1500),
    appgen_edit: w(1000, 4500, 12000),
    simulation: w(15, 50, 120),
  },
  beta: {
    assist: w(60, 300, 800),
    edit: w(80, 400, 1000),
    create: w(30, 120, 300),
    flagship: w(4, 12, 25),
    video: w(2, 6, 12),
    appgen_initial: w(10, 40, 100),
    appgen_edit: w(120, 500, 1200),
    simulation: w(2, 4, 6),
  },
};

/**
 * Plafond de COÛT IA engagé par compte, en dollars (tous moteurs, toutes
 * fonctionnalités). C'est le disjoncteur : il ne se déclenche pas sur un usage
 * normal, il arrête une dérive — un agent qui reboucle, des générations en
 * rafale par script — avant qu'elle ne coûte plus que ce que le compte rapporte.
 *
 * Calibrage (plafond de coût par crédit ≈ 10 F, cf. `config/generation-budgets.ts`) :
 *  - payant : les crédits du mois de l'offre PLUS deux recharges Power (640
 *    crédits) consommés au plafond de coût restent sous la limite mensuelle —
 *    un client qui paie n'est jamais arrêté par le disjoncteur ;
 *  - gratuit : un compte Découverte qui a acheté le Pack Complet (265 crédits)
 *    peut tout produire dans la journée ; sans achat, les limites en nombre
 *    bornent déjà ses aides gratuites à quelques centimes ;
 *  - bêta : borne volontairement le coût du programme (1 500 + 1 500 crédits
 *    offerts par mois valent bien plus que ce plafond au coût réel).
 */
export const DEFAULT_SPEND_CAPS_USD: Record<QuotaTier, WindowLimits> = {
  // Le gratuit produit des ESQUISSES (petits modèles, sans recherche web) : ~40 F par projet en
  // moyenne. 1,5 $ par mois couvre plusieurs projets complets et borne l'abus.
  free: w(0.5, 1, 1.5),
  starter: w(3, 8, 18),
  growth: w(6, 18, 45),
  top: w(15, 45, 110),
  beta: w(2, 6, 15),
};

// ============================================
// PÉRIODES
// ============================================

/** Clé de période d'une fenêtre, en UTC : `2026-10-15`, `2026-W42`, `2026-10`. */
export function periodKey(window: QuotaWindow, at = new Date()): string {
  if (window === 'day') return at.toISOString().slice(0, 10);
  if (window === 'month') return at.toISOString().slice(0, 7);

  // Semaine ISO 8601 : du lundi au dimanche, la semaine 1 contient le premier jeudi.
  const date = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
  const weekday = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - weekday);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Fin (exclue) de la période en cours d'une fenêtre : c'est l'instant où le compteur repart à zéro. */
export function periodEnd(window: QuotaWindow, at = new Date()): Date {
  const y = at.getUTCFullYear();
  const m = at.getUTCMonth();
  const d = at.getUTCDate();

  if (window === 'day') return new Date(Date.UTC(y, m, d + 1));
  if (window === 'month') return new Date(Date.UTC(y, m + 1, 1));

  const weekday = at.getUTCDay() || 7;
  return new Date(Date.UTC(y, m, d + (8 - weekday)));
}

// ============================================
// RÉPONSES
// ============================================

export interface QuotaWindowStatus {
  window: QuotaWindow;
  used: number;
  limit: number | null;
  remaining: number | null;
  resetsAt: string;
}

export interface QuotaGroupStatus {
  group: QuotaGroup;
  label: string;
  tier: QuotaTier;
  windows: QuotaWindowStatus[];
}

export interface UsageQuotaStatus {
  groups: QuotaGroupStatus[];
  /** Part du plafond de coût IA engagée, par fenêtre (0-100). Jamais un montant : c'est un indicateur. */
  capacity: Record<QuotaWindow, number>;
  tier: QuotaTier;
  enforcement: 'off' | 'log' | 'enforce';
}

/** Corps d'un refus pour quota atteint (HTTP 429). */
export interface QuotaRefusal {
  error: 'quota_exceeded';
  message: string;
  group: QuotaGroup;
  reason: 'count' | 'spend';
  window: QuotaWindow;
  limit: number | null;
  used: number;
  resetsAt: string;
  tier: QuotaTier;
  suggestions: { productCode: string; name: string; priceXaf: number; credits: number }[];
}

/** Surcharges réglées depuis le panneau d'administration. */
export interface UsageQuotaOverrides {
  limits?: Partial<Record<QuotaTier, Partial<Record<QuotaGroup, Partial<WindowLimits>>>>>;
  spendCapsUsd?: Partial<Record<QuotaTier, Partial<WindowLimits>>>;
}

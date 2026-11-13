/**
 * Les promotions IDEM — ce qu'une campagne, un coupon ou une offre de lancement peut faire.
 *
 * Une promotion est une RÈGLE datée, pas un prix : elle dit sur quoi elle porte (`scope`), pour qui
 * (`audience`), combien elle retire (`discount`), dans quelles limites (`limits`), et comment elle
 * s'affiche (`display`). Les prix restent ceux d'`offer.model.ts` ; la promotion s'applique au moment
 * du débit (API) et au moment de l'affichage (écrans) avec le MÊME calcul (`engine.ts`) : le prix
 * barré qu'on montre est exactement celui qu'on encaisse.
 *
 * Trois natures :
 *  - `campaign` : s'applique d'office à tous ceux qu'elle vise (bêta gratuite, soldes de rentrée) ;
 *  - `coupon`   : s'applique après saisie d'un code par l'utilisateur (code partenaire, influenceur) ;
 *  - les deux peuvent en plus offrir des francs au portefeuille, un bonus de recharge et des crédits
 *    du jour plus larges (quotas d'usage IA).
 */

/** Les familles de services, pour viser « tout iCode » sans lister chaque article. */
export type PromoService =
  | 'idem'
  | 'communication'
  | 'icode'
  | 'ideploy'
  | 'ivision'
  | 'isimulate'
  | 'idomain'
  | 'passes'
  | 'packs';

export type PromotionKind = 'campaign' | 'coupon';

/** État posé par l'équipe. La phase réelle (programmée, expirée, épuisée) se calcule avec les dates. */
export type PromotionState = 'draft' | 'active' | 'paused' | 'ended';

/** Ce que voit le panel : l'état croisé avec les dates et les limites. */
export type PromotionPhase = 'draft' | 'scheduled' | 'running' | 'paused' | 'ended' | 'expired' | 'exhausted';

export type DiscountType = 'free' | 'percent' | 'fixed';

export interface PromotionDiscount {
  type: DiscountType;
  /** Pourcentage (1-100) pour `percent`, montant en F CFA pour `fixed`, ignoré pour `free`. */
  value: number;
}

export interface PromotionScope {
  /** Vrai : tous les articles payants (sauf exclusions). */
  all: boolean;
  /** Familles entières visées. */
  services: PromoService[];
  /** Articles visés un par un (`pack.lancement`, `deliverable.business_plan`…). */
  items: string[];
  /** Articles jamais remisés par cette promotion, même compris dans `all` ou une famille. */
  excludeItems: string[];
}

export interface PromotionAudience {
  /** Faux : seulement les adresses / comptes listés. */
  everyone: boolean;
  /** Seulement les comptes créés à partir de cette date (offre de bienvenue). */
  newUsersSince?: string | null;
  /** Adresses visées (minuscules). */
  emails?: string[];
  /** Comptes visés. */
  userIds?: string[];
}

export interface PromotionLimits {
  /** Nombre d'achats remisés par compte ; `null` = sans limite. */
  perUser?: number | null;
  /** Nombre total d'achats remisés ; `null` = sans limite. */
  total?: number | null;
  /** Total des remises accordées, en F CFA ; au-delà la promotion est épuisée. */
  budgetXaf?: number | null;
  /** Coupons : nombre de comptes qui peuvent saisir le code. */
  claims?: number | null;
}

export interface PromotionDisplay {
  /** Bandeau en haut des pages de prix et de la console. */
  banner: boolean;
  title: string;
  message: string;
  /** Prix d'origine barré à côté du prix remisé. */
  strikethrough: boolean;
  /** Petit libellé à côté du prix (« Bêta », « -30 % »). */
  badge: string;
  /** Les mêmes textes en anglais (pages en anglais). Vide : texte anglais par défaut de la campagne, sinon le français. */
  en?: PromotionDisplayTexts | null;
}

export interface PromotionDisplayTexts {
  title?: string;
  message?: string;
  badge?: string;
}

export type QuotaWindowKey = 'day' | 'week' | 'month';
export type WindowLimitsPatch = Partial<Record<QuotaWindowKey, number | null>>;

/**
 * Crédits du jour pendant la promotion : des limites d'usage IA plus larges que celles de l'offre
 * du compte. Elles ne réduisent jamais un compte : on retient la plus large des deux.
 */
export interface PromotionQuotas {
  enabled: boolean;
  /** Le nombre de « tours complets » par jour qui a servi à calculer les limites (indicatif). */
  timesPerDay?: number | null;
  /** Par groupe d'usage (`flagship`, `create`, `video`…). */
  limits: Record<string, WindowLimitsPatch>;
  /** Plafond de coût IA par compte, en dollars. */
  spendCapsUsd: WindowLimitsPatch;
}

export interface PromotionStats {
  redemptions: number;
  discountXaf: number;
  claims: number;
  topupBonusXaf: number;
  walletCreditXaf: number;
}

export interface Promotion {
  id: string;
  /** Identifiant lisible et stable (`beta-gratuite-2026`). */
  slug: string;
  name: string;
  /** Note interne de l'équipe. */
  description?: string;
  kind: PromotionKind;
  state: PromotionState;
  /** Coupons : le code à saisir, en majuscules. */
  code?: string | null;
  startsAt: string;
  /** `null` : jusqu'à ce que l'équipe y mette fin. */
  endsAt: string | null;
  /** La plus haute passe d'abord quand deux promotions exclusives visent le même article. */
  priority: number;
  /** Cumulable avec la meilleure promotion exclusive. */
  stackable: boolean;
  discount: PromotionDiscount;
  scope: PromotionScope;
  audience: PromotionAudience;
  limits: PromotionLimits;
  display: PromotionDisplay;
  quotas?: PromotionQuotas | null;
  /** Francs offerts au portefeuille à la saisie du coupon (ou à l'inscription pour une campagne). */
  walletCreditXaf?: number;
  /** Bonus de recharge en plus des paliers (en %). */
  topupBonusPercent?: number;
  stats: PromotionStats;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
  endedAt?: string | null;
  endedBy?: string | null;
  endReason?: string | null;
}

/** Ce que les écrans reçoivent : jamais les limites, les audiences ni les compteurs. */
export interface PublicPromotion {
  id: string;
  slug: string;
  name: string;
  kind: PromotionKind;
  startsAt: string;
  endsAt: string | null;
  priority: number;
  stackable: boolean;
  discount: PromotionDiscount;
  scope: PromotionScope;
  display: PromotionDisplay;
  topupBonusPercent?: number;
  /** Coupon déjà saisi par l'utilisateur connecté. */
  claimed?: boolean;
}

export interface PromotionsSnapshot {
  promotions: PublicPromotion[];
  /** Heure du serveur, pour borner les promotions sans dépendre de l'horloge du téléphone. */
  now: string;
}

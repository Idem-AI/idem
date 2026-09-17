import { BillingEngine, BillingInterval, annualPriceXaf } from './billing.model';

/**
 * Encaissement Mobile Money via pawaPay.
 *
 * Trois principes, tous imposés par la nature du Mobile Money :
 *
 *  1. **La transaction existe avant l'appel au prestataire.** `depositId` est
 *     un UUIDv4 que NOUS générons et persistons d'abord. Une coupure réseau au
 *     milieu de l'initiation ne crée donc jamais un paiement fantôme : on relit
 *     son statut avec le même identifiant. C'est aussi ce qui rend
 *     `POST /deposits` idempotent côté pawaPay.
 *
 *  2. **Rien n'est livré sur la foi d'un callback.** Un callback n'est qu'un
 *     signal « va regarder » ; le statut fait foi seulement quand il vient d'un
 *     `GET /deposits/{id}`. S'y ajoutent la signature RFC 9421 et la liste
 *     blanche d'IP, mais la relecture reste la garantie qui ne dépend d'aucune
 *     configuration.
 *
 *  3. **Un paiement sans statut final n'est pas un paiement échoué.** Le réseau
 *     Mobile Money est lent et parfois muet : le réconciliateur relit jusqu'à
 *     24 h avec un délai croissant, et seul un `NOT_FOUND` confirmé bien après
 *     l'initiation autorise à conclure à l'échec.
 *
 * Référence : https://docs.pawapay.io/v2/docs/deposits
 */

// ============================================
// STATUTS
// ============================================

/**
 * Statut interne d'une transaction. Reprend volontairement le vocabulaire de
 * pawaPay — traduire deux fois (leur statut, puis le nôtre) ne ferait
 * qu'ajouter une occasion de se tromper lors d'un diagnostic — avec un seul
 * ajout : `CREATED`, l'état d'avant l'appel, que pawaPay ne connaît pas.
 */
export type PaymentStatus =
  /** Persistée chez nous, pas encore soumise à pawaPay. */
  | 'CREATED'
  /** Acceptée par pawaPay, l'abonné doit valider sur son téléphone. */
  | 'ACCEPTED'
  /** Transmise à l'opérateur. */
  | 'SUBMITTED'
  /** En cours de traitement par l'opérateur. */
  | 'PROCESSING'
  /** Vérification automatique de pawaPay ; rien à faire de notre côté. */
  | 'IN_RECONCILIATION'
  /** Encaissée. */
  | 'COMPLETED'
  /** Échec après acceptation (PIN refusé, solde insuffisant…). */
  | 'FAILED'
  /** Refusée à l'initiation (montant hors bornes, opérateur fermé…). */
  | 'REJECTED'
  /** Jamais parvenue à pawaPay : abandonnée après la fenêtre de réconciliation. */
  | 'NOT_FOUND'
  /** Sans statut final au bout de 24 h de relectures. */
  | 'EXPIRED';

/** Statuts dont la transaction ne bougera plus. */
export const FINAL_PAYMENT_STATUSES: PaymentStatus[] = [
  'COMPLETED',
  'FAILED',
  'REJECTED',
  'NOT_FOUND',
  'EXPIRED',
];

/** Statuts qui appellent une relecture périodique. */
export const PENDING_PAYMENT_STATUSES: PaymentStatus[] = [
  'CREATED',
  'ACCEPTED',
  'SUBMITTED',
  'PROCESSING',
  'IN_RECONCILIATION',
];

export function isFinalPaymentStatus(status: PaymentStatus): boolean {
  return FINAL_PAYMENT_STATUSES.includes(status);
}

/**
 * Traduit un statut renvoyé par pawaPay.
 *
 * `DUPLICATE_IGNORED` devient `ACCEPTED` : pawaPay signale ainsi qu'il connaît
 * déjà ce `depositId`. C'est exactement le résultat attendu d'une reprise après
 * coupure réseau — le paiement existe, il faut en suivre le statut, surtout pas
 * le rejouer.
 */
export function mapPawapayStatus(raw: string): PaymentStatus {
  switch (raw) {
    case 'DUPLICATE_IGNORED':
      return 'ACCEPTED';
    case 'ACCEPTED':
    case 'SUBMITTED':
    case 'PROCESSING':
    case 'IN_RECONCILIATION':
    case 'COMPLETED':
    case 'FAILED':
    case 'REJECTED':
    case 'NOT_FOUND':
      return raw;
    default:
      // Un statut inconnu est traité comme « en cours » : le réconciliateur
      // continuera de relire plutôt que de conclure à tort.
      return 'PROCESSING';
  }
}

// ============================================
// INTENTION
// ============================================

/** Ce que le paiement achète. Détermine ce qui sera livré à l'encaissement. */
export type PaymentIntentType =
  /** Achat ponctuel : pack, recharge, passe, Project Pass, option. */
  | 'purchase'
  /** Première période d'un abonnement. */
  | 'subscription'
  /** Période suivante d'un abonnement existant. */
  | 'renewal'
  /** Échéance 2 ou 3 d'un annuel payé en trois fois. */
  | 'installment'
  /** Exécution de simulation ou rapport, facturés à l'acte. */
  | 'simulation';

export interface PaymentIntent {
  type: PaymentIntentType;
  /** Produit du catalogue (`billing_products.code`). */
  productCode: string;
  /** Compteur visé — indispensable pour une recharge, qui n'en porte pas. */
  engine?: BillingEngine | null;
  /** Projet concerné (Project Pass AppGen, simulation). */
  projectId?: string;
  /** Périodicité souscrite. */
  interval?: BillingInterval;
  /** Abonnement renouvelé ou échelonné. */
  subscriptionId?: string;
  /** Rang de l'échéance (1 à 3) pour un annuel payé en plusieurs fois. */
  installmentIndex?: number;
  /** Niveau de simulation acheté. */
  simulationTier?: string;
  /** Libellé affiché à l'utilisateur et repris dans le reçu. */
  label: string;
}

// ============================================
// LIVRAISON
// ============================================

/**
 * Où en est la contrepartie du paiement.
 *
 * Séparé du statut du paiement parce que les deux échouent indépendamment :
 * l'argent peut être encaissé alors que l'octroi des crédits a planté. Ce cas
 * doit être visible et rejouable, jamais silencieux.
 */
export type FulfillmentState = 'pending' | 'in_progress' | 'done' | 'failed';

export interface PaymentFulfillment {
  state: FulfillmentState;
  at?: Date;
  purchaseId?: string;
  subscriptionId?: string;
  invoiceId?: string;
  /** Simulation débloquée par ce paiement — empêche de la consommer deux fois. */
  consumedBySimulationId?: string;
  error?: string;
  attempts?: number;
}

// ============================================
// ÉVÉNEMENTS
// ============================================

/**
 * Étapes journalisées d'une transaction. La liste est fermée : le panel admin
 * s'appuie dessus pour dire « bloqué à telle étape », ce qu'un champ libre ne
 * permettrait pas.
 */
export type PaymentEventType =
  | 'created'
  | 'provider_predicted'
  | 'provider_unavailable'
  | 'pawapay_request'
  | 'pawapay_response'
  | 'pawapay_error'
  | 'callback_received'
  | 'signature_verified'
  | 'signature_rejected'
  | 'status_polled'
  | 'status_changed'
  | 'fulfillment_started'
  | 'fulfilled'
  | 'fulfillment_failed'
  | 'refund_requested'
  | 'refund_completed'
  | 'refund_failed'
  | 'admin_action'
  | 'email_sent'
  | 'expired';

/** Qui a produit l'événement — la première question d'un diagnostic. */
export type PaymentEventSource = 'api' | 'callback' | 'reconciler' | 'admin' | 'system';

export interface PaymentEventModel {
  id?: string;
  transactionId: string;
  depositId: string;
  type: PaymentEventType;
  source: PaymentEventSource;
  level: 'info' | 'warn' | 'error';
  message: string;
  httpStatus?: number;
  durationMs?: number;
  /** Corrélation avec les logs applicatifs (en-tête `X-Request-Id`). */
  requestId?: string;
  /** Charge utile expurgée (jamais de numéro en clair, jamais de jeton). */
  data?: Record<string, unknown>;
  at: Date;
}

// ============================================
// TRANSACTION
// ============================================

/** Application d'où part le paiement, pour mesurer les tunnels séparément. */
export type PaymentClientApp = 'dashboard' | 'appgen' | 'simulation' | 'ideploy' | 'admin';

export interface PaymentTransactionModel {
  id?: string;
  /** Référence lisible `PAY-2026-09-000123`, donnée à l'utilisateur. */
  reference: string;
  /** UUIDv4 généré par nous, clé d'idempotence côté pawaPay. */
  depositId: string;
  userId: string;
  /** E-mail figé à l'achat : le compte peut changer d'adresse ensuite. */
  userEmail?: string;
  intent: PaymentIntent;

  /** Montant réellement demandé, en unité entière de la devise. */
  amount: number;
  currency: string;
  /** Équivalent XAF, devise de référence de la facturation. */
  amountXaf: number;
  country: string;
  /** Code opérateur pawaPay (`MTN_MOMO_CMR`, `ORANGE_CMR`…). */
  provider: string;

  /** `2376*****89` — la seule forme affichable. */
  phoneMasked: string;
  /** Empreinte, pour la recherche support. */
  phoneHash: string;
  /** Numéro chiffré, pour préremplir une relance. */
  phoneEncrypted?: string;

  status: PaymentStatus;
  /** Statut brut du prestataire, conservé tel quel pour les litiges. */
  pawapayStatus?: string;
  failureCode?: string;
  failureMessage?: string;
  /** Identifiant opérateur, celui qui figure sur le reçu de l'abonné. */
  providerTransactionId?: string;
  /** Flux à redirection (Wave) : page d'autorisation de l'abonné. */
  authorizationUrl?: string;

  fulfillment: PaymentFulfillment;
  refund?: {
    refundId: string;
    status: string;
    amount: number;
    requestedBy?: string;
    reason?: string;
    at?: Date;
  };

  polling: {
    count: number;
    lastAt?: Date;
    /** Prochaine relecture ; `null` quand la transaction est finale. */
    nextPollAt?: Date | null;
  };

  /** Clé fournie par le client pour éviter un double paiement au double-clic. */
  idempotencyKey?: string;
  requestId?: string;
  client?: {
    app?: PaymentClientApp;
    ip?: string;
    userAgent?: string;
  };

  /** Jour `YYYY-MM-DD` de création — clé d'agrégation, comme en facturation. */
  day: string;
  createdAt?: Date;
  updatedAt?: Date;
  finalizedAt?: Date;
}

// ============================================
// PAYS ET DEVISES
// ============================================

export interface PaymentCountry {
  /** ISO 3166-1 alpha-3, le format attendu par pawaPay. */
  code: string;
  name: string;
  /** Indicatif téléphonique, sans `+`. */
  prefix: string;
  currency: string;
  /**
   * Décimales acceptées par les opérateurs du pays. Le franc CFA n'en a pas :
   * envoyer « 1999.00 » ferait rejeter le dépôt avec `INVALID_AMOUNT`.
   */
  decimals: 0 | 2;
  /**
   * La grille de prix du pays, en devise locale.
   *
   * **Ces prix sont fixés pour le pays, pas convertis.** Chaque grille part du
   * revenu local (salaire minimum quand il existe, PIB/hab. PPA sinon), puis
   * s'ajuste aux points de douleur et aux habitudes relevés : là où le revenu
   * est irrégulier, les passes et recharges descendent davantage ; les offres
   * pro, achetées par des entreprises formelles, restent plus proches du prix
   * de la zone CFA. Chaque montant est enfin posé sur un palier qui se lit.
   *
   * La clé est le prix catalogue du produit : elle ne sert qu'à situer le
   * produit dans l'échelle de l'offre, pour que la hiérarchie reste la même
   * d'un pays à l'autre — un Cabinet reste plus cher qu'un Essentiel partout.
   *
   * Absente en zone franc : XAF et XOF sont à parité, le prix catalogue
   * s'applique tel quel.
   */
  prices?: Record<number, number>;
}

/**
 * Pays ouverts à l'encaissement au lancement : la zone franc, où le prix
 * affiché est le prix payé.
 *
 * XAF et XOF partagent la même parité avec l'euro (655,957) : un prix en F CFA
 * se règle à l'identique des deux côtés, sans conversion ni risque de change.
 * Les autres marchés (NGN, GHS, KES…) supposent une conversion et un
 * coefficient de pouvoir d'achat ; ils s'ouvriront depuis les réglages.
 *
 * Cette liste dit ce que NOUS ouvrons. Ce qui est réellement disponible à
 * l'instant T vient toujours de `GET /active-conf` : un opérateur peut être
 * fermé, et la liste ci-dessous n'en saurait rien.
 */
/**
 * Les pays que nous savons **tarifer**.
 *
 * Savoir tarifer un pays ne suffit pas à y encaisser : il faut encore que le
 * compte pawaPay y soit provisionné. La liste réellement proposée à l'écran est
 * l'intersection des deux — voir `payment-countries.service.ts`. Garder ici les
 * pays pas encore activés permet à une activation côté pawaPay de suffire,
 * sans redéploiement.
 *
 * Les prix de référence sont ceux arbitrés au modèle économique (section
 * « Tarification Internationale »), sur la base de 2 999 F au Cameroun.
 */
export const SUPPORTED_COUNTRIES: PaymentCountry[] = [
  // ── Zone franc : prix du catalogue tel quel ───────────────────────────────
  // XAF et XOF sont à parité fixe : le même prix dans les sept pays, sans
  // conversion ni risque de change. L'offre de référence y pèse 4 à 6 % d'un
  // salaire minimum (SMIG 2026 : 75 000 F en Côte d'Ivoire, 64 223 F au
  // Sénégal, 60 000 F au Cameroun, 52 000 F au Bénin) — c'est ce POIDS, et non
  // le prix, que la grille des autres pays reprend comme point de départ.
  { code: 'CMR', name: 'Cameroun', prefix: '237', currency: 'XAF', decimals: 0 },
  { code: 'CIV', name: "Côte d'Ivoire", prefix: '225', currency: 'XOF', decimals: 0 },
  { code: 'SEN', name: 'Sénégal', prefix: '221', currency: 'XOF', decimals: 0 },
  { code: 'BEN', name: 'Bénin', prefix: '229', currency: 'XOF', decimals: 0 },
  { code: 'BFA', name: 'Burkina Faso', prefix: '226', currency: 'XOF', decimals: 0 },
  { code: 'COG', name: 'Congo-Brazzaville', prefix: '242', currency: 'XAF', decimals: 0 },
  // Seul pays de la zone où les opérateurs acceptent les centimes.
  { code: 'GAB', name: 'Gabon', prefix: '241', currency: 'XAF', decimals: 2 },

  // ── Afrique de l'Est ──────────────────────────────────────────────────────
  // Salaire minimum de 9 000 à 18 000 KES selon la zone. Adoption numérique la plus forte de la région (91 % des exportateurs paient en numérique), et Netflix mobile y coûte 1,55 $ : on y paie déjà le numérique. Au plus près du prix CFA.
  // Offre de référence : 650 KES.
  {
    code: 'KEN', name: "Kenya", prefix: '254', currency: 'KES', decimals: 0,
    prices: { 499: 100, 500: 100, 900: 180, 999: 210, 1499: 310, 1999: 410, 2499: 510, 2999: 650, 4999: 1100, 6999: 1550, 7499: 1650, 7999: 1750, 9999: 2250, 11999: 2700, 19999: 4550, 24999: 5650, 29999: 6800 },
  },
  // Aucun salaire minimum effectif. Les meilleures institutions de la région — une entreprise se crée en 4 jours, l'impôt des PME est à 15 % — et le hub de Kigali : un écosystème formel qui paie ses outils.
  // Offre de référence : 6 500 RWF.
  {
    code: 'RWA', name: "Rwanda", prefix: '250', currency: 'RWF', decimals: 0,
    prices: { 499: 1050, 500: 1050, 900: 1850, 999: 2050, 1499: 3100, 1999: 4100, 2499: 5150, 2999: 6500, 4999: 11500, 6999: 16000, 7499: 17000, 7999: 18000, 9999: 24000, 11999: 28500, 19999: 47500, 24999: 59500, 29999: 71500 },
  },
  // Aucun salaire minimum effectif. Data la moins chère d'Afrique (0,02 $ le Go) : l'usage numérique est massif, mais les revenus restent bas.
  // Offre de référence : 15 000 UGX.
  {
    code: 'UGA', name: "Ouganda", prefix: '256', currency: 'UGX', decimals: 0,
    prices: { 499: 2250, 500: 2250, 900: 4050, 999: 4500, 1499: 6750, 1999: 8950, 2499: 11000, 2999: 15000, 4999: 27000, 6999: 37500, 7499: 40000, 7999: 43000, 9999: 57500, 11999: 69000, 19999: 115000, 24999: 143000, 29999: 172000 },
  },
  // Le frein n'est pas le paiement mais l'usage des outils numériques, sur des infrastructures qui se dégradent et des tarifs parapublics élevés. Prix d'entrée doux pour lever la barrière du premier usage.
  // Offre de référence : 75 ZMW.
  {
    code: 'ZMB', name: "Zambie", prefix: '260', currency: 'ZMW', decimals: 0,
    prices: { 499: 11, 500: 11, 900: 20, 999: 22, 1499: 34, 1999: 45, 2499: 56, 2999: 75, 4999: 130, 6999: 190, 7499: 200, 7999: 210, 9999: 290, 11999: 340, 19999: 570, 24999: 720, 29999: 860 },
  },

  // ── Afrique de l'Ouest anglophone, Corne, Afrique australe, RDC ───────────
  // Petit marché servi par un seul opérateur (Orange), revenus bas : bas de la fourchette.
  // Offre de référence : 80 SLE.
  {
    code: 'SLE', name: "Sierra Leone", prefix: '232', currency: 'SLE', decimals: 0,
    prices: { 499: 12, 500: 12, 900: 21, 999: 23, 1499: 35, 1999: 47, 2499: 59, 2999: 80, 4999: 140, 6999: 200, 7499: 220, 7999: 230, 9999: 310, 11999: 370, 19999: 610, 24999: 770, 29999: 920 },
  },
  // PIB/hab. PPA parmi les plus faibles (1 699 $), capital rare, infrastructures contraintes ; le salaire minimum n'est plus national mais négocié par secteur.
  // Offre de référence : 220 MZN.
  {
    code: 'MOZ', name: "Mozambique", prefix: '258', currency: 'MZN', decimals: 0,
    prices: { 499: 32, 500: 32, 900: 57, 999: 63, 1499: 95, 1999: 130, 2499: 160, 2999: 220, 4999: 410, 6999: 570, 7499: 620, 7999: 660, 9999: 890, 11999: 1050, 19999: 1800, 24999: 2250, 29999: 2700 },
  },
  // Économie dollarisée — le franc congolais et le dollar sont tous deux encaissables —, PIB/hab. PPA de 2 144 $, infrastructures faibles.
  // Offre de référence : 8 050 CDF.
  {
    code: 'COD', name: "RD Congo", prefix: '243', currency: 'CDF', decimals: 0,
    prices: { 499: 1150, 500: 1150, 900: 2050, 999: 2300, 1499: 3450, 1999: 4550, 2499: 5700, 2999: 8050, 4999: 15000, 6999: 20500, 7499: 22000, 7999: 23500, 9999: 32500, 11999: 39000, 19999: 64500, 24999: 81000, 29999: 97000 },
  },
  // Salaire minimum bas (21,77 GHS par jour) mais cedi en hausse de 8,9 % sur l'année, régulation mobile money de référence et data très bon marché. Les PME y restent lentes à adopter le numérique.
  // Offre de référence : 45 GHS.
  {
    code: 'GHA', name: "Ghana", prefix: '233', currency: 'GHS', decimals: 0,
    prices: { 499: 7, 500: 7, 900: 12, 999: 13, 1499: 20, 1999: 27, 2499: 34, 2999: 45, 4999: 80, 6999: 110, 7499: 120, 7999: 130, 9999: 170, 11999: 210, 19999: 340, 24999: 430, 29999: 520 },
  },
  // Salaire minimum de 70 000 NGN (~53 $), 26 % d'adultes exclus du système financier, naira en baisse de 8,4 % sur l'année et concurrence logicielle intense. Mais c'est la plus grande base de fondateurs du continent : l'entrée est basse, les offres pro préservées.
  // Offre de référence : 4 900 NGN.
  {
    code: 'NGA', name: "Nigeria", prefix: '234', currency: 'NGN', decimals: 0,
    prices: { 499: 700, 500: 700, 900: 1250, 999: 1400, 1499: 2100, 1999: 2800, 2499: 3500, 2999: 4900, 4999: 9000, 6999: 12500, 7499: 13500, 7999: 14500, 9999: 19500, 11999: 23500, 19999: 39500, 24999: 49000, 29999: 59000 },
  },
  // Créer une entreprise y prend 26 jours et l'impôt atteint 30 % : économie très informelle. Entrée basse, offres pro préservées pour les entreprises formelles.
  // Offre de référence : 9 500 TZS.
  {
    code: 'TZA', name: "Tanzanie", prefix: '255', currency: 'TZS', decimals: 0,
    prices: { 499: 1400, 500: 1400, 900: 2500, 999: 2800, 1499: 4200, 1999: 5600, 2499: 7000, 2999: 9500, 4999: 17000, 6999: 24000, 7499: 25500, 7999: 27500, 9999: 36500, 11999: 44000, 19999: 73000, 24999: 91500, 29999: 110000 },
  },
  // Contrôle des changes, Telebirr dominant et faible habitude de l'abonnement logiciel : bas de fourchette.
  // Offre de référence : 590 ETB.
  {
    code: 'ETH', name: "Éthiopie", prefix: '251', currency: 'ETB', decimals: 0,
    prices: { 499: 87, 500: 87, 900: 160, 999: 170, 1499: 260, 1999: 350, 2499: 440, 2999: 590, 4999: 1050, 6999: 1500, 7499: 1600, 7999: 1700, 9999: 2300, 11999: 2750, 19999: 4550, 24999: 5700, 29999: 6850 },
  },
  // Micro-marché arrimé au rand sud-africain, servi par M-Pesa : bas de fourchette.
  // Offre de référence : 59 LSL.
  {
    code: 'LSO', name: "Lesotho", prefix: '266', currency: 'LSL', decimals: 0,
    prices: { 499: 9, 500: 9, 900: 16, 999: 18, 1499: 27, 1999: 35, 2499: 44, 2999: 59, 4999: 100, 6999: 140, 7499: 160, 7999: 170, 9999: 220, 11999: 260, 19999: 430, 24999: 540, 29999: 650 },
  },
  // Salaire minimum de 120 000 MWK (~69 $) et PIB/hab. PPA parmi les plus faibles du continent (1 797 $) : plancher de la fourchette.
  // Offre de référence : 6 000 MWK.
  {
    code: 'MWI', name: "Malawi", prefix: '265', currency: 'MWK', decimals: 0,
    prices: { 499: 850, 500: 850, 900: 1550, 999: 1700, 1499: 2550, 1999: 3400, 2499: 4250, 2999: 6000, 4999: 11000, 6999: 15500, 7499: 16500, 7999: 17500, 9999: 24000, 11999: 29000, 19999: 48000, 24999: 60000, 29999: 72000 },
  },
];

export const DEFAULT_COUNTRY = 'CMR';

export function getCountry(code: string): PaymentCountry | undefined {
  return SUPPORTED_COUNTRIES.find((country) => country.code === code.toUpperCase());
}

/**
 * Conversion d'un prix catalogue (XAF) vers la devise du pays.
 *
 * XAF et XOF sont à parité fixe 1:1 : le prix ne bouge pas d'un pays à
 * l'autre de la zone franc. Toute devise hors zone lèvera ici — c'est
 * délibéré, pour qu'une ouverture de marché passe par une décision de prix
 * explicite et non par un taux de change implicite.
 */
export function localPrice(catalogPriceXaf: number, country: PaymentCountry): number {
  // Zone franc : le prix catalogue est le prix payé.
  if (!country.prices) return catalogPriceXaf;

  const fixed = country.prices[catalogPriceXaf];
  if (fixed !== undefined) return fixed;

  // Un produit ajouté au catalogue sans prix local ne doit pas bloquer le
  // paiement : on le situe entre ses deux voisins de la grille. `checkBilling`
  // signale ce cas — c'est un prix à fixer, pas un comportement normal.
  const tiers = Object.keys(country.prices)
    .map(Number)
    .sort((a, b) => a - b);
  const lower = [...tiers].reverse().find((tier) => tier <= catalogPriceXaf) ?? tiers[0];
  const ratio = country.prices[lower] / lower;

  return readablePrice(catalogPriceXaf * ratio);
}

/**
 * Prix annuel local : la même remise que le catalogue, appliquée au prix
 * **local** mensuel.
 *
 * Calculer l'annuel en F CFA puis le convertir tomberait hors de la grille du
 * pays ; partir du mensuel local garde l'annuel cohérent avec ce que
 * l'utilisateur voit déjà affiché.
 */
export function localAnnualPrice(monthlyLocal: number, country: PaymentCountry): number {
  const annual = annualPriceXaf(monthlyLocal);
  return country.prices ? readablePrice(annual) : annual;
}

/** Pose un montant sur un palier lisible dans sa magnitude. */
function readablePrice(amount: number): number {
  const step = amount < 100 ? 1 : amount < 1000 ? 10 : amount < 10000 ? 50 : amount < 100000 ? 500 : 1000;
  return Math.max(step, Math.round(amount / step) * step);
}

/**
 * Montant au format attendu par pawaPay.
 *
 * Le motif imposé est `^([0]|([1-9][0-9]{0,17}))([.][0-9]{0,3}[1-9])?$` : pas
 * de zéro final après la virgule, pas de zéro en tête. Pour la zone franc on
 * envoie donc un entier nu.
 */
export function formatAmountForPawapay(amount: number, decimals: 0 | 2): string {
  if (decimals === 0) return String(Math.round(amount));

  const fixed = amount.toFixed(2);
  // Retire les zéros inutiles : « 12.50 » → « 12.5 », « 12.00 » → « 12 ».
  return fixed.replace(/\.?0+$/, '');
}

// ============================================
// TÉLÉPHONE
// ============================================

/**
 * Forme MSISDN : chiffres uniquement, indicatif pays compris, sans `+` ni
 * zéro initial. `predict-provider` renvoie la forme canonique ; ce nettoyage
 * sert à lui soumettre une saisie utilisable.
 */
export function normalizePhone(input: string, country?: PaymentCountry): string {
  let digits = input.replace(/\D/g, '');

  if (country) {
    // « 06 51 23 45 67 » saisi localement : on retire le zéro d'appel national
    // avant d'ajouter l'indicatif, sinon le numéro est faux d'un chiffre.
    if (digits.startsWith('00')) digits = digits.slice(2);
    if (!digits.startsWith(country.prefix)) {
      digits = country.prefix + digits.replace(/^0+/, '');
    }
  }

  return digits;
}

/** `237653456789` → `2376*****89`. La seule forme qui a le droit de sortir. */
export function maskPhone(phone: string): string {
  if (phone.length <= 6) return '*'.repeat(phone.length);
  return `${phone.slice(0, 4)}${'*'.repeat(phone.length - 6)}${phone.slice(-2)}`;
}

// ============================================
// MESSAGE CLIENT
// ============================================

/**
 * Libellé qui apparaît dans le SMS de confirmation de l'abonné.
 *
 * pawaPay impose 4 à 22 caractères alphanumériques et espaces uniquement : les
 * accents et la ponctuation font rejeter le dépôt. « Pack Identité » devient
 * donc « IDEM Pack Identite ».
 */
export function buildCustomerMessage(label: string): string {
  const cleaned = `IDEM ${label}`
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 22)
    .trim();

  // Un libellé vide ou trop court after nettoyage reste valide grâce au repli.
  return cleaned.length >= 4 ? cleaned : 'IDEM';
}

// ============================================
// RELECTURE DES STATUTS
// ============================================

/**
 * Délais de relecture, en millisecondes.
 *
 * Serrés au début — l'abonné a son téléphone en main et l'écran attend une
 * réponse — puis très espacés, parce qu'au-delà de quelques minutes seul le
 * réseau de l'opérateur décide et le relancer plus souvent n'y change rien.
 */
export const POLL_SCHEDULE_MS = [30_000, 60_000, 120_000, 300_000, 600_000];

/** Intervalle appliqué une fois le calendrier épuisé. */
export const POLL_FALLBACK_INTERVAL_MS = 1_800_000;

/** Au-delà, la transaction est déclarée `EXPIRED` et cesse d'être relue. */
export const POLL_DEADLINE_MS = 24 * 3600_000;

/**
 * Délai avant de conclure qu'un `NOT_FOUND` est définitif.
 *
 * pawaPay peut répondre `NOT_FOUND` quelques instants après l'initiation, le
 * temps que la transaction se propage. Conclure trop tôt afficherait un échec
 * à un abonné en train de taper son code.
 */
export const NOT_FOUND_GRACE_MS = 15 * 60_000;

export function nextPollDelayMs(attempt: number): number {
  return POLL_SCHEDULE_MS[attempt] ?? POLL_FALLBACK_INTERVAL_MS;
}

// ============================================
// CODES D'ÉCHEC
// ============================================

export interface FailureExplanation {
  /** Message montré à l'utilisateur, en français, sans jargon. */
  message: string;
  /** Ce qu'il peut faire ; `null` quand il n'y a rien à faire de son côté. */
  hint: string | null;
  /** Vrai si un nouvel essai a une chance d'aboutir. */
  retryable: boolean;
}

/**
 * Traduction des codes pawaPay.
 *
 * Deux lectures d'un même échec : ce que voit l'abonné (clair, actionnable) et
 * ce que voit le support (le code brut, conservé sur la transaction). Sans
 * cette table, l'écran afficherait « PAYER_LIMIT_REACHED » à un commerçant.
 *
 * Référence : https://docs.pawapay.io/v2/docs/failure_codes
 */
export const FAILURE_EXPLANATIONS: Record<string, FailureExplanation> = {
  PAYMENT_NOT_APPROVED: {
    message: "Le paiement n'a pas été validé sur votre téléphone.",
    hint: 'Relancez, puis saisissez votre code secret quand la demande s’affiche.',
    retryable: true,
  },
  INSUFFICIENT_BALANCE: {
    message: 'Votre compte Mobile Money n’a pas un solde suffisant.',
    hint: 'Rechargez votre compte, puis relancez le paiement.',
    retryable: true,
  },
  PAYMENT_IN_PROGRESS: {
    message: 'Une autre transaction est déjà en cours sur ce numéro.',
    hint: 'Patientez une dizaine de minutes avant de réessayer.',
    retryable: true,
  },
  PAYER_NOT_FOUND: {
    message: 'Ce numéro n’est pas enregistré chez cet opérateur Mobile Money.',
    hint: 'Vérifiez le numéro ou choisissez un autre opérateur.',
    retryable: true,
  },
  PAYER_LIMIT_REACHED: {
    message: 'Vous avez atteint le plafond autorisé par votre opérateur.',
    hint: 'Réessayez plus tard ou utilisez un autre numéro.',
    retryable: true,
  },
  WALLET_LIMIT_REACHED: {
    message: 'Le plafond de votre portefeuille Mobile Money est atteint.',
    hint: 'Contactez votre opérateur pour relever votre plafond.',
    retryable: true,
  },
  INVALID_PHONE_NUMBER: {
    message: 'Ce numéro de téléphone n’est pas valide.',
    hint: 'Vérifiez le numéro, indicatif pays compris.',
    retryable: true,
  },
  INVALID_AMOUNT: {
    message: 'Le montant n’est pas accepté par cet opérateur.',
    hint: null,
    retryable: false,
  },
  AMOUNT_OUT_OF_BOUNDS: {
    message: 'Le montant dépasse les limites autorisées par l’opérateur.',
    hint: 'Choisissez une offre d’un montant différent ou contactez-nous.',
    retryable: false,
  },
  INVALID_CURRENCY: {
    message: 'La devise n’est pas prise en charge par cet opérateur.',
    hint: null,
    retryable: false,
  },
  INVALID_PROVIDER: {
    message: 'Cet opérateur n’est pas disponible.',
    hint: 'Choisissez un autre opérateur.',
    retryable: true,
  },
  PROVIDER_TEMPORARILY_UNAVAILABLE: {
    message: 'L’opérateur Mobile Money est momentanément indisponible.',
    hint: 'Réessayez dans quelques minutes.',
    retryable: true,
  },
  DEPOSITS_NOT_ALLOWED: {
    message: 'Les paiements ne sont pas activés pour cet opérateur.',
    hint: null,
    retryable: false,
  },
  UNSPECIFIED_FAILURE: {
    message: 'L’opérateur a refusé le paiement sans en préciser la raison.',
    hint: 'Réessayez ; si le problème persiste, contactez votre opérateur.',
    retryable: true,
  },
  UNKNOWN_ERROR: {
    message: 'Le paiement n’a pas abouti.',
    hint: 'Réessayez dans quelques minutes.',
    retryable: true,
  },
  // Rejets à l'initiation : ils traduisent un défaut de NOTRE requête. L'abonné
  // n'y peut rien, le support doit les voir passer.
  INVALID_INPUT: { message: 'Le paiement n’a pas pu être lancé.', hint: null, retryable: false },
  MISSING_PARAMETER: { message: 'Le paiement n’a pas pu être lancé.', hint: null, retryable: false },
  UNSUPPORTED_PARAMETER: { message: 'Le paiement n’a pas pu être lancé.', hint: null, retryable: false },
  INVALID_PARAMETER: { message: 'Le paiement n’a pas pu être lancé.', hint: null, retryable: false },
  DUPLICATE_METADATA_FIELD: { message: 'Le paiement n’a pas pu être lancé.', hint: null, retryable: false },
  NO_AUTHENTICATION: { message: 'Le service de paiement est indisponible.', hint: null, retryable: false },
  AUTHENTICATION_ERROR: { message: 'Le service de paiement est indisponible.', hint: null, retryable: false },
  AUTHORISATION_ERROR: { message: 'Le service de paiement est indisponible.', hint: null, retryable: false },
  HTTP_SIGNATURE_ERROR: { message: 'Le service de paiement est indisponible.', hint: null, retryable: false },
  // Remboursements.
  DEPOSIT_ALREADY_REFUNDED: { message: 'Ce paiement a déjà été remboursé.', hint: null, retryable: false },
  AMOUNT_TOO_LARGE: { message: 'Le montant dépasse ce qui reste remboursable.', hint: null, retryable: false },
  REFUND_IN_PROGRESS: { message: 'Un remboursement est déjà en cours.', hint: null, retryable: true },
  PAWAPAY_WALLET_OUT_OF_FUNDS: {
    message: 'Le remboursement ne peut pas être effectué pour le moment.',
    hint: null,
    retryable: true,
  },
  MANUALLY_CANCELLED: { message: 'Le paiement a été annulé.', hint: null, retryable: true },
  REFUNDS_NOT_ALLOWED: { message: 'Les remboursements ne sont pas activés.', hint: null, retryable: false },
};

/** Repli explicite : un code inconnu ne doit jamais produire un écran vide. */
export function explainFailure(code?: string): FailureExplanation {
  if (!code) {
    return {
      message: 'Le paiement n’a pas abouti.',
      hint: 'Réessayez dans quelques minutes.',
      retryable: true,
    };
  }

  return (
    FAILURE_EXPLANATIONS[code] ?? {
      message: 'Le paiement n’a pas abouti.',
      hint: 'Réessayez ; en cas d’échec répété, contactez le support avec votre référence.',
      retryable: true,
    }
  );
}

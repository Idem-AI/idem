import { BillingEngine, BillingInterval } from './billing.model';

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
 * fermé, et la tarification n'en saurait rien. Les pays et leurs prix vivent
 * dans `packages/shared-models/src/pricing/pricing.config.json`.
 */
export const DEFAULT_COUNTRY = 'CMR';


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

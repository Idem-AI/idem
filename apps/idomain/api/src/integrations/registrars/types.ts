/**
 * Ce qu'iDomain attend d'un registrar, quel qu'il soit. Chaque fournisseur est un adaptateur :
 * le moteur de prix, les commandes et la gestion DNS ne connaissent que cette interface, si bien
 * qu'en changer ne change pas le parcours du client.
 *
 * Rien n'est supposé : une opération qu'un fournisseur ne sait pas faire lève `unsupported`, et
 * la matrice `provider_capabilities` dit, par extension, ce qu'il propose.
 */

export type RegistrarOperation = 'register' | 'renew' | 'transfer' | 'restore';

export interface AvailabilityResult {
  domain: string;
  available: boolean;
  /** Nom premium : prix du registre hors grille, jamais vendu au prix catalogue. */
  premium: boolean;
  /** Coût annoncé par le fournisseur pour cette opération et cette durée, s'il le donne. */
  cost?: number;
  currency?: string;
  reason?: string;
}

/** Le coût d'une extension, tel que le fournisseur le publie. */
export interface TldPricing {
  tld: string;
  currency: string;
  minYears: number;
  maxYears: number;
  /** Coût d'une année par opération (`register`, `renew`, `transfer`, `restore`). */
  costs: Partial<Record<RegistrarOperation, number>>;
}

export interface RegistrantContact {
  firstName: string;
  lastName: string;
  company?: string | null;
  email: string;
  phoneCountryCode: string;
  phone: string;
  address: string;
  city: string;
  state?: string | null;
  postalCode?: string | null;
  country: string;
}

export interface RegisteredDomain {
  /** La référence du domaine chez le fournisseur. */
  ref: string;
  domain: string;
  expiresAt: Date | null;
  nameservers: string[];
}

/**
 * Un JEU d'enregistrements : toutes les valeurs d'un même nom et d'un même type. C'est l'unité que
 * les zones des registrars écrivent réellement — écrire un jeu remplace TOUTES ses valeurs —,
 * donc l'unité de cette interface : on ne peut pas y « ajouter une valeur » par mégarde en
 * effaçant les autres.
 */
export interface DnsRecordSet {
  /** `@` pour le domaine lui-même, sinon le sous-domaine (`www`), toujours relatif. */
  name: string;
  type: string;
  ttl: number;
  values: string[];
}

export interface ResellerAccount {
  balance: number | null;
  currency: string;
}

/**
 * Les erreurs, rangées par ce qu'elles permettent de faire :
 *   - `unavailable`  le nom est pris : inutile de réessayer, ni ailleurs ;
 *   - `rejected`     refus définitif de CE fournisseur (données, extension) : un autre peut réussir ;
 *   - `uncertain`    délai dépassé, coupure : l'opération a PEUT-ÊTRE eu lieu — vérifier avant tout ;
 *   - `transient`    panne passagère certaine (refus avant traitement) : réessayer plus tard ;
 *   - `unsupported`  opération que ce fournisseur ne propose pas ;
 *   - `credentials`  compte mal configuré ou solde épuisé : alerte, fournisseur écarté.
 */
export type RegistrarErrorKind = 'unavailable' | 'rejected' | 'uncertain' | 'transient' | 'unsupported' | 'credentials' | 'insufficient_funds';

export class RegistrarError extends Error {
  constructor(
    readonly kind: RegistrarErrorKind,
    message: string,
    readonly code?: string,
    readonly status?: number
  ) {
    super(message);
    this.name = 'RegistrarError';
  }
}

export interface RegistrarAdapter {
  readonly code: string;
  /** Configuré (identifiants présents) : sinon le fournisseur n'est jamais interrogé. */
  isConfigured(): boolean;
  checkAvailability(domains: string[], operation: RegistrarOperation, years: number): Promise<AvailabilityResult[]>;
  listTldPricing(): Promise<TldPricing[]>;
  register(input: { domain: string; years: number; contact: RegistrantContact; nameservers?: string[]; idempotencyKey: string }): Promise<RegisteredDomain>;
  renew(input: { domain: string; years: number; idempotencyKey: string }): Promise<{ expiresAt: Date | null }>;
  transfer(input: { domain: string; authCode: string; years: number; idempotencyKey: string }): Promise<{ ref: string | null }>;
  /** Le domaine tel que le fournisseur le connaît, ou null s'il n'est pas dans notre compte. */
  getDomain(domain: string): Promise<RegisteredDomain | null>;
  /** La zone tenue par le fournisseur, par jeux (noms relatifs). */
  getRecordSets(domain: string): Promise<DnsRecordSet[]>;
  /** Écrit un jeu complet (crée ou remplace) et publie la zone. */
  setRecordSet(domain: string, set: DnsRecordSet): Promise<void>;
  /** Supprime un jeu entier (nom + type) et publie la zone ; absent = rien à faire. */
  deleteRecordSet(domain: string, name: string, type: string): Promise<void>;
  account(): Promise<ResellerAccount>;
}

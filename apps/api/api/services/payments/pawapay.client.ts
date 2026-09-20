import axios, { AxiosInstance, AxiosError } from 'axios';
import logger from '../../config/logger';
import { paymentEventsService } from './payment-events.service';

/**
 * Client HTTP pawaPay (API v2).
 *
 * Deux partis pris tiennent tout le fichier :
 *
 *  1. **Aucune erreur réseau n'est traitée comme un échec de paiement.** Un
 *     timeout sur `POST /deposits` ne dit rien du sort de l'argent : la demande
 *     est peut-être partie. Le client lève une `PawapayError` marquée
 *     `indeterminate`, et l'orchestrateur ira relire le statut avec le même
 *     `depositId`. Conclure à l'échec ici serait la pire erreur possible.
 *
 *  2. **Aucune relance automatique sur les écritures.** L'initiation est
 *     idempotente côté pawaPay (même `depositId` ⇒ `DUPLICATE_IGNORED`), mais
 *     la relance appartient au réconciliateur, qui sait ce qui a déjà été
 *     tenté. Relancer ici masquerait le problème dans la latence.
 *
 * Références :
 *   https://docs.pawapay.io/v2/docs/deposits
 *   https://docs.pawapay.io/v2/api-reference/toolkit/active-configuration
 */

const SANDBOX_BASE_URL = 'https://api.sandbox.pawapay.io/v2';
const PRODUCTION_BASE_URL = 'https://api.pawapay.io/v2';

/** 15 s : au-delà, pawaPay ne répondra pas — l'opérateur, lui, continue. */
const REQUEST_TIMEOUT_MS = 15_000;

// ============================================
// TYPES DE L'API
// ============================================

export interface PawapayMetadataItem {
  [key: string]: string | boolean | undefined;
  isPII?: boolean;
}

export interface DepositRequest {
  depositId: string;
  amount: string;
  currency: string;
  payer: {
    type: 'MMO';
    accountDetails: { phoneNumber: string; provider: string };
  };
  customerMessage?: string;
  clientReferenceId?: string;
  preAuthorisationCode?: string;
  metadata?: PawapayMetadataItem[];
}

export interface DepositCreationResponse {
  depositId: string;
  status: 'ACCEPTED' | 'REJECTED' | 'DUPLICATE_IGNORED';
  created?: string;
  failureReason?: { failureCode: string; failureMessage: string };
}

export interface DepositStatusData {
  depositId: string;
  status: string;
  amount?: string;
  currency?: string;
  country?: string;
  payer?: { type: string; accountDetails: { phoneNumber: string; provider: string } };
  customerMessage?: string;
  clientReferenceId?: string;
  created?: string;
  providerTransactionId?: string;
  failureReason?: { failureCode: string; failureMessage: string };
  metadata?: Record<string, string>;
}

export interface DepositStatusResponse {
  status: 'FOUND' | 'NOT_FOUND';
  data?: DepositStatusData;
}

export interface PredictProviderResponse {
  country: string;
  provider: string;
  phoneNumber: string;
}

export interface ActiveConfOperationType {
  status: 'OPERATIONAL' | 'CLOSED' | string;
  authType?: string;
  pinPrompt?: string;
  pinPromptRevivable?: boolean;
  pinPromptInstructions?: string;
  decimalsInAmount?: 'NONE' | 'TWO_PLACES' | string;
  minAmount?: string;
  maxAmount?: string;
}

export interface ActiveConfProvider {
  provider: string;
  displayName?: string;
  logo?: string;
  nameDisplayedToCustomer?: string;
  currencies: {
    currency: string;
    displayName?: string;
    operationTypes: Record<string, ActiveConfOperationType>;
  }[];
}

export interface ActiveConfCountry {
  country: string;
  prefix?: string;
  flag?: string;
  displayName?: Record<string, string>;
  providers: ActiveConfProvider[];
}

export interface ActiveConfResponse {
  companyName?: string;
  countries: ActiveConfCountry[];
}

export interface RefundRequest {
  refundId: string;
  depositId: string;
  amount?: string;
  currency?: string;
  clientReferenceId?: string;
  metadata?: PawapayMetadataItem[];
}

export interface RefundCreationResponse {
  refundId: string;
  status: 'ACCEPTED' | 'REJECTED' | 'DUPLICATE_IGNORED';
  created?: string;
  failureReason?: { failureCode: string; failureMessage: string };
}

// ============================================
// ERREURS
// ============================================

export class PawapayError extends Error {
  constructor(
    message: string,
    readonly options: {
      endpoint: string;
      httpStatus?: number;
      failureCode?: string;
      /**
       * Vrai quand l'issue de l'opération est INCONNUE (timeout, coupure,
       * 5xx). L'appelant doit alors relire le statut, jamais conclure.
       */
      indeterminate: boolean;
      durationMs?: number;
    }
  ) {
    super(message);
    this.name = 'PawapayError';
  }
}

// ============================================
// CLIENT
// ============================================

export class PawapayClient {
  private client: AxiosInstance | null = null;

  /**
   * L'instance est construite à la première utilisation, jamais à l'import :
   * les secrets sont chargés dans `bootstrap()`, après l'import des modules.
   * Un client construit trop tôt partirait sans jeton (le piège déjà rencontré
   * avec le backend Gemini, cf. `config/secrets.ts`).
   */
  private getClient(): AxiosInstance {
    if (this.client) return this.client;

    const token = process.env.PAWAPAY_API_TOKEN;
    if (!token) {
      throw new PawapayError('PAWAPAY_API_TOKEN absent : encaissement impossible.', {
        endpoint: 'config',
        indeterminate: false,
      });
    }

    this.client = axios.create({
      baseURL: this.baseUrl(),
      timeout: REQUEST_TIMEOUT_MS,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      // On veut inspecter les 4xx (un rejet métier arrive en 200 ou 4xx selon
      // le cas) plutôt que de les voir levées comme des pannes.
      validateStatus: (status) => status < 500,
    });

    return this.client;
  }

  baseUrl(): string {
    return process.env.PAWAPAY_ENV === 'production' ? PRODUCTION_BASE_URL : SANDBOX_BASE_URL;
  }

  isProduction(): boolean {
    return process.env.PAWAPAY_ENV === 'production';
  }

  /** Vrai si le jeton est présent. Lu par la sonde de santé du panel admin. */
  isConfigured(): boolean {
    return Boolean(process.env.PAWAPAY_API_TOKEN);
  }

  /** Vide l'instance mémoïsée (rotation de jeton, bascule d'environnement). */
  reset(): void {
    this.client = null;
  }

  /**
   * Exécute un appel en le mesurant et en normalisant ses erreurs.
   *
   * La distinction porte sur une seule question : sait-on ce qui s'est passé ?
   * Une réponse HTTP, même 4xx, est une information. Un timeout n'en est pas
   * une — d'où `indeterminate`.
   */
  private async call<T>(endpoint: string, fn: (client: AxiosInstance) => Promise<{ status: number; data: T }>): Promise<T> {
    const startedAt = Date.now();

    try {
      const response = await fn(this.getClient());
      const durationMs = Date.now() - startedAt;

      paymentEventsService.recordPawapayCall(endpoint, String(response.status), durationMs);

      if (response.status >= 400) {
        const body = response.data as unknown as {
          failureReason?: { failureCode?: string; failureMessage?: string };
          errorMessage?: string;
        };
        const failureCode = body?.failureReason?.failureCode;

        throw new PawapayError(
          body?.failureReason?.failureMessage ?? body?.errorMessage ?? `HTTP ${response.status}`,
          { endpoint, httpStatus: response.status, failureCode, indeterminate: false, durationMs }
        );
      }

      return response.data;
    } catch (error: unknown) {
      const durationMs = Date.now() - startedAt;

      if (error instanceof PawapayError) throw error;

      const axiosError = error as AxiosError;
      const httpStatus = axiosError.response?.status;
      // Pas de réponse, ou 5xx : l'opération a peut-être abouti côté pawaPay.
      const indeterminate = !httpStatus || httpStatus >= 500;

      paymentEventsService.recordPawapayCall(endpoint, httpStatus ? String(httpStatus) : 'network_error', durationMs);

      logger.error(`payment.pawapay_call_failed`, {
        event: 'payment.pawapay_call_failed',
        endpoint,
        httpStatus,
        durationMs,
        indeterminate,
        message: axiosError.message,
      });

      throw new PawapayError(axiosError.message || 'Appel pawaPay en échec', {
        endpoint,
        httpStatus,
        indeterminate,
        durationMs,
      });
    }
  }

  // ============================================
  // DÉPÔTS
  // ============================================

  async initiateDeposit(request: DepositRequest): Promise<DepositCreationResponse> {
    return this.call<DepositCreationResponse>('deposits.initiate', (client) =>
      client.post<DepositCreationResponse>('/deposits', request)
    );
  }

  /**
   * Statut d'un dépôt. La réponse est enveloppée (`{status, data}`) : `FOUND`
   * dit que pawaPay connaît la transaction, `data.status` dit où elle en est.
   */
  async getDeposit(depositId: string): Promise<DepositStatusResponse> {
    return this.call<DepositStatusResponse>('deposits.status', (client) =>
      client.get<DepositStatusResponse>(`/deposits/${depositId}`)
    );
  }

  /** Redemande l'envoi du callback d'un dépôt déjà finalisé. */
  async resendDepositCallback(depositId: string): Promise<unknown> {
    return this.call<unknown>('deposits.resend_callback', (client) =>
      client.post(`/deposits/resend-callback`, { depositId })
    );
  }

  // ============================================
  // REMBOURSEMENTS
  // ============================================

  async initiateRefund(request: RefundRequest): Promise<RefundCreationResponse> {
    return this.call<RefundCreationResponse>('refunds.initiate', (client) =>
      client.post<RefundCreationResponse>('/refunds', request)
    );
  }

  async getRefund(refundId: string): Promise<{ status: string; data?: Record<string, unknown> }> {
    return this.call('refunds.status', (client) => client.get(`/refunds/${refundId}`));
  }

  // ============================================
  // OUTILLAGE
  // ============================================

  /**
   * Configuration active d'un pays : opérateurs ouverts, devises, bornes de
   * montant, décimales, type d'autorisation.
   *
   * C'est la seule source qui dise ce qui marche À CET INSTANT. Notre liste de
   * pays dit ce que nous ouvrons commercialement ; celle-ci dit si l'opérateur
   * répond.
   */
  async getActiveConfiguration(country?: string): Promise<ActiveConfResponse> {
    const params = new URLSearchParams({ operationType: 'DEPOSIT' });
    if (country) params.set('country', country);

    return this.call<ActiveConfResponse>('active_conf', (client) =>
      client.get<ActiveConfResponse>(`/active-conf?${params.toString()}`)
    );
  }

  /**
   * Devine l'opérateur d'un numéro et renvoie sa forme canonique.
   *
   * Indispensable : l'abonné saisit « 06 51 23 45 67 » ou « +237 651… », et un
   * MSISDN mal formé fait rejeter le dépôt avec `INVALID_PHONE_NUMBER`.
   */
  async predictProvider(phoneNumber: string): Promise<PredictProviderResponse> {
    return this.call<PredictProviderResponse>('predict_provider', (client) =>
      client.post<PredictProviderResponse>('/predict-provider', { phoneNumber })
    );
  }

  async getAvailability(country?: string): Promise<unknown> {
    const params = new URLSearchParams({ operationType: 'DEPOSIT' });
    if (country) params.set('country', country);

    return this.call('availability', (client) => client.get(`/availability?${params.toString()}`));
  }

  /** Soldes des portefeuilles — un remboursement échoue si le solde est vide. */
  async getWalletBalances(): Promise<unknown> {
    return this.call('wallet_balances', (client) => client.get('/wallet-balances'));
  }

  /** Clés publiques servant à vérifier la signature des callbacks. */
  async getPublicKeys(): Promise<unknown> {
    return this.call('public_keys', (client) => client.get('/public-keys'));
  }
}

export const pawapayClient = new PawapayClient();
export default pawapayClient;

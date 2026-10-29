/**
 * L'API IDEM, vue d'iDomain.
 *
 * iDomain n'a ni écran de connexion ni portefeuille à lui :
 *   - IDENTITÉ   le cookie httpOnly `session` posé par l'API IDEM sur `.idem.africa`, vérifié par
 *                `GET /auth/profile` — le mécanisme de tout le monorepo (iDeploy, iVision, AppGen) ;
 *   - PORTEFEUILLE la passerelle `/internal/idomain/*` (clé `IDOMAIN_SERVICE_KEY`) : débit et
 *                restitution en francs, aux règles d'IDEM (402 avec les offres de recharge si le
 *                solde manque). Chaque mouvement porte une RÉFÉRENCE : IDEM ne débite ni ne
 *                rembourse jamais deux fois la même, ce qui rend les reprises sans danger.
 */
import axios, { AxiosError } from 'axios';
import { createHash } from 'crypto';
import { env } from '../config/env';
import logger from '../config/logger';
import { traceHeaders } from '../utils/trace.util';

export interface IdemProfile {
  uid: string;
  email: string;
  displayName?: string | null;
  isSuperUser?: boolean;
}

// ─── Identité ───────────────────────────────────────────────────────────────

/** Une session vérifiée est crue 20 s : une page qui lance dix appels n'en coûte qu'un à IDEM. */
const SESSION_TTL_MS = 20_000;
const sessionCache = new Map<string, { profile: IdemProfile; at: number }>();
const inFlight = new Map<string, Promise<IdemProfile | null>>();

/**
 * Vérifie un cookie `session` auprès d'IDEM. `userAgent` est celui du
 * navigateur : IDEM lie chaque session à son appareil et refuserait la
 * requête s'il voyait le User-Agent de ce serveur.
 */
export async function verifySession(sessionCookie: string, userAgent = ''): Promise<IdemProfile | null> {
  // Le cookie est un secret : seule son empreinte sert de clé. Le User-Agent en
  // fait partie : le même cookie présenté par un autre appareil est revérifié.
  const key = createHash('sha256').update(`${sessionCookie}|${userAgent}`).digest('hex');
  const hit = sessionCache.get(key);
  if (hit && Date.now() - hit.at < SESSION_TTL_MS) return hit.profile;
  const pending = inFlight.get(key);
  if (pending) return pending;
  const job = (async () => {
    try {
      const res = await axios.get(`${env.idemApiUrl}/auth/profile`, {
        headers: { Cookie: `session=${sessionCookie}`, 'X-Idem-Client-User-Agent': userAgent, ...traceHeaders() },
        timeout: 8000,
        validateStatus: (s) => s < 500,
      });
      if (res.status !== 200) return null;
      const body = res.data?.user || res.data;
      if (!body?.uid) return null;
      const profile: IdemProfile = { uid: String(body.uid), email: body.email, displayName: body.displayName, isSuperUser: body.isSuperUser === true };
      sessionCache.set(key, { profile, at: Date.now() });
      if (sessionCache.size > 5000) sessionCache.clear();
      return profile;
    } finally {
      inFlight.delete(key);
    }
  })();
  inFlight.set(key, job);
  return job;
}

// ─── Passerelle ─────────────────────────────────────────────────────────────

export class IdemGatewayError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'IdemGatewayError';
  }
}

async function call<T>(method: 'get' | 'post', path: string, data?: unknown, timeoutMs = 20_000): Promise<T> {
  try {
    const res = await axios.request<T>({
      method,
      url: `${env.idemApiUrl}/internal/idomain${path}`,
      data,
      timeout: timeoutMs,
      headers: { 'x-idomain-key': env.serviceKey, ...traceHeaders() },
    });
    return res.data;
  } catch (error) {
    const e = error as AxiosError<Record<string, unknown>>;
    const status = e.response?.status || 503;
    if (status >= 500) logger.error('idem.gateway_failed', { event: 'idem.gateway_failed', path, status, error: e });
    throw new IdemGatewayError(String(e.response?.data?.message || e.message), status, e.response?.data);
  }
}

export interface ChargeResult {
  charged: boolean;
  chargedXaf: number;
  balanceXaf: number;
  ledgerEntryId?: string;
  /** La même référence avait déjà été débitée : rien de nouveau n'a été pris. */
  replayed?: boolean;
}

export const idem = {
  billing: {
    /** Débit en francs. 402 (`IdemGatewayError`) si le solde manque : le corps porte les offres. */
    charge: (p: { userId: string; reference: string; amountXaf: number; label: string; action: 'domain_register' | 'domain_renew' | 'domain_transfer' }) =>
      call<ChargeResult>('post', '/billing/charge', p),
    /** Restitue tout ou partie d'un débit : une fois par référence de restitution, jamais plus que le débit. */
    refund: (p: { userId: string; chargeReference: string; refundReference: string; amountXaf: number; note: string }) => call<{ ok: boolean; refunded: boolean; balanceXaf?: number }>('post', '/billing/refund', p),
    /** Le solde, et si l'utilisateur a droit aux domaines au coût (forfait Entreprise). */
    account: (userId: string) => call<{ walletXaf: number; atCost: boolean }>('get', `/billing/account?userId=${encodeURIComponent(userId)}`),
  },
};

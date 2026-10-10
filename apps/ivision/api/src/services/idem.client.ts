/**
 * L'API IDEM, vue d'iVision.
 *
 * iVision n'a ni système d'authentification, ni fournisseurs de modèles, ni facturation à lui :
 *   - IDENTITÉ  le cookie httpOnly `session` d'IDEM (domaine `.idem.africa`) est vérifié par
 *               `GET /auth/profile`, exactement comme le fait iDeploy ;
 *   - PASSERELLE `/internal/ivision/*` (clé de service `IVISION_SERVICE_KEY`) : les appels de
 *               modèles (même runtime d'agents, mêmes étages, même suivi d'usage), les crédits
 *               (même portefeuille, mêmes prix) et les marques des projets IDEM de l'utilisateur.
 */
import axios, { AxiosError } from 'axios';
import { createHash } from 'crypto';
import { env } from '../config/env';
import logger from '../config/logger';
import { getTraceContext, traceHeaders } from '../utils/trace.util';

export interface IdemProfile {
  uid: string;
  email: string;
  displayName?: string | null;
  photoURL?: string | null;
  isSuperUser?: boolean;
}

// ─── Identité ───────────────────────────────────────────────────────────────

/** Une session vérifiée est crue 20 s : une page qui lance dix appels n'en coûte qu'un à IDEM. */
const SESSION_TTL_MS = 20_000;
const sessionCache = new Map<string, { profile: IdemProfile; at: number }>();
const inFlight = new Map<string, Promise<IdemProfile | null>>();

export async function verifySession(sessionCookie: string): Promise<IdemProfile | null> {
  // Le cookie est un secret : seule son empreinte sert de clé.
  const key = createHash('sha256').update(sessionCookie).digest('hex');
  const hit = sessionCache.get(key);
  if (hit && Date.now() - hit.at < SESSION_TTL_MS) return hit.profile;
  const pending = inFlight.get(key);
  if (pending) return pending;
  const job = (async () => {
    try {
      const res = await axios.get(`${env.idemApiUrl}/auth/profile`, {
        headers: { Cookie: `session=${sessionCookie}`, ...traceHeaders() },
        timeout: 8000,
        validateStatus: (s) => s < 500,
      });
      if (res.status !== 200) return null;
      const body = res.data?.user || res.data;
      if (!body?.uid) return null;
      const profile: IdemProfile = { uid: body.uid, email: body.email, displayName: body.displayName, photoURL: body.photoURL, isSuperUser: body.isSuperUser };
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

// ─── Passerelle interne ─────────────────────────────────────────────────────

export class IdemGatewayError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: any
  ) {
    super(message);
  }
}

async function call<T>(method: 'get' | 'post', path: string, body?: unknown, timeoutMs = 120_000): Promise<T> {
  // L'appel est rattaché à l'utilisateur de la requête en cours (suivi d'usage et quotas d'IDEM),
  // même quand le moteur partagé appelle un modèle sans savoir pour qui.
  const traced = getTraceContext()?.userId;
  const data = body && typeof body === 'object' && !Array.isArray(body) && traced !== undefined && !(body as { userId?: string }).userId ? { ...body, userId: String(traced) } : body;
  try {
    const res = await axios.request<T>({
      method,
      url: `${env.idemApiUrl}/internal/ivision${path}`,
      data,
      timeout: timeoutMs,
      maxBodyLength: 40 * 1024 * 1024,
      maxContentLength: 40 * 1024 * 1024,
      headers: { 'x-ivision-key': env.serviceKey, ...traceHeaders() },
    });
    return res.data;
  } catch (error) {
    const e = error as AxiosError<any>;
    const status = e.response?.status || 503;
    if (status >= 500) logger.error('idem.gateway_failed', { event: 'idem.gateway_failed', path, status, error: e });
    throw new IdemGatewayError(e.response?.data?.message || e.message, status, e.response?.data);
  }
}

export type ModelTier = 'mechanical' | 'writing' | 'reasoning';

export const idem = {
  ai: {
    /** Copie et agents de la vidéo : l'étage que la jauge de créativité choisit. */
    text: (p: { userId: string; system: string; user: string; tier: ModelTier; kind?: 'copy' | 'agents' }) => call<{ text: string }>('post', '/ai/text', p).then((r) => r.text),
    /** Un agent créatif (codeur des plans Ultra, agents des visuels) : runtime d'agents d'IDEM. */
    agent: (p: { userId?: string; projectId?: string; element?: string; role: string; profile: string; system: string; user: string }) =>
      call<{ text: string }>('post', '/ai/agent', p, 180_000).then((r) => r.text),
    /** Une composition de visuel (prompt système + charge utile), au modèle de la fonction IDEM. */
    prompt: (p: { userId: string; feature: 'flyer' | 'imageBrief'; messages: { role: string; content: string }[] }) => call<{ text: string }>('post', '/ai/prompt', p, 180_000).then((r) => r.text),
    vision: (p: { userId?: string; base64: string; mimeType: string; instruction: string; options?: { maxOutputTokens?: number; temperature?: number; purpose?: string } }) =>
      call<{ text: string }>('post', '/ai/vision', p).then((r) => r.text),
    image: (p: { userId?: string; prompt: string; size?: string; tag: string; purpose?: string; model?: string; fallbackModel?: string }) => call<{ base64: string; mimeType: string; model: string }>('post', '/ai/image', p, 180_000),
    /** Un clip de plan (CogVideoX-3) : la tâche du modèle peut durer plusieurs minutes. */
    video: (p: { userId?: string; prompt: string; image?: { base64: string; mimeType: string }; size: string; durationSec: 5 | 10; quality: 'speed' | 'quality'; tag: string }) =>
      call<{ url: string; model: string }>('post', '/ai/video', p, 420_000),
    /** Une ligne de voix off (GLM-TTS, repli Gemini TTS). Une langue refusée lève `voice_language_unsupported`. */
    speech: (p: { userId?: string; text: string; language: string; provider: 'glm' | 'gemini'; voice: string; style?: string; tag: string }) =>
      call<{ base64: string; mimeType: string; provider: 'glm' | 'gemini'; model: string; voice: string }>('post', '/ai/speech', p, 90_000),
  },
  billing: {
    /** Débite (mêmes règles que les routes d'IDEM : mode d'application, 402 si le solde manque). */
    charge: (p: { userId: string; action: string; cost: number; note?: string; element?: string; projectId?: string }) =>
      call<{ charged: boolean; cost: number; balance?: number; ledgerEntryId?: string; reason?: string }>('post', '/billing/charge', p),
    refund: (p: { userId: string; cost: number; action: string; note: string }) => call<{ ok: boolean }>('post', '/billing/refund', p),
    balance: (userId: string) => call<{ credits: number; plan?: string; status?: string }>('get', `/billing/balance?userId=${encodeURIComponent(userId)}`),
    /** Le barème d'IDEM (prix de référence de la vidéo, d'un visuel, d'une révision). */
    prices: () => call<{ motion_video: number; revision: number; flyer: number; ai_visual: number; creativity: Record<string, number> }>('get', '/billing/prices', undefined, 10_000),
  },
  projects: {
    list: (userId: string) => call<{ projects: { id: string; name: string; hasBrand: boolean; primary?: string; updatedAt?: string }[] }>('get', `/projects?userId=${encodeURIComponent(userId)}`),
    /** La charte d'un projet IDEM de l'utilisateur, au format du moteur partagé (BrandKit). */
    brand: (userId: string, projectId: string) => call<{ name: string; branding: any; voice: any; photos: string[] }>('get', `/projects/${encodeURIComponent(projectId)}/brand?userId=${encodeURIComponent(userId)}`),
  },
};

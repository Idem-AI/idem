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

/** L'avancement d'un import de site dans IDEM. */
export interface SiteImportJobView {
  jobId: string;
  status: 'running' | 'done' | 'failed';
  step: string;
  result?: { projectId: string; reused: boolean; name: string; siteUrl: string; images: string[]; logo: boolean; fonts: { display: string; body: string; copied: string[] }; warnings: string[] };
  error?: { code: string; message: string };
}

export const idem = {
  ai: {
    /** Copie et agents de la vidéo : l'étage que la jauge de créativité choisit. */
    text: (p: { userId: string; system: string; user: string; tier: ModelTier; kind?: 'copy' | 'agents' }) => call<{ text: string }>('post', '/ai/text', p).then((r) => r.text),
    /** Un agent créatif (codeur des plans Ultra, agents des visuels) : runtime d'agents d'IDEM. */
    agent: (p: { userId?: string; projectId?: string; element?: string; role: string; profile: string; system: string; user: string; level?: string; options?: { temperature?: number; seed?: number; reasoning?: boolean; schema?: { name: string; schema: Record<string, unknown> } } }) =>
      call<{ text: string }>('post', '/ai/agent', p, 180_000).then((r) => r.text),
    /** Une composition de visuel (prompt système + charge utile), au modèle de la fonction IDEM. */
    prompt: (p: { userId: string; feature: 'flyer' | 'imageBrief'; messages: { role: string; content: string }[] }) => call<{ text: string }>('post', '/ai/prompt', p, 180_000).then((r) => r.text),
    vision: (p: { userId?: string; base64: string; mimeType: string; instruction: string; options?: { maxOutputTokens?: number; temperature?: number; purpose?: string } }) =>
      call<{ text: string }>('post', '/ai/vision', p).then((r) => r.text),
    image: (p: { userId?: string; prompt: string; size?: string; tag: string; purpose?: string; model?: string; fallbackModel?: string }) => call<{ base64: string; mimeType: string; model: string }>('post', '/ai/image', p, 180_000),
    /** Un clip de plan (Veo / Seedance) : la tâche du modèle peut durer plusieurs minutes. */
    video: (p: { userId?: string; prompt: string; image?: { base64: string; mimeType: string }; size: string; durationSec: 4 | 6 | 8; quality: 'speed' | 'quality'; tag: string; model?: string }) =>
      call<{ url: string; model: string }>('post', '/ai/video', p, 420_000),
    /** Une ligne de voix off (Kokoro, ou le serveur de l'exploitant). Une langue refusée lève `voice_language_unsupported`. */
    speech: (p: { userId?: string; text: string; language: string; style?: string; persona?: string; gender?: 'female' | 'male'; tag: string }) =>
      call<{ base64: string; mimeType: string; provider: 'openrouter'; model: string; voice: string }>('post', '/ai/speech', p, 90_000),
  },
  billing: {
    /** Débite (mêmes règles que les routes d'IDEM : mode d'application, 402 si le solde manque). */
    charge: (p: { userId: string; action: string; cost: number; note?: string; element?: string; projectId?: string; quantity?: number }) =>
      call<{ charged: boolean; cost: number; balance?: number; ledgerEntryId?: string; reason?: string; quotaReserved?: boolean }>('post', '/billing/charge', p),
    /** Restitue les crédits (`cost` > 0) et, avec `releaseQuota`, la place prise dans le quota d'usage. */
    refund: (p: { userId: string; cost: number; action: string; note: string; releaseQuota?: boolean }) => call<{ ok: boolean }>('post', '/billing/refund', p),
    /** Le portefeuille IDEM de l'utilisateur, en francs, et son forfait Créateur. */
    balance: (userId: string) => call<{ credits: number; walletXaf?: number; createur?: boolean; plan?: string | null; status?: string }>('get', `/billing/balance?userId=${encodeURIComponent(userId)}`),
    /** Les prix d'IDEM, en francs (vidéo de référence, export d'un visuel, plan filmé par l'IA…). */
    prices: () =>
      call<{ motion_video: number; revision: number; flyer: number; ai_visual: number; export_visual?: number; export_video?: number; ai_clip?: number; charter?: number; createur?: { monthlyXaf: number; annualXaf: number }; creativity: Record<string, number> }>(
        'get',
        '/billing/prices',
        undefined,
        10_000
      ),
  },
  /**
   * La boucle IDEM : ce qu'iVision voit faire rejoint celle d'IDEM, qui rend l'étape suivante à proposer (le site,
   * la charte…). Une panne ne bloque jamais une création : l'appelant ignore l'erreur.
   */
  journey: {
    record: (p: { userId: string; type: string; projectId: string; place?: string }) =>
      call<{ recommendations: JourneyNext[] }>('post', '/journey/events', p, 8_000),
    next: (userId: string, projectId: string, place?: string) =>
      call<{ recommendations: JourneyNext[] }>('get', `/journey/next?userId=${encodeURIComponent(userId)}&projectId=${encodeURIComponent(projectId)}${place ? `&place=${encodeURIComponent(place)}` : ''}`, undefined, 8_000),
    feedback: (p: { userId: string; id: string; action: 'shown' | 'clicked' | 'dismissed' }) => call<void>('post', '/journey/feedback', p, 8_000),
  },
  projects: {
    list: (userId: string) => call<{ projects: { id: string; name: string; hasBrand: boolean; primary?: string; updatedAt?: string }[] }>('get', `/projects?userId=${encodeURIComponent(userId)}`),
    /** La charte d'un projet IDEM de l'utilisateur, au format du moteur partagé (BrandKit). */
    brand: (userId: string, projectId: string) => call<{ name: string; branding: any; voice: any; photos: string[] }>('get', `/projects/${encodeURIComponent(projectId)}/brand?userId=${encodeURIComponent(userId)}`),
    /** Un projet IDEM complet depuis un site (projet, logo et déclinaisons, palettes, polices, direction, motifs) : tâche de fond. */
    fromSite: (userId: string, url: string, consent?: UserConsent) =>
      call<{ jobId: string; status: string; step: string }>('post', '/projects/from-site', { userId, url, ...(consent ? { consent: consentBody(consent) } : {}) }, 20_000),
    /** L'accord des politiques enregistré sur un projet déjà créé. */
    consent: (userId: string, projectId: string, consent: UserConsent) =>
      call<{ accepted: boolean }>('post', `/projects/${encodeURIComponent(projectId)}/consent`, { userId, consent: consentBody(consent) }, 15_000),
    fromSiteJob: (userId: string, jobId: string) => call<SiteImportJobView>('get', `/projects/from-site/${encodeURIComponent(jobId)}?userId=${encodeURIComponent(userId)}`, undefined, 15_000),
    /** Les pages de la charte d'un projet (HTML des sections), telles qu'IDEM les affiche. */
    branding: (userId: string, projectId: string) =>
      call<CharterPages>('get', `/projects/${encodeURIComponent(projectId)}/branding?userId=${encodeURIComponent(userId)}`, undefined, 30_000),
    generateCharter,
  },
};

/**
 * L'accord donné dans iVision : politique de confidentialité, conditions d'utilisation et conditions du
 * programme bêta d'IDEM, cochés par l'utilisateur ; l'adresse IP et le navigateur font la même trace qu'IDEM.
 */
export interface UserConsent {
  ipAddress?: string;
  userAgent?: string;
}

const consentBody = (c: UserConsent) => ({ privacy: true, terms: true, beta: true, ...(c.ipAddress ? { ipAddress: c.ipAddress } : {}), ...(c.userAgent ? { userAgent: c.userAgent.slice(0, 400) } : {}) });

/** Une recommandation de la boucle IDEM (forme de `@idem/shared-journey`). */
export interface JourneyNext {
  id: string;
  destination: string;
  projectId?: string;
  because?: string;
  score: number;
}

export interface CharterPages {
  name: string;
  /** Les politiques acceptées pour ce projet (sinon IDEM refuse ses générations). */
  policiesAccepted?: boolean;
  pdfFormat: string;
  fonts: { primaryFont?: string; secondaryFont?: string; fontUrl?: string };
  sections: { id: string; name: string; type: string; html: string }[];
}

/** Une étape du flux de génération de la charte (IDEM : `generateBrandingStreamingController`). */
export interface CharterStreamEvent {
  type?: string;
  stepName?: string;
  error?: string;
}

/**
 * Lance la génération de la charte d'un projet dans IDEM et suit son flux. La promesse rendue se résout
 * dès que la génération est ACCEPTÉE (débit et contrôles passés) : un refus (402 portefeuille, 429 quota,
 * 404 projet) est levé là, avant tout travail. `done` se résout à la fin du flux.
 */
async function generateCharter(
  userId: string,
  projectId: string,
  creativity: string,
  onEvent: (event: CharterStreamEvent) => void
): Promise<{ done: Promise<void> }> {
  let res;
  try {
    res = await axios.request({
      method: 'post',
      url: `${env.idemApiUrl}/internal/ivision/projects/${encodeURIComponent(projectId)}/branding/generate`,
      data: { userId, creativity },
      responseType: 'stream',
      // La génération d'une charte complète peut prendre plusieurs minutes.
      timeout: 0,
      headers: { 'x-ivision-key': env.serviceKey, Accept: 'text/event-stream', ...traceHeaders() },
    });
  } catch (error) {
    const e = error as AxiosError<NodeJS.ReadableStream>;
    const status = e.response?.status || 503;
    const body = e.response?.data ? await readJson(e.response.data) : undefined;
    if (status >= 500) logger.error('idem.charter_failed', { event: 'idem.charter_failed', projectId, status, error: e });
    throw new IdemGatewayError((body as { message?: string } | undefined)?.message || e.message, status, body);
  }
  const stream = res.data as NodeJS.ReadableStream;
  const done = new Promise<void>((resolve, reject) => {
    let buffer = '';
    let failed: string | null = null;
    stream.on('data', (chunk: Buffer) => {
      buffer += chunk.toString('utf8');
      let cut: number;
      while ((cut = buffer.indexOf('\n\n')) >= 0) {
        const block = buffer.slice(0, cut);
        buffer = buffer.slice(cut + 2);
        const data = block
          .split('\n')
          .filter((l) => l.startsWith('data:'))
          .map((l) => l.slice(5).trim())
          .join('');
        if (!data) continue;
        try {
          const event = JSON.parse(data) as CharterStreamEvent;
          if (event.error) failed = String(event.error).slice(0, 200);
          onEvent(event);
        } catch {
          /* une ligne illisible n'arrête pas le suivi */
        }
      }
    });
    stream.on('end', () => (failed ? reject(new Error(failed)) : resolve()));
    stream.on('error', reject);
  });
  return { done };
}

/** Le corps JSON d'un refus reçu en flux (`responseType: 'stream'`). */
async function readJson(stream: NodeJS.ReadableStream): Promise<unknown> {
  try {
    let text = '';
    for await (const chunk of stream as AsyncIterable<Buffer>) text += chunk.toString('utf8');
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * OÙ PARTENT LES GÉNÉRATIONS : OpenRouter, ou nos machines (idem-ml).
 *
 * Une seule variable configure tout :
 *
 *   IDEM_AI_BACKEND=openrouter          (défaut) tout part chez OpenRouter ;
 *   IDEM_AI_BACKEND=idem-ml             tout part sur la passerelle idem-ml ;
 *   IDEM_AI_BACKEND=image:idem-ml,logo:idem-ml,text:openrouter
 *                                       mixte : une valeur par sorte, séparées par des virgules.
 *
 * Sortes disponibles : text, image, video, logo.
 * `speech` (voix ElevenLabs) et `search` (plugin web OpenRouter) restent TOUJOURS chez OpenRouter.
 *
 * La passerelle idem-ml (`idem-ml/services/gateway`) parle le protocole OpenRouter pour text/image/video
 * et ajoute des routes spécialisées pour logo (/v1/text-to-svg, /v1/image-to-svg).
 * Mêmes identifiants de modèles, mêmes prix, même clé : IDEM_ML_URL + IDEM_ML_API_KEY.
 *
 * Réglage à chaud, sans redéploiement : `npm run ai:models -- --backend image:idem-ml,logo:idem-ml`
 * (document `platform_settings/ai`, relu toutes les 15 s).
 *
 * Repli : sur panne, surcharge ou modèle absent chez nous, l'appel repart chez OpenRouter
 * (`IDEM_AI_FALLBACK=off` pour l'interdire). La passerelle est mise de côté `IDEM_ML_RETRY_AFTER_MS`
 * (30 s) après chaque panne.
 */
import { getAiRuntime } from './ai-runtime.config';
import { getOpenRouterApiKey, OPENROUTER_BASE_URL, openRouterHeaders, openRouterRouting } from './openrouter.config';
import type { ModelProcessor } from '../services/privacy/privacy-guard';
import logger from './logger';

export type AiBackend = 'openrouter' | 'idem-ml';
/** Ce qu'un appel produit. `speech` et `search` ne quittent jamais OpenRouter. */
export type AiKind = 'text' | 'image' | 'video' | 'logo' | 'speech' | 'search';
export const SELF_HOSTABLE_KINDS = ['text', 'image', 'video', 'logo'] as const;
export type SelfHostableKind = (typeof SELF_HOSTABLE_KINDS)[number];

const isSelfHostable = (kind: AiKind): kind is SelfHostableKind => (SELF_HOSTABLE_KINDS as readonly string[]).includes(kind);

/** « idem-ml », « idem_ml », « selfhosted » : nos machines ; « openrouter » : OpenRouter ; autre : ignoré. */
export function parseBackend(value: unknown): AiBackend | undefined {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw) return undefined;
  if (['idem-ml', 'idem_ml', 'idemml', 'selfhosted', 'self-hosted'].includes(raw)) return 'idem-ml';
  if (raw === 'openrouter') return 'openrouter';
  return undefined;
}

/**
 * Parse `IDEM_AI_BACKEND`.
 * - Valeur simple (`idem-ml` / `openrouter`) → s'applique à toutes les sortes.
 * - Liste `sorte:backend,...` (`image:idem-ml,logo:idem-ml`) → map par sorte ; les sortes absentes
 *   restent sur OpenRouter.
 * - `all:idem-ml` est équivalent à la valeur simple `idem-ml`.
 */
function parseEnvBackend(): AiBackend | Partial<Record<SelfHostableKind, AiBackend>> | undefined {
  const raw = (process.env.IDEM_AI_BACKEND ?? '').trim().toLowerCase();
  if (!raw) return undefined;
  if (!raw.includes(':')) return parseBackend(raw);

  const map: Partial<Record<SelfHostableKind, AiBackend>> = {};
  for (const part of raw.split(',')) {
    const sep = part.indexOf(':');
    if (sep < 0) continue;
    const kind = part.slice(0, sep).trim() as SelfHostableKind;
    const backend = parseBackend(part.slice(sep + 1).trim());
    if (!backend) continue;
    if (kind === ('all' as SelfHostableKind)) return backend; // `all:idem-ml` → valeur simple
    if ((SELF_HOSTABLE_KINDS as readonly string[]).includes(kind)) map[kind] = backend;
  }
  return Object.keys(map).length > 0 ? map : undefined;
}

/** L'adresse de la passerelle, normalisée en `…/v1`. */
export function idemMlBaseUrl(): string | undefined {
  const raw = process.env.IDEM_ML_URL?.trim().replace(/\/+$/, '');
  if (!raw) return undefined;
  return /\/v1$/.test(raw) ? raw : `${raw}/v1`;
}

/**
 * URL de base pour le client OmniSVG (logo) quand `logo=idem-ml`.
 * OmniSVG ajoute lui-même `/v1/text-to-svg` ou `/v1/image-to-svg` : on donne le préfixe sans `/v1`.
 */
export function idemMlOmnisvgBaseUrl(): string | undefined {
  const base = idemMlBaseUrl();
  return base ? base.replace(/\/v1$/, '') : undefined;
}

export function idemMlApiKey(): string | undefined {
  return process.env.IDEM_ML_API_KEY?.trim() || undefined;
}

export function isIdemMlConfigured(): boolean {
  return Boolean(idemMlBaseUrl() && idemMlApiKey());
}

const warned = new Set<string>();
function warnOnce(key: string, message: string): void {
  if (warned.has(key)) return;
  warned.add(key);
  logger.warn(message, { event: 'ai.backend_config' });
}

/** Le fournisseur VOULU pour une sorte : DB à chaud › IDEM_AI_BACKEND › OpenRouter. */
export function wantedBackend(kind: AiKind): AiBackend {
  if (!isSelfHostable(kind)) return 'openrouter';

  // 1. Réglage de la base (à chaud, via la DB)
  const dbBackend = parseBackend(getAiRuntime().backend?.[kind]);
  if (dbBackend) return dbBackend;

  // 2. Variable d'environnement (valeur simple ou map)
  const envParsed = parseEnvBackend();
  if (!envParsed) return 'openrouter';
  if (typeof envParsed === 'string') return envParsed;
  return envParsed[kind] ?? 'openrouter';
}

// ── Disjoncteur ─────────────────────────────────────────────────────────────

let idemMlDownUntil = 0;

function retryAfterMs(): number {
  const value = Number(process.env.IDEM_ML_RETRY_AFTER_MS);
  return Number.isFinite(value) && value >= 0 ? value : 30_000;
}

export function markIdemMlDown(reason: string): void {
  idemMlDownUntil = Date.now() + retryAfterMs();
  logger.warn('ai.backend_idem_ml_down', { event: 'ai.backend_idem_ml_down', reason, retryInMs: retryAfterMs() });
}

export function isIdemMlResting(): boolean {
  return Date.now() < idemMlDownUntil;
}

export function resetIdemMlBreaker(): void {
  idemMlDownUntil = 0;
}

export function openRouterFallbackAllowed(): boolean {
  const flag = (process.env.IDEM_AI_FALLBACK ?? 'openrouter').trim().toLowerCase();
  return flag !== 'off' && flag !== 'none' && Boolean(getOpenRouterApiKey());
}

/** Le fournisseur EFFECTIF : celui voulu, sauf passerelle non configurée ou au repos. */
export function aiBackend(kind: AiKind): AiBackend {
  const wanted = wantedBackend(kind);
  if (wanted === 'openrouter') return 'openrouter';
  if (!isIdemMlConfigured()) {
    warnOnce(`unconfigured:${kind}`, `[AI] IDEM_AI_BACKEND="${kind}:idem-ml" mais IDEM_ML_URL / IDEM_ML_API_KEY manquent — OpenRouter conservé`);
    return 'openrouter';
  }
  if (isIdemMlResting() && openRouterFallbackAllowed()) return 'openrouter';
  return 'idem-ml';
}

// ── Point d'accès OpenRouter-compatible (text / image / video) ───────────────

export interface AiEndpoint {
  backend: AiBackend;
  baseUrl: string;
  apiKeyEnv: 'OPENROUTER_API_KEY' | 'IDEM_ML_API_KEY';
  apiKey: string | undefined;
  headers: Record<string, string>;
  processor: ModelProcessor;
  routing: () => Record<string, unknown>;
}

export function openRouterEndpoint(): AiEndpoint {
  return {
    backend: 'openrouter',
    baseUrl: OPENROUTER_BASE_URL(),
    apiKeyEnv: 'OPENROUTER_API_KEY',
    apiKey: getOpenRouterApiKey(),
    headers: openRouterHeaders(),
    processor: 'openrouter',
    routing: openRouterRouting,
  };
}

export function idemMlEndpoint(): AiEndpoint {
  return {
    backend: 'idem-ml',
    baseUrl: idemMlBaseUrl() ?? '',
    apiKeyEnv: 'IDEM_ML_API_KEY',
    apiKey: idemMlApiKey(),
    headers: { 'X-Idem-Client': 'idem-api' },
    processor: 'idem_selfhosted',
    routing: () => ({}),
  };
}

export function aiEndpoint(kind: AiKind): AiEndpoint {
  return aiBackend(kind) === 'idem-ml' ? idemMlEndpoint() : openRouterEndpoint();
}

export function usageProviderLabel(backend: AiBackend): string {
  return backend === 'idem-ml' ? 'idem_ml' : 'openrouter';
}

export function isFallbackWorthy(status: number | undefined, networkError: boolean): boolean {
  if (networkError || !status) return true;
  return status === 404 || status === 408 || status === 429 || status >= 500;
}

/** Résumé lisible (contrôles, démarrage). */
export function describeAiBackends(): Record<SelfHostableKind, AiBackend> & { fallback: boolean; idemMl: string | undefined } {
  return {
    text: aiBackend('text'),
    image: aiBackend('image'),
    video: aiBackend('video'),
    logo: aiBackend('logo'),
    fallback: openRouterFallbackAllowed(),
    idemMl: idemMlBaseUrl(),
  };
}

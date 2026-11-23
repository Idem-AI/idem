/**
 * Le transport des appels de modèles : vers le fournisseur choisi (`config/ai-backend.config.ts`), et le REPLI
 * vers OpenRouter quand nos machines ne répondent pas.
 *
 * Deux formes, une règle :
 *   - `fallbackFetch`  le `fetch` du SDK `openai` (texte : complétion, outils, flux) quand le texte part sur idem-ml ;
 *   - `postToModel`    les médias (image, vision, vidéo), en axios.
 *
 * Le repli rejoue le MÊME corps chez OpenRouter, en y reposant la politique de transmission d'OpenRouter
 * (`guardModelRequest('openrouter', …)` : `data_collection: 'deny'`) et son routage d'hébergeurs : une donnée qui
 * devait rester chez nous ne part ailleurs que si le repli est permis (`IDEM_AI_FALLBACK`, défaut : oui).
 */
import axios, { AxiosRequestConfig } from 'axios';

import logger from '../config/logger';
import {
  AiEndpoint,
  AiKind,
  aiEndpoint,
  isFallbackWorthy,
  markIdemMlDown,
  openRouterEndpoint,
  openRouterFallbackAllowed,
} from '../config/ai-backend.config';
import { guardModelRequest } from './privacy/privacy-guard';

/** Les en-têtes d'authentification d'un point d'accès (throw si la clé manque). */
export function endpointHeaders(endpoint: AiEndpoint): Record<string, string> {
  if (!endpoint.apiKey) throw new Error(`${endpoint.apiKeyEnv} is not configured — ${endpoint.backend} calls are unavailable`);
  return { Authorization: `Bearer ${endpoint.apiKey}`, ...endpoint.headers };
}

/** Le corps final pour ce point d'accès : routage propre au fournisseur, puis le garde (en dernier). */
function bodyFor<T extends Record<string, any>>(endpoint: AiEndpoint, body: T): T {
  return guardModelRequest(endpoint.processor, { ...body, ...endpoint.routing() });
}

export interface ModelPostResult<T> {
  data: T;
  /** Le point d'accès qui a RÉPONDU (après un éventuel repli) : la suite de l'échange (vidéo) y reste. */
  endpoint: AiEndpoint;
}

/**
 * POST d'un appel de média vers le fournisseur de cette sorte d'appel, avec repli vers OpenRouter.
 * `path` commence par `/` (`/images`, `/videos`, `/chat/completions`).
 */
export async function postToModel<T>(
  kind: AiKind,
  path: string,
  body: Record<string, any>,
  options: Pick<AxiosRequestConfig, 'timeout'> & { tag?: string } = {}
): Promise<ModelPostResult<T>> {
  const primary = aiEndpoint(kind);
  const send = async (endpoint: AiEndpoint) => {
    const response = await axios.post<T>(`${endpoint.baseUrl}${path}`, bodyFor(endpoint, body), {
      headers: endpointHeaders(endpoint),
      timeout: options.timeout,
    });
    return { data: response.data, endpoint };
  };

  try {
    return await send(primary);
  } catch (error: any) {
    if (primary.backend !== 'idem-ml') throw error;
    const status: number | undefined = error?.response?.status;
    if (!isFallbackWorthy(status, !error?.response) || !openRouterFallbackAllowed()) throw error;
    markIdemMlDown(`${kind} ${path} → ${status ?? error?.code ?? 'network'}`);
    logger.warn('ai.backend_fallback', { event: 'ai.backend_fallback', kind, path, status, tag: options.tag });
    return send(openRouterEndpoint());
  }
}

/**
 * Le `fetch` du client `openai` quand le texte part sur idem-ml : essaie la passerelle, et sur panne, modèle non
 * servi ou surcharge, rejoue la requête chez OpenRouter (clé, en-têtes, routage et garde d'OpenRouter).
 *
 * Le repli n'a lieu qu'AVANT le premier octet de réponse : un flux commencé chez nous y reste.
 */
export function fallbackFetch(kind: AiKind = 'text'): typeof fetch {
  return async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    let failure: { status?: number; network: boolean; reason: string };
    try {
      const response = await fetch(input, init);
      if (response.ok || !isFallbackWorthy(response.status, false) || !openRouterFallbackAllowed()) return response;
      failure = { status: response.status, network: false, reason: `HTTP ${response.status}` };
      // La réponse refusée n'est pas lue : sa connexion est rendue tout de suite.
      void response.body?.cancel().catch(() => undefined);
    } catch (error: any) {
      // Annulation par l'appelant : ce n'est pas une panne de nos machines.
      if (error?.name === 'AbortError' || init?.signal?.aborted) throw error;
      failure = { network: true, reason: error?.cause?.code || error?.message || 'network' };
    }

    if (!openRouterFallbackAllowed()) {
      throw new Error(`idem-ml unreachable (${failure.reason}) and no OpenRouter fallback (IDEM_AI_FALLBACK=off or no key)`);
    }

    markIdemMlDown(`${kind} → ${failure.reason}`);
    const openrouter = openRouterEndpoint();
    const idemMlBase = url.replace(/\/(chat\/completions|completions|embeddings|models)(\?.*)?$/, '');
    const target = openrouter.baseUrl + url.slice(idemMlBase.length);

    let body = init?.body;
    if (typeof body === 'string') {
      try {
        body = JSON.stringify(bodyFor(openrouter, JSON.parse(body)));
      } catch {
        // Corps non JSON : relayé tel quel.
      }
    }
    const headers = new Headers(init?.headers);
    for (const [name, value] of Object.entries(endpointHeaders(openrouter))) headers.set(name, value);
    headers.delete('x-idem-client');
    // Le corps rejoué a grandi (routage et politique d'OpenRouter) : l'ancienne longueur ferait attendre le serveur.
    headers.delete('content-length');

    logger.warn('ai.backend_fallback', { event: 'ai.backend_fallback', kind, status: failure.status, reason: failure.reason });
    return fetch(target, { ...init, body, headers });
  };
}

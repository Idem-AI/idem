import logger from '../config/logger';
import { describeError } from './retry';

/**
 * Rend visible la VRAIE cause d'un `TypeError: fetch failed`.
 *
 * Le problème: `@google/genai` ré-emballe tout échec réseau en
 * `new Error(\`exception ${e} sending request\`)` (cf. `HttpClient.apiCall`).
 * L'interpolation ne garde que le message — `error.cause`, où Node range le
 * code système (`ECONNRESET`, `ENOTFOUND`, `UND_ERR_CONNECT_TIMEOUT`…), est
 * perdue avant même que l'erreur ne remonte. Les journaux répétaient donc
 * « fetch failed » sans jamais dire si c'était un DNS mort, une connexion
 * refusée ou un délai d'établissement dépassé — trois pannes aux remèdes
 * opposés.
 *
 * La sonde s'installe autour de `globalThis.fetch`, en amont du SDK: elle
 * OBSERVE l'échec pendant que la cause existe encore, la journalise, puis
 * relaie l'erreur d'origine telle quelle. Aucun comportement n'est modifié —
 * ni la valeur renvoyée, ni l'erreur propagée, ni le nombre d'appels.
 *
 * Portée volontairement étroite: seules les requêtes vers `googleapis.com`
 * sont commentées, pour ne pas bavarder sur tout le trafic du processus.
 * `IDEM_DISABLE_FETCH_DIAGNOSTICS=true` la désactive.
 */

const INSTALLED_FLAG = Symbol.for('idem.fetchDiagnosticsInstalled');
const WATCHED_HOSTS = ['googleapis.com'];

function urlOf(input: unknown): string {
  try {
    if (typeof input === 'string') return input;
    if (input instanceof URL) return input.href;
    if (input && typeof (input as Request).url === 'string') return (input as Request).url;
  } catch {
    /* une URL illisible ne doit jamais empêcher la requête */
  }
  return '';
}

export function installFetchDiagnostics(): void {
  const globalScope = globalThis as any;

  if (globalScope[INSTALLED_FLAG]) return;
  if (process.env.IDEM_DISABLE_FETCH_DIAGNOSTICS === 'true') return;
  if (typeof globalScope.fetch !== 'function') return;

  const originalFetch: typeof fetch = globalScope.fetch.bind(globalScope);

  globalScope.fetch = async function instrumentedFetch(input: any, init?: any) {
    try {
      return await originalFetch(input, init);
    } catch (error) {
      try {
        const url = urlOf(input);
        if (WATCHED_HOSTS.some((host) => url.includes(host))) {
          // `describeError` déroule la chaîne `cause` : c'est le seul endroit du
          // parcours où elle est encore intacte.
          logger.warn(
            `[fetch] échec réseau vers ${new URL(url).host} — ${describeError(error)}`
          );
        }
      } catch {
        /* la sonde ne doit jamais transformer une panne réseau en crash */
      }
      throw error;
    }
  };

  globalScope[INSTALLED_FLAG] = true;
  logger.info('Sonde réseau installée : la cause réelle des « fetch failed » sera journalisée.');
}

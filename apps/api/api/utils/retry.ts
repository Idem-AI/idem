import logger from '../config/logger';

/**
 * Réessai avec attente exponentielle, réservé aux pannes RÉSEAU.
 *
 * Le contexte: les appels Gemini échouent parfois sur `TypeError: fetch failed`
 * — la connexion TCP/TLS vers `aiplatform.googleapis.com` ne s'établit pas dans
 * les 10 s que undici accorde par défaut. C'est une panne strictement
 * temporelle: le même appel rejoué quelques secondes plus tard passe. Sans
 * réessai côté serveur, l'utilisateur voyait une génération échouer et devait
 * cliquer « réessayer » lui-même.
 *
 * ⚠️ Ce module ne rejoue QUE le transitoire réseau. Deux familles d'erreurs en
 * sont volontairement exclues:
 *  - 429 / 503 « high demand »: Google sature PAR MODÈLE. Rejouer le même
 *    modèle ne sert à rien, il faut BASCULER — c'est le travail de la chaîne de
 *    repli (`fallbackModels`), pas celui-ci.
 *  - 400 / 401 / 403 / 404 et les erreurs de contenu (réponse vide, JSON
 *    illisible): déterministes. Les rejouer ne fait que multiplier la facture
 *    et le temps d'attente avant l'échec.
 */

/** Nombre de tentatives par défaut (1 essai + 2 réessais). */
const DEFAULT_ATTEMPTS = 3;
/** Attente avant le 1er réessai. Double à chaque tour: 1 s → 2 s → 4 s. */
const DEFAULT_BASE_DELAY_MS = 1000;
/** Plafond de l'attente: au-delà, l'utilisateur croit à un blocage. */
const DEFAULT_MAX_DELAY_MS = 8000;
/** Dispersion aléatoire ±30%, pour ne pas resynchroniser les appels parallèles. */
const DEFAULT_JITTER_RATIO = 0.3;

export interface RetryOptions {
  /** Nombre TOTAL de tentatives, réessais compris. */
  attempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitterRatio?: number;
  /** Étiquette affichée dans les logs (ex: `GEMINI/gemini-2.5-flash`). */
  label?: string;
  /** Prédicat de réessai. Par défaut: uniquement le transitoire réseau. */
  isRetryable?: (error: unknown) => boolean;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Déroule la chaîne `cause` d'une erreur.
 *
 * `fetch()` de Node emballe la vraie raison (`ECONNRESET`, `ENOTFOUND`,
 * `UND_ERR_CONNECT_TIMEOUT`…) dans `error.cause`, parfois sur deux niveaux. Un
 * log qui n'affiche que `error.message` dit donc « fetch failed » et rien de
 * plus — impossible de distinguer un DNS mort d'un pare-feu ou d'une coupure.
 */
export function describeError(error: unknown): string {
  const parts: string[] = [];
  let current: any = error;
  let depth = 0;

  while (current && depth < 5) {
    const code = current.code ?? current.errno;
    const status = current.status ?? current.statusCode;
    const detail = [
      current.name && current.name !== 'Error' ? current.name : undefined,
      current.message || String(current),
      code ? `code=${code}` : undefined,
      status ? `status=${status}` : undefined,
      current.syscall ? `syscall=${current.syscall}` : undefined,
      current.hostname ? `host=${current.hostname}` : undefined,
    ]
      .filter(Boolean)
      .join(' ');

    if (detail && !parts.includes(detail)) {
      parts.push(detail);
    }

    current = current.cause;
    depth += 1;
  }

  return parts.length > 0 ? parts.join(' ← ') : String(error);
}

/**
 * L'erreur est-elle une panne réseau transitoire ?
 *
 * On inspecte la chaîne `cause` ET le message, parce que le SDK `@google/genai`
 * ré-emballe l'échec en `new Error(\`exception ${e} sending request\`)`: le code
 * système est alors perdu et seule la sous-chaîne « fetch failed » subsiste.
 */
export function isTransientNetworkError(error: any): boolean {
  if (!error) return false;

  const codes = new Set<string>();
  let current: any = error;
  let depth = 0;
  let text = '';

  while (current && depth < 5) {
    if (current.code) codes.add(String(current.code).toUpperCase());
    if (current.errno) codes.add(String(current.errno).toUpperCase());
    text += ` ${current.message || String(current)}`;
    current = current.cause;
    depth += 1;
  }

  const NETWORK_CODES = [
    'ECONNRESET',
    'ECONNREFUSED',
    'ECONNABORTED',
    'EPIPE',
    'ETIMEDOUT',
    'ENOTFOUND',
    'EAI_AGAIN',
    'EHOSTUNREACH',
    'ENETUNREACH',
    'ENETDOWN',
    'EPROTO',
    'UND_ERR_CONNECT_TIMEOUT',
    'UND_ERR_HEADERS_TIMEOUT',
    'UND_ERR_BODY_TIMEOUT',
    'UND_ERR_SOCKET',
    'UND_ERR_RESPONSE_STATUS_CODE',
  ];
  if (NETWORK_CODES.some((code) => codes.has(code))) return true;

  const NETWORK_PATTERNS = [
    'fetch failed',
    'socket hang up',
    'network error',
    'other side closed',
    'client network socket disconnected',
    'terminated',
    'connect timeout',
    'request timed out',
    'read econnreset',
  ];
  const haystack = text.toLowerCase();
  return NETWORK_PATTERNS.some((pattern) => haystack.includes(pattern));
}

/**
 * Exécute `fn`, en la rejouant tant que l'échec est un transitoire réseau.
 *
 * L'erreur finalement propagée est celle de la DERNIÈRE tentative: l'appelant
 * (chaîne de repli, contrôleur) continue de la traiter comme avant.
 */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const {
    attempts = DEFAULT_ATTEMPTS,
    baseDelayMs = DEFAULT_BASE_DELAY_MS,
    maxDelayMs = DEFAULT_MAX_DELAY_MS,
    jitterRatio = DEFAULT_JITTER_RATIO,
    label = 'appel',
    isRetryable = isTransientNetworkError,
  } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      const isLast = attempt >= attempts;
      if (isLast || !isRetryable(error)) {
        // Une erreur non rejouable au 1er coup n'est pas un incident de ce
        // module: on la laisse remonter sans bruit supplémentaire.
        if (isLast && attempt > 1) {
          logger.error(
            `[retry] ${label} — échec après ${attempts} tentatives: ${describeError(error)}`
          );
        }
        throw error;
      }

      const delay = nextDelay(attempt, baseDelayMs, maxDelayMs, jitterRatio);
      logger.warn(
        `[retry] ${label} — tentative ${attempt}/${attempts} échouée (${describeError(error)}). ` +
          `Nouvel essai dans ${delay} ms.`
      );
      await sleep(delay);
    }
  }

  throw lastError;
}

/** Attente exponentielle plafonnée, dispersée par un jitter multiplicatif. */
function nextDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
  jitterRatio: number
): number {
  const exponential = Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs);
  const jitter = 1 + (Math.random() * 2 - 1) * jitterRatio;
  return Math.max(0, Math.round(exponential * jitter));
}

/**
 * L'erreur est-elle une SATURATION DE QUOTA (429, « rate limit », « quota ») ?
 *
 * À distinguer soigneusement d'une saturation de capacité (503 « high demand »),
 * que la chaîne de repli traite en changeant de modèle.
 *
 * Sur une offre payante, le quota est par modèle : basculer suffit. Sur une
 * offre GRATUITE, il est partagé par le projet entier — basculer ne fait
 * qu'épuiser la chaîne plus vite, et la génération échoue alors qu'une attente
 * de quelques secondes l'aurait sauvée. C'est le cas observé : un business plan
 * s'arrêtait à sa troisième section, les six suivantes tombant l'une après
 * l'autre sur le même mur.
 */
export function isRateLimited(error: any): boolean {
  let current: any = error;
  let depth = 0;
  let text = '';

  while (current && depth < 5) {
    const status = current.status ?? current.statusCode ?? current.code;
    if (status === 429 || String(status) === '429') return true;
    text += ` ${current.message || String(current)}`;
    current = current.cause;
    depth += 1;
  }

  return /\b429\b|rate.?limit|quota.?exceeded|resource.?exhausted|too many requests/i.test(text);
}

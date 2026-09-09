import logger from '../config/logger';

/**
 * Robust parsing of JSON emitted by LLMs.
 *
 * Models frequently return JSON that a strict `JSON.parse` rejects:
 *  - wrapped in ```json … ``` fences or surrounded by prose,
 *  - containing raw control characters (newlines/tabs) INSIDE string values —
 *    the classic "Unterminated string in JSON" when an SVG or a long text is
 *    embedded as a string (e.g. a long brand name wrapped onto several lines),
 *  - trailing commas before a closing brace/bracket.
 *
 * These helpers strip the noise and repair the common breakages, then parse.
 */

/** Removes a surrounding ```json … ``` / ``` … ``` fence and trims prose. */
export function stripCodeFences(text: string): string {
  const t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return fence ? fence[1].trim() : t;
}

/** Extracts the outermost `{ … }` (or `[ … ]`) block from text. */
export function extractJsonBlock(text: string): string {
  const firstObj = text.indexOf('{');
  const firstArr = text.indexOf('[');
  if (firstObj === -1 && firstArr === -1) return text;

  let start: number;
  let close: string;
  if (firstArr !== -1 && (firstObj === -1 || firstArr < firstObj)) {
    start = firstArr;
    close = ']';
  } else {
    start = firstObj;
    close = '}';
  }

  const end = text.lastIndexOf(close);
  return start !== -1 && end > start ? text.slice(start, end + 1) : text;
}

/**
 * Escapes raw control characters that appear INSIDE JSON string literals
 * (newlines/tabs/etc.) — the usual cause of "Unterminated string in JSON".
 * Walks the text with a tiny state machine so structural whitespace between
 * tokens is left untouched.
 */
export function escapeControlCharsInStrings(json: string): string {
  let out = '';
  let inString = false;
  let escaped = false;

  for (let i = 0; i < json.length; i++) {
    const ch = json[i];

    if (escaped) {
      out += ch;
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      out += ch;
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      out += ch;
      continue;
    }

    if (inString) {
      if (ch === '\n') {
        out += '\\n';
        continue;
      }
      if (ch === '\r') {
        out += '\\r';
        continue;
      }
      if (ch === '\t') {
        out += '\\t';
        continue;
      }
      const code = ch.charCodeAt(0);
      if (code < 0x20) {
        out += '\\u' + code.toString(16).padStart(4, '0');
        continue;
      }
    }

    out += ch;
  }

  return out;
}

/** Removes trailing commas immediately before a `}` or `]`. */
export function removeTrailingCommas(json: string): string {
  return json.replace(/,(\s*[}\]])/g, '$1');
}

/**
 * Referme un JSON TRONQUÉ en coupant au dernier élément complet.
 *
 * ── POURQUOI ────────────────────────────────────────────────────────────────
 *
 * Une réponse coupée par `maxOutputTokens` s'arrête au milieu d'un mot. Aucune
 * des réparations ci-dessus ne la rattrape : il manque des guillemets et des
 * accolades, pas une virgule. Le contenu est alors perdu EN ENTIER — alors que
 * les neuf dixièmes en étaient valides et déjà payés.
 *
 * Observé en production sur une section de business plan : deux tableaux, trois
 * fiches et un graphique complets, perdus parce que le dernier libellé était
 * coupé en deux.
 *
 * ── COMMENT ─────────────────────────────────────────────────────────────────
 *
 * On parcourt la chaîne en suivant l'état (dans une chaîne ? échappement ?) et
 * la pile de délimiteurs ouverts. À chaque FRONTIÈRE SÛRE — une virgule hors
 * chaîne, ou un `}`/`]` qui vient de se refermer — on mémorise la position et
 * l'état de la pile. À la fin, on revient à la dernière frontière et on referme
 * ce qui reste ouvert.
 *
 * Couper à une frontière plutôt qu'à la fin est le point : on jette l'élément
 * partiel au lieu de tenter de le compléter. Un bloc à moitié écrit refermé de
 * force produirait une carte au titre tronqué et au corps vide — un défaut
 * visible, là où l'omettre ne se voit pas.
 */
export function closeTruncatedJson(json: string): string | null {
  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  let safePos = -1;
  let safeStack: string[] = [];

  for (let i = 0; i < json.length; i += 1) {
    const c = json[i];

    if (inString) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') inString = false;
      continue;
    }

    if (c === '"') {
      inString = true;
    } else if (c === '{' || c === '[') {
      stack.push(c === '{' ? '}' : ']');
    } else if (c === '}' || c === ']') {
      if (stack[stack.length - 1] !== c) return null; // mal formé, pas tronqué
      stack.pop();
      // Un élément vient de se refermer proprement : frontière sûre APRÈS lui.
      safePos = i + 1;
      safeStack = [...stack];
    } else if (c === ',') {
      // Frontière sûre AVANT la virgule : ce qui précède est complet.
      safePos = i;
      safeStack = [...stack];
    }
  }

  // Rien d'ouvert et rien d'incomplet : la chaîne n'était pas tronquée.
  if (stack.length === 0 && !inString) return null;
  // Aucune frontière atteinte : il n'y a rien à sauver.
  if (safePos <= 0 || safeStack.length === 0) return null;

  const head = json.slice(0, safePos).replace(/,\s*$/, '');
  return head + safeStack.reverse().join('');
}

/**
 * Parses LLM JSON with progressive repair. Returns the parsed value, or `null`
 * when even the repaired content cannot be parsed (callers should fall back).
 */
export function parseLlmJson<T = unknown>(content: string): T | null {
  if (!content || typeof content !== 'string') return null;

  const stripped = stripCodeFences(content);
  const block = extractJsonBlock(stripped);

  // Ordered from cheapest (already-valid JSON) to most aggressively repaired.
  const candidates = [
    stripped,
    block,
    removeTrailingCommas(escapeControlCharsInStrings(block)),
    removeTrailingCommas(escapeControlCharsInStrings(stripped)),
  ];

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as T;
    } catch {
      // Try the next, more-repaired candidate.
    }
  }

  // DERNIER RECOURS : la troncature. Placée en dernier parce qu'elle PERD de
  // l'information — le dernier élément, incomplet, est abandonné. Elle ne doit
  // donc jamais devancer une réparation qui conserve tout.
  for (const candidate of [block, stripped]) {
    const closed = closeTruncatedJson(escapeControlCharsInStrings(candidate));
    if (!closed) continue;
    try {
      const parsed = JSON.parse(removeTrailingCommas(closed)) as T;
      logger.warn(
        `parseLlmJson: réponse TRONQUÉE, récupérée en coupant au dernier élément complet ` +
          `(${candidate.length} → ${closed.length} car.). Cause probable : budget de sortie atteint.`
      );
      return parsed;
    } catch {
      // La coupure n'a pas suffi ; on tente le candidat suivant.
    }
  }

  logger.warn('parseLlmJson: all parse attempts failed');
  return null;
}

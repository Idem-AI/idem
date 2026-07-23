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

  logger.warn('parseLlmJson: all parse attempts failed');
  return null;
}

/**
 * Parse pasted or uploaded `.env`-style text into key/value pairs.
 *
 * Mirrors `apps/ideploy-api/api/utils/env-example.ts`'s server-side parser —
 * kept separate (not imported) because this runs in the browser against a
 * file the user picked, not a repository file the backend fetched, but the
 * grammar is the same one every `.env` file already uses.
 */
export interface ParsedEnvVar {
  key: string;
  value: string;
}

const KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function parseEnvFile(content: string): ParsedEnvVar[] {
  const seen = new Set<string>();
  const out: ParsedEnvVar[] = [];

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;

    const key = line.slice(0, eq).trim().replace(/^export\s+/, '');
    if (!KEY_PATTERN.test(key) || seen.has(key)) continue;

    let value = line.slice(eq + 1).trim();
    if (value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))) {
      value = value.slice(1, -1);
    }

    seen.add(key);
    out.push({ key, value });
  }

  return out;
}

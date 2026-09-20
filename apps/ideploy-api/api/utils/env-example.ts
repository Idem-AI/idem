/**
 * Parse a `.env.example`-style file into the keys (and any default) it names.
 *
 * Shared by `github.service.ts` and `gitlab.service.ts`'s `detectFramework` —
 * both fetch whichever of `.env.example` / `.env.sample` / `.env.template` the
 * repository ships and hand its raw content here. The point is the same one
 * Vercel's own import flow makes: the repository already says which variables
 * it needs, so asking the operator to first read the source and then type
 * each key by hand is friction the platform can remove, not merely tolerate.
 */
export interface DetectedEnvVar {
  key: string;
  /** The value committed in the example file, if any — never treated as a real secret. */
  defaultValue: string;
}

/**
 * Candidate filenames, in the order they're worth checking — `.env` itself
 * goes first. Committing a real `.env` (not just an example) is exactly the
 * kind of thing a linter would flag, but plenty of real repositories do it
 * anyway, and one already did: verified live against a repository whose
 * root actually lists a plain `.env`, which this list never once checked
 * for, so detection silently found nothing to show even though the values
 * were sitting right there. Checked first, not last, because when both a
 * real `.env` and an `.env.example` exist, the real one is the file whose
 * values are the ones actually running — an example's placeholder shouldn't
 * out-rank it.
 */
export const ENV_EXAMPLE_FILENAMES = [
  '.env',
  '.env.example',
  '.env.sample',
  '.env.template',
  '.env.dist',
  '.env.default',
  '.env.local.example',
  'env.example',
  'example.env',
] as const;

const KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function parseEnvExample(content: string): DetectedEnvVar[] {
  const seen = new Set<string>();
  const out: DetectedEnvVar[] = [];

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    // A line without an `=` names nothing usable.
    const eq = line.indexOf('=');
    if (eq === -1) continue;

    const key = line.slice(0, eq).trim().replace(/^export\s+/, '');
    if (!KEY_PATTERN.test(key) || seen.has(key)) continue;

    let value = line.slice(eq + 1).trim();
    // Strip one layer of matching quotes — committed examples are often
    // `KEY="value"` — without touching an unquoted value's own content.
    if (value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))) {
      value = value.slice(1, -1);
    }

    seen.add(key);
    out.push({ key, defaultValue: value });
  }

  return out;
}

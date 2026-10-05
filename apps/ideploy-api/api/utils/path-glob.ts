/**
 * Matching changed files against an application's watch paths.
 *
 * Patterns, one per line, relative to the repository root:
 *   - `**` crosses folders, `*` stays within one, `?` is one character;
 *   - a pattern ending with `/` means everything under that folder;
 *   - a leading `!` excludes what it matches.
 * `apps/api/**` and `packages/**` make an application of a monorepo
 * redeploy only when its own code or the shared packages change.
 */

/** One pattern as a regular expression over a repository-relative path. */
export function globToRegExp(pattern: string): RegExp {
  let p = pattern.trim().replace(/^\.?\/+/, '');
  if (p.endsWith('/')) p += '**';
  let re = '';
  for (let i = 0; i < p.length; i++) {
    const c = p[i];
    if (c === '*' && p[i + 1] === '*') {
      // `**/` also matches nothing, so `a/**/b` matches `a/b`.
      if (p[i + 2] === '/') {
        re += '(?:.*/)?';
        i += 2;
      } else {
        re += '.*';
        i += 1;
      }
    } else if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}

/** The patterns of a `watch_paths` value: one per line or comma, blanks and `#` comments dropped. */
export function parseWatchPaths(value: string | null | undefined): string[] {
  return (value ?? '')
    .split(/[\n,]/)
    .map((p) => p.trim())
    .filter((p) => p && !p.startsWith('#'));
}

/** Whether any changed file is included by the patterns and not excluded by a `!` one. */
export function matchesWatchPaths(files: string[], patterns: string[]): boolean {
  const include = patterns.filter((p) => !p.startsWith('!')).map(globToRegExp);
  const exclude = patterns.filter((p) => p.startsWith('!')).map((p) => globToRegExp(p.slice(1)));
  if (include.length === 0) return true;
  return files.some((raw) => {
    const file = raw.replace(/^\/+/, '');
    return include.some((r) => r.test(file)) && !exclude.some((r) => r.test(file));
  });
}

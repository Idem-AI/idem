/**
 * The context a repair is asked with — compact, and without secrets.
 *
 * Tokens are paid per character: a build log is mostly noise (BuildKit
 * progress, downloads, deprecation warnings) around a few lines that say
 * what broke. Those lines, with a little context before and after, and the
 * end of the log, are what a model needs; the rest is dropped here, in code,
 * for free. Every value of the application's variables is masked before
 * anything leaves the server.
 */

/** Lines that say something broke. */
const ERROR_LINE = /\b(error|err!|failed|failure|fatal|exception|traceback|panic|cannot|can't|could not|not found|no such|undefined|denied|refused|killed|exit code|exited)\b/i;

/** Lines that never help: progress, downloads, cache bookkeeping, deprecations. */
const NOISE_LINE =
  /^(#\d+ (DONE|CACHED|\[internal\]|resolve|sha256|extracting|exporting|writing image|naming to|transferring)|.*\b\d+(\.\d+)?\s?[kMG]i?B\s*\/\s*\d+(\.\d+)?\s?[kMG]i?B\b|npm (WARN|warn) deprecated|Progress: resolved|Downloading |Downloaded |Collecting |Using cached |Requirement already satisfied|\s*$)/;

/** Hide every secret value, longest first (a value may contain a shorter one). */
export function redact(text: string, secrets: string[]): string {
  let out = text;
  for (const secret of [...new Set(secrets)].filter((s) => s.length >= 6).sort((a, b) => b.length - a.length)) {
    out = out.split(secret).join('***');
  }
  return out;
}

/**
 * The lines of a log worth reading: each error line with 3 lines before and
 * 6 after, and the last 40 lines (where the final error is), BuildKit's
 * prefixes and colours removed, repeats collapsed, at most `maxChars` (the end
 * kept: the cause is usually last).
 */
export function compactLog(output: string, secrets: string[] = [], maxChars = 8000): string {
  const lines = redact(output, secrets)
    .split('\n')
    // eslint-disable-next-line no-control-regex
    .map((l) => l.replace(/\x1b\[[0-9;]*m/g, '').replace(/^#\d+\s+\d+(\.\d+)?\s+/, '').trimEnd())
    .filter((l) => !NOISE_LINE.test(l));
  const keep = new Set<number>();
  lines.forEach((line, i) => {
    if (!ERROR_LINE.test(line)) return;
    for (let j = Math.max(0, i - 3); j <= Math.min(lines.length - 1, i + 6); j++) keep.add(j);
  });
  for (let j = Math.max(0, lines.length - 40); j < lines.length; j++) keep.add(j);
  const kept: string[] = [];
  let previous = -2;
  for (const i of [...keep].sort((a, b) => a - b)) {
    if (i > previous + 1 && kept.length) kept.push('…');
    if (kept[kept.length - 1] !== lines[i]) kept.push(lines[i]);
    previous = i;
  }
  const text = kept.join('\n');
  return text.length > maxChars ? `…${text.slice(text.length - maxChars)}` : text;
}

/** Source files a log names (`src/app.ts:12`, `/app/server.js`), found in the repository. */
export function referencedFiles(log: string, paths: string[], max = 3): string[] {
  const found: string[] = [];
  const candidates = log.matchAll(/([\w@./-]+\.(?:[cm]?[jt]sx?|py|php|rb|go|rs|java|kt|cs|json|ya?ml|toml|xml|gradle|vue|svelte))(?::\d+)?/g);
  for (const [, raw] of candidates) {
    const path = raw.replace(/^\/?app\//, '').replace(/^\.\//, '');
    if (path.includes('node_modules/') || path.startsWith('/')) continue;
    const match = paths.includes(path) ? path : paths.find((p) => p.endsWith(`/${path}`));
    if (match && !found.includes(match)) found.push(match);
    if (found.length >= max) break;
  }
  return found;
}

/** The file tree, three levels under `root`, at most `max` paths. */
export function fileTree(paths: string[], root: string, max = 200): string[] {
  return paths
    .filter((p) => (root === '' || p.startsWith(`${root}/`)) && p.split('/').length - (root ? root.split('/').length : 0) <= 3)
    .sort()
    .slice(0, max);
}

/** The manifests and configuration files a repair needs first, in this order. */
export const KEY_FILES = [
  'package.json', 'pyproject.toml', 'requirements.txt', 'composer.json', 'Gemfile', 'go.mod', 'Cargo.toml',
  'pom.xml', 'build.gradle', 'build.gradle.kts', 'Procfile', 'next.config.js', 'next.config.mjs', 'next.config.ts',
  'vite.config.ts', 'vite.config.js', 'angular.json', 'Dockerfile',
];

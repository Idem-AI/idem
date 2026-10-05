/**
 * Validation des références Git fournies par l'utilisateur.
 *
 * Branche et URL de dépôt finissent dans une commande `git clone` exécutée sur
 * le serveur. En plus de l'échappement shell fait à l'appel, on refuse ici ce
 * que Git lui-même interpréterait dangereusement : une valeur commençant par
 * `-` devient une option (`--upload-pack=…`), et les transports `ext::` ou
 * `file://` exécutent une commande ou lisent le disque de l'hôte.
 */

/** Noms de branche/tag acceptés : l'alphabet usuel de `git check-ref-format`. */
const BRANCH_PATTERN = /^[A-Za-z0-9._\/-]{1,200}$/;

export function isSafeGitBranch(branch: unknown): branch is string {
  return (
    typeof branch === 'string' &&
    BRANCH_PATTERN.test(branch) &&
    !branch.startsWith('-') &&
    !branch.includes('..') &&
    !branch.endsWith('.lock')
  );
}

export function assertSafeGitBranch(branch: unknown): string {
  if (!isSafeGitBranch(branch)) throw new Error('Invalid git branch name.');
  return branch;
}

/** URL de dépôt : https, ou SSH au format `git@hôte:chemin`. */
export function isSafeGitUrl(url: unknown): url is string {
  if (typeof url !== 'string' || url.length > 500 || url.startsWith('-')) return false;
  if (/\s/.test(url)) return false;

  if (/^git@[A-Za-z0-9.-]+:[A-Za-z0-9._\/~-]+$/.test(url)) return true;

  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function assertSafeGitUrl(url: unknown): string {
  if (!isSafeGitUrl(url)) throw new Error('Invalid git repository URL (https or git@host:path only).');
  return url;
}

/** Sous-répertoire relatif au dépôt : pas de chemin absolu ni de remontée. */
export function isSafeRelativeDir(dir: unknown): boolean {
  if (dir === null || dir === undefined || dir === '') return true;
  if (typeof dir !== 'string' || dir.length > 300) return false;
  return /^[A-Za-z0-9._\/ -]+$/.test(dir) && !dir.split('/').includes('..');
}

/** A `docker build --target` stage name. */
export function isSafeBuildTarget(target: unknown): boolean {
  if (target === null || target === undefined || target === '') return true;
  return typeof target === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(target);
}

/** Watch-path patterns: printable path characters and glob syntax, nothing a shell could read. */
export function isSafeWatchPaths(value: unknown): boolean {
  if (value === null || value === undefined || value === '') return true;
  return typeof value === 'string' && value.length <= 2000 && /^[A-Za-z0-9._\/*?!#, \n\r-]+$/.test(value);
}

/** A commit id as Git prints it: 7 to 40 hexadecimal characters. */
export function isSafeCommitSha(sha: unknown): sha is string {
  return typeof sha === 'string' && /^[0-9a-f]{7,40}$/i.test(sha);
}

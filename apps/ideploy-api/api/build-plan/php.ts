/**
 * PHP applications: Laravel, Symfony or plain PHP, served by Apache from
 * their public folder, with the PHP version and the extensions the project
 * and its dependencies ask for, and their front-end assets built with Node.
 */
import { BuildPlanResult, PhpRecipe, PlanIssue } from './types';
import { RepoFiles, joinPath } from './repo-files';
import { hasFile } from './common';
import { FRESH_COREPACK, readPackage, startScript } from './node';

const DEFAULT_PHP_MINOR = 3;

/** Symfony's and others' Redis integrations, which use the phpredis extension. */
const REDIS_PACKAGES = /^(?:symfony\/redis-messenger|snc\/redis-bundle|illuminate\/redis)$/i;

/**
 * Extensions each framework uses beyond PHP's own: database drivers, intl, zip, opcache.
 * Laravel's Redis client is phpredis by default, and no package declares
 * ext-redis: without it, a cache, session or queue on Redis answered every
 * request with `Class "Redis" not found`.
 */
const FRAMEWORK_EXTENSIONS: Record<PhpRecipe['framework'], string[]> = {
  Laravel: ['pdo_mysql', 'pdo_pgsql', 'bcmath', 'intl', 'zip', 'opcache', 'pcntl', 'gd', 'exif', 'redis'],
  Symfony: ['pdo_mysql', 'pdo_pgsql', 'intl', 'zip', 'opcache'],
  PHP: ['pdo_mysql', 'mysqli', 'pdo_pgsql', 'zip', 'opcache', 'gd'],
};

/** `8.2` from composer.json's `require.php` (`^8.2`, `>=8.1`, `~8.1.0`, `^8.1|^8.2`). */
export function phpVersionFromConstraint(constraint: string): string | null {
  const alternatives = constraint.split('|').map((c) => c.trim()).filter(Boolean);
  const minors: number[] = [];
  let seven = false;
  for (const c of alternatives) {
    const exact = /^(?:\^|~|=|==)?\s*8\.(\d+)/.exec(c);
    const lower = />=?\s*8\.(\d+)/.exec(c);
    const upper = /<\s*8\.(\d+)/.exec(c);
    if (lower) {
      let minor = Math.max(Number(lower[1]), DEFAULT_PHP_MINOR);
      if (upper && minor >= Number(upper[1])) minor = Number(upper[1]) - 1;
      minors.push(minor);
    } else if (exact) minors.push(Number(exact[1]));
    else if (/^(?:\^|~)?\s*7\.4/.test(c)) seven = true;
  }
  // PHP 8 whenever the constraint allows it.
  if (minors.length) return `8.${Math.max(...minors)}`;
  return seven ? '7.4' : null;
}

/** Compiled into PHP's official images: nothing to install. */
const BUILT_IN = new Set([
  'core', 'ctype', 'curl', 'date', 'dom', 'fileinfo', 'filter', 'ftp', 'hash', 'iconv', 'json', 'libxml', 'mbstring',
  'mysqlnd', 'openssl', 'pcre', 'pdo', 'pdo_sqlite', 'phar', 'posix', 'readline', 'reflection', 'session', 'simplexml',
  'sodium', 'spl', 'sqlite3', 'standard', 'tokenizer', 'xml', 'xmlreader', 'xmlwriter', 'zlib',
]);

/** Coverage and debugging: never in a production image (and slower). */
const DEV_ONLY = new Set(['pcov', 'xdebug', 'xhprof', 'blackfire']);

/** `ext-gd`, `ext-pdo_mysql` among requirement names → `gd`, `pdo_mysql`. */
function extensionsOf(names: string[]): string[] {
  return names.filter((k) => k.toLowerCase().startsWith('ext-')).map((k) => k.slice(4).toLowerCase());
}

/**
 * The extensions composer.lock's production packages require — their
 * `require`, never their `suggest` nor `packages-dev`: read as text, a lock
 * named imagick AND gmagick (two suggestions that cannot load together), pcov,
 * mongodb…, and installing them failed the build. Null when the lock cannot
 * be read whole (truncated, invalid): it is then not used at all.
 */
export function lockExtensions(lock: string): string[] | null {
  try {
    const parsed = JSON.parse(lock) as { packages?: { require?: Record<string, string> }[] };
    return extensionsOf((parsed.packages ?? []).flatMap((p) => Object.keys(p.require ?? {})));
  } catch {
    return null;
  }
}

/** What to install: no built-in, no development tool, never imagick and gmagick together. */
export function selectExtensions(names: string[]): string[] {
  const wanted = new Set(names.map((n) => n.toLowerCase()).filter((n) => /^[a-z0-9_]+$/.test(n) && !BUILT_IN.has(n) && !DEV_ONLY.has(n)));
  if (wanted.has('imagick')) wanted.delete('gmagick');
  return [...wanted].sort();
}

interface ComposerJson {
  require?: Record<string, string>;
}

export async function planPhp(files: RepoFiles, appDir: string): Promise<BuildPlanResult | null> {
  const has = (name: string) => hasFile(files, appDir, name);
  const composerText = await files.read(joinPath(appDir, 'composer.json'));
  if (composerText === null) {
    // Plain PHP without Composer: an index.php, and no Node application in the same folder.
    if (!has('index.php') && !has('public/index.php')) return null;
    const pkg = await readPackage(files, appDir);
    if (pkg && startScript(pkg)) return null;
  }
  let composer: ComposerJson = {};
  try {
    composer = composerText ? (JSON.parse(composerText) as ComposerJson) : {};
  } catch {
    composer = {};
  }
  const require = composer.require ?? {};
  const framework: PhpRecipe['framework'] = require['laravel/framework']
    ? 'Laravel'
    : require['symfony/framework-bundle']
      ? 'Symfony'
      : 'PHP';
  const issues: PlanIssue[] = [];

  const declared = require.php ? phpVersionFromConstraint(require.php) : null;
  const version = declared ?? `8.${DEFAULT_PHP_MINOR}`;

  // The extensions the project and its production dependencies require:
  // composer.json, and composer.lock read as JSON (a package needing ext-gd
  // fails the install otherwise).
  const lock = await files.read(joinPath(appDir, 'composer.lock'));
  const required = [...extensionsOf(Object.keys(require)), ...(lock ? lockExtensions(lock) ?? [] : [])];
  // Packages that talk to Redis through phpredis without declaring it.
  if (Object.keys(require).some((name) => REDIS_PACKAGES.test(name))) required.push('redis');
  const extensions = selectExtensions([...FRAMEWORK_EXTENSIONS[framework], ...required]);

  const documentRoot = framework !== 'PHP' || has('public/index.php') ? 'public' : '';

  // Front-end assets (Laravel's Vite, Symfony's Encore), built before Composer.
  const pkg = await readPackage(files, appDir);
  let assets: PhpRecipe['assets'] = null;
  if (pkg?.scripts?.build) {
    const manager = has('pnpm-lock.yaml') ? 'pnpm' : has('yarn.lock') ? 'yarn' : 'npm';
    const install =
      manager === 'pnpm'
        ? `${FRESH_COREPACK} && pnpm install --frozen-lockfile`
        : manager === 'yarn'
          ? `${FRESH_COREPACK} && yarn install`
          : has('package-lock.json')
            ? 'npm ci'
            : 'npm install';
    assets = { manager, install, build: `${manager} run build` };
  }

  if (framework === 'Laravel') {
    issues.push({
      code: 'LARAVEL_APP_KEY',
      severity: 'info',
      message: 'Laravel needs APP_KEY (php artisan key:generate --show) and APP_ENV=production under Variables. Its migrations run before each release (php artisan migrate --force).',
    });
  }

  const build =
    framework === 'Laravel'
      ? 'php artisan storage:link || true'
      : null;

  return {
    language: 'php',
    framework,
    appDir,
    buildRoot: appDir,
    output: 'server',
    tool: composerText ? 'composer' : undefined,
    runtimeVersion: { name: 'PHP', version, source: declared ? 'composer.json' : 'default' },
    nixpacksEnv: {},
    issues,
    release:
      framework === 'Laravel'
        ? 'php artisan migrate --force'
        : require['doctrine/doctrine-migrations-bundle']
          ? 'php bin/console doctrine:migrations:migrate --no-interaction --allow-no-migration'
          : undefined,
    recipe: {
      kind: 'php',
      version,
      framework,
      extensions,
      documentRoot,
      assets,
      build,
      // Laravel writes its log to a file in the container (LOG_CHANNEL=stack
      // or single): followed onto the container's output, where iDeploy's
      // Logs tab reads it. Apache itself already logs there.
      start:
        framework === 'Laravel'
          ? 'touch storage/logs/laravel.log && chown www-data:www-data storage/logs/laravel.log; tail -n 0 -F storage/logs/laravel.log & exec apache2-foreground'
          : 'apache2-foreground',
    },
  };
}

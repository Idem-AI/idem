/**
 * The files a build plan is read from — the same interface whether they come
 * from the checkout on the server (at deployment) or from the GitHub/GitLab
 * API (at import), so both read the code the same way.
 */
import { shellQuote } from '../ssh/ssh';

export interface RepoFiles {
  /** Every file path, relative to the repository root, without a leading `./`. */
  paths: string[];
  read(path: string): Promise<string | null>;
}

/** Folders that never hold an application's own configuration. */
export const IGNORED_DIRS = [
  'node_modules', '.git', 'dist', 'build', 'target', '.next', '.nuxt', '.output', '.turbo',
  '.svelte-kit', '.angular', 'coverage', 'vendor', '.venv', 'venv', '.gradle', '.idea',
];

/** The files whose content the plan reads. */
const READ_NAMES = [
  'package.json', 'pnpm-workspace.yaml', 'pnpm-lock.yaml', 'turbo.json', 'nx.json', 'lerna.json', 'angular.json',
  '.nvmrc', '.node-version', '.tool-versions', 'react-router.config.ts', 'react-router.config.js',
  'pom.xml', 'build.gradle', 'build.gradle.kts', 'settings.gradle', 'settings.gradle.kts',
  'gradle-wrapper.properties', 'system.properties', '.java-version', '.sdkmanrc',
  'vite.config.ts', 'vite.config.js', 'vite.config.mjs', 'astro.config.mjs', 'astro.config.ts',
  'svelte.config.js', 'svelte.config.ts', 'nuxt.config.ts', 'nuxt.config.js',
  'next.config.js', 'next.config.mjs', 'next.config.ts', 'vue.config.js',
  // Python, PHP, Go, Ruby, Rust, .NET.
  'requirements.txt', 'pyproject.toml', 'Pipfile', 'runtime.txt', '.python-version', 'Procfile',
  'main.py', 'app.py', 'server.py', 'application.py', 'asgi.py', 'wsgi.py', 'run.py', 'streamlit_app.py',
  'composer.json', 'composer.lock', 'go.mod', 'Gemfile', '.ruby-version',
  'Cargo.toml', 'rust-toolchain.toml', 'rust-toolchain', 'global.json',
];

/** Read by pattern: .NET project files are named after their project. */
const READ_PATTERNS = ['*.csproj', '*.fsproj'];

export interface RepoSnapshot {
  files: RepoFiles;
  /** MemAvailable of the server, in MB (null when unreadable). */
  memoryAvailableMb: number | null;
  /** Free space where the code is built, in MB. */
  diskFreeMb: number | null;
}

/**
 * One SSH round trip: the server's free memory and disk, the file list (5
 * levels, dependency and output folders skipped) and the configuration files
 * above, base64-encoded: 256 KB at most, the first 4 KB of a pnpm lockfile
 * (its format version is all the plan reads).
 */
export function snapshotCommand(dir: string): string {
  const prune = IGNORED_DIRS.map((d) => `-name ${shellQuote(d)}`).join(' -o ');
  const names = [...READ_NAMES, ...READ_PATTERNS].map((n) => `-name ${shellQuote(n)}`).join(' -o ');
  const walk = `find . -maxdepth 5 \\( ${prune} \\) -prune -o -type f`;
  return (
    `cd ${shellQuote(dir)} && ` +
    `echo "@@MEM $(awk '/^MemAvailable:/{print int($2/1024)}' /proc/meminfo 2>/dev/null)"; ` +
    `echo "@@DISK $(df -Pk . 2>/dev/null | awk 'NR==2{print int($4/1024)}')"; ` +
    `${walk} -print | head -8000 | sed 's|^\\./|@@F |'; ` +
    `${walk} \\( ${names} \\) -print | head -400 | while read -r f; do ` +
    `case "$f" in *pnpm-lock.yaml) n=4096 ;; *) n=262144 ;; esac; ` +
    `echo "@@C \${f#./} $(head -c $n "$f" | base64 -w0)"; done`
  );
}

export function parseSnapshot(output: string): RepoSnapshot {
  const paths: string[] = [];
  const contents = new Map<string, string>();
  let memoryAvailableMb: number | null = null;
  let diskFreeMb: number | null = null;
  for (const line of output.split('\n')) {
    if (line.startsWith('@@F ')) paths.push(line.slice(4).trim());
    else if (line.startsWith('@@C ')) {
      const rest = line.slice(4);
      const space = rest.lastIndexOf(' ');
      if (space > 0) contents.set(rest.slice(0, space), Buffer.from(rest.slice(space + 1).trim(), 'base64').toString('utf8'));
    } else if (line.startsWith('@@MEM ')) memoryAvailableMb = Number(line.slice(6)) || null;
    else if (line.startsWith('@@DISK ')) diskFreeMb = Number(line.slice(7)) || null;
  }
  return {
    files: { paths, read: async (path) => contents.get(path) ?? null },
    memoryAvailableMb,
    diskFreeMb,
  };
}

/** `a/b` from parts, ignoring empty ones ('' is the repository root). */
export function joinPath(...parts: string[]): string {
  return parts
    .map((p) => p.replace(/^\.?\/+|\/+$/g, ''))
    .filter(Boolean)
    .join('/');
}

/** The folder holding `path` ('' for the root). */
export function dirOf(path: string): string {
  const i = path.lastIndexOf('/');
  return i === -1 ? '' : path.slice(0, i);
}

/** `path` relative to `from`, both relative to the repository root, `from` an ancestor. */
export function relativeTo(from: string, path: string): string {
  if (!from) return path;
  return path === from ? '' : path.slice(from.length + 1);
}

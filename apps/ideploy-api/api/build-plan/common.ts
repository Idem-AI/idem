/**
 * What the plans of every language read the same way.
 */
import { RepoFiles, joinPath, relativeTo } from './repo-files';
import { readPackage, startScript } from './node';

/**
 * A folder that belongs to a Node application — a start script, or the root
 * of a workspace. Python, Go and Rust step aside there: a Next.js app with a
 * requirements.txt for a script, a turborepo with a Cargo.toml for a tool.
 */
export async function nodeOwnsFolder(files: RepoFiles, dir: string): Promise<boolean> {
  const pkg = await readPackage(files, dir);
  if (!pkg) return false;
  return Boolean(startScript(pkg) || pkg.workspaces || hasFile(files, dir, 'pnpm-workspace.yaml'));
}

/**
 * The `web:` line of a Procfile — the Heroku convention, how a Python or Ruby
 * project says how it starts. `$PORT` is set in the container.
 */
export async function procfileWeb(files: RepoFiles, dir: string): Promise<string | null> {
  const text = await files.read(joinPath(dir, 'Procfile'));
  return /^web:\s*(.+?)\s*$/m.exec(text ?? '')?.[1] ?? null;
}

/** Files named one of `names` under `dir`, at most `depth` folders down, the shallowest first. */
export function filesNamed(files: RepoFiles, dir: string, names: string[], depth = 3): string[] {
  return files.paths
    .filter((p) => (dir === '' || p.startsWith(`${dir}/`)) && names.includes(p.slice(p.lastIndexOf('/') + 1)))
    .map((p) => relativeTo(dir, p))
    .filter((rel) => rel.split('/').length - 1 <= depth)
    .sort((a, b) => a.split('/').length - b.split('/').length || names.indexOf(base(a)) - names.indexOf(base(b)) || a.localeCompare(b));
}

const base = (path: string) => path.slice(path.lastIndexOf('/') + 1);

/** `true` when `dir` holds `name` (relative to the repository root). */
export function hasFile(files: RepoFiles, dir: string, name: string): boolean {
  return files.paths.includes(joinPath(dir, name));
}

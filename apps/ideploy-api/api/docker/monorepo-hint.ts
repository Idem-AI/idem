/**
 * What to do when nixpacks finds no start command in a JavaScript monorepo.
 *
 * At the root of a workspace (pnpm, npm or yarn; turbo or nx) there is no
 * `start` script: the repository holds several applications and nixpacks
 * cannot pick one. Other platforms ask which application to build; iDeploy
 * only said "No start command could be found". This lists the applications
 * found and the exact build and start commands for the package manager in use.
 */
import { shellQuote } from '../ssh/ssh';

export interface WorkspacePackage {
  path: string;
  name: string;
  hasStart: boolean;
  hasBuild: boolean;
}

export interface MonorepoProbe {
  manager: 'pnpm' | 'yarn' | 'npm';
  orchestrator: 'turbo' | 'nx' | null;
  packages: WorkspacePackage[];
}

/** Shell printing the lockfile, the orchestrator and every package (name, start/build scripts). */
export function monorepoProbeCommand(dir: string): string {
  const d = shellQuote(dir);
  return (
    `cd ${d} && ` +
    `{ [ -f pnpm-lock.yaml ] && echo MANAGER=pnpm || { [ -f yarn.lock ] && echo MANAGER=yarn || echo MANAGER=npm; }; }; ` +
    `{ [ -f turbo.json ] && echo ORCH=turbo; [ -f nx.json ] && echo ORCH=nx; true; }; ` +
    `find . -mindepth 2 -maxdepth 3 -name package.json -not -path '*/node_modules/*' | sort | while read -r f; do ` +
    `name=$(grep -m1 '"name"' "$f" | sed -E 's/.*"name"[[:space:]]*:[[:space:]]*"([^"]+)".*/\\1/'); ` +
    `start=$(grep -cE '"start"[[:space:]]*:' "$f"); build=$(grep -cE '"build"[[:space:]]*:' "$f"); ` +
    `echo "PKG=$(dirname "$f" | sed 's|^\\./||')|$name|$start|$build"; done`
  );
}

export function parseMonorepoProbe(output: string): MonorepoProbe {
  const lines = output.split('\n').map((l) => l.trim());
  const manager = (lines.find((l) => l.startsWith('MANAGER='))?.slice(8) ?? 'npm') as MonorepoProbe['manager'];
  const orch = lines.find((l) => l.startsWith('ORCH='))?.slice(5);
  const packages = lines
    .filter((l) => l.startsWith('PKG='))
    .map((l) => {
      const [path, name, start, build] = l.slice(4).split('|');
      return { path, name: name || path, hasStart: Number(start) > 0, hasBuild: Number(build) > 0 };
    });
  return { manager, orchestrator: orch === 'turbo' || orch === 'nx' ? orch : null, packages };
}

/** Build and start commands for one package, for the package manager in use. */
export function commandsFor(manager: MonorepoProbe['manager'], pkg: WorkspacePackage): { build: string | null; start: string } {
  if (manager === 'pnpm') {
    return {
      // `name...`: the package and the workspace packages it depends on —
      // needed even when the application itself has no build script.
      build: `pnpm --filter ${pkg.name}... run build`,
      start: `pnpm --filter ${pkg.name} run start`,
    };
  }
  if (manager === 'yarn') {
    return { build: pkg.hasBuild ? `yarn workspace ${pkg.name} run build` : null, start: `yarn workspace ${pkg.name} run start` };
  }
  return { build: pkg.hasBuild ? `npm run build -w ${pkg.path}` : null, start: `npm run start -w ${pkg.path}` };
}

/** The message, or null when this is not a monorepo with a runnable application. */
export function monorepoHint(probe: MonorepoProbe): string | null {
  const runnable = probe.packages.filter((p) => p.hasStart);
  if (runnable.length === 0) return null;
  const tool = [probe.manager, probe.orchestrator].filter(Boolean).join(' + ');
  const lines = [
    `This repository is a monorepo (${tool}) with ${runnable.length} application(s): nixpacks cannot tell which one to run.`,
    'Pick one in Settings › Build options: set its build and start commands, and leave the root directory at ./ so the shared packages are built too:',
  ];
  for (const pkg of runnable.slice(0, 8)) {
    const c = commandsFor(probe.manager, pkg);
    lines.push(`  • ${pkg.name} (${pkg.path}) — build: ${c.build ?? '(none)'} · start: ${c.start}`);
  }
  if (runnable.length > 8) lines.push(`  • … and ${runnable.length - 8} more`);
  lines.push('One iDeploy application per service of the monorepo.');
  return lines.join('\n');
}

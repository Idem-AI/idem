/**
 * Rust applications: the binary of the package — or of the workspace member
 * the Root directory points to, built from the workspace root (its
 * Cargo.lock and sibling crates) — on the toolchain the project pins.
 */
import { BuildPlanResult, PlanIssue } from './types';
import { RepoFiles, dirOf, joinPath, relativeTo } from './repo-files';
import { hasFile, nodeOwnsFolder } from './common';

/** The first `[[bin]] name`, else the `[package] name` of a Cargo.toml. */
export function cargoBinary(cargo: string): string | null {
  const bin = /\[\[bin\]\][^[]*?name\s*=\s*"([^"]+)"/.exec(cargo)?.[1];
  if (bin) return bin;
  return cargoPackage(cargo);
}

function cargoPackage(cargo: string): string | null {
  return /\[package\][^[]*?name\s*=\s*"([^"]+)"/.exec(cargo)?.[1] ?? null;
}

/** The member folders of a workspace Cargo.toml, globs (`crates/*`) resolved against the files. */
export function workspaceMembers(cargo: string, root: string, paths: string[]): string[] {
  const block = /\[workspace\][^[]*?members\s*=\s*\[([^\]]*)\]/.exec(cargo)?.[1] ?? '';
  const patterns = [...block.matchAll(/"([^"]+)"/g)].map((m) => m[1].replace(/\/+$/, ''));
  const dirs = new Set<string>();
  for (const pattern of patterns) {
    if (!pattern.includes('*')) {
      dirs.add(pattern);
      continue;
    }
    const re = new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]+')}$`);
    for (const p of paths) {
      if (!p.endsWith('/Cargo.toml')) continue;
      const rel = relativeTo(root, dirOf(p));
      if ((root === '' || p.startsWith(`${root}/`)) && re.test(rel)) dirs.add(rel);
    }
  }
  return [...dirs].sort();
}

/** A program in `dir`: its binary and package names, or null for a library. */
async function program(files: RepoFiles, dir: string): Promise<{ bin: string; pkg: string } | null> {
  const cargo = await files.read(joinPath(dir, 'Cargo.toml'));
  if (!cargo || !(hasFile(files, dir, 'src/main.rs') || /\[\[bin\]\]/.test(cargo))) return null;
  const bin = cargoBinary(cargo);
  const pkg = cargoPackage(cargo) ?? bin;
  return bin && pkg ? { bin, pkg } : null;
}

export async function planRust(files: RepoFiles, appDir: string): Promise<BuildPlanResult | null> {
  const cargo = await files.read(joinPath(appDir, 'Cargo.toml'));
  if (cargo === null) return null;
  // Tauri and napi-rs projects are Node applications with a Rust part.
  if (await nodeOwnsFolder(files, appDir)) return null;
  const issues: PlanIssue[] = [];

  // A member of a workspace higher up builds from that workspace's root.
  let buildRoot = appDir;
  const parts = appDir ? appDir.split('/') : [];
  for (let i = 0; i < parts.length; i++) {
    const dir = parts.slice(0, i).join('/');
    const rootCargo = await files.read(joinPath(dir, 'Cargo.toml'));
    if (rootCargo && /\[workspace\]/.test(rootCargo) && workspaceMembers(rootCargo, dir, files.paths).includes(relativeTo(dir, appDir))) {
      buildRoot = dir;
      break;
    }
  }

  let found = await program(files, appDir);
  if (!found) {
    // The root of a workspace: its only program, else the one to point to.
    const runnable: { dir: string; bin: string; pkg: string }[] = [];
    for (const dir of workspaceMembers(cargo, appDir, files.paths)) {
      const p = await program(files, joinPath(appDir, dir));
      if (p) runnable.push({ dir, ...p });
    }
    if (runnable.length === 1) found = runnable[0];
    else {
      issues.push({
        code: runnable.length ? 'RUST_PICK_BINARY' : 'RUST_NO_BINARY',
        severity: 'blocking',
        message: runnable.length
          ? `This workspace has several programs (${runnable.map((r) => r.dir).join(', ')}). Set the Root directory to the folder of the one to deploy (Settings › Build options): it is built from the workspace root.`
          : 'No program was found in this Cargo project (no src/main.rs, no [[bin]]).',
      });
    }
  }

  const rootDir = buildRoot;
  const toolchain =
    (await files.read(joinPath(rootDir, 'rust-toolchain.toml'))) ?? (await files.read(joinPath(rootDir, 'rust-toolchain'))) ?? '';
  const pinned = /(?:channel\s*=\s*")?(1\.\d+)(?:\.\d+)?/.exec(toolchain)?.[1] ?? null;
  const minimum = /rust-version\s*=\s*"(1\.\d+)/.exec(cargo)?.[1] ?? null;

  const plan: BuildPlanResult = {
    language: 'rust',
    framework: 'Rust',
    appDir,
    buildRoot,
    output: 'server',
    tool: 'cargo',
    runtimeVersion: pinned ? { name: 'Rust', version: pinned, source: 'rust-toolchain' } : minimum ? { name: 'Rust', version: minimum, source: 'Cargo.toml' } : undefined,
    nixpacksEnv: {},
    issues,
  };
  if (found) {
    // A workspace builds one package (-p); --locked holds to a committed Cargo.lock.
    const inWorkspace = buildRoot !== appDir || found.pkg !== cargoPackage(cargo);
    plan.recipe = {
      kind: 'rust',
      // rust-version is a minimum: the latest stable builds it too.
      version: pinned ?? '1',
      bin: found.bin,
      build: `cargo build --release${hasFile(files, buildRoot, 'Cargo.lock') ? ' --locked' : ''}${inWorkspace ? ` -p ${found.pkg}` : ''} --bin ${found.bin}`,
      start: '/usr/local/bin/app',
    };
  }
  return plan;
}

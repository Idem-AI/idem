/**
 * Go applications: the main package (the root, or one of cmd/*), the Go
 * version go.mod names, cgo only when a dependency needs it.
 */
import { BuildPlanResult, PlanIssue } from './types';
import { RepoFiles, joinPath } from './repo-files';
import { hasFile, nodeOwnsFolder } from './common';

/** Dependencies that only build with cgo (a C compiler and glibc at run time). */
const CGO_MODULES = /github\.com\/mattn\/go-sqlite3|github\.com\/confluentinc\/confluent-kafka-go|gopkg\.in\/gographics|github\.com\/tecbot\/gorocksdb|github\.com\/mattn\/go-oci8/;

/** Folder names a repository's server binary usually has under cmd/. */
const PREFERRED_MAINS = ['server', 'api', 'app', 'web', 'main', 'http'];

/** `1.22` from go.mod's `go 1.22.3` and `toolchain go1.23.1` — the newer of the two. */
export function goVersion(goMod: string): string | null {
  const minor = (v: string | undefined) => (v ? /^1\.(\d+)/.exec(v)?.[1] : undefined);
  const go = minor(/^go\s+([\d.]+)/m.exec(goMod)?.[1]);
  const toolchain = minor(/^toolchain\s+go([\d.]+)/m.exec(goMod)?.[1]);
  const best = [go, toolchain].filter((m): m is string => Boolean(m)).map(Number);
  return best.length ? `1.${Math.max(...best)}` : null;
}

export async function planGo(files: RepoFiles, appDir: string, overrides: { build?: string | null } = {}): Promise<BuildPlanResult | null> {
  const goMod = await files.read(joinPath(appDir, 'go.mod'));
  if (goMod === null) return null;
  const issues: PlanIssue[] = [];

  // The main package: the root, or the cmd/<name> folder of the server.
  const prefix = appDir ? `${appDir}/cmd/` : 'cmd/';
  const mains = [
    ...new Set(
      files.paths
        .filter((p) => p.startsWith(prefix) && p.endsWith('/main.go') && p.slice(prefix.length).split('/').length === 2)
        .map((p) => p.slice(prefix.length, p.lastIndexOf('/')))
    ),
  ].sort();
  const moduleName = /^module\s+(\S+)/m.exec(goMod)?.[1]?.split('/').pop() ?? '';
  let mainPackage: string | null = hasFile(files, appDir, 'main.go') ? '.' : null;
  if (!mainPackage && mains.length === 1) mainPackage = `./cmd/${mains[0]}`;
  if (!mainPackage && mains.length > 1) {
    const preferred = [moduleName, ...PREFERRED_MAINS].find((n) => mains.includes(n));
    if (preferred) {
      mainPackage = `./cmd/${preferred}`;
      issues.push({ code: 'GO_MAIN', severity: 'info', message: `Several programs in cmd/ (${mains.join(', ')}): building cmd/${preferred}.` });
    }
  }
  if (!mainPackage) {
    // A Node application with a go.mod for its tooling stays a Node application.
    if (await nodeOwnsFolder(files, appDir)) return null;
    if (!overrides.build) {
      issues.push(
        mains.length > 1
          ? {
              code: 'GO_PICK_MAIN',
              severity: 'blocking',
              message:
                `This module has several programs (${mains.map((m) => `cmd/${m}`).join(', ')}). Set the build command to the one to deploy: ` +
                `go build -o /out/app ./cmd/${mains[0]} (Settings › Build options).`,
            }
          : {
              code: 'GO_NO_MAIN',
              severity: 'blocking',
              message: 'No main package was found (no main.go at the root, none in cmd/<name>/). Set the build command: go build -o /out/app ./path/to/main.',
            }
      );
    }
  }

  const version = goVersion(goMod);
  const plan: BuildPlanResult = {
    language: 'go',
    framework: 'Go',
    appDir,
    buildRoot: appDir,
    output: 'server',
    tool: 'go modules',
    runtimeVersion: version ? { name: 'Go', version, source: 'go.mod' } : undefined,
    nixpacksEnv: {},
    issues,
  };
  if (mainPackage || overrides.build) {
    plan.recipe = {
      kind: 'go',
      version: version ?? '1',
      cgo: CGO_MODULES.test(goMod),
      // -trimpath and stripped symbols: a smaller binary, the same behaviour.
      build: `go build -trimpath -ldflags="-s -w" -o /out/app ${mainPackage ?? '.'}`,
      start: '/usr/local/bin/app',
    };
  }
  return plan;
}

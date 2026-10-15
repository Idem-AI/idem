import { describe, it, expect } from 'vitest';
import { commandsFor, monorepoHint, monorepoProbeCommand, parseMonorepoProbe } from '../../../api/docker/monorepo-hint';

const OUTPUT = [
  'MANAGER=pnpm',
  'ORCH=turbo',
  'PKG=apps/web|@acme/web|1|1',
  'PKG=apps/api|@acme/api|1|1',
  'PKG=packages/ui|@acme/ui|0|1',
].join('\n');

describe('monorepo hint', () => {
  it('reads the manager, the orchestrator and the packages', () => {
    const probe = parseMonorepoProbe(OUTPUT);
    expect(probe.manager).toBe('pnpm');
    expect(probe.orchestrator).toBe('turbo');
    expect(probe.packages).toHaveLength(3);
    expect(probe.packages[2]).toEqual({ path: 'packages/ui', name: '@acme/ui', hasStart: false, hasBuild: true });
  });

  it('lists only the applications, with the pnpm commands', () => {
    const hint = monorepoHint(parseMonorepoProbe(OUTPUT))!;
    expect(hint).toContain('monorepo (pnpm + turbo) with 2 application(s)');
    expect(hint).toContain('@acme/web (apps/web) — build: pnpm --filter @acme/web... run build · start: pnpm --filter @acme/web run start');
    expect(hint).not.toContain('@acme/ui (');
  });

  it('gives yarn and npm commands', () => {
    const pkg = { path: 'apps/web', name: 'web', hasStart: true, hasBuild: true };
    expect(commandsFor('yarn', pkg)).toEqual({ build: 'yarn workspace web run build', start: 'yarn workspace web run start' });
    expect(commandsFor('npm', pkg)).toEqual({ build: 'npm run build -w apps/web', start: 'npm run start -w apps/web' });
    expect(commandsFor('npm', { ...pkg, hasBuild: false }).build).toBeNull();
    // pnpm builds the shared packages the application depends on anyway.
    expect(commandsFor('pnpm', { ...pkg, hasBuild: false }).build).toBe('pnpm --filter web... run build');
  });

  it('says nothing when no package can start', () => {
    expect(monorepoHint(parseMonorepoProbe('MANAGER=npm\nPKG=lib|lib|0|1'))).toBeNull();
    expect(monorepoHint(parseMonorepoProbe('MANAGER=npm'))).toBeNull();
  });

  it('probes the build directory, quoted', () => {
    expect(monorepoProbeCommand("/data/a b")).toContain("cd '/data/a b'");
  });
});

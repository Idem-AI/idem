/**
 * A build that "succeeds" without building, and a version that cannot start:
 * caught before they replace a working one.
 */
import { describe, it, expect } from 'vitest';
import { analyzeRepository, RepoFiles } from '../../../api/build-plan';
import { buildOutputContract, startEntry } from '../../../api/build-plan/node';
import { explainFailure, explainRuntimeFailure } from '../../../api/build-plan/failures';
import { nodeDockerfile, outputCheck } from '../../../api/docker/recipes';
import { trialDisabled, trialEnvironment } from '../../../api/jobs/deployment.worker';

function repo(files: Record<string, string | object>): RepoFiles {
  const contents = new Map(Object.entries(files).map(([p, c]) => [p, typeof c === 'string' ? c : JSON.stringify(c)]));
  return { paths: [...contents.keys()], read: async (p) => contents.get(p) ?? null };
}

/** An nx + pnpm monorepo whose Next.js app declares next nowhere but in its scripts. */
const nxMonorepo = {
  'package.json': { name: 'buni', private: true, devDependencies: { nx: '20' } },
  'pnpm-workspace.yaml': "packages:\n  - 'apps/*'\n  - 'packages/*'\n",
  'pnpm-lock.yaml': "lockfileVersion: '9.0'\n",
  'nx.json': {},
  'apps/avs/package.json': { name: '@buni/avs', scripts: { dev: 'next dev', build: 'next build', start: 'next start' } },
  'packages/ui/package.json': { name: '@buni/ui', scripts: { build: 'tsc' } },
};

describe('build output contract', () => {
  it('recognises Next.js from its scripts and builds through the package graph, not nx', async () => {
    const plan = await analyzeRepository(repo(nxMonorepo), 'apps/avs');
    expect(plan.framework).toBe('Next.js');
    expect(plan.build).toBe("pnpm --filter '@buni/avs...' run --if-present build");
    expect(plan.recipe).toMatchObject({
      kind: 'node',
      nextCacheDir: 'apps/avs/.next/cache',
      output: { path: 'apps/avs/.next/BUILD_ID', alternatives: [], build: 'cd apps/avs && pnpm run build', strict: true },
    });
  });

  it('checks the output in the image, builds the app itself if missing, then fails with what to fix', () => {
    const check = outputCheck({ path: 'apps/avs/.next/BUILD_ID', alternatives: [], build: 'cd apps/avs && pnpm run build', strict: true });
    expect(check).toContain("if ! { [ -e 'apps/avs/.next/BUILD_ID' ]; }; then echo 'iDeploy: apps/avs/.next/BUILD_ID was not produced by the workspace build.");
    expect(check).toContain('( cd apps/avs && pnpm run build ); fi');
    expect(check).toContain("Its \"build\" script must build this application.' >&2; exit 1; fi");
    expect(explainFailure("iDeploy: The build did not produce apps/avs/.next/BUILD_ID, which the start command runs.")?.code).toBe('BUILD_OUTPUT_MISSING');
  });

  it('only warns for an entry read from a command', () => {
    const contract = buildOutputContract('Express', 'node dist/main', 'apps/api', null);
    expect(contract).toEqual({ path: 'apps/api/dist/main', alternatives: ['apps/api/dist/main.js', 'apps/api/dist/main/index.js'], build: null, strict: false });
    const check = outputCheck(contract!);
    expect(check).toContain("[ -e 'apps/api/dist/main' ] || [ -e 'apps/api/dist/main.js' ] || [ -e 'apps/api/dist/main/index.js' ]");
    expect(check).toContain('iDeploy warning:');
    expect(check).not.toContain('exit 1');
  });

  it('puts the check in the Dockerfile after the build, with the Next.js cache', async () => {
    const plan = await analyzeRepository(repo(nxMonorepo), 'apps/avs');
    const file = nodeDockerfile(plan.recipe as Parameters<typeof nodeDockerfile>[0]);
    const build = file.indexOf("run --if-present build");
    const check = file.indexOf("if ! { [ -e 'apps/avs/.next/BUILD_ID' ]");
    expect(build).toBeGreaterThan(0);
    expect(check).toBeGreaterThan(build);
    expect(file).toContain('RUN --mount=type=cache,id=ideploy-next,target=/app/apps/avs/.next/cache if [ -e /tmp/ideploy-workspace-build-failed ]');
    // The workspace build failing falls back to the application's own build.
    expect(file).toContain("run --if-present build || { echo 'iDeploy: the workspace build failed. Building the application on its own instead.'; touch /tmp/ideploy-workspace-build-failed; }");
  });

  it('reads the file a start command runs', () => {
    expect(startEntry('node -r dotenv/config dist/index.js')).toBe('dist/index.js');
    expect(startEntry('NODE_ENV=production node --enable-source-maps ./dist/main')).toBe('dist/main');
    expect(startEntry('cd apps/api && node dist/main.js')).toBe('dist/main.js');
    expect(startEntry('remix-serve ./build/server/index.js')).toBe('build/server/index.js');
    expect(startEntry('tsx src/index.ts')).toBeNull();
    expect(buildOutputContract('Node.js', 'node $ENTRY', '', null)).toBeNull();
  });
});

describe('a version that cannot start', () => {
  it('explains the crash from the container logs', () => {
    expect(
      explainRuntimeFailure("✓ Ready in 157ms\nError: Could not find a production build in the '.next' directory. Try building your app")?.code
    ).toBe('NO_BUILD_OUTPUT');
    expect(explainRuntimeFailure('Error: listen EADDRINUSE: address already in use :::3000')?.code).toBe('PORT_IN_USE');
    expect(explainRuntimeFailure("Error: Cannot find module '/app/dist/main.js'")?.code).toBe('ENTRY_NOT_FOUND');
    expect(explainRuntimeFailure("Error: Cannot find module 'express'")?.code).toBe('MODULE_NOT_FOUND');
    expect(explainRuntimeFailure('Error: connect ECONNREFUSED 127.0.0.1:5432')?.code).toBe('DATABASE_UNREACHABLE');
    expect(explainRuntimeFailure('server started')).toBeNull();
  });

  it('runs the trial with the container’s environment, unless the app opts out', () => {
    expect(trialEnvironment(['A=1'], 3000)).toEqual(['A=1', 'PORT=3000', 'HOST=0.0.0.0']);
    expect(trialEnvironment(['PORT=8080', 'HOST=::'], 3000)).toEqual(['PORT=8080', 'HOST=::']);
    expect(trialDisabled(['IDEPLOY_TRIAL=false'])).toBe(true);
    expect(trialDisabled(['IDEPLOY_TRIAL= off '])).toBe(true);
    expect(trialDisabled(['IDEPLOY_TRIAL=true', 'X=false'])).toBe(false);
  });
});

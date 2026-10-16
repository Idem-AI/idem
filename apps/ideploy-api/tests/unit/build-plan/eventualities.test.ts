/**
 * What else goes wrong between a repository and a running application, and
 * the mechanism for each: retries that change what failed, a checkout made
 * complete, a site found where the build wrote it, a process that stops cleanly.
 */
import { describe, it, expect } from 'vitest';
import YAML from 'yaml';
import { analyzeRepository, RepoFiles } from '../../../api/build-plan';
import { JavaRecipe } from '../../../api/build-plan/types';
import { explainFailure } from '../../../api/build-plan/failures';
import { DOCKER_HUB_MIRROR, javaDockerfile, nodeDockerfile } from '../../../api/docker/recipes';
import { BuildContext, planBuild } from '../../../api/docker/build-packs';
import { generateComposeFile } from '../../../api/docker/compose';
import { parseLoopbackOnlyPorts } from '../../../api/docker/listening-ports';
import { fetchSubmodulesAndLfs } from '../../../api/jobs/deployment.worker';
import { applicationRow } from '../../helpers/rows';

function repo(files: Record<string, string | object>): RepoFiles {
  const contents = new Map(Object.entries(files).map(([p, c]) => [p, typeof c === 'string' ? c : JSON.stringify(c)]));
  return { paths: [...contents.keys()], read: async (p) => contents.get(p) ?? null };
}

const context = (overrides: Partial<BuildContext> = {}): BuildContext => ({
  srcDir: '/data/src',
  workdir: '/data',
  imageTag: 'app:1',
  port: 3000,
  ...overrides,
});

const script = (plan: { steps: { command: string }[] }) => plan.steps.map((s) => s.command).join('\n');

describe('build failures with a retry that changes what failed', () => {
  it('names the cause of each', () => {
    expect(explainFailure('toomanyrequests: You have reached your pull rate limit.')?.code).toBe('DOCKERHUB_RATE_LIMIT');
    expect(explainFailure('npm error code E401\nnpm error 401 Unauthorized')?.code).toBe('PRIVATE_PACKAGE');
    expect(explainFailure('<--- JS stacktrace --->\nFATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory')?.code).toBe('NODE_HEAP');
    expect(explainFailure('process "/bin/sh -c npm run build" did not complete successfully: exit code: 137')?.code).toBe('OUT_OF_MEMORY');
  });

  it('builds Node with a heap argument, husky and Cypress off, and pnpm 10 install scripts allowed', () => {
    const pnpm = nodeDockerfile({
      kind: 'node',
      nodeVersion: '22',
      manager: 'pnpm',
      pnpmMajor: 10,
      hasPackageManagerField: false,
      install: 'pnpm install --frozen-lockfile',
      build: 'pnpm run build',
      start: 'pnpm run start',
      nextCacheDir: null,
      output: null,
    });
    expect(pnpm).toContain('ENV CI=1 HUSKY=0 CYPRESS_INSTALL_BINARY=0');
    expect(pnpm).toContain('ARG NODE_OPTIONS');
    expect(pnpm).toContain("RUN printf '\\ndangerously-allow-all-builds=true\\n' >> .npmrc");
    expect(pnpm.indexOf('dangerously-allow-all-builds')).toBeLessThan(pnpm.indexOf('pnpm install --frozen-lockfile'));
    const npm = nodeDockerfile({
      kind: 'node',
      nodeVersion: '22',
      manager: 'npm',
      pnpmMajor: null,
      hasPackageManagerField: false,
      install: 'npm ci',
      build: null,
      start: 'npm run start',
      nextCacheDir: null,
      output: null,
    });
    expect(npm).not.toContain('dangerously-allow-all-builds');
  });

  it('pulls the base images from Google’s mirror after a Docker Hub refusal', () => {
    const recipe: JavaRecipe = { kind: 'java', tool: 'maven', jdk: 21, wrapper: true, module: '', framework: 'Spring Boot', build: './mvnw -B -DskipTests package' };
    const file = javaDockerfile(recipe, [], DOCKER_HUB_MIRROR);
    expect(file).toContain('FROM mirror.gcr.io/library/eclipse-temurin:21-jdk AS build');
    expect(file).toContain('FROM mirror.gcr.io/library/eclipse-temurin:21-jre');
  });
});

describe('a repository that needs completing', () => {
  it('builds with the official Gradle image when the wrapper jar was not committed', async () => {
    const files = {
      'build.gradle': "plugins { id 'org.springframework.boot' version '3.3.0' }",
      gradlew: '',
      'gradle/wrapper/gradle-wrapper.properties': 'distributionUrl=https\\://services.gradle.org/distributions/gradle-8.10.2-bin.zip',
    };
    const plan = await analyzeRepository(repo(files), '');
    expect(plan.recipe).toMatchObject({ kind: 'java', wrapper: false, gradleVersion: '8.10.2', build: 'gradle build -x test -x check --no-daemon' });
    expect(plan.issues.find((i) => i.code === 'WRAPPER_INCOMPLETE')?.severity).toBe('info');
    expect(javaDockerfile(plan.recipe as JavaRecipe)).toContain('FROM gradle:8.10.2-jdk21 AS build');

    const complete = await analyzeRepository(repo({ ...files, 'gradle/wrapper/gradle-wrapper.jar': '' }), '');
    expect(complete.recipe).toMatchObject({ wrapper: true, build: './gradlew build -x test -x check --no-daemon' });
  });

  it('strips Windows line endings from the wrappers', () => {
    const file = javaDockerfile({ kind: 'java', tool: 'gradle', jdk: 21, wrapper: true, module: '', framework: 'Java', build: './gradlew build' });
    expect(file).toContain("sed -i 's/\\r$//' \"$w\" && chmod +x \"$w\"");
  });

  it('fetches submodules with the clone’s token, and Git LFS files', () => {
    const withToken = fetchSubmodulesAndLfs('https://x-access-token:tok123@github.com/acme/app.git');
    expect(withToken).toContain("-c 'url.https://x-access-token:tok123@github.com/.insteadOf=https://github.com/'");
    expect(withToken).toContain("-c 'url.https://x-access-token:tok123@github.com/.insteadOf=git@github.com:'");
    expect(withToken).toContain('submodule update --init --recursive --depth 1');
    const publicRepo = fetchSubmodulesAndLfs(null);
    expect(publicRepo).toContain('git submodule update --init --recursive --depth 1');
    expect(publicRepo).toContain("grep -qs 'filter=lfs' .gitattributes");
    expect(publicRepo).toContain('git lfs pull');
  });
});

describe('a static site', () => {
  it('serves the folder the build really wrote, never the unbuilt template', () => {
    const command = script(planBuild('static', context({ publishDirectory: 'apps/web/dist', buildCommand: 'npm run build' })));
    expect(command).toContain("P='apps/web/dist'");
    expect(command).toContain("for c in 'apps/web/build' 'apps/web/out' 'apps/web/dist/browser' 'apps/web/.output/public' 'apps/web/www'");
    expect(command).toContain('"$P" > Dockerfile.ideploy-static');
    expect(command).not.toContain("'apps/web/public'");
  });

  it('serves a plain HTML folder itself, and never its .git', () => {
    const command = script(planBuild('static', context()));
    expect(command).toContain("[ -f './index.html' ] && [ ! -f './package.json' ]; then F='.'");
    expect(command).toContain("grep -qxE '/?\\.git/?' .dockerignore 2>/dev/null || printf '\\n.git\\n' >> .dockerignore");
  });
});

describe('a running application', () => {
  it('runs with an init process that passes signals on', () => {
    const parsed = YAML.parse(generateComposeFile(applicationRow({ uuid: 'abc' }), 'img:tag')) as { services: Record<string, { init?: boolean }> };
    expect(Object.values(parsed.services)[0].init).toBe(true);
  });

  it('tells a server bound to localhost from one serving nothing', () => {
    const table = [
      '  sl  local_address rem_address   st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode',
      '   0: 0100007F:0BB8 00000000:0000 0A 00000000:00000000 00:00000000 00000000     0        0 1 1',
      '   1: 0100007F:1F90 00000000:0000 0A 00000000:00000000 00:00000000 00000000     0        0 2 1',
      '   2: 00000000:1F90 00000000:0000 0A 00000000:00000000 00:00000000 00000000     0        0 3 1',
    ].join('\n');
    // 3000 on 127.0.0.1 only; 8080 also on 0.0.0.0, so reachable.
    expect(parseLoopbackOnlyPorts(table)).toEqual([3000]);
  });
});

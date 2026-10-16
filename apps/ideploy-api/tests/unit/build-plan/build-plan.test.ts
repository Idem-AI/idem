import { describe, it, expect } from 'vitest';
import { analyzeRepository, describePlan, parseSnapshot, RepoFiles } from '../../../api/build-plan';
import { nodeMajorFromSpec, supportedNodeMajor, parsePnpmWorkspace, pnpmMajorForLockfile } from '../../../api/build-plan/node';
import { gradleIncludes, javaVersionFromGradle, javaVersionFromMaven } from '../../../api/build-plan/java';
import { explainFailure } from '../../../api/build-plan/failures';

function repo(files: Record<string, string | object>): RepoFiles {
  const contents = new Map(Object.entries(files).map(([p, c]) => [p, typeof c === 'string' ? c : JSON.stringify(c)]));
  return { paths: [...contents.keys()], read: async (p) => contents.get(p) ?? null };
}

const turborepo = {
  'package.json': { name: 'acme', private: true, scripts: { build: 'turbo run build' }, devDependencies: { turbo: '^2' } },
  'pnpm-workspace.yaml': "packages:\n  - 'apps/*'\n  - \"packages/*\"\n",
  'pnpm-lock.yaml': "lockfileVersion: '9.0'\n",
  'turbo.json': {},
  '.nvmrc': '20\n',
  'apps/web/package.json': { name: 'web', scripts: { dev: 'next dev', build: 'next build', start: 'next start' }, dependencies: { next: '15', '@acme/ui': 'workspace:*' } },
  'apps/api/package.json': {
    name: '@acme/api',
    scripts: { build: 'nest build', start: 'nest start', 'start:dev': 'nest start --watch', 'start:prod': 'node dist/main' },
    dependencies: { '@nestjs/core': '10' },
  },
  'packages/ui/package.json': { name: '@acme/ui', main: 'index.js', scripts: { build: 'tsc' }, dependencies: { react: '19' } },
  'packages/ui/index.js': '',
};

describe('build plan — JavaScript monorepo', () => {
  it('asks which application at the root, listing them', async () => {
    const plan = await analyzeRepository(repo(turborepo), '');
    expect(plan.apps?.map((a) => a.dir)).toEqual(['apps/api', 'apps/web']);
    const blocking = plan.issues.find((i) => i.severity === 'blocking');
    expect(blocking?.code).toBe('MONOREPO_PICK_APP');
    expect(blocking?.message).toContain('apps/web (Next.js)');
    expect(plan.issues.some((i) => i.code === 'NO_START_COMMAND')).toBe(false);
  });

  it('builds an application from the workspace root with turbo', async () => {
    const plan = await analyzeRepository(repo(turborepo), 'apps/web');
    expect(plan).toMatchObject({
      framework: 'Next.js',
      buildRoot: '',
      appDir: 'apps/web',
      output: 'server',
      tool: 'pnpm',
      build: 'npx turbo run build --filter=web',
      start: 'cd apps/web && pnpm run start',
      workspace: { manager: 'pnpm', orchestrator: 'turbo', packageName: 'web' },
      nixpacksEnv: { NIXPACKS_NODE_VERSION: '20' },
    });
    expect(plan.issues.filter((i) => i.severity === 'blocking')).toEqual([]);
  });

  it('prefers the production start script', async () => {
    const plan = await analyzeRepository(repo(turborepo), 'apps/api');
    expect(plan.framework).toBe('NestJS');
    expect(plan.start).toBe('cd apps/api && pnpm run start:prod');
  });

  it('picks the only application of a monorepo on its own', async () => {
    const files = { ...turborepo } as Record<string, string | object>;
    delete files['apps/api/package.json'];
    const plan = await analyzeRepository(repo(files), '');
    expect(plan.appDir).toBe('apps/web');
    expect(plan.issues[0].code).toBe('MONOREPO_SINGLE_APP');
  });

  it('lets the user’s start command deploy the root', async () => {
    const plan = await analyzeRepository(repo(turborepo), '', { overrides: { start: 'pnpm --filter web start' } });
    expect(plan.issues.filter((i) => i.severity === 'blocking')).toEqual([]);
  });

  it('builds a static site of a pnpm workspace with its dependencies', async () => {
    const plan = await analyzeRepository(
      repo({
        'package.json': { name: 'root', workspaces: ['apps/*'] },
        'pnpm-lock.yaml': "lockfileVersion: '6.0'\n",
        'apps/admin/package.json': { name: 'admin', scripts: { dev: 'vite', build: 'vite build' }, devDependencies: { vite: '5' } },
        'apps/admin/index.html': '',
        'apps/admin/vite.config.ts': "export default { build: { outDir: 'public-build' } }",
      }),
      'apps/admin'
    );
    expect(plan).toMatchObject({
      framework: 'Vite',
      output: 'static',
      buildRoot: '',
      build: "pnpm --filter 'admin...' run --if-present build",
      install: 'npm install -g --force corepack@latest && corepack enable && corepack prepare pnpm@8 --activate && pnpm install --frozen-lockfile',
      publishDirectory: 'apps/admin/public-build',
    });
  });
});

describe('build plan — JavaScript applications', () => {
  it('serves a Vite SPA as static files', async () => {
    const plan = await analyzeRepository(
      repo({
        'package.json': { name: 'spa', scripts: { dev: 'vite', start: 'vite', build: 'vite build' }, devDependencies: { vite: '5' }, engines: { node: '>=18' } },
        'package-lock.json': '{}',
        'index.html': '',
        '.nvmrc': 'v18.17.0',
      }),
      ''
    );
    expect(plan).toMatchObject({ output: 'static', install: 'npm ci', build: 'npm run build', publishDirectory: 'dist' });
    expect(plan.nixpacksEnv.NIXPACKS_NODE_VERSION).toBe('18');
  });

  it('reads the Angular output folder, and serves SSR as a server', async () => {
    const angular = (ssr: boolean) => ({
      'package.json': { name: 'shop', scripts: { start: 'ng serve', build: 'ng build' }, dependencies: { '@angular/core': '20' } },
      'package-lock.json': '{}',
      'angular.json': {
        projects: { shop: { projectType: 'application', architect: { build: { builder: '@angular/build:application', options: { outputPath: 'dist/shop', ...(ssr ? { ssr: { entry: 'src/server.ts' } } : {}) } } } } },
      },
    });
    const spa = await analyzeRepository(repo(angular(false)), '');
    expect(spa).toMatchObject({ output: 'static', publishDirectory: 'dist/shop/browser' });
    const ssr = await analyzeRepository(repo(angular(true)), '');
    expect(ssr).toMatchObject({ output: 'server', framework: 'Angular (SSR)', start: 'node dist/shop/server/server.mjs' });
  });

  it('serves a Next static export from out/', async () => {
    const plan = await analyzeRepository(
      repo({
        'package.json': { scripts: { build: 'next build', start: 'next start' }, dependencies: { next: '15' } },
        'next.config.mjs': "export default { output: 'export' }",
      }),
      ''
    );
    expect(plan).toMatchObject({ output: 'static', publishDirectory: 'out' });
  });

  it('starts a server without a start script from its main file, and leaves a plain start script to nixpacks', async () => {
    const main = await analyzeRepository(repo({ 'package.json': { dependencies: { express: '4' } }, 'server.js': '' }), '');
    expect(main.start).toBe('node server.js');
    const script = await analyzeRepository(repo({ 'package.json': { scripts: { start: 'node app.js' }, dependencies: { express: '4' } } }), '');
    expect(script.start).toBeUndefined();
  });

  it('stops before the build when nothing can start the application', async () => {
    const plan = await analyzeRepository(repo({ 'package.json': { dependencies: { express: '4' } } }), '');
    expect(plan.issues.find((i) => i.severity === 'blocking')?.code).toBe('NO_START_COMMAND');
    const own = await analyzeRepository(repo({ 'package.json': { dependencies: { express: '4' } } }), '', { overrides: { start: 'node dist/x.js' } });
    expect(own.issues.find((i) => i.severity === 'blocking')).toBeUndefined();
  });

  it('says a SvelteKit adapter for another host builds nothing runnable', async () => {
    const plan = await analyzeRepository(
      repo({ 'package.json': { devDependencies: { '@sveltejs/kit': '2', '@sveltejs/adapter-auto': '3' } }, 'svelte.config.js': "import adapter from '@sveltejs/adapter-auto'" }),
      ''
    );
    expect(plan.issues.find((i) => i.severity === 'blocking')?.code).toBe('SVELTEKIT_ADAPTER');
  });
});

describe('build plan — Java', () => {
  const springPom = (extra = '') =>
    `<project><properties><java.version>17</java.version></properties>${extra}<build><plugins><plugin><artifactId>spring-boot-maven-plugin</artifactId></plugin></plugins></build><dependencies>org.springframework.boot</dependencies></project>`;

  it('leaves a single Spring Boot project to nixpacks, with its JDK', async () => {
    const plan = await analyzeRepository(repo({ 'pom.xml': springPom(), mvnw: '' }), '');
    expect(plan).toMatchObject({ language: 'java', framework: 'Spring Boot (Maven)', output: 'server', nixpacksEnv: { NIXPACKS_JDK_VERSION: '17' } });
    expect(plan.start).toBeUndefined();
  });

  it('runs the application module of a multi-module Maven build', async () => {
    const files = {
      'pom.xml': '<project><packaging>pom</packaging><modules><module>common</module><module>api</module></modules></project>',
      mvnw: '',
      'common/pom.xml': '<project><artifactId>common</artifactId></project>',
      'api/pom.xml': springPom(),
    };
    const plan = await analyzeRepository(repo(files), '');
    expect(plan.build).toBe('./mvnw -B -DskipTests -pl api -am package');
    expect(plan.start).toContain('-Dserver.port=$PORT');
    expect(plan.start).toContain('ls api/target/*.jar');
    expect(plan.nixpacksEnv.NIXPACKS_JDK_VERSION).toBe('17');

    const fromModule = await analyzeRepository(repo(files), 'api');
    expect(fromModule).toMatchObject({ buildRoot: '', appDir: 'api', build: './mvnw -B -DskipTests -pl api -am package' });
  });

  it('asks which module when several can run', async () => {
    const plan = await analyzeRepository(
      repo({
        'pom.xml': '<project><modules><module>api</module><module>admin</module></modules></project>',
        'api/pom.xml': springPom(),
        'admin/pom.xml': springPom(),
      }),
      ''
    );
    expect(plan.issues.find((i) => i.severity === 'blocking')?.code).toBe('JAVA_PICK_MODULE');
  });

  it('reads Gradle multi-projects, toolchains and the wrapper version', async () => {
    const files = {
      'settings.gradle.kts': 'rootProject.name = "x"\ninclude("app", "lib")',
      'build.gradle.kts': '',
      gradlew: '',
      'gradle/wrapper/gradle-wrapper.properties': 'distributionUrl=https\\://services.gradle.org/distributions/gradle-8.10-bin.zip',
      'app/build.gradle.kts': 'plugins { id("org.springframework.boot") }\njava { toolchain { languageVersion = JavaLanguageVersion.of(21) } }',
      'lib/build.gradle.kts': 'plugins { `java-library` }',
    };
    const plan = await analyzeRepository(repo(files), '');
    expect(plan).toMatchObject({ tool: 'gradle', build: './gradlew :app:build -x test -x check', nixpacksEnv: { NIXPACKS_JDK_VERSION: '21' } });
    expect(plan.start).toContain('app/build/libs');
    expect(plan.start).toContain("grep -v -e '-plain.jar'");

    const gradle9 = await analyzeRepository(
      repo({ ...files, 'gradle/wrapper/gradle-wrapper.properties': 'distributionUrl=https\\://services.gradle.org/distributions/gradle-9.1.0-bin.zip' }),
      ''
    );
    expect(gradle9.issues.find((i) => i.severity === 'blocking')?.code).toBe('UNSUPPORTED_GRADLE_VERSION');
  });

  it('runs the root of a Gradle build whose modules are libraries', async () => {
    const plan = await analyzeRepository(
      repo({
        'settings.gradle': "include 'lib'",
        'build.gradle': "plugins { id 'org.springframework.boot' version '3.3.0' }",
        'lib/build.gradle': "plugins { id 'java-library' }",
      }),
      ''
    );
    expect(plan.issues.filter((i) => i.severity === 'blocking')).toEqual([]);
    expect(plan.start).toBeUndefined();
  });

  it('starts Quarkus on $PORT', async () => {
    const plan = await analyzeRepository(repo({ 'pom.xml': '<project><dependencies>io.quarkus</dependencies></project>' }), '');
    expect(plan.start).toBe('java -Dquarkus.http.host=0.0.0.0 -Dquarkus.http.port=$PORT $JAVA_OPTS -jar target/quarkus-app/quarkus-run.jar');
  });

  it('parses Java versions', () => {
    expect(javaVersionFromMaven('<maven.compiler.source>1.8</maven.compiler.source>')).toBe(8);
    expect(javaVersionFromMaven('<maven.compiler.release>21</maven.compiler.release>')).toBe(21);
    expect(javaVersionFromGradle('sourceCompatibility = JavaVersion.VERSION_1_8')).toBe(8);
    expect(javaVersionFromGradle("sourceCompatibility = '17'")).toBe(17);
    expect(javaVersionFromGradle('kotlin { jvmToolchain(21) }')).toBe(21);
    expect(gradleIncludes("include ':api', ':services:web'")).toEqual(['api', 'services/web']);
  });
});

describe('build plan — server and helpers', () => {
  it('stops on a full disk and warns on little memory', async () => {
    const files = repo(turborepo);
    const full = await analyzeRepository(files, 'apps/web', { resources: { memoryAvailableMb: 800, diskFreeMb: 500 } });
    expect(full.issues.map((i) => `${i.code}:${i.severity}`)).toEqual(expect.arrayContaining(['LOW_DISK:blocking', 'LOW_MEMORY:warning']));
  });

  it('describes the plan for the log', async () => {
    const plan = await analyzeRepository(repo(turborepo), 'apps/web');
    const lines = describePlan(plan, { start: 'node x.js (yours)' });
    expect(lines[0]).toBe('Application: apps/web — Next.js, server');
    expect(lines).toContain('Start:   node x.js (yours)');
    expect(lines.join('\n')).toContain('Node 20 (from .nvmrc)');
  });

  it('parses node versions', () => {
    expect(nodeMajorFromSpec('>=18')).toBe(22);
    expect(nodeMajorFromSpec('^18 || ^20')).toBe(20);
    expect(nodeMajorFromSpec('v18.17.0')).toBe(18);
    expect(nodeMajorFromSpec('lts/*')).toBe(22);
    expect(nodeMajorFromSpec('>=18 <21')).toBe(18);
    expect(supportedNodeMajor(19)).toBe(20);
    expect(supportedNodeMajor(24)).toBe(22);
    expect(pnpmMajorForLockfile("lockfileVersion: '9.0'")).toBe(9);
    expect(parsePnpmWorkspace("packages:\n  - apps/*\n  - '!apps/legacy' # old\ncatalog:\n  - x")).toEqual(['apps/*', '!apps/legacy']);
  });

  it('reads the snapshot printed by the server', async () => {
    const b64 = Buffer.from('{"name":"x"}').toString('base64');
    const snap = parseSnapshot(`@@MEM 2048\n@@DISK 9000\n@@F package.json\n@@F src/index.js\n@@C package.json ${b64}\n`);
    expect(snap.memoryAvailableMb).toBe(2048);
    expect(snap.diskFreeMb).toBe(9000);
    expect(snap.files.paths).toEqual(['package.json', 'src/index.js']);
    expect(await snap.files.read('package.json')).toBe('{"name":"x"}');
  });

  it('explains known build failures', () => {
    expect(explainFailure('ERR_PNPM_OUTDATED_LOCKFILE  Cannot install with "frozen-lockfile"')?.code).toBe('LOCKFILE_OUT_OF_DATE');
    expect(explainFailure('FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory')?.code).toBe('NODE_HEAP');
    expect(explainFailure('[ERROR] error: invalid target release: 21')?.code).toBe('JDK_MISMATCH');
    expect(explainFailure('npm ERR! network request failed, reason: ETIMEDOUT')).toMatchObject({ code: 'NETWORK', retryable: true });
    expect(explainFailure('everything is fine')).toBeNull();
  });
});

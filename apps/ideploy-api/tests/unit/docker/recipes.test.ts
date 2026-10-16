import { describe, it, expect } from 'vitest';
import { javaDockerfile, nodeDockerfile, recipeLabel } from '../../../api/docker/recipes';
import { recipePlan } from '../../../api/docker/build-packs';
import { analyzeRepository, RepoFiles } from '../../../api/build-plan';
import { JavaRecipe, NodeRecipe } from '../../../api/build-plan/types';

function repo(files: Record<string, string | object>): RepoFiles {
  const contents = new Map(Object.entries(files).map(([p, c]) => [p, typeof c === 'string' ? c : JSON.stringify(c)]));
  return { paths: [...contents.keys()], read: async (p) => contents.get(p) ?? null };
}

const node: NodeRecipe = {
  kind: 'node',
  nodeVersion: '22',
  manager: 'pnpm',
  pnpmMajor: 9,
  hasPackageManagerField: false,
  install: 'pnpm install --frozen-lockfile',
  build: 'npx turbo run build --filter=web',
  start: 'cd apps/web && pnpm run start',
  nextCacheDir: 'apps/web/.next/cache',
};

const java: JavaRecipe = {
  kind: 'java',
  tool: 'maven',
  jdk: 25,
  wrapper: true,
  module: 'api',
  framework: 'Spring Boot',
  build: './mvnw -B -DskipTests -pl api -am package',
};

describe('recipes — Node', () => {
  it('builds on the official image of the version read from the code, with the store cached', () => {
    const file = nodeDockerfile(node, ['NEXT_PUBLIC_API_URL']);
    expect(file).toMatch(/^FROM node:22-slim\n/);
    expect(file).toContain('ARG NEXT_PUBLIC_API_URL');
    expect(file).toContain('npm install -g corepack@latest && corepack enable && corepack prepare pnpm@9 --activate');
    expect(file).toContain('RUN --mount=type=cache,id=ideploy-pnpm,target=/pnpm/store pnpm install --frozen-lockfile');
    expect(file).toContain('RUN --mount=type=cache,id=ideploy-next,target=/app/apps/web/.next/cache npx turbo run build --filter=web');
    expect(file).toContain('CMD ["sh", "-c", "cd apps/web && pnpm run start"]');
    // The build variables are ARGs before the build, never baked as ENV.
    expect(file.indexOf('ARG NEXT_PUBLIC_API_URL')).toBeLessThan(file.indexOf('turbo run build'));
    expect(file).not.toContain('ENV NEXT_PUBLIC_API_URL');
  });

  it('uses the pnpm package.json names, and no corepack for npm', () => {
    expect(nodeDockerfile({ ...node, hasPackageManagerField: true })).toContain('corepack enable && corepack install');
    const npm = nodeDockerfile({ ...node, manager: 'npm', install: 'npm ci', build: null, nextCacheDir: null });
    expect(npm).not.toContain('corepack');
    expect(npm).toContain('RUN --mount=type=cache,id=ideploy-npm,target=/root/.npm npm ci');
    expect(npm).not.toContain('turbo');
  });

  it('refuses build variable names that are not identifiers', () => {
    expect(nodeDockerfile(node, ['OK_1', 'bad-name', 'x;rm'])).not.toMatch(/ARG (bad-name|x;rm)/);
  });
});

describe('recipes — Java', () => {
  it('builds the module with its wrapper and runs its jar on any JDK', () => {
    const file = javaDockerfile(java);
    expect(file).toContain('FROM eclipse-temurin:25-jdk AS build');
    expect(file).toContain('--mount=type=cache,id=ideploy-m2,target=/root/.m2');
    expect(file).toContain('./mvnw -B -DskipTests -pl api -am package');
    expect(file).toContain('ls -S api/target/*.jar');
    expect(file).toContain('FROM eclipse-temurin:25-jre');
    expect(file).toContain('CMD ["sh", "-c", "exec java -Dserver.port=${PORT:-8080} $JAVA_OPTS -jar app.jar"]');
  });

  it('uses the official build tool image without a wrapper', () => {
    expect(javaDockerfile({ ...java, wrapper: false })).toContain('FROM maven:3.9-eclipse-temurin-25 AS build');
    const gradle = javaDockerfile({ ...java, tool: 'gradle', wrapper: false, jdk: 21, module: '', build: 'gradle build -x test -x check --no-daemon' });
    expect(gradle).toContain('FROM gradle:jdk21 AS build');
    expect(gradle).toContain('--mount=type=cache,id=ideploy-gradle,target=/root/.gradle');
    expect(gradle).toContain('ls -S build/libs/*.jar');
  });

  it('copies the Quarkus application folder', () => {
    const file = javaDockerfile({ ...java, framework: 'Quarkus', module: '' });
    expect(file).toContain('cp -r target/quarkus-app /out/');
    expect(file).toContain('-Dquarkus.http.port=${PORT:-8080} $JAVA_OPTS -jar quarkus-app/quarkus-run.jar');
  });
});

describe('recipes — from the build plan', () => {
  it('gives a Gradle 9 project a recipe, and keeps the nixpacks limit only for nixpacks', async () => {
    const plan = await analyzeRepository(
      repo({
        'build.gradle.kts': 'plugins { id("org.springframework.boot") }\njava { toolchain { languageVersion = JavaLanguageVersion.of(25) } }',
        gradlew: '',
        'gradle/wrapper/gradle-wrapper.properties': 'distributionUrl=https\\://services.gradle.org/distributions/gradle-9.1.0-bin.zip',
      }),
      ''
    );
    expect(plan.recipe).toMatchObject({ kind: 'java', tool: 'gradle', jdk: 25, wrapper: true, build: './gradlew build -x test -x check --no-daemon' });
    expect(plan.issues.find((i) => i.code === 'UNSUPPORTED_GRADLE_VERSION')?.engine).toBe('nixpacks');
  });

  it('gives a Node server a recipe with its start script', async () => {
    const plan = await analyzeRepository(
      repo({
        'package.json': { scripts: { build: 'tsc', start: 'node dist/index.js' }, dependencies: { express: '4' }, engines: { node: '24' } },
        'package-lock.json': '{}',
      }),
      ''
    );
    expect(plan.recipe).toMatchObject({ kind: 'node', nodeVersion: '24', manager: 'npm', install: 'npm ci', build: 'npm run build', start: 'npm run start' });
  });

  it('gives no recipe to a static site, a blocked app or bun', async () => {
    const spa = await analyzeRepository(repo({ 'package.json': { scripts: { build: 'vite build' }, devDependencies: { vite: '5' } }, 'index.html': '' }), '');
    expect(spa.recipe).toBeUndefined();
    const blocked = await analyzeRepository(repo({ 'package.json': { dependencies: { express: '4' } } }), '');
    expect(blocked.recipe).toBeUndefined();
    const bun = await analyzeRepository(repo({ 'package.json': { scripts: { start: 'bun run index.ts' } }, 'bun.lockb': '' }), '');
    expect(bun.recipe).toBeUndefined();
  });

  it('writes the Dockerfile on the server and builds it with BuildKit', () => {
    const plan = recipePlan({ srcDir: '/data/src', workdir: '/data', imageTag: 'app:1', port: 3000, buildEnv: ['API_URL=https://x'] }, 'FROM x\n', recipeLabel(node));
    expect(plan.pack).toBe('recipe');
    const command = plan.steps[0].command;
    expect(plan.steps[0].label).toBe('Building image (iDeploy recipe: Node 22 (pnpm))');
    expect(command).toContain(`echo ${Buffer.from('FROM x\n').toString('base64')} | base64 -d > Dockerfile.ideploy`);
    expect(command).toContain("DOCKER_BUILDKIT=1 docker build --progress=plain -f Dockerfile.ideploy --build-arg 'API_URL=https://x' -t 'app:1' .");
    expect(command).toContain("[ -e .dockerignore ] || printf '.git\\n' > .dockerignore");
  });
});

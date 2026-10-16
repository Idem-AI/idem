/**
 * iDeploy's own build recipes: a Dockerfile generated from the build plan.
 *
 * nixpacks guesses at build time and ships its own toolchains: JDK 21 and
 * Gradle 8 at most, no dependency cache, multi-gigabyte images. When the plan
 * knows the application (a Node server, a Java jar), iDeploy writes the
 * Dockerfile itself, on the official images, with BuildKit cache mounts — the
 * npm/pnpm/yarn store, ~/.m2, ~/.gradle survive between builds on the server,
 * so a redeploy downloads nothing it already has.
 *
 * The Dockerfile is written next to the code on the server, never committed.
 */
import { JavaRecipe, NodeRecipe } from '../build-plan/types';
import { FRESH_COREPACK } from '../build-plan/node';

/** Build-time Variables become ARGs: the build steps see them as environment. */
function argLines(buildArgKeys: string[]): string[] {
  return [...new Set(buildArgKeys)].filter((k) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(k)).map((k) => `ARG ${k}`);
}

/** A JSON string for an exec-form instruction. */
const json = (value: string) => JSON.stringify(value);

const NODE_CACHES: Record<NodeRecipe['manager'], string> = {
  npm: '--mount=type=cache,id=ideploy-npm,target=/root/.npm',
  pnpm: '--mount=type=cache,id=ideploy-pnpm,target=/pnpm/store',
  // Yarn 1, and Yarn 2+ with its global cache (the default since Yarn 4).
  yarn: '--mount=type=cache,id=ideploy-yarn,target=/usr/local/share/.cache/yarn --mount=type=cache,id=ideploy-yarn-berry,target=/root/.yarn/berry/cache',
};

/** An install that accepts a lockfile out of step with package.json (the retry after a frozen install failed). */
export function lenientInstall(manager: NodeRecipe['manager']): string {
  if (manager === 'pnpm') return 'pnpm install --no-frozen-lockfile';
  if (manager === 'yarn') return 'YARN_ENABLE_IMMUTABLE_INSTALLS=false yarn install';
  return 'npm install';
}

/** A value single-quoted for sh. */
const sq = (value: string) => `'${value.replace(/'/g, `'\\''`)}'`;

/**
 * The build's output contract, checked in the image (see buildOutputContract):
 * missing after the workspace build, the application's own build runs; still
 * missing, a certain contract fails the build with what to fix, a guessed one
 * warns.
 */
export function outputCheck(output: NonNullable<NodeRecipe['output']>, mounts = ''): string {
  const present = [output.path, ...output.alternatives].map((p) => `[ -e ${sq(p)} ]`).join(' || ');
  const missing = `The build did not produce ${output.path}, which the start command runs.`;
  const steps: string[] = [];
  if (output.build) {
    steps.push(
      `if ! { ${present}; }; then echo ${sq(`iDeploy: ${output.path} was not produced by the workspace build. Running the application's own build: ${output.build}`)}; ( ${output.build} ); fi`
    );
  }
  steps.push(
    output.strict
      ? `if ! { ${present}; }; then echo ${sq(`iDeploy: ${missing} Its "build" script must build this application.`)} >&2; exit 1; fi`
      : `if ! { ${present}; }; then echo ${sq(`iDeploy warning: ${missing} If the application does not start, check its "build" script.`)}; fi`
  );
  return `RUN${mounts} ${steps.join('; ')}`;
}

/** Environment of both stages: no prompt, no telemetry, patient downloads. */
const NODE_ENV_LINE =
  'ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 COREPACK_HOME=/corepack NEXT_TELEMETRY_DISABLED=1 ' +
  'npm_config_store_dir=/pnpm/store npm_config_fetch_retries=5 npm_config_fetch_retry_mintimeout=20000 npm_config_fetch_retry_maxtimeout=120000';

/**
 * Two stages. The build runs on the full `node` image — git, python3, make
 * and g++ are there, so native modules (bcrypt, sharp, sqlite3) compile and
 * git dependencies install. The application runs on `node:<v>-slim` with
 * openssl (Prisma's engines need it), and the build variables stay in the
 * build stage.
 */
export function nodeDockerfile(recipe: NodeRecipe, buildArgKeys: string[] = []): string {
  const lines = [
    `FROM node:${recipe.nodeVersion} AS build`,
    'WORKDIR /app',
    NODE_ENV_LINE,
    'ENV CI=1',
    'RUN mkdir -p /corepack',
    ...argLines(buildArgKeys),
    'COPY . .',
  ];
  if (recipe.manager !== 'npm') {
    const activate = recipe.hasPackageManagerField
      ? 'corepack install'
      : recipe.manager === 'pnpm'
        ? `corepack prepare pnpm@${recipe.pnpmMajor ?? 'latest'} --activate`
        : 'true';
    lines.push(`RUN ${NODE_CACHES.npm} ${FRESH_COREPACK} && ${activate}`);
  }
  lines.push(`RUN ${NODE_CACHES[recipe.manager]} ${recipe.install}`);
  const nextCache = recipe.nextCacheDir ? ` --mount=type=cache,id=ideploy-next,target=/app/${recipe.nextCacheDir}` : '';
  if (recipe.build) lines.push(`RUN${nextCache} ${recipe.build}`);
  if (recipe.output) lines.push(outputCheck(recipe.output, nextCache));
  lines.push(
    '',
    `FROM node:${recipe.nodeVersion}-slim`,
    'WORKDIR /app',
    // Not fatal: only Prisma-like engines need it, and a mirror outage must not fail the build.
    'RUN (apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*) || echo "openssl not installed"',
    NODE_ENV_LINE,
    // Node, corepack and the package manager it prepared: the start command may call pnpm or yarn.
    'COPY --from=build /usr/local /usr/local',
    'COPY --from=build /corepack /corepack',
    'COPY --from=build /app /app',
    'ENV NODE_ENV=production',
    `CMD ["sh", "-c", ${json(recipe.start)}]`,
    ''
  );
  return lines.join('\n');
}

/** How each framework is told its port: its own property, not `$PORT`. */
function javaPortFlags(framework: JavaRecipe['framework']): string {
  switch (framework) {
    case 'Spring Boot':
      return '-Dserver.port=${PORT:-8080}';
    case 'Quarkus':
      return '-Dquarkus.http.host=0.0.0.0 -Dquarkus.http.port=${PORT:-8080}';
    case 'Micronaut':
      return '-Dmicronaut.server.port=${PORT:-8080}';
    default:
      return '';
  }
}

function javaBuildImage(recipe: JavaRecipe): string {
  // The wrapper fetches the build tool the project pinned; without one, the
  // official image of the tool on the right JDK.
  if (recipe.wrapper) return `eclipse-temurin:${recipe.jdk}-jdk`;
  return recipe.tool === 'maven' ? `maven:3.9-eclipse-temurin-${recipe.jdk}` : `gradle:jdk${recipe.jdk}`;
}

export function javaDockerfile(recipe: JavaRecipe, buildArgKeys: string[] = []): string {
  const out = recipe.tool === 'maven' ? 'target' : 'build';
  const moduleOut = recipe.module ? `${recipe.module}/${out}` : out;
  const caches =
    recipe.tool === 'maven'
      ? '--mount=type=cache,id=ideploy-m2,target=/root/.m2'
      : '--mount=type=cache,id=ideploy-gradle,target=/root/.gradle';
  // The runnable archive: the largest (a fat jar, or a Spring Boot executable
  // war), never a plain, sources or javadoc jar.
  const libs = `${moduleOut}${recipe.tool === 'gradle' ? '/libs' : ''}`;
  const collect =
    recipe.framework === 'Quarkus'
      ? `cp -r ${moduleOut}/quarkus-app /out/`
      : `jar=$(ls -S ${libs}/*.jar ${libs}/*.war 2>/dev/null | grep -v -e '-plain\\.[jw]ar$' -e '-sources\\.jar$' -e '-javadoc\\.jar$' | head -1) && ` +
        `[ -n "$jar" ] || { echo "No jar was built in ${moduleOut}." >&2; exit 1; } && cp "$jar" /out/app.jar`;
  const jarPath = recipe.framework === 'Quarkus' ? 'quarkus-app/quarkus-run.jar' : 'app.jar';
  const flags = javaPortFlags(recipe.framework);
  return [
    `FROM ${javaBuildImage(recipe)} AS build`,
    'WORKDIR /app',
    // The build tool's JVM sized on the server's memory, not a fixed heap.
    'ENV MAVEN_OPTS="-XX:MaxRAMPercentage=50" GRADLE_OPTS="-XX:MaxRAMPercentage=50 -Dorg.gradle.daemon=false" GRADLE_USER_HOME=/root/.gradle',
    ...argLines(buildArgKeys),
    'COPY . .',
    `RUN ${caches} for w in mvnw gradlew; do [ -f "$w" ] && chmod +x "$w"; done; ${recipe.build}`,
    `RUN mkdir -p /out && ${collect}`,
    '',
    `FROM eclipse-temurin:${recipe.jdk}-jre`,
    'WORKDIR /app',
    'COPY --from=build /out/ ./',
    'ENV JAVA_OPTS="-XX:MaxRAMPercentage=75 -XX:+ExitOnOutOfMemoryError"',
    'EXPOSE 8080',
    `CMD ["sh", "-c", ${json(`exec java ${flags ? `${flags} ` : ''}$JAVA_OPTS -jar ${jarPath}`)}]`,
    '',
  ].join('\n');
}

export function recipeDockerfile(recipe: NodeRecipe | JavaRecipe, buildArgKeys: string[] = []): string {
  return recipe.kind === 'node' ? nodeDockerfile(recipe, buildArgKeys) : javaDockerfile(recipe, buildArgKeys);
}

/** A short name for the log. */
export function recipeLabel(recipe: NodeRecipe | JavaRecipe): string {
  if (recipe.kind === 'node') return `Node ${recipe.nodeVersion} (${recipe.manager})`;
  return `Java ${recipe.jdk} (${recipe.tool}${recipe.wrapper ? ' wrapper' : ''})`;
}

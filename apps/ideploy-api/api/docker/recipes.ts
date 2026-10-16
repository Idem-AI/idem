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

/** Build-time Variables become ARGs: the build steps see them as environment. */
function argLines(buildArgKeys: string[]): string[] {
  return [...new Set(buildArgKeys)].filter((k) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(k)).map((k) => `ARG ${k}`);
}

/** A JSON string for an exec-form instruction. */
const json = (value: string) => JSON.stringify(value);

const NODE_CACHES: Record<NodeRecipe['manager'], string> = {
  npm: '--mount=type=cache,id=ideploy-npm,target=/root/.npm',
  pnpm: '--mount=type=cache,id=ideploy-pnpm,target=/pnpm/store',
  yarn: '--mount=type=cache,id=ideploy-yarn,target=/usr/local/share/.cache/yarn',
};

export function nodeDockerfile(recipe: NodeRecipe, buildArgKeys: string[] = []): string {
  const lines = [
    `FROM node:${recipe.nodeVersion}-slim`,
    'WORKDIR /app',
    'ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 NEXT_TELEMETRY_DISABLED=1 npm_config_store_dir=/pnpm/store CI=1',
    ...argLines(buildArgKeys),
    'COPY . .',
  ];
  if (recipe.manager !== 'npm') {
    // The corepack bundled with older Node fails to verify recent pnpm
    // releases ("Cannot find matching keyid"), and Node 25 ships none.
    const activate = recipe.hasPackageManagerField
      ? 'corepack install'
      : recipe.manager === 'pnpm'
        ? `corepack prepare pnpm@${recipe.pnpmMajor ?? 'latest'} --activate`
        : 'true';
    lines.push(`RUN ${NODE_CACHES.npm} npm install -g corepack@latest && corepack enable && ${activate}`);
  }
  lines.push(`RUN ${NODE_CACHES[recipe.manager]} ${recipe.install}`);
  if (recipe.build) {
    const nextCache = recipe.nextCacheDir ? ` --mount=type=cache,id=ideploy-next,target=/app/${recipe.nextCacheDir}` : '';
    lines.push(`RUN${nextCache} ${recipe.build}`);
  }
  lines.push('ENV NODE_ENV=production', `CMD ["sh", "-c", ${json(recipe.start)}]`, '');
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
  // The runnable jar: the largest one (a fat jar), never a plain, sources or javadoc jar.
  const collect =
    recipe.framework === 'Quarkus'
      ? `cp -r ${moduleOut}/quarkus-app /out/`
      : `jar=$(ls -S ${moduleOut}${recipe.tool === 'gradle' ? '/libs' : ''}/*.jar 2>/dev/null | grep -v -e '-plain.jar$' -e '-sources.jar$' -e '-javadoc.jar$' | head -1) && ` +
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

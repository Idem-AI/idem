/**
 * Java applications: Maven or Gradle, the JDK the code is written for, and —
 * in a multi-module project — which module is the application and how to
 * start its jar (nixpacks looks for `target/*.jar` at the root, where a
 * multi-module build puts none).
 */
import { BuildPlanResult, AppCandidate, PlanIssue } from './types';
import { RepoFiles, joinPath, relativeTo } from './repo-files';

/** JDKs nixpacks installs. */
export const JDK_VERSIONS = [8, 11, 17, 21];

/** `1.8` → 8, `17` → 17. */
function javaMajor(value: string | undefined): number | null {
  if (!value) return null;
  const m = /^\s*(?:1\.)?(\d+)/.exec(value);
  return m ? Number(m[1]) : null;
}

export function javaVersionFromMaven(pom: string): number | null {
  for (const re of [
    /<java\.version>\s*([\d.]+)\s*</,
    /<maven\.compiler\.release>\s*([\d.]+)\s*</,
    /<release>\s*([\d.]+)\s*<\/release>/,
    /<maven\.compiler\.target>\s*([\d.]+)\s*</,
    /<maven\.compiler\.source>\s*([\d.]+)\s*</,
  ]) {
    const v = javaMajor(re.exec(pom)?.[1]);
    if (v) return v;
  }
  return null;
}

export function javaVersionFromGradle(build: string): number | null {
  for (const re of [
    /JavaLanguageVersion\.of\(\s*(\d+)\s*\)/,
    /jvmToolchain\(\s*(\d+)\s*\)/,
    /JavaVersion\.VERSION_(?:1_)?(\d+)/,
    /(?:source|target)Compatibility\s*=\s*['"]?(?:1\.)?(\d+)/,
  ]) {
    const v = javaMajor(re.exec(build)?.[1]);
    if (v) return v;
  }
  return null;
}

async function javaVersionFromFiles(files: RepoFiles, dir: string): Promise<{ major: number; source: string } | null> {
  const sources: [string, RegExp][] = [
    ['system.properties', /java\.runtime\.version\s*=\s*([\d.]+)/],
    ['.java-version', /^\s*([\d.]+)/],
    ['.sdkmanrc', /^java\s*=\s*([\d.]+)/m],
    ['.tool-versions', /^java\s+\D*([\d.]+)/m],
  ];
  for (const [name, re] of sources) {
    const text = await files.read(joinPath(dir, name));
    const major = javaMajor(re.exec(text ?? '')?.[1]);
    if (major) return { major, source: joinPath(dir, name) };
  }
  return null;
}

type JavaFramework = 'Spring Boot' | 'Quarkus' | 'Micronaut' | 'Java';

function javaFramework(build: string): JavaFramework {
  if (/spring-boot|org\.springframework\.boot/.test(build)) return 'Spring Boot';
  if (/quarkus/.test(build)) return 'Quarkus';
  if (/micronaut/.test(build)) return 'Micronaut';
  return 'Java';
}

/** Port flags for each framework: they read their own property, not `$PORT`. */
function portFlags(framework: JavaFramework): string {
  switch (framework) {
    case 'Spring Boot':
      return '-Dserver.port=$PORT';
    case 'Quarkus':
      return '-Dquarkus.http.host=0.0.0.0 -Dquarkus.http.port=$PORT';
    case 'Micronaut':
      return '-Dmicronaut.server.port=$PORT';
    default:
      return '';
  }
}

/** `java … -jar <the module's runnable jar>`. */
function jarStart(framework: JavaFramework, tool: 'maven' | 'gradle', moduleDir: string): string {
  const flags = portFlags(framework);
  if (framework === 'Quarkus') {
    const out = tool === 'maven' ? 'target' : 'build';
    return `java ${flags} $JAVA_OPTS -jar ${joinPath(moduleDir, out, 'quarkus-app/quarkus-run.jar')}`;
  }
  const libs = tool === 'maven' ? joinPath(moduleDir, 'target') : joinPath(moduleDir, 'build/libs');
  const jar = `$(ls ${libs}/*.jar | grep -v -e '-plain.jar' -e '-sources.jar' -e '-javadoc.jar' | head -1)`;
  return `java ${flags ? `${flags} ` : ''}$JAVA_OPTS -jar ${jar}`;
}

/** A build that produces something to run, not a library. */
function isRunnable(tool: 'maven' | 'gradle', build: string): boolean {
  return tool === 'maven'
    ? /spring-boot-maven-plugin|quarkus-maven-plugin|micronaut-maven-plugin|maven-shade-plugin|<mainClass>/.test(build)
    : /org\.springframework\.boot|io\.quarkus|io\.micronaut\.application|\bapplication\s*[{(]|id\s*\(?\s*['"]application['"]/.test(build);
}

/** `<module>a</module>` of a Maven parent. */
function mavenModules(pom: string): string[] {
  const block = /<modules>([\s\S]*?)<\/modules>/.exec(pom)?.[1] ?? '';
  return [...block.matchAll(/<module>\s*([^<\s]+)\s*<\/module>/g)].map((m) => m[1].replace(/\/+$/, ''));
}

/** `include ':api', 'web'` / `include("api", ":services:web")` of a Gradle settings file. */
export function gradleIncludes(settings: string): string[] {
  const out: string[] = [];
  for (const m of settings.matchAll(/^\s*include\s*\(?([^\n)]*)\)?/gm)) {
    for (const p of m[1].matchAll(/['"]([^'"]+)['"]/g)) out.push(p[1].replace(/^:/, '').replace(/:/g, '/'));
  }
  return out;
}

/** Parsed from `distributionUrl=…/gradle-9.5.1-bin.zip`. */
function gradleMajor(wrapper: string | null): number | null {
  const m = /distributionUrl.*gradle-(\d+)(?:\.\d+)*-/.exec(wrapper ?? '');
  return m ? Number(m[1]) : null;
}

const GRADLE_FILES = ['build.gradle', 'build.gradle.kts'];
const SETTINGS_FILES = ['settings.gradle', 'settings.gradle.kts'];

async function readFirst(files: RepoFiles, dir: string, names: string[]): Promise<string | null> {
  for (const n of names) {
    const t = await files.read(joinPath(dir, n));
    if (t !== null) return t;
  }
  return null;
}

/** The Maven/Gradle build `appDir` belongs to: the highest parent listing it as a module. */
async function findBuildRoot(files: RepoFiles, appDir: string, tool: 'maven' | 'gradle'): Promise<string> {
  const parts = appDir ? appDir.split('/') : [];
  for (let i = 0; i < parts.length; i++) {
    const dir = parts.slice(0, i).join('/');
    const rel = relativeTo(dir, appDir);
    if (tool === 'maven') {
      const pom = await files.read(joinPath(dir, 'pom.xml'));
      if (pom && mavenModules(pom).includes(rel)) return dir;
    } else {
      const settings = await readFirst(files, dir, SETTINGS_FILES);
      if (settings && gradleIncludes(settings).includes(rel)) return dir;
    }
  }
  return appDir;
}

export async function planJava(files: RepoFiles, appDir: string, overrides: { start?: string | null } = {}): Promise<BuildPlanResult | null> {
  const pom = await files.read(joinPath(appDir, 'pom.xml'));
  const gradle = pom === null ? await readFirst(files, appDir, GRADLE_FILES) : null;
  const settingsOnly = pom === null && gradle === null ? await readFirst(files, appDir, SETTINGS_FILES) : null;
  if (pom === null && gradle === null && settingsOnly === null) return null;

  const tool: 'maven' | 'gradle' = pom !== null ? 'maven' : 'gradle';
  const issues: PlanIssue[] = [];
  if (pom !== null && (await readFirst(files, appDir, GRADLE_FILES)) !== null) {
    issues.push({ code: 'MULTIPLE_BUILD_SYSTEMS', severity: 'warning', message: 'Both Maven (pom.xml) and Gradle are present: Maven is used.' });
  }

  const buildRoot = await findBuildRoot(files, appDir, tool);
  const own = pom ?? gradle ?? '';

  // The modules of this build, and the runnable ones among them.
  const modules =
    tool === 'maven' ? mavenModules(own) : gradleIncludes((await readFirst(files, appDir, SETTINGS_FILES)) ?? '');
  const runnable: AppCandidate[] = [];
  for (const mod of modules) {
    const dir = joinPath(appDir, mod);
    const build = tool === 'maven' ? await files.read(joinPath(dir, 'pom.xml')) : await readFirst(files, dir, GRADLE_FILES);
    if (!build) continue;
    if (isRunnable(tool, build)) runnable.push({ dir, name: mod, framework: javaFramework(build), output: 'server' });
  }

  // The module that runs: this folder, or the only runnable module under it.
  let moduleDir = appDir;
  let framework = javaFramework(own);
  if (modules.length > 0) {
    if (runnable.length === 1) {
      moduleDir = runnable[0].dir;
      framework = runnable[0].framework as JavaFramework;
      issues.push({ code: 'JAVA_MODULE', severity: 'info', message: `Multi-module build: running ${runnable[0].dir} (${framework}).` });
    } else if (runnable.length === 0 && isRunnable(tool, own)) {
      // The root is the application; the modules are its libraries.
    } else if (!overrides.start) {
      issues.push(
        runnable.length > 1
          ? {
              code: 'JAVA_PICK_MODULE',
              severity: 'blocking',
              message:
                `This build has ${runnable.length} runnable modules: ${runnable.map((r) => r.dir).join(', ')}. ` +
                'Set the Root directory to the one to deploy (Settings › Build options) — the whole build still runs from the root.',
            }
          : {
              code: 'JAVA_NO_MODULE',
              severity: 'blocking',
              message: 'No runnable module was found in this multi-module build (none uses the Spring Boot, Quarkus or Micronaut plugin, or declares a main class). Set a start command.',
            }
      );
    }
  }

  // The JDK the code is compiled for.
  const nixpacksEnv: Record<string, string> = {};
  const moduleBuild =
    moduleDir === appDir ? own : (tool === 'maven' ? await files.read(joinPath(moduleDir, 'pom.xml')) : await readFirst(files, moduleDir, GRADLE_FILES)) ?? '';
  const rootBuild = buildRoot === appDir ? own : (tool === 'maven' ? await files.read(joinPath(buildRoot, 'pom.xml')) : await readFirst(files, buildRoot, GRADLE_FILES)) ?? '';
  const parse = tool === 'maven' ? javaVersionFromMaven : javaVersionFromGradle;
  const fromFile = (await javaVersionFromFiles(files, appDir)) ?? (await javaVersionFromFiles(files, buildRoot));
  const fromBuild = parse(moduleBuild) ?? parse(own) ?? parse(rootBuild);
  const major = fromFile?.major ?? fromBuild;
  let runtimeVersion: BuildPlanResult['runtimeVersion'];
  if (major) {
    const source = fromFile?.source ?? (tool === 'maven' ? 'pom.xml' : 'build.gradle');
    nixpacksEnv.NIXPACKS_JDK_VERSION = String(major);
    runtimeVersion = { name: 'Java', version: String(major), source };
    if (!JDK_VERSIONS.includes(major)) {
      issues.push({
        code: 'JDK_VERSION',
        severity: 'warning',
        message:
          `The code targets Java ${major}; the build engine ships JDK ${JDK_VERSIONS.join(', ')}. ` +
          `If the build fails with "invalid target release", target Java ${JDK_VERSIONS.filter((v) => v < major).pop() ?? 21} or deploy with a Dockerfile.`,
      });
    }
  }

  // Gradle: the wrapper's version (nixpacks knows 4 to 8 only).
  if (tool === 'gradle') {
    const wrapper = await files.read(joinPath(buildRoot, 'gradle/wrapper/gradle-wrapper.properties'));
    const g = gradleMajor(wrapper);
    if (g !== null && (g < 4 || g > 8)) {
      issues.push({
        code: 'UNSUPPORTED_GRADLE_VERSION',
        severity: 'blocking',
        message:
          `The Gradle wrapper is pinned to Gradle ${g}; the build engine supports Gradle 4 to 8 only. ` +
          'Set distributionUrl to Gradle 8 in gradle/wrapper/gradle-wrapper.properties, or deploy with a Dockerfile.',
      });
    }
  }

  const moduleRel = relativeTo(buildRoot, moduleDir);
  const wrapper = tool === 'maven' ? files.paths.includes(joinPath(buildRoot, 'mvnw')) : files.paths.includes(joinPath(buildRoot, 'gradlew'));
  const plan: BuildPlanResult = {
    language: 'java',
    framework: `${framework} (${tool === 'maven' ? 'Maven' : 'Gradle'})`,
    appDir,
    buildRoot,
    output: 'server',
    tool,
    runtimeVersion,
    nixpacksEnv,
    issues,
  };
  if (modules.length > 0 && runnable.length > 1) plan.apps = runnable;

  // A module (or a root with modules): build what it needs, start its jar.
  if (moduleRel) {
    const name = moduleRel.replace(/\//g, ':');
    plan.build =
      tool === 'maven'
        ? `${wrapper ? './mvnw' : 'mvn'} -B -DskipTests -pl ${moduleRel} -am package`
        : `${wrapper ? './gradlew' : 'gradle'} :${name}:build -x test -x check`;
    plan.start = jarStart(framework, tool, moduleRel);
  } else if (framework === 'Quarkus' || framework === 'Micronaut') {
    // nixpacks starts `target/*.jar` with Spring's port flag only.
    plan.start = jarStart(framework, tool, '');
  }
  return plan;
}

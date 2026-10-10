/**
 * Compiling a Java project before SonarQube looks at it.
 *
 * The Java analyser needs compiled classes (`sonar.java.binaries`); pointing it
 * at the sources made the analysis fail on every Maven or Gradle project. The
 * build is planned from the files found in the checkout, run in a throw-away
 * JDK container, and the analysis then reads the classes it produced.
 */
export interface JavaProbe {
  /** Paths (relative to the checkout) of build files found, e.g. `pom.xml`, `api/build.gradle`. */
  buildFiles: string[];
  /** Whether any `.java` file exists. */
  hasJava: boolean;
  /** Contents of the chosen build file, to read the Java version from. */
  buildText: string;
}

export interface JavaBuildPlan {
  tool: 'maven' | 'gradle';
  /** Directory of the build file, relative to the checkout (`.` at the root). */
  dir: string;
  jdk: number;
  image: string;
  /** Run inside `dir`. */
  command: string;
}

const LTS = [8, 11, 17, 21];

/** `1.8` → 8, `17` → 17, then the lowest LTS that can compile it. */
export function jdkFor(declared: number | null): number {
  if (declared === null) return 21;
  return LTS.find((v) => v >= declared) ?? 21;
}

export function declaredJavaVersion(buildText: string): number | null {
  const patterns = [
    /<(?:java\.version|maven\.compiler\.release|maven\.compiler\.source|maven\.compiler\.target|release|source)>\s*(\d+(?:\.\d+)?)\s*</,
    /sourceCompatibility\s*=?\s*(?:JavaVersion\.VERSION_)?['"]?(\d+(?:[._]\d+)?)/,
    /JavaLanguageVersion\.of\(\s*(\d+)\s*\)/,
    /jvmTarget\s*=\s*['"](\d+(?:\.\d+)?)['"]/,
  ];
  for (const p of patterns) {
    const m = p.exec(buildText);
    if (!m) continue;
    const parts = m[1].replace('_', '.').split('.');
    const major = parts[0] === '1' && parts[1] ? Number(parts[1]) : Number(parts[0]);
    if (Number.isFinite(major) && major >= 5) return major;
  }
  return null;
}

const depth = (p: string) => p.split('/').length;

/** The build to run, or null when there is no Java or no build tool to compile it. */
export function planJavaBuild(probe: JavaProbe): JavaBuildPlan | null {
  if (!probe.hasJava) return null;
  const tools: { tool: 'maven' | 'gradle'; file: string }[] = [];
  for (const f of probe.buildFiles) {
    const name = f.split('/').pop();
    if (name === 'pom.xml') tools.push({ tool: 'maven', file: f });
    else if (name === 'build.gradle' || name === 'build.gradle.kts') tools.push({ tool: 'gradle', file: f });
  }
  // The shallowest build file is the root of the build; Maven wins a tie.
  tools.sort((a, b) => depth(a.file) - depth(b.file) || (a.tool === 'maven' ? -1 : 1));
  const chosen = tools[0];
  if (!chosen) return null;
  const dir = chosen.file.includes('/') ? chosen.file.slice(0, chosen.file.lastIndexOf('/')) : '.';
  const jdk = jdkFor(declaredJavaVersion(probe.buildText));
  if (chosen.tool === 'maven') {
    return {
      tool: 'maven',
      dir,
      jdk,
      image: `maven:3.9-eclipse-temurin-${jdk}`,
      command: 'mvn -B -ntp -q -DskipTests -Dmaven.test.skip=true compile',
    };
  }
  const wrapper = probe.buildFiles.some((f) => f === (dir === '.' ? 'gradlew' : `${dir}/gradlew`));
  return {
    tool: 'gradle',
    dir,
    jdk,
    image: wrapper ? `eclipse-temurin:${jdk}-jdk` : `gradle:jdk${jdk}`,
    command: wrapper ? 'sh ./gradlew --no-daemon -q classes -x test' : 'gradle --no-daemon -q classes -x test',
  };
}

/** Where the compiled classes end up, for `sonar.java.binaries` (globs, relative to the checkout). */
export const JAVA_BINARIES = '**/target/classes,**/build/classes/java/main,**/build/classes/kotlin/main';

/** Remote command listing what `planJavaBuild` needs; output is parsed by `parseProbe`. */
export function probeCommand(workdir: string, quote: (s: string) => string): string {
  const w = quote(workdir);
  return (
    `cd ${w} && ` +
    `find . -maxdepth 3 \\( -name pom.xml -o -name build.gradle -o -name build.gradle.kts -o -name gradlew \\) -not -path '*/node_modules/*' | sed 's|^\\./||' | sed 's|^|BUILD=|'; ` +
    `if [ -n "$(find . -name '*.java' -not -path '*/node_modules/*' -print -quit)" ]; then echo HASJAVA=1; fi`
  );
}

export function parseProbe(output: string): Omit<JavaProbe, 'buildText'> {
  const lines = output.split('\n').map((l) => l.trim());
  return {
    buildFiles: lines.filter((l) => l.startsWith('BUILD=')).map((l) => l.slice(6)),
    hasJava: lines.includes('HASJAVA=1'),
  };
}

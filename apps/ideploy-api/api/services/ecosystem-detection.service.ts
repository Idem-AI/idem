/**
 * Which language/framework a repository is, beyond the JS-only guesswork
 * `detectFramework` used to do — this platform deploys Java, Python, Go,
 * Ruby and PHP applications too, and nixpacks (the build engine actually
 * running on the target server) already has first-class support for all of
 * them. The gap was never the build engine; it was that we never told the
 * user what we found, never picked the right port for anything but Node,
 * and never caught a build that nixpacks cannot perform *before* spending a
 * full build cycle finding out.
 *
 * That last part is not hypothetical: verified live against a real Java
 * repository (spring-projects/spring-petclinic, which ships both a Gradle
 * and a Maven build) — nixpacks 1.41.0 picked Gradle, read its wrapper's
 * Gradle 9.5.1, and failed outright with "Unsupported Gradle version: 9".
 * Its own provider (`src/providers/java.rs`) only maps versions 4–8 to a Nix
 * package; anything else is a hard error, not a degraded build. A repository
 * that builds fine on the developer's own machine would fail here with no
 * warning until the deploy log did — exactly the gap this module closes by
 * checking the same thing nixpacks is about to check, before it does.
 */

export type Ecosystem = 'node' | 'java-maven' | 'java-gradle' | 'python' | 'go' | 'ruby' | 'php' | 'dockerfile' | 'unknown';

export interface EcosystemWarning {
  code: string;
  message: string;
  /** 'blocking': nixpacks will fail outright. 'warning': works, but worth the operator's attention. */
  severity: 'blocking' | 'warning';
}

export interface EcosystemDetection {
  ecosystem: Ecosystem;
  /** Human label for display, e.g. "Spring Boot (Maven)", "Django", "Go". */
  framework: string;
  buildTool?: string;
  /** The port the framework listens on by convention — what Traefik needs routed, not a guess. */
  suggestedPort: number | null;
  /**
   * Set only when the framework does not read `$PORT` on its own (Django's
   * dev server, for one) — the exact start command needed to bind it to our
   * chosen port. Frameworks that already honour `$PORT` leave this unset;
   * forcing a command in front of a working default would be the opposite
   * of resilient.
   */
  startCommandHint?: string;
  warnings: EcosystemWarning[];
}

export interface EcosystemRepoAccess {
  getFile(path: string): Promise<string | null>;
}

/** Supported Gradle major versions, straight from nixpacks' own provider (src/providers/java.rs, get_gradle_pkg). */
const NIXPACKS_SUPPORTED_GRADLE_MAJORS = new Set([4, 5, 6, 7, 8]);

/** Parsed from `distributionUrl=…/gradle-9.5.1-bin.zip` — mirrors nixpacks' own regex closely enough to agree with it. */
function parseGradleMajorVersion(wrapperProperties: string): number | null {
  const m = /distributionUrl.*gradle-(\d+)(?:\.\d+)*-/.exec(wrapperProperties);
  return m ? Number(m[1]) : null;
}

function gradleVersionWarning(major: number | null): EcosystemWarning | null {
  if (major === null) return null;
  if (NIXPACKS_SUPPORTED_GRADLE_MAJORS.has(major)) return null;
  return {
    code: 'UNSUPPORTED_GRADLE_VERSION',
    message:
      `This project's Gradle wrapper is pinned to Gradle ${major}, which the build engine (nixpacks) does not ` +
      `support — only Gradle 4 through 8. The build will fail with "Unsupported Gradle version". Pin an older ` +
      `Gradle in gradle/wrapper/gradle-wrapper.properties, or deploy with a Dockerfile instead.`,
    severity: 'blocking',
  };
}

/** `pom.xml`'s packaging/dependencies are enough to tell Spring Boot from plain Java without a full XML parser. */
function isSpringBoot(pomXml: string): boolean {
  return /spring-boot/i.test(pomXml);
}

function isSpringBootGradle(buildGradle: string): boolean {
  return /spring-boot/i.test(buildGradle);
}

async function detectJava(repo: EcosystemRepoAccess): Promise<EcosystemDetection | null> {
  const [pomXml, buildGradle, buildGradleKts] = await Promise.all([
    repo.getFile('pom.xml'),
    repo.getFile('build.gradle'),
    repo.getFile('build.gradle.kts'),
  ]);
  const gradleFile = buildGradle ?? buildGradleKts;

  // Both present (common — many teams keep a Maven wrapper around during a
  // Gradle migration, or vice versa): Maven wins. Not because it is "more
  // correct", but because nixpacks' own Gradle provider is the one with a
  // known, narrow version ceiling — preferring Maven avoids a class of
  // failure Maven does not have, and the operator can still switch manually.
  if (pomXml !== null && gradleFile !== null) {
    const detection = await buildMavenDetection(pomXml);
    detection.warnings.push({
      code: 'MULTIPLE_BUILD_SYSTEMS',
      message: 'Both a Maven (pom.xml) and a Gradle build were found; Maven was used. Switch the preset manually if Gradle is the one that should build.',
      severity: 'warning',
    });
    return detection;
  }

  if (pomXml !== null) return buildMavenDetection(pomXml);
  if (gradleFile !== null) return buildGradleDetection(repo, gradleFile);
  return null;
}

async function buildMavenDetection(pomXml: string): Promise<EcosystemDetection> {
  const springBoot = isSpringBoot(pomXml);
  return {
    ecosystem: 'java-maven',
    framework: springBoot ? 'Spring Boot (Maven)' : 'Java (Maven)',
    buildTool: 'maven',
    suggestedPort: springBoot ? 8080 : null,
    warnings: [],
  };
}

async function buildGradleDetection(repo: EcosystemRepoAccess, gradleFile: string): Promise<EcosystemDetection> {
  const springBoot = isSpringBootGradle(gradleFile);
  const wrapperProps = await repo.getFile('gradle/wrapper/gradle-wrapper.properties');
  const gradleMajor = wrapperProps ? parseGradleMajorVersion(wrapperProps) : null;
  const warning = gradleVersionWarning(gradleMajor);
  return {
    ecosystem: 'java-gradle',
    framework: springBoot ? 'Spring Boot (Gradle)' : 'Java (Gradle)',
    buildTool: 'gradle',
    suggestedPort: springBoot ? 8080 : null,
    warnings: warning ? [warning] : [],
  };
}

async function detectPython(repo: EcosystemRepoAccess): Promise<EcosystemDetection | null> {
  const [requirementsTxt, pyprojectToml, pipfile, manageP] = await Promise.all([
    repo.getFile('requirements.txt'),
    repo.getFile('pyproject.toml'),
    repo.getFile('Pipfile'),
    repo.getFile('manage.py'),
  ]);
  if (requirementsTxt === null && pyprojectToml === null && pipfile === null && manageP === null) return null;

  const manifest = [requirementsTxt, pyprojectToml, pipfile].filter((f): f is string => f !== null).join('\n');
  const buildTool = pyprojectToml !== null ? 'poetry/pip' : pipfile !== null ? 'pipenv' : 'pip';

  // Django is the one whose own dev server does not read $PORT — manage.py
  // is the reliable signal (requirements.txt naming "django" is not: it is
  // routinely a transitive dependency of something else).
  if (manageP !== null || /\bdjango\b/i.test(manifest)) {
    return {
      ecosystem: 'python',
      framework: 'Django',
      buildTool,
      suggestedPort: 8000,
      startCommandHint: 'python manage.py runserver 0.0.0.0:$PORT',
      warnings: [
        {
          code: 'DJANGO_DEV_SERVER',
          message:
            'Django\'s own dev server (manage.py runserver) is not meant for production traffic. Consider a ' +
            'start command using gunicorn/uvicorn if this deploys somewhere users will actually hit.',
          severity: 'warning',
        },
      ],
    };
  }
  if (/\bfastapi\b/i.test(manifest)) {
    return { ecosystem: 'python', framework: 'FastAPI', buildTool, suggestedPort: 8000, warnings: [] };
  }
  if (/\bflask\b/i.test(manifest)) {
    return { ecosystem: 'python', framework: 'Flask', buildTool, suggestedPort: 5000, warnings: [] };
  }
  return { ecosystem: 'python', framework: 'Python', buildTool, suggestedPort: null, warnings: [] };
}

async function detectGo(repo: EcosystemRepoAccess): Promise<EcosystemDetection | null> {
  const goMod = await repo.getFile('go.mod');
  if (goMod === null) return null;
  return {
    ecosystem: 'go',
    framework: 'Go',
    buildTool: 'go modules',
    // No real convention — a Go binary's listen address is whatever the
    // developer wrote, most commonly hardcoded rather than read from an
    // env var. Reported as unknown rather than guessed, so the UI asks
    // instead of silently routing to a port nothing is listening on.
    suggestedPort: null,
    warnings: [
      {
        code: 'GO_PORT_UNKNOWN',
        message: 'Go binaries usually hardcode their listen port rather than reading $PORT. Check main.go for the actual port and set it below.',
        severity: 'warning',
      },
    ],
  };
}

async function detectRuby(repo: EcosystemRepoAccess): Promise<EcosystemDetection | null> {
  const gemfile = await repo.getFile('Gemfile');
  if (gemfile === null) return null;
  const isRails = /\brails\b/i.test(gemfile);
  return {
    ecosystem: 'ruby',
    framework: isRails ? 'Ruby on Rails' : 'Ruby',
    buildTool: 'bundler',
    suggestedPort: isRails ? 3000 : null,
    warnings: [],
  };
}

async function detectPhp(repo: EcosystemRepoAccess): Promise<EcosystemDetection | null> {
  const composerJson = await repo.getFile('composer.json');
  if (composerJson === null) return null;
  let isLaravel = false;
  try {
    const pkg = JSON.parse(composerJson);
    isLaravel = Boolean(pkg?.require?.['laravel/framework']);
  } catch {
    /* malformed composer.json — still PHP, just not confidently Laravel */
  }
  return {
    ecosystem: 'php',
    framework: isLaravel ? 'Laravel' : 'PHP',
    buildTool: 'composer',
    suggestedPort: isLaravel ? 8000 : null,
    startCommandHint: isLaravel ? 'php artisan serve --host=0.0.0.0 --port=$PORT' : undefined,
    warnings: [],
  };
}

/**
 * Detect the ecosystem from repository manifests, trying the languages with a
 * single fixed-name manifest file first (cheap: one request each, run in
 * parallel by the caller's RepoAccess where possible).
 *
 * Node is deliberately not handled here — `github.service.ts`/`gitlab.service.ts`
 * already do real JS framework detection (Next/Vite/Angular/…) from
 * `package.json`, and duplicating that would just be two sources of truth
 * for the same file. This only steps in for everything Node detection
 * wouldn't recognise.
 */
export async function detectNonNodeEcosystem(repo: EcosystemRepoAccess): Promise<EcosystemDetection | null> {
  const detectors = [detectJava, detectPython, detectGo, detectRuby, detectPhp];
  for (const detect of detectors) {
    const result = await detect(repo);
    if (result) return result;
  }
  return null;
}

/**
 * Which package manager a Node repository actually uses, from its lockfile —
 * nixpacks' own Node provider already picks the right install command from
 * this, so nothing here needs to override it; this exists only so the
 * "detected configuration" panel can tell the operator what nixpacks is
 * about to run instead of leaving them to guess.
 *
 * Checked in the order a repository is most likely to have committed
 * exactly one of these; two lockfiles in the same repo is itself a signal
 * worth surfacing separately, not something this silently resolves.
 */
export async function detectNodePackageManager(repo: EcosystemRepoAccess): Promise<string> {
  const [pnpm, yarn, bun] = await Promise.all([
    repo.getFile('pnpm-lock.yaml'),
    repo.getFile('yarn.lock'),
    repo.getFile('bun.lockb'),
  ]);
  if (pnpm !== null) return 'pnpm';
  if (yarn !== null) return 'yarn';
  if (bun !== null) return 'bun';
  return 'npm';
}

/** A directory somewhere in the repository that looks like an application root, from the manifest it ships. */
export interface ManifestDirectory {
  /** Path relative to the repository root; '' means the repository root itself. */
  dir: string;
  manifestFile: string;
}

const MANIFEST_FILENAMES = new Set([
  'package.json',
  'pom.xml',
  'build.gradle',
  'build.gradle.kts',
  'requirements.txt',
  'pyproject.toml',
  'Pipfile',
  'go.mod',
  'Gemfile',
  'composer.json',
  'Dockerfile',
]);

/** Directories no application root is ever meaningfully inside — dependency trees and build output, not source. */
const EXCLUDED_DIR_SEGMENTS = new Set(['node_modules', 'vendor', '.git', 'dist', 'build', 'target', '.next', 'venv', '.venv']);

/**
 * Every directory in the repository tree that ships one of our recognised
 * manifests — the free byproduct of already having the whole tree fetched
 * for the other checks in this module. Used to find the actual application
 * root in a monorepo when nothing at the repository root matched anything:
 * a repo whose root holds only a README and a `docs/` folder, with the real
 * app in `apps/api/`, used to leave the operator staring at an empty "Root
 * Directory" field with no hint that anything there needed to change.
 *
 * One entry per directory (a directory with both `pom.xml` and `Dockerfile`
 * counts once) — this locates the *application*, not every file that named
 * one, and a caller wanting to know precisely what was found there is going
 * to re-run its own detection against that directory anyway.
 */
export function findManifestDirectories(treePaths: string[]): ManifestDirectory[] {
  const byDir = new Map<string, ManifestDirectory>();
  for (const path of treePaths) {
    const slash = path.lastIndexOf('/');
    const filename = slash === -1 ? path : path.slice(slash + 1);
    if (!MANIFEST_FILENAMES.has(filename)) continue;
    const dir = slash === -1 ? '' : path.slice(0, slash);
    if (dir.split('/').some((segment) => EXCLUDED_DIR_SEGMENTS.has(segment))) continue;
    if (!byDir.has(dir)) byDir.set(dir, { dir, manifestFile: filename });
  }
  return [...byDir.values()];
}

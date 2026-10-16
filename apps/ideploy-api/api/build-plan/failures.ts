/**
 * Known build failures, recognised in the output: what happened, in words, and
 * what to do. The raw log stays below it; this is the line a developer reads
 * first.
 */

export interface KnownFailure {
  code: string;
  explanation: string;
  /** A network hiccup: the same build may pass on a second try. */
  retryable?: boolean;
}

const CATALOG: { code: string; test: RegExp; explanation: string; retryable?: boolean }[] = [
  {
    code: 'OUT_OF_MEMORY',
    test: /JavaScript heap out of memory|ENOMEM|exit code:? 137|code 137|returned a non-zero code: 137|java\.lang\.OutOfMemoryError|Killed\s*$/m,
    explanation:
      'The build ran out of memory and was stopped. Free memory on the server (or use a larger one); for Node, a build variable NODE_OPTIONS=--max-old-space-size=2048 can help.',
  },
  {
    code: 'NO_SPACE',
    test: /no space left on device/i,
    explanation: 'The server is out of disk space. Remove old images (docker image prune) and deploy again.',
  },
  {
    code: 'LOCKFILE_OUT_OF_DATE',
    test: /ERR_PNPM_OUTDATED_LOCKFILE|ERR_PNPM_LOCKFILE_CONFIG_MISMATCH|npm ci` can only install packages when your package\.json and package-lock\.json|lockfile would have been modified|The lockfile would have been modified|Your lockfile needs to be updated/,
    explanation:
      'The lockfile does not match package.json. Run the install locally (pnpm install / npm install / yarn), commit the updated lockfile and push.',
  },
  {
    code: 'NODE_ENGINE',
    test: /ERR_PNPM_UNSUPPORTED_ENGINE|The engine "node" is incompatible|EBADENGINE|requires a peer of node|Unsupported engine/,
    explanation:
      'A dependency needs another Node version. Set it in .nvmrc (e.g. 20) or in "engines": { "node": "20" } of package.json — iDeploy reads both.',
  },
  {
    code: 'WORKSPACE_PACKAGE_MISSING',
    test: /ERR_PNPM_WORKSPACE_PKG_NOT_FOUND|No matching version found for @?[\w-]+\/[\w-]+@workspace|Unsupported URL Type "workspace:"/,
    explanation:
      'A workspace package (workspace:*) is missing: the build ran inside the application folder only. Keep the Root directory on the application folder — iDeploy installs from the monorepo root.',
  },
  {
    code: 'MODULE_NOT_FOUND',
    test: /Cannot find module '([^']+)'|Module not found: (Error: )?Can't resolve '([^']+)'/,
    explanation:
      'A module imported by the code is not installed. Add it to "dependencies" of package.json (not only installed on your machine), check the case of the file name (Linux is case-sensitive), commit and push.',
  },
  {
    code: 'TYPESCRIPT_ERRORS',
    test: /error TS\d{4}:|Type error: /,
    explanation: 'The code does not compile (TypeScript errors above). Run the build locally (npm run build) and fix them.',
  },
  {
    code: 'MISSING_ENV',
    test: /Invalid environment variables|Missing required environment variable|environment variable .* (is )?(missing|required|not set)/i,
    explanation: 'The build needs environment variables. Add them under Variables, marked as build variables, and deploy again.',
  },
  {
    code: 'JDK_MISMATCH',
    test: /invalid target release: (\d+)|release version (\d+) not supported|has been compiled by a more recent version of the Java Runtime|Unsupported class file major version/,
    explanation:
      'The JDK does not match the Java version of the code. Set the version in pom.xml (<java.version>) or build.gradle (toolchain), or add system.properties with java.runtime.version=17.',
  },
  {
    code: 'GRADLE_VERSION',
    test: /Unsupported Gradle version/,
    explanation: 'The build engine supports Gradle 4 to 8. Pin Gradle 8 in gradle/wrapper/gradle-wrapper.properties, or deploy with a Dockerfile.',
  },
  {
    code: 'WRAPPER_NOT_EXECUTABLE',
    test: /\.\/(gradlew|mvnw): Permission denied/,
    explanation: 'The build wrapper is not executable in Git. Run: git update-index --chmod=+x gradlew (or mvnw), commit and push.',
  },
  {
    code: 'MAVEN_DEPENDENCY',
    test: /Could not resolve dependencies for project|Could not transfer artifact|Non-resolvable parent POM/,
    explanation:
      'Maven could not download a dependency: a private repository needs credentials (settings.xml), or the version does not exist. If the log shows a timeout, deploy again.',
  },
  {
    code: 'NETWORK',
    test: /ETIMEDOUT|ECONNRESET|EAI_AGAIN|socket hang up|ERR_SOCKET_TIMEOUT|503 Service Unavailable|502 Bad Gateway|TLS handshake timeout|i\/o timeout/,
    explanation: 'A download failed (registry timeout). This is usually temporary.',
    retryable: true,
  },
];

/** The first known failure in the build output, or null. */
export function explainFailure(output: string): KnownFailure | null {
  for (const entry of CATALOG) {
    if (entry.test.test(output)) return { code: entry.code, explanation: entry.explanation, retryable: entry.retryable };
  }
  return null;
}

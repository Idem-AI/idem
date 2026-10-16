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
    code: 'NODE_HEAP',
    test: /JavaScript heap out of memory|Reached heap limit/,
    explanation:
      'The Node.js build ran out of heap. iDeploy retries with a larger heap; set the build variable NODE_OPTIONS=--max-old-space-size=4096 to keep it.',
  },
  {
    code: 'OUT_OF_MEMORY',
    test: /ENOMEM|exit code:? 137|code 137|returned a non-zero code: 137|java\.lang\.OutOfMemoryError|Killed\s*$/m,
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
    test: /ERR_PNPM_OUTDATED_LOCKFILE|ERR_PNPM_LOCKFILE_CONFIG_MISMATCH|ERR_PNPM_NO_LOCKFILE|lockfile would have been created|npm ci` can only install packages when your package\.json and package-lock\.json|lockfile would have been modified|The lockfile would have been modified|Your lockfile needs to be updated|changed significantly since poetry\.lock was last generated|uv\.lock\S* needs to be updated|Pipfile\.lock \S+ out of date|The gemspecs for path gems changed|You are trying to install in deployment mode after changing|missing go\.sum entry|go: updates to go\.mod needed|lock file needs to be updated but --locked was passed|Cargo\.lock needs to be updated/,
    explanation:
      'The lockfile does not match the manifest. Update it locally (npm/pnpm/yarn install, poetry lock, uv lock, pipenv lock, bundle install, go mod tidy, cargo update), commit it and push.',
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
    code: 'PYTHON_VERSION',
    test: /requires a different Python|Could not find a version that satisfies the requirement|No matching distribution found for/,
    explanation:
      'A Python dependency has no version for this Python (or the version pinned does not exist). Set the Python version in .python-version (e.g. 3.11), or relax the pin.',
  },
  {
    code: 'PHP_EXTENSION',
    test: /requires ext-[\w-]+|ext-[\w-]+ \* -> it is missing from your system/,
    explanation: 'A Composer package needs a PHP extension: declare it in composer.json "require" (e.g. "ext-gd": "*") — iDeploy installs the declared ones.',
  },
  {
    code: 'PHP_VERSION',
    test: /requires php [^\s]+ -> your php version|Your requirements could not be resolved to an installable set of packages/,
    explanation: 'Composer cannot install the packages on this PHP version. Set "php" in composer.json "require" to the version the lockfile was made with (e.g. "^8.2").',
  },
  {
    code: 'GO_MODULE',
    test: /no required module provides package|cannot find module providing package|found, but does not contain package/,
    explanation: 'An imported Go package is not in go.mod. Run go mod tidy locally, commit go.mod and go.sum, and push.',
  },
  {
    code: 'RUBY_GEM',
    test: /Could not find gem '|Bundler::GemNotFound|Could not find [\w.-]+ in locally installed gems/,
    explanation: 'Bundler cannot find a gem. Run bundle install locally, commit Gemfile.lock, and push.',
  },
  {
    code: 'DOTNET_PACKAGE',
    test: /error NU110[12]|Unable to find package|NETSDK1045/,
    explanation: 'NuGet could not restore a package (a private feed needs a nuget.config with its credentials), or the project targets a .NET version newer than the one read.',
  },
  {
    code: 'COMPILE_ERROR',
    // BuildKit prefixes every line (#12 1.234 main.go:3:2: …): no anchors.
    test: /error\[E\d{4}\]|: error CS\d{4}:|\[ERROR\] COMPILATION ERROR|\S+\.go:\d+:\d+: |SyntaxError: invalid syntax/,
    explanation: 'The code does not compile (errors above). Build it locally and fix them.',
  },
  {
    code: 'BUILD_OUTPUT_MISSING',
    test: /iDeploy: The build did not produce /,
    explanation:
      'The build finished without producing what the start command runs (see the line above). The application’s "build" script must build it: in a monorepo, check that the build of this application is not skipped.',
  },
  {
    code: 'DOCKERHUB_RATE_LIMIT',
    test: /toomanyrequests|You have reached your pull rate limit|429 Too Many Requests/,
    explanation: 'Docker Hub refused the image pull (its rate limit for this server).',
  },
  {
    code: 'PRIVATE_PACKAGE',
    test: /npm (ERR!|error) code E40[13]|ERR_PNPM_FETCH_40[13]|Request failed "40[13]|YN0041|401 Unauthorized - GET https?:\/\/registry|403 Forbidden - GET https?:\/\/registry/,
    explanation:
      'A package comes from a private registry that refused the request. Add the registry token as a build variable (e.g. NPM_TOKEN) and reference it in .npmrc: //registry.npmjs.org/:_authToken=${NPM_TOKEN}.',
  },
  {
    code: 'BASE_IMAGE_MISSING',
    test: /manifest unknown|docker\.io\/library\/(node|eclipse-temurin|maven|gradle):[\w.-]+: not found|pull access denied for (node|eclipse-temurin|maven|gradle)\b/,
    explanation: 'The base image for this runtime version could not be pulled.',
  },
  {
    code: 'COREPACK',
    test: /Cannot find matching keyid|Internal Error: .*(Error when performing the request|keyid)|Usage Error: This project is configured to use \w+/,
    explanation:
      'The package manager named in package.json ("packageManager") could not be set up. Check that its version exists, or remove the field to use the lockfile’s.',
  },
  {
    code: 'NETWORK',
    test: /ETIMEDOUT|ECONNRESET|EAI_AGAIN|socket hang up|ERR_SOCKET_TIMEOUT|503 Service Unavailable|502 Bad Gateway|TLS handshake timeout|i\/o timeout|Temporary failure resolving|Could not resolve host|ERR_PNPM_META_FETCH_FAIL|ERR_PNPM_FETCH_\d+|getaddrinfo ENOTFOUND/,
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

/**
 * Why a container stopped at start, from its logs: the same catalog idea for
 * the run, where the raw stack trace was all a developer got.
 */
const RUNTIME_CATALOG: { code: string; test: RegExp; explanation: string }[] = [
  {
    code: 'NO_BUILD_OUTPUT',
    test: /Could not find a production build in the '?\.next'? directory|ENOENT: no such file or directory, open '[^']*\.next\/BUILD_ID'/,
    explanation:
      'The image has no Next.js build: `next build` did not run for this application. Its "build" script must run it; in a monorepo, the build of this application must not be skipped.',
  },
  {
    code: 'ENTRY_NOT_FOUND',
    test: /Error: Cannot find module '\/app\/[^']+'|Unable to access jarfile|Could not find or load main class|Failed to find attribute|Error loading ASGI app|Could not import module|Could not locate a Flask application|The application '[^']+\.dll' does not exist|exec: "[^"]+": executable file not found/,
    explanation: 'The file the start command runs is not in the image: the build did not produce it, or the start command points to another path.',
  },
  {
    code: 'MODULE_NOT_FOUND',
    test: /Cannot find module '([^'/.][^']*)'|ERR_MODULE_NOT_FOUND|ClassNotFoundException|NoClassDefFoundError|ModuleNotFoundError: No module named|ImportError: No module named|cannot load such file -- /,
    explanation:
      'A dependency is missing at run time: it must be in "dependencies" (not only installed on your machine). A Java class missing usually means a dependency with the wrong scope.',
  },
  {
    code: 'PORT_IN_USE',
    test: /EADDRINUSE|Address already in use|Failed to bind to address|\[Errno 98\]|Port \d+ (was )?already in use|Web server failed to start\. Port/,
    explanation: 'The port is already taken inside the container: two servers start on the same port, or the start command runs the app twice.',
  },
  {
    code: 'DATABASE_UNREACHABLE',
    test: /ECONNREFUSED [\d.:]+:(5432|3306|27017|6379)|connect ECONNREFUSED 127\.0\.0\.1|getaddrinfo (ENOTFOUND|EAI_AGAIN) \S+|Communications link failure|Connection to \S+ refused|could not connect to server|MongoServerSelectionError|PrismaClientInitializationError|psycopg2?\.OperationalError|SQLSTATE\[HY000\] \[2002\]|ActiveRecord::ConnectionNotEstablished|PG::ConnectionBad|could not translate host name/,
    explanation:
      'The application cannot reach its database or another service. Use the internal address shown on the database page (not localhost), and check the variables holding it.',
  },
  {
    code: 'APP_SECRET',
    test: /No application encryption key has been specified|Missing .?secret_key_base|ActiveSupport::MessageEncryptor::InvalidMessage|Missing encryption key to decrypt|The SECRET_KEY setting must not be empty/,
    explanation:
      'The framework’s secret key is missing: Laravel APP_KEY (php artisan key:generate --show), Rails RAILS_MASTER_KEY or SECRET_KEY_BASE, Django SECRET_KEY. Add it under Variables and redeploy.',
  },
  {
    code: 'MISSING_ENV',
    test: /Missing (required )?environment variable|Environment variable \S+ (is )?(missing|required|not set)|Invalid environment variables|must be (set|defined|provided)|Could not resolve placeholder '[^']+'/i,
    explanation: 'A runtime variable is missing. Add it under Variables (runtime) and redeploy.',
  },
  {
    code: 'JAVA_VERSION',
    test: /UnsupportedClassVersionError|has been compiled by a more recent version of the Java Runtime/,
    explanation: 'The Java runtime is older than the version the code was compiled for. Set the Java version in pom.xml / build.gradle so build and runtime match.',
  },
  {
    code: 'OUT_OF_MEMORY',
    test: /JavaScript heap out of memory|java\.lang\.OutOfMemoryError|Terminating due to java\.lang\.OutOfMemoryError/,
    explanation: 'The application ran out of memory at start. Give it more memory (Settings › Resources) or reduce what it loads at start.',
  },
  {
    code: 'PERMISSION_DENIED',
    test: /EACCES: permission denied|Permission denied/,
    explanation: 'The application writes where it may not (a read-only folder, or a port under 1024). Write to /tmp or a volume, and listen on $PORT.',
  },
];

/** The first known cause of a crash at start, from the container's logs, or null. */
export function explainRuntimeFailure(logs: string): KnownFailure | null {
  for (const entry of RUNTIME_CATALOG) {
    if (entry.test.test(logs)) return { code: entry.code, explanation: entry.explanation };
  }
  return null;
}

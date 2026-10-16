/**
 * A build plan: what iDeploy read in the code and what it will run.
 *
 * Built from the repository alone — the user pastes a URL and fills nothing.
 * The commands it sets are the ones the build engine could not have guessed
 * (a monorepo application, a production start script, a runtime version);
 * when the engine's own default is right, they stay unset.
 */

export type IssueSeverity = 'blocking' | 'warning' | 'info';

export interface PlanIssue {
  code: string;
  severity: IssueSeverity;
  /** Set when only that engine has the problem (nixpacks' Gradle and JDK limits): dropped when iDeploy builds with its own recipe. */
  engine?: 'nixpacks';
  /** What is wrong and what to do, in one or two sentences. */
  message: string;
}

/** An application found in a monorepo, to deploy on its own. */
export interface AppCandidate {
  /** Folder, relative to the repository root. */
  dir: string;
  name: string;
  framework: string;
  output: 'server' | 'static';
}

export interface BuildPlanResult {
  language: Language | null;
  /** e.g. "Next.js", "Spring Boot (Maven)". */
  framework: string | null;
  /** The application's folder, relative to the repository root ('' = root). */
  appDir: string;
  /** Where install and build run: the workspace root for a monorepo application, else `appDir`. */
  buildRoot: string;
  /** A server keeps a process running; a static site is files served by nginx. */
  output: 'server' | 'static' | null;
  /** Static sites: the build output, relative to `buildRoot`. */
  publishDirectory?: string;
  /** `pnpm`, `npm`, `yarn`, `bun`, `maven`, `gradle`. */
  tool?: string;
  runtimeVersion?: { name: 'Node' | 'Java' | 'Python' | 'PHP' | 'Go' | 'Ruby' | '.NET' | 'Rust'; version: string; source: string };
  /** Set for an application inside a workspace. */
  workspace?: { manager: string; orchestrator: 'turbo' | 'nx' | null; packageName: string };
  /** Commands the engine could not guess; unset: its own default. Relative to `buildRoot`. */
  install?: string;
  build?: string;
  start?: string;
  /** Variables for nixpacks (`NIXPACKS_NODE_VERSION`, `NIXPACKS_JDK_VERSION`). */
  nixpacksEnv: Record<string, string>;
  /** Set when iDeploy can build this itself, with a generated Dockerfile. */
  recipe?: Recipe;
  /** The root of a monorepo: the applications in it. */
  apps?: AppCandidate[];
  issues: PlanIssue[];
}

/** A Node server: commands run from `buildRoot`. */
export interface NodeRecipe {
  kind: 'node';
  /** Major of the official `node` image. */
  nodeVersion: string;
  manager: 'pnpm' | 'yarn' | 'npm';
  /** `corepack prepare pnpm@<major>` when package.json does not name its pnpm. */
  pnpmMajor: number | null;
  hasPackageManagerField: boolean;
  install: string;
  build: string | null;
  start: string;
  /** Next.js keeps a build cache in `<app>/.next/cache`. */
  nextCacheDir: string | null;
  /**
   * What the build must produce for the start command (relative to
   * `buildRoot`), and the application's own build to run when the workspace
   * build did not produce it. Null: nothing checkable.
   */
  output: { path: string; alternatives: string[]; build: string | null; strict: boolean } | null;
}

/** A Java server: built with Maven or Gradle, run from its jar. */
export interface JavaRecipe {
  kind: 'java';
  tool: 'maven' | 'gradle';
  jdk: number;
  wrapper: boolean;
  /** The module that runs, relative to `buildRoot` ('' = the root). */
  module: string;
  framework: 'Spring Boot' | 'Quarkus' | 'Micronaut' | 'Java';
  /** The Gradle version the wrapper names: the image to use when the wrapper itself cannot run. */
  gradleVersion?: string | null;
  build: string;
}

export type Language = 'node' | 'java' | 'python' | 'php' | 'go' | 'ruby' | 'dotnet' | 'rust';

/**
 * The recipes of the other languages share two commands the user can
 * replace in the settings: the build (run from `buildRoot` in the build
 * image) and the start (the container's command).
 */
interface CommandRecipe {
  /** Major(.minor) of the official image. */
  version: string;
  build: string | null;
  start: string;
}

/** Python: a virtualenv built with the project's own tool, run by its server (gunicorn, uvicorn…). */
export interface PythonRecipe extends CommandRecipe {
  kind: 'python';
  manager: 'pip' | 'pip-project' | 'poetry' | 'uv' | 'pipenv';
  install: string;
  /** Server packages the start command needs and the project does not list (gunicorn, uvicorn). */
  extras: string[];
}

/** PHP: Apache with the extensions the project asks for, Composer, and its front-end assets. */
export interface PhpRecipe extends CommandRecipe {
  kind: 'php';
  framework: 'Laravel' | 'Symfony' | 'PHP';
  extensions: string[];
  /** Served folder, relative to the application ('' = the application itself). */
  documentRoot: string;
  /** Front-end assets built with Node before Composer (Laravel's Vite, Symfony Encore). */
  assets: { manager: 'npm' | 'pnpm' | 'yarn'; install: string; build: string } | null;
}

/** Go: a static (or cgo) binary of the main package. */
export interface GoRecipe extends CommandRecipe {
  kind: 'go';
  cgo: boolean;
}

/** Ruby: Bundler, Rails assets, a Rack server. */
export interface RubyRecipe extends CommandRecipe {
  kind: 'ruby';
  rails: boolean;
  /** jsbundling/cssbundling: the Node packages the asset build needs. */
  nodeInstall: string | null;
}

/** .NET: `dotnet publish` of the project, run with its runtime. */
export interface DotnetRecipe extends CommandRecipe {
  kind: 'dotnet';
  /** The project file, relative to `buildRoot`. */
  project: string;
  assembly: string;
  web: boolean;
}

/** Rust: `cargo build --release` of the binary. */
export interface RustRecipe extends CommandRecipe {
  kind: 'rust';
  bin: string;
}

export type Recipe = NodeRecipe | JavaRecipe | PythonRecipe | PhpRecipe | GoRecipe | RubyRecipe | DotnetRecipe | RustRecipe;

export function emptyPlan(appDir: string): BuildPlanResult {
  return { language: null, framework: null, appDir, buildRoot: appDir, output: null, nixpacksEnv: {}, issues: [] };
}

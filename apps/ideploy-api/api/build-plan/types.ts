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
  language: 'node' | 'java' | null;
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
  runtimeVersion?: { name: 'Node' | 'Java'; version: string; source: string };
  /** Set for an application inside a workspace. */
  workspace?: { manager: string; orchestrator: 'turbo' | 'nx' | null; packageName: string };
  /** Commands the engine could not guess; unset: its own default. Relative to `buildRoot`. */
  install?: string;
  build?: string;
  start?: string;
  /** Variables for nixpacks (`NIXPACKS_NODE_VERSION`, `NIXPACKS_JDK_VERSION`). */
  nixpacksEnv: Record<string, string>;
  /** The root of a monorepo: the applications in it. */
  apps?: AppCandidate[];
  issues: PlanIssue[];
}

export function emptyPlan(appDir: string): BuildPlanResult {
  return { language: null, framework: null, appDir, buildRoot: appDir, output: null, nixpacksEnv: {}, issues: [] };
}

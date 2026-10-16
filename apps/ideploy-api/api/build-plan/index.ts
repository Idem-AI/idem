/**
 * Read the code, decide how to build it.
 *
 * Run at every deployment on the checkout itself (the files are the ones being
 * built, whatever the source), and at import on the GitHub/GitLab tree, so the
 * user sees what will happen before the first build.
 */
import { BuildPlanResult, emptyPlan } from './types';
import { RepoFiles, joinPath } from './repo-files';
import { planNode } from './node';
import { planJava } from './java';

export * from './types';
export { snapshotCommand, parseSnapshot } from './repo-files';
export type { RepoFiles } from './repo-files';

export interface AnalyzeOptions {
  /** The user's own commands: they win over the plan's. */
  overrides?: { install?: string | null; build?: string | null; start?: string | null };
  /** The server the build runs on. */
  resources?: { memoryAvailableMb: number | null; diskFreeMb: number | null };
}

/** Below this, a build fails for want of space: images and dependencies take gigabytes. */
const MIN_DISK_MB = 1024;
/** Bundlers (Next, Angular, Vite…) and Maven/Gradle need this much to build comfortably. */
const HEAVY_BUILD_MEMORY_MB = 1536;

export async function analyzeRepository(files: RepoFiles, appDir: string, options: AnalyzeOptions = {}): Promise<BuildPlanResult> {
  // Java first: a Spring backend with a package.json for its front-end tooling is Java.
  const plan =
    (await planJava(files, appDir, options.overrides ?? {})) ??
    (await planNode(files, appDir, { overrides: options.overrides })) ??
    emptyPlan(appDir);

  const resources = options.resources;
  if (resources?.diskFreeMb !== null && resources?.diskFreeMb !== undefined && resources.diskFreeMb < MIN_DISK_MB) {
    plan.issues.push({
      code: 'LOW_DISK',
      severity: 'blocking',
      message: `Only ${resources.diskFreeMb} MB free on the server: a build needs at least ${MIN_DISK_MB} MB. Free space (old images: docker image prune) and deploy again.`,
    });
  }
  const heavy = plan.language === 'java' || /Next|Nuxt|Angular|Vite|Astro|Svelte|Remix|React Router|Gatsby|Create React App|Vue CLI/.test(plan.framework ?? '');
  const memory = resources?.memoryAvailableMb;
  if (heavy && memory !== null && memory !== undefined && memory < HEAVY_BUILD_MEMORY_MB) {
    plan.issues.push({
      code: 'LOW_MEMORY',
      severity: 'warning',
      message: `${memory} MB of memory free on the server: a ${plan.framework} build usually needs ${HEAVY_BUILD_MEMORY_MB} MB or more and may be killed.`,
    });
  }
  return plan;
}

/** The plan, as the deployment log shows it. */
export function describePlan(plan: BuildPlanResult, effective: { install?: string | null; build?: string | null; start?: string | null } = {}): string[] {
  if (!plan.language) return ['Language not recognised: the build engine (nixpacks) decides on its own.'];
  const lines: string[] = [];
  const where = plan.appDir ? plan.appDir : 'repository root';
  lines.push(`Application: ${where} — ${plan.framework}${plan.output ? `, ${plan.output === 'static' ? 'static site' : 'server'}` : ''}`);
  const facts = [
    plan.runtimeVersion ? `${plan.runtimeVersion.name} ${plan.runtimeVersion.version} (from ${plan.runtimeVersion.source})` : null,
    plan.tool,
    plan.workspace ? `monorepo${plan.workspace.orchestrator ? ` (${plan.workspace.orchestrator})` : ''}, built from ${plan.buildRoot || 'the repository root'}` : null,
  ].filter(Boolean);
  if (facts.length) lines.push(facts.join(' · '));
  // With a recipe, the commands it runs (nixpacks' own defaults are not shown).
  const recipe = plan.recipe;
  const install = effective.install ?? plan.install ?? (recipe?.kind === 'node' ? recipe.install : null);
  const build = effective.build ?? (recipe ? recipe.build : plan.build);
  const start =
    effective.start ??
    (recipe?.kind === 'node' ? recipe.start : recipe?.kind === 'java' ? `java -jar ${recipe.module ? `${recipe.module}/` : ''}<the built jar>` : plan.start);
  if (install) lines.push(`Install: ${install}`);
  if (build) lines.push(`Build:   ${build}`);
  if (start) lines.push(`Start:   ${start}`);
  if (plan.output === 'static' && plan.publishDirectory) lines.push(`Serves:  ${joinPath(plan.buildRoot, plan.publishDirectory)} (nginx)`);
  for (const issue of plan.issues) {
    const mark = issue.severity === 'blocking' ? '✗' : issue.severity === 'warning' ? '⚠' : 'ℹ';
    lines.push(`${mark} ${issue.message}`);
  }
  return lines;
}

/**
 * At import: the applications of a monorepo (to pick one), or the only one
 * (picked for the user). Read the way the deployment will read it. Each file
 * is fetched once (the GitHub/GitLab API counts every request).
 */
export async function monorepoLayout(
  paths: string[],
  getFile: (path: string) => Promise<string | null>
): Promise<{
  candidates?: { dir: string; manifestFile: string; framework: string }[];
  onlyApp?: string;
  /** What would fail or surprise at the first deployment, said at import. */
  issues: { code: string; message: string; severity: 'blocking' | 'warning' }[];
}> {
  const cache = new Map<string, Promise<string | null>>();
  const read = (path: string) => {
    if (!cache.has(path)) cache.set(path, getFile(path));
    return cache.get(path) as Promise<string | null>;
  };
  try {
    const plan = await analyzeRepository({ paths, read }, '');
    // The picker shows the applications; nixpacks' own limits do not apply to iDeploy's recipes.
    const issues = plan.issues
      .filter((i) => i.severity !== 'info' && !i.engine && !/^(MONOREPO_|JAVA_PICK_MODULE)/.test(i.code))
      .map((i) => ({ code: i.code, message: i.message, severity: i.severity as 'blocking' | 'warning' }));
    if (plan.apps && plan.apps.length > 1) {
      const manifestFile = plan.language === 'java' ? (plan.tool === 'maven' ? 'pom.xml' : 'build.gradle') : 'package.json';
      return { candidates: plan.apps.map((a) => ({ dir: a.dir, manifestFile, framework: a.framework })), issues };
    }
    if (plan.appDir) return { onlyApp: plan.appDir, issues };
    return { issues };
  } catch {
    /* unreadable: the import works as before */
  }
  return { issues: [] };
}

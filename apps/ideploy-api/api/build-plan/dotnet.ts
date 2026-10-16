/**
 * .NET applications: the project to publish (the web one, or the only one),
 * the .NET version it targets, its assembly. Built from the repository root:
 * a project references its siblings (../Shared/Shared.csproj).
 */
import { BuildPlanResult, PlanIssue } from './types';
import { RepoFiles, relativeTo } from './repo-files';

/** `8.0` from `net8.0`, `net6.0;net8.0`, `netcoreapp3.1`. */
export function dotnetVersion(csproj: string): string | null {
  const frameworks = /<TargetFrameworks?>([^<]+)<\/TargetFrameworks?>/.exec(csproj)?.[1] ?? '';
  const versions = [...frameworks.matchAll(/net(?:coreapp)?(\d+)\.(\d+)/g)].map((m) => [Number(m[1]), Number(m[2])] as const);
  if (!versions.length) return null;
  const [major, minor] = versions.sort((a, b) => b[0] - a[0] || b[1] - a[1])[0];
  return `${major}.${minor}`;
}

export async function planDotnet(files: RepoFiles, appDir: string): Promise<BuildPlanResult | null> {
  const projects = files.paths
    .filter((p) => (appDir === '' || p.startsWith(`${appDir}/`)) && /\.(cs|fs)proj$/.test(p))
    .filter((p) => relativeTo(appDir, p).split('/').length <= 4)
    .sort();
  if (!projects.length) return null;
  const issues: PlanIssue[] = [];

  const contents = new Map<string, string>();
  for (const p of projects) contents.set(p, (await files.read(p)) ?? '');
  // Test projects never deploy.
  const deployable = projects.filter((p) => !/Microsoft\.NET\.Test\.Sdk|<IsTestProject>true/i.test(contents.get(p) ?? ''));
  const web = deployable.filter((p) => /Sdk="Microsoft\.NET\.Sdk\.(Web|Razor)"/.test(contents.get(p) ?? ''));
  const project = web.length === 1 ? web[0] : web.length === 0 && deployable.length === 1 ? deployable[0] : null;
  if (!project) {
    const candidates = web.length ? web : deployable;
    issues.push({
      code: 'DOTNET_PICK_PROJECT',
      severity: 'blocking',
      message:
        `Several projects can run (${candidates.join(', ')}). Set the Root directory to the folder of the one to deploy (Settings › Build options).`,
    });
  }

  const csproj = project ? contents.get(project) ?? '' : '';
  const globalJson = (await files.read('global.json')) ?? '';
  const sdk = /"version"\s*:\s*"(\d+)\.(\d+)/.exec(globalJson);
  const version = dotnetVersion(csproj) ?? (sdk ? `${sdk[1]}.${sdk[2]}` : null);
  const isWeb = Boolean(project && web.includes(project));
  const assembly =
    /<AssemblyName>([^<]+)<\/AssemblyName>/.exec(csproj)?.[1] ?? (project ? project.slice(project.lastIndexOf('/') + 1).replace(/\.(cs|fs)proj$/, '') : '');

  const plan: BuildPlanResult = {
    language: 'dotnet',
    framework: isWeb ? 'ASP.NET Core' : '.NET',
    appDir,
    buildRoot: '',
    output: 'server',
    tool: 'dotnet',
    runtimeVersion: version ? { name: '.NET', version, source: dotnetVersion(csproj) ? project ?? 'csproj' : 'global.json' } : undefined,
    nixpacksEnv: {},
    issues,
  };
  if (project) {
    plan.recipe = {
      kind: 'dotnet',
      version: version ?? '8.0',
      project,
      assembly,
      web: isWeb,
      build: `dotnet publish "${project}" -c Release -o /out`,
      // ASP.NET Core listens where ASPNETCORE_URLS says: the port the proxy routes to.
      start: isWeb ? `export ASPNETCORE_URLS=http://0.0.0.0:\${PORT:-8080} && exec dotnet "${assembly}.dll"` : `exec dotnet "${assembly}.dll"`,
    };
  }
  return plan;
}

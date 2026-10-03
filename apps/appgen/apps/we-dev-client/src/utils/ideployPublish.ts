/**
 * Mise en ligne par iDeploy, depuis iCode.
 *
 * Deux formes, choisies d'après le projet, jamais demandées à l'utilisateur :
 *   - `static`    : site vitrine, application mobile (PWA), application web sans
 *                   serveur. Le site est construit ICI (`npm run build`, dans la
 *                   WebContainer) et le dossier `dist/` est envoyé tel quel : ce
 *                   qui part en ligne est exactement ce que l'aperçu montrait.
 *   - `fullstack` : `backend/` + `frontend/`. Les sources partent ; iDeploy crée
 *                   la base PostgreSQL, le serveur et l'interface et les relie.
 *
 * Tout passe par le serveur iCode (`/api/ideploy/*`), qui parle à iDeploy avec
 * la session IDEM de l'utilisateur.
 */
import { getContainerInstance as getWebContainerInstance } from '@/components/WeIde/services';
import { useFileStore } from '@/components/WeIde/stores/fileStore';
import type { AppDeployment, IdeployRecord } from '@/api/persistence/db';

const API_BASE = process.env.REACT_APP_NEXT_API_BASE_URL || 'http://localhost:3000';

export type PublishMode = 'static' | 'fullstack';
type PublishFiles = Record<string, string | { base64: string }>;

export interface PublishResult {
  mode: PublishMode;
  created: boolean;
  url: string | null;
  apiUrl?: string | null;
  ids: Omit<IdeployRecord, 'mode'>;
  deployments: Array<{ role: 'site' | 'backend' | 'frontend'; deploymentUuid: string }>;
}

export class PublishError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly code?: string,
    /** Ce qui s'est passé, pour les « détails » : sortie du build, journal du déploiement. */
    readonly details?: string | null
  ) {
    super(message);
  }
}

/** Une application complète a ses deux dossiers ; tout le reste se publie comme un site. */
export function detectPublishMode(files: Record<string, string>): PublishMode {
  return 'backend/package.json' in files && 'frontend/package.json' in files ? 'fullstack' : 'static';
}

/** Ce qui ne part jamais : dépendances, base de l'aperçu, build local, plugin du mode Edit. */
const EXCLUDED = /(^|\/)(node_modules|\.git|\.pglite|\.idem|dist)(\/|$)/;

/** Les sources d'une application complète, telles que l'atelier les tient. */
export function collectSourceFiles(): PublishFiles {
  const files = useFileStore.getState().files;
  const out: PublishFiles = {};
  for (const [path, content] of Object.entries(files)) {
    if (typeof content !== 'string' || EXCLUDED.test(path)) continue;
    out[path] = content;
  }
  return out;
}

const TEXT_EXTENSIONS = /\.(html?|css|js|mjs|cjs|json|map|svg|txt|xml|webmanifest|md)$/i;

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(binary);
}

async function run(command: string, args: string[]): Promise<{ exitCode: number; output: string }> {
  const container = await getWebContainerInstance();
  if (!container) throw new PublishError('preview_unavailable');
  const process = await container.spawn(command, args, { env: { npm_config_yes: 'true' } });
  let output = '';
  void process.output.pipeTo(
    new WritableStream({
      write(data) {
        output = (output + data).slice(-8000);
      },
    })
  );
  const exitCode = await process.exit;
  return { exitCode, output };
}

/**
 * Construit le site dans la WebContainer et lit `dist/`. Les dépendances sont
 * installées d'abord si l'aperçu n'a jamais tourné.
 */
export async function buildStaticSite(): Promise<PublishFiles> {
  const container = await getWebContainerInstance();
  if (!container) throw new PublishError('preview_unavailable');

  const hasDependencies = await container.fs
    .readdir('node_modules')
    .then(() => true)
    .catch(() => false);
  if (!hasDependencies) {
    const install = await run('npm', ['install']);
    if (install.exitCode !== 0) throw new PublishError('build_failed', undefined, 'install', install.output);
  }

  const build = await run('npm', ['run', 'build']);
  if (build.exitCode !== 0) throw new PublishError('build_failed', undefined, 'build', build.output);

  const files: PublishFiles = {};
  const walk = async (dir: string): Promise<void> => {
    const entries = await container.fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        await walk(path);
      } else if (TEXT_EXTENSIONS.test(entry.name)) {
        files[path] = await container.fs.readFile(path, 'utf-8');
      } else {
        files[path] = { base64: toBase64(await container.fs.readFile(path)) };
      }
    }
  };
  await walk('dist').catch(() => {
    throw new PublishError('build_failed', undefined, 'no_dist', build.output);
  });
  if (!('dist/index.html' in files)) throw new PublishError('build_failed', undefined, 'no_index', build.output);
  return files;
}

/** Envoie à iDeploy (création, ou mise à jour des mêmes applications). */
export async function publishToIdeploy(options: {
  name: string;
  mode: PublishMode;
  files: PublishFiles;
  existing?: IdeployRecord | null;
}): Promise<PublishResult> {
  const response = await fetch(`${API_BASE}/api/ideploy/publish`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: options.name,
      mode: options.mode,
      files: options.files,
      existing: options.existing && options.existing.mode === options.mode ? options.existing : null,
    }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.success) {
    throw new PublishError(data?.message || 'publish_failed', response.status, data?.code);
  }
  return data as PublishResult;
}

export type DeploymentState = 'queued' | 'in_progress' | 'finished' | 'failed';

/** Où en est un déploiement, et la cause d'un échec. */
export async function getDeploymentState(
  deploymentUuid: string
): Promise<{ status: DeploymentState; log: string | null }> {
  const response = await fetch(`${API_BASE}/api/ideploy/deployments/${encodeURIComponent(deploymentUuid)}`, {
    credentials: 'include',
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.success) return { status: 'in_progress', log: null };
  const status = ['queued', 'in_progress', 'finished', 'failed'].includes(data.status) ? data.status : 'in_progress';
  return { status, log: data.log ?? null };
}

/** Attend la fin d'un déploiement (un build complet prend une à quelques minutes). */
export async function waitForDeployment(
  deploymentUuid: string,
  onStatus?: (status: DeploymentState) => void,
  timeoutMs = 15 * 60 * 1000
): Promise<{ status: 'finished' | 'failed'; log: string | null }> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const { status, log } = await getDeploymentState(deploymentUuid);
    onStatus?.(status);
    if (status === 'finished' || status === 'failed') return { status, log };
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  return { status: 'failed', log: 'timeout' };
}

/** L'enregistrement gardé pour la prochaine mise à jour (et affiché par le tableau de bord). */
export function toDeploymentRecord(result: PublishResult, name: string): AppDeployment {
  const ids = result.ids;
  return {
    provider: 'ideploy',
    siteId: ids.applicationUuid ?? ids.frontendUuid ?? '',
    siteName: name,
    url: result.url ?? '',
    ideploy: { mode: result.mode, ...ids, apiUrl: result.apiUrl ?? undefined },
  };
}

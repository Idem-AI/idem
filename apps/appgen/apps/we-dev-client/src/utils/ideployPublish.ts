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

/** Empreinte des sources : deux constructions des mêmes sources donnent le même site. */
function sourceFingerprint(): string {
  const files = useFileStore.getState().files;
  let hash = 2166136261;
  const mix = (text: string) => {
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
  };
  for (const path of Object.keys(files).sort()) {
    const content = files[path];
    if (typeof content !== 'string' || EXCLUDED.test(path)) continue;
    mix(path);
    mix('\u0000');
    mix(content);
    mix('\u0001');
  }
  return `${(hash >>> 0).toString(36)}-${Object.keys(files).length}`;
}

/**
 * La construction en cours ou la dernière réussie, par empreinte des sources.
 *
 * La fenêtre de mise en ligne lance la construction dès son ouverture
 * (`prepareStaticSite`) : le temps que l'utilisateur lise et clique, le site est
 * souvent déjà prêt. Une deuxième publication sans modification ne reconstruit rien.
 */
let lastBuild: { fingerprint: string; promise: Promise<PublishFiles> } | null = null;
/** Une construction à la fois : deux `npm run build` écriraient `dist/` en même temps. */
let buildChain: Promise<unknown> = Promise.resolve();

export function prepareStaticSite(): Promise<PublishFiles> {
  const fingerprint = sourceFingerprint();
  if (lastBuild && lastBuild.fingerprint === fingerprint) return lastBuild.promise;
  const promise = buildChain.catch(() => undefined).then(() => buildStaticSiteNow());
  buildChain = promise;
  const entry = { fingerprint, promise };
  lastBuild = entry;
  // Un échec n'est pas gardé : la prochaine tentative reconstruit.
  promise.catch(() => {
    if (lastBuild === entry) lastBuild = null;
  });
  return promise;
}

/** Le site construit (réutilisé quand les sources n'ont pas changé). */
export function buildStaticSite(): Promise<PublishFiles> {
  return prepareStaticSite();
}

/**
 * Construit le site dans la WebContainer et lit `dist/`. Les dépendances sont
 * installées d'abord si l'aperçu n'a jamais tourné.
 */
async function buildStaticSiteNow(): Promise<PublishFiles> {
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
  // Les dossiers et les fichiers sont lus en parallèle : un site a des centaines de fichiers.
  const walk = async (dir: string): Promise<void> => {
    const entries = await container.fs.readdir(dir, { withFileTypes: true });
    await Promise.all(
      entries.map(async (entry) => {
        const path = `${dir}/${entry.name}`;
        if (entry.isDirectory()) {
          await walk(path);
        } else if (TEXT_EXTENSIONS.test(entry.name)) {
          files[path] = await container.fs.readFile(path, 'utf-8');
        } else {
          files[path] = { base64: toBase64(await container.fs.readFile(path)) };
        }
      })
    );
  };
  await walk('dist').catch(() => {
    throw new PublishError('build_failed', undefined, 'no_dist', build.output);
  });
  if (!('dist/index.html' in files)) throw new PublishError('build_failed', undefined, 'no_index', build.output);
  return files;
}

/** Ce que le contrôle du site construit a relevé (`scripts/postbuild.mjs` des sites vitrines, template ≥ 1.4). */
export interface BuildReport {
  /** Ce qui prive une page de son référencement : pas de texte pré-rendu, pas de titre, pas de description, pas de h1. */
  errors: string[];
  warnings: string[];
}

/**
 * Le bilan de la dernière construction, s'il existe (un site d'avant ou une application n'en écrivent pas).
 * Lu après `buildStaticSite` ; ne fait jamais échouer une publication.
 */
export async function readBuildReport(): Promise<BuildReport | null> {
  try {
    const container = await getWebContainerInstance();
    if (!container) return null;
    const raw = JSON.parse(await container.fs.readFile('.idem/build-report.json', 'utf-8'));
    const errors = Array.isArray(raw?.seo?.errors) ? raw.seo.errors.filter((line: unknown) => typeof line === 'string') : [];
    const warnings = Array.isArray(raw?.seo?.warnings) ? raw.seo.warnings.filter((line: unknown) => typeof line === 'string') : [];
    return { errors, warnings };
  } catch {
    return null;
  }
}

/**
 * Le corps compressé (gzip) : un site construit pèse souvent quelques Mo de
 * JSON, divisés par 3 à 5 — c'est l'envoi qui coûte, sur une connexion mobile.
 * Le serveur iCode (express.json) le décompresse. Sans `CompressionStream`
 * (navigateur ancien), le corps part tel quel.
 */
async function gzip(text: string): Promise<Blob | null> {
  if (typeof CompressionStream === 'undefined' || text.length < 32 * 1024) return null;
  try {
    const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
    return await new Response(stream).blob();
  } catch {
    return null;
  }
}

/** Envoie à iDeploy (création, ou mise à jour des mêmes applications). */
export async function publishToIdeploy(options: {
  name: string;
  mode: PublishMode;
  files: PublishFiles;
  existing?: IdeployRecord | null;
}): Promise<PublishResult> {
  const json = JSON.stringify({
    name: options.name,
    mode: options.mode,
    files: options.files,
    existing: options.existing && options.existing.mode === options.mode ? options.existing : null,
  });
  const compressed = await gzip(json);
  const response = await fetch(`${API_BASE}/api/ideploy/publish`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(compressed ? { 'Content-Encoding': 'gzip' } : {}) },
    body: compressed ?? json,
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
    // Une mise en ligne de site se compte en secondes : relue chaque seconde au début, puis plus calmement.
    await new Promise((resolve) => setTimeout(resolve, Date.now() - started < 60_000 ? 1000 : 3000));
  }
  return { status: 'failed', log: 'timeout' };
}

export interface AddressState {
  url: string | null;
  /** L'adresse répond en HTTPS avec un certificat valide. */
  ready: boolean;
  /** Une autre adresse de l'application qui marche déjà (l'automatique), le temps que la principale arrive. */
  fallbackUrl: string | null;
  /** Tous les noms de l'application ; `status: 'automatic'` = adresse gratuite d'iDeploy. */
  domains: { host: string; status: string; https: string }[];
}

/** L'adresse publique répond-elle déjà en HTTPS ? */
export async function getAddressState(applicationUuid: string): Promise<AddressState | null> {
  try {
    const response = await fetch(`${API_BASE}/api/ideploy/applications/${encodeURIComponent(applicationUuid)}/address`, {
      credentials: 'include',
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.success) return null;
    return {
      url: data.url ?? null,
      ready: Boolean(data.ready),
      fallbackUrl: data.fallbackUrl ?? null,
      domains: Array.isArray(data.domains) ? data.domains : [],
    };
  } catch {
    return null;
  }
}

/**
 * Attend que l'adresse réponde en HTTPS, au plus `timeoutMs`. Le nom vient d'être
 * créé dans le DNS : le montrer avant qu'il soit publié menait à une erreur du navigateur.
 */
export async function waitForAddress(
  applicationUuid: string,
  timeoutMs = 60_000,
  signal?: { cancelled: boolean }
): Promise<AddressState | null> {
  const started = Date.now();
  let last: AddressState | null = null;
  while (Date.now() - started < timeoutMs && !signal?.cancelled) {
    last = (await getAddressState(applicationUuid)) ?? last;
    if (last?.ready) return last;
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  return last;
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

import { Router, Request, Response } from 'express';
import { forwardedCredentials } from '../middleware/auth.js';

/**
 * Publishing from iCode, through iDeploy — without leaving iCode.
 *
 * The browser talks to this server only; this server talks to iDeploy with the
 * user's own IDEM session (same cookie, server to server: no CORS to open on
 * iDeploy). Two shapes, chosen by the client from the project's layout:
 *
 *   - `static`    : a site, a mobile app (PWA) or a web app without a server.
 *                   The client sends the SOURCES; iDeploy builds them on the
 *                   server that serves them, in a throwaway Node container
 *                   (much faster than the browser's WebContainer). When that
 *                   build environment is unavailable, the client builds in the
 *                   browser and sends `dist/…`, served as is.
 *   - `fullstack` : `backend/` + `frontend/`. The client sends the SOURCES,
 *                   iDeploy creates PostgreSQL, the server and the interface
 *                   and links them (`DATABASE_URL`, `VITE_API_URL`).
 *
 * A first publish creates; the next ones replace the code and redeploy the
 * same applications, so the address never changes.
 */
const router = Router();

const IDEPLOY_API_URL = (process.env.IDEPLOY_API_URL || 'http://localhost:3002').replace(/\/$/, '');

type Files = Record<string, string | { base64: string }>;

interface PublishBody {
  name?: string;
  mode?: 'static' | 'fullstack';
  files?: Files;
  /** What a previous publish created, kept by the client with the deployment record. */
  existing?: { applicationUuid?: string; backendUuid?: string; frontendUuid?: string } | null;
  /**
   * Update of a site: every file with its SHA-256; `files` then holds only
   * those iDeploy does not already have (see `/applications/:uuid/source/manifest`).
   */
  manifest?: Record<string, string> | null;
}

export interface PublishedDeployment {
  role: 'site' | 'backend' | 'frontend';
  deploymentUuid: string;
}

/** Call iDeploy as the user; throws with iDeploy's own message on failure. */
async function ideploy<T>(req: Request, method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${IDEPLOY_API_URL}/api/v1${path}`, {
    method,
    headers: { ...forwardedCredentials(req), 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  // iDeploy répond `{ success, data }`, ou `{ success: false, error: { code, message } }`.
  const payload = (await response.json().catch(() => null)) as
    | { success?: boolean; data?: T; error?: { code?: string | null; message?: string } }
    | null;
  if (!response.ok || payload?.success === false) {
    const error = new Error(payload?.error?.message || `iDeploy answered ${response.status}`) as Error & {
      status?: number;
      code?: string;
    };
    error.status = response.status;
    error.code = payload?.error?.code ?? undefined;
    throw error;
  }
  return (payload?.data ?? payload) as T;
}

/** A project name iDeploy accepts as an application name. */
function slug(name: string): string {
  const cleaned = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return cleaned || 'mon-app';
}

router.post('/publish', async (req: Request, res: Response) => {
  const { name, mode, files, existing, manifest } = (req.body ?? {}) as PublishBody;
  const delta = mode !== 'fullstack' && Boolean(existing?.applicationUuid) && Boolean(manifest) && typeof manifest === 'object';
  if (!files || typeof files !== 'object' || (!delta && Object.keys(files).length === 0)) {
    return res.status(422).json({ success: false, message: 'Aucun fichier à publier.' });
  }
  const appName = slug(name || 'mon-app');

  try {
    if (mode === 'fullstack') {
      if (existing?.backendUuid && existing?.frontendUuid) {
        // Update: same database, same addresses — only the code changes.
        const backend = await ideploy<{ deploymentUuid: string }>(
          req, 'PUT', `/applications/${existing.backendUuid}/source`, { files, deploy: true }
        );
        const frontend = await ideploy<{ deploymentUuid: string }>(
          req, 'PUT', `/applications/${existing.frontendUuid}/source`, { files, deploy: true }
        );
        const app = await ideploy<{ fqdn?: string | null }>(req, 'GET', `/applications/${existing.frontendUuid}`);
        return res.json({
          success: true,
          mode,
          created: false,
          url: toUrl(app?.fqdn),
          ids: { backendUuid: existing.backendUuid, frontendUuid: existing.frontendUuid },
          deployments: [
            { role: 'backend', deploymentUuid: backend.deploymentUuid },
            { role: 'frontend', deploymentUuid: frontend.deploymentUuid },
          ] satisfies PublishedDeployment[],
        });
      }

      const result = await ideploy<{
        workspace: { uuid: string };
        database: { uuid: string };
        backend: { uuid: string; url: string | null; deploymentUuid: string };
        frontend: { uuid: string; url: string | null; deploymentUuid: string };
      }>(req, 'POST', '/quick-deploy/fullstack', { name: appName, files, platform_domain: true });

      return res.json({
        success: true,
        mode,
        created: true,
        url: result.frontend.url,
        apiUrl: result.backend.url,
        ids: {
          workspaceUuid: result.workspace.uuid,
          databaseUuid: result.database.uuid,
          backendUuid: result.backend.uuid,
          frontendUuid: result.frontend.uuid,
        },
        deployments: [
          { role: 'backend', deploymentUuid: result.backend.deploymentUuid },
          { role: 'frontend', deploymentUuid: result.frontend.deploymentUuid },
        ] satisfies PublishedDeployment[],
      });
    }

    // Static: the built site.
    if (existing?.applicationUuid) {
      // The address is read while the code is saved: one round trip less.
      const [updated, app] = await Promise.all([
        ideploy<{ deploymentUuid: string }>(
          req, 'PUT', `/applications/${existing.applicationUuid}/source`, delta ? { manifest, files, deploy: true } : { files, deploy: true }
        ),
        ideploy<{ fqdn?: string | null }>(req, 'GET', `/applications/${existing.applicationUuid}`),
      ]);
      return res.json({
        success: true,
        mode: 'static',
        created: false,
        url: toUrl(app?.fqdn),
        ids: { applicationUuid: existing.applicationUuid },
        deployments: [{ role: 'site', deploymentUuid: updated.deploymentUuid }] satisfies PublishedDeployment[],
      });
    }

    // iDeploy reuses the application already published under this name (same address) when the
    // client lost track of it — another browser, a new chat: `reused` then says so.
    const created = await ideploy<{ applicationUuid: string; deploymentUuid: string; url: string | null; reused?: boolean }>(
      req,
      'POST',
      '/quick-deploy',
      {
        name: appName,
        files,
        build_pack: 'static',
        publish_directory: 'dist',
        ports_exposes: '80',
        // `monapp.ideploy.site` (ou `monapp-<id>` si pris) plutôt qu'une adresse technique.
        platform_domain: true,
      }
    );
    return res.json({
      success: true,
      mode: 'static',
      created: !created.reused,
      url: created.url,
      ids: { applicationUuid: created.applicationUuid },
      deployments: [{ role: 'site', deploymentUuid: created.deploymentUuid }] satisfies PublishedDeployment[],
    });
  } catch (error) {
    const err = error as Error & { status?: number; code?: string };
    console.error('[ideploy] publish failed', err.message);
    return res
      .status(err.status && err.status >= 400 && err.status < 600 ? err.status : 502)
      .json({ success: false, code: err.code, message: err.message });
  }
});

/**
 * The address of a first publish, prepared when the publish window opens:
 * iDeploy creates the application and its `monapp.ideploy.site`, deploys
 * nothing, and routes the name as soon as DNS serves it — the certificate is
 * then obtained while the site builds. The click becomes an update of it.
 */
router.post('/reserve', async (req: Request, res: Response) => {
  const appName = slug(String(req.body?.name || 'mon-app'));
  try {
    // The site's package.json (and .npmrc): iDeploy installs its dependencies before the code arrives.
    const raw = req.body?.manifests;
    const manifests =
      raw && typeof raw === 'object'
        ? Object.fromEntries(
            ['package.json', 'package-lock.json', '.npmrc']
              .filter((path) => typeof raw[path] === 'string' && raw[path].length < 2_000_000)
              .map((path) => [path, raw[path] as string])
          )
        : undefined;
    const reserved = await ideploy<{ applicationUuid: string; url: string | null; reused?: boolean }>(req, 'POST', '/quick-deploy', {
      name: appName,
      build_pack: 'static',
      publish_directory: 'dist',
      ports_exposes: '80',
      platform_domain: true,
      reserve: true,
      ...(manifests && Object.keys(manifests).length ? { prepare_files: manifests } : {}),
    });
    // Already published under this name: not a reservation. The client must never hand it back
    // (`/site/delete` when the name changes) — the publish finds it again and updates it.
    if (reserved.reused) return res.json({ success: false, code: 'ALREADY_PUBLISHED', applicationUuid: reserved.applicationUuid, url: reserved.url ?? null });
    return res.json({ success: true, applicationUuid: reserved.applicationUuid, url: reserved.url ?? null });
  } catch (error) {
    const err = error as Error & { status?: number; code?: string };
    return res.status(err.status && err.status >= 400 && err.status < 600 ? err.status : 502).json({ success: false, code: err.code, message: err.message });
  }
});

/** Each file of the published site with its SHA-256: the client then sends only what changed. */
router.get('/applications/:uuid/source/manifest', async (req: Request, res: Response) => {
  try {
    const data = await ideploy<{ manifest: Record<string, string> }>(
      req, 'GET', `/applications/${encodeURIComponent(String(req.params.uuid))}/source/manifest`
    );
    return res.json({ success: true, manifest: data?.manifest ?? {} });
  } catch (error) {
    const err = error as Error & { status?: number };
    return res.status(err.status ?? 502).json({ success: false, message: err.message });
  }
});

/**
 * « Supprimer le site » d'iCode : tout ce qu'une mise en ligne a créé dans iDeploy disparaît, par l'API d'iDeploy
 * elle-même (aucune logique serveur ici). Supprimer une application, côté iDeploy, c'est arrêter ses conteneurs,
 * effacer ses fichiers et ses images, retirer ses routes, ET rendre son adresse `monapp.idem.africa` : son
 * enregistrement DNS est retiré de la zone.
 *
 *   ordre   interface, serveur, site, puis base de données, puis espace de travail (vide seulement)
 *   absent  une ressource déjà supprimée (404) compte comme supprimée : la suppression peut être relancée
 *   arrêt   tout autre refus (déploiement en cours, droits) arrête tout et est rendu tel quel : rien d'autre ne
 *           part, l'atelier garde le site
 */
router.post('/site/delete', async (req: Request, res: Response) => {
  const record = (req.body?.ideploy ?? {}) as Record<string, unknown>;
  const id = (key: string) => (typeof record[key] === 'string' && /^[\w-]{1,64}$/.test(record[key] as string) ? (record[key] as string) : null);
  const results: Array<{ resource: string; outcome: 'deleted' | 'absent' | 'kept' }> = [];
  const remove = async (resource: string, path: string, keepOnConflict = false) => {
    try {
      await ideploy(req, 'DELETE', path);
      results.push({ resource, outcome: 'deleted' });
    } catch (error) {
      const err = error as Error & { status?: number };
      if (err.status === 404) return results.push({ resource, outcome: 'absent' });
      // Un espace de travail qui contient encore autre chose est gardé : il ne coûte rien et n'est pas qu'à ce site.
      if (keepOnConflict && err.status === 409) return results.push({ resource, outcome: 'kept' });
      throw Object.assign(err, { resource });
    }
  };
  try {
    for (const [key, resource] of [
      ['frontendUuid', 'frontend'],
      ['backendUuid', 'backend'],
      ['applicationUuid', 'site'],
    ] as const) {
      const uuid = id(key);
      if (uuid) await remove(resource, `/applications/${encodeURIComponent(uuid)}`);
    }
    const database = id('databaseUuid');
    if (database) await remove('database', `/databases/postgresql/${encodeURIComponent(database)}`);
    const workspace = id('workspaceUuid');
    if (workspace) await remove('workspace', `/workspaces/${encodeURIComponent(workspace)}`, true);
    return res.json({ success: true, results });
  } catch (error) {
    const err = error as Error & { status?: number; code?: string; resource?: string };
    return res.status(err.status ?? 502).json({ success: false, message: err.message, code: err.code ?? null, resource: err.resource ?? null, results });
  }
});

/** Where a deployment is: queued, in progress, finished, failed — and its last log lines. */
router.get('/deployments/:uuid', async (req: Request, res: Response) => {
  try {
    const deployment = await ideploy<{
      status?: string;
      application_url?: string | null;
      logs?: string | null;
    }>(req, 'GET', `/deploy/${encodeURIComponent(String(req.params.uuid))}`);
    const text = logText(deployment.logs);
    return res.json({
      success: true,
      status: deployment.status ?? 'queued',
      url: deployment.application_url ?? null,
      log: text ? text.split('\n').slice(-40).join('\n') : null,
      // The site's own build report (SEO checks), now that iDeploy builds it.
      buildReport: buildReportFrom(text),
      // The build environment itself failed (not the site): iCode then builds in the browser.
      buildUnavailable: Boolean(text?.includes('IDEPLOY_BUILD_UNAVAILABLE')),
    });
  } catch (error) {
    const err = error as Error & { status?: number };
    return res.status(err.status ?? 502).json({ success: false, message: err.message });
  }
});

/**
 * Does the public address answer over HTTPS yet? A deployment can be finished
 * while `monapp.ideploy.site` is still propagating: showing it then gives a
 * browser error ("not secure", or another server). The client waits on this,
 * and meanwhile offers the automatic address when that one already works.
 */
router.get('/applications/:uuid/address', async (req: Request, res: Response) => {
  try {
    const guide = await ideploy<{
      domains: Array<{ host: string; status: string; https?: { status?: string } }>;
    }>(req, 'GET', `/applications/${encodeURIComponent(String(req.params.uuid))}/domains/dns`);
    const domains = guide?.domains ?? [];
    const primary = domains[0] ?? null;
    const working = domains.find((d) => d.https?.status === 'valid') ?? null;
    return res.json({
      success: true,
      url: primary ? `https://${primary.host}` : null,
      ready: primary?.https?.status === 'valid',
      // L'adresse qui marche déjà, quand ce n'est pas encore la principale.
      fallbackUrl: working && working !== primary ? `https://${working.host}` : null,
      // Chaque nom de l'application : `automatic` = une adresse gratuite d'iDeploy, les autres sont à l'utilisateur.
      domains: domains.map((d) => ({ host: d.host, status: d.status, https: d.https?.status ?? 'not_checked' })),
    });
  } catch (error) {
    const err = error as Error & { status?: number };
    return res.status(err.status ?? 502).json({ success: false, message: err.message });
  }
});

/**
 * A domain bought elsewhere, added to the application exactly as iDeploy's own
 * « Nom de domaine » tab does (PATCH fqdn, then redeploy when iDeploy says so).
 * The DNS rules, the routing and the certificate stay iDeploy's.
 */
router.post('/applications/:uuid/domains', async (req: Request, res: Response) => {
  const uuid = encodeURIComponent(String(req.params.uuid));
  const host = String(req.body?.host ?? '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/[/?#].*$/, '')
    .replace(/:\d+$/, '')
    .replace(/\.$/, '');
  if (!/^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(host)) {
    return res.status(422).json({ success: false, message: 'invalid_domain' });
  }
  try {
    const app = await ideploy<{ fqdn?: string | null }>(req, 'GET', `/applications/${uuid}`);
    const current = (app?.fqdn ?? '').split(',').map((d) => d.trim()).filter(Boolean);
    const known = new Set(current.map((d) => d.replace(/^https?:\/\//, '').toLowerCase()));
    const labels = host.split('.');
    const apex = labels.length === 2 || (labels.length === 3 && /^(co|com|org|net|gov|ac|edu)$/.test(labels[1]));
    const wanted = [host, ...(apex && req.body?.includeWww !== false ? [`www.${host}`] : [])].filter((h) => !known.has(h));
    // The new name first: it becomes the address shown (the free one stays and keeps working).
    const fqdn = [...wanted.map((h) => `https://${h}`), ...current].join(',');
    const updated = wanted.length
      ? await ideploy<{ redeployRequired?: boolean }>(req, 'PATCH', `/applications/${uuid}`, { fqdn })
      : {};
    if (updated?.redeployRequired) await ideploy(req, 'POST', '/deploy', { uuid: String(req.params.uuid) });
    return res.json({ success: true, hosts: [host, ...(apex && req.body?.includeWww !== false ? [`www.${host}`] : [])] });
  } catch (error) {
    const err = error as Error & { status?: number; code?: string };
    return res.status(err.status ?? 502).json({ success: false, code: err.code, message: err.message });
  }
});

/**
 * « Personnaliser l'adresse » : the free address `xxx.ideploy.site`, with the
 * name the owner chooses. GET `?label=` says whether it is free; PUT applies it
 * (iDeploy routes it, or redeploys by itself).
 */
router.get('/applications/:uuid/platform-address', async (req: Request, res: Response) => {
  try {
    const label = encodeURIComponent(String(req.query.label ?? '').slice(0, 80));
    const check = await ideploy<Record<string, unknown>>(req, 'GET', `/applications/${encodeURIComponent(String(req.params.uuid))}/platform-address?label=${label}`);
    return res.json({ success: true, ...check });
  } catch (error) {
    const err = error as Error & { status?: number; code?: string };
    return res.status(err.status ?? 502).json({ success: false, code: err.code, message: err.message });
  }
});

router.put('/applications/:uuid/platform-address', async (req: Request, res: Response) => {
  try {
    const app = await ideploy<{ fqdn?: string | null; deploymentUuid?: string | null }>(
      req, 'PUT', `/applications/${encodeURIComponent(String(req.params.uuid))}/platform-address`, { label: String(req.body?.label ?? '').slice(0, 80) }
    );
    return res.json({ success: true, url: toUrl(app?.fqdn), deploymentUuid: app?.deploymentUuid ?? null });
  } catch (error) {
    const err = error as Error & { status?: number; code?: string };
    return res.status(err.status ?? 502).json({ success: false, code: err.code, message: err.message });
  }
});

/** iDeploy's DNS guide for the application: the record to create per domain, what DNS answers, HTTPS. */
router.get('/applications/:uuid/domains/dns', async (req: Request, res: Response) => {
  try {
    const query = typeof req.query.domains === 'string' ? `?domains=${encodeURIComponent(req.query.domains.slice(0, 2000))}` : '';
    const guide = await ideploy<unknown>(req, 'GET', `/applications/${encodeURIComponent(String(req.params.uuid))}/domains/dns${query}`);
    return res.json({ success: true, guide });
  } catch (error) {
    const err = error as Error & { status?: number };
    return res.status(err.status ?? 502).json({ success: false, message: err.message });
  }
});

/** iDeploy's address for an application, as a link. */
function toUrl(fqdn?: string | null): string | null {
  if (!fqdn) return null;
  const first = fqdn.split(',')[0].trim();
  return /^https?:\/\//.test(first) ? first : `https://${first}`;
}

/** A deployment log as text: iDeploy stores it as JSON entries ({ output }) or as plain text. */
function logText(logs?: string | null): string | null {
  if (!logs) return null;
  try {
    const entries = JSON.parse(logs) as Array<{ output?: string }>;
    if (Array.isArray(entries)) return entries.map((e) => e.output ?? '').join('\n');
  } catch {
    /* plain text */
  }
  return logs;
}

/** `@@IDEM_BUILD_REPORT <base64>`, written by iDeploy after building the site: its errors and warnings. */
function buildReportFrom(text: string | null): { errors: string[]; warnings: string[] } | null {
  const line = text?.split('\n').reverse().find((l) => l.includes('@@IDEM_BUILD_REPORT '));
  if (!line) return null;
  try {
    const raw = JSON.parse(Buffer.from(line.split('@@IDEM_BUILD_REPORT ')[1].trim(), 'base64').toString('utf8'));
    const strings = (list: unknown) => (Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : []);
    return { errors: strings(raw?.seo?.errors), warnings: strings(raw?.seo?.warnings) };
  } catch {
    return null;
  }
}

export default router;

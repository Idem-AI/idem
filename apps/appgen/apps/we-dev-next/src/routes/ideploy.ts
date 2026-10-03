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
 *                   The client sends the BUILT site (`dist/…`), iDeploy serves
 *                   it as is — what was previewed is exactly what goes live.
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
  const { name, mode, files, existing } = (req.body ?? {}) as PublishBody;
  if (!files || typeof files !== 'object' || Object.keys(files).length === 0) {
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
      }>(req, 'POST', '/quick-deploy/fullstack', { name: appName, files });

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
      const updated = await ideploy<{ deploymentUuid: string }>(
        req, 'PUT', `/applications/${existing.applicationUuid}/source`, { files, deploy: true }
      );
      const app = await ideploy<{ fqdn?: string | null }>(req, 'GET', `/applications/${existing.applicationUuid}`);
      return res.json({
        success: true,
        mode: 'static',
        created: false,
        url: toUrl(app?.fqdn),
        ids: { applicationUuid: existing.applicationUuid },
        deployments: [{ role: 'site', deploymentUuid: updated.deploymentUuid }] satisfies PublishedDeployment[],
      });
    }

    const created = await ideploy<{ applicationUuid: string; deploymentUuid: string; url: string | null }>(
      req,
      'POST',
      '/quick-deploy',
      {
        name: appName,
        files,
        build_pack: 'static',
        publish_directory: 'dist',
        ports_exposes: '80',
      }
    );
    return res.json({
      success: true,
      mode: 'static',
      created: true,
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

/** Where a deployment is: queued, in progress, finished, failed — and its last log lines. */
router.get('/deployments/:uuid', async (req: Request, res: Response) => {
  try {
    const deployment = await ideploy<{
      status?: string;
      application_url?: string | null;
      logs?: string | null;
    }>(req, 'GET', `/deploy/${encodeURIComponent(String(req.params.uuid))}`);
    return res.json({
      success: true,
      status: deployment.status ?? 'queued',
      url: deployment.application_url ?? null,
      log: tail(deployment.logs),
    });
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

/** The last lines of a deployment log, for the « details » of a failure. */
function tail(logs?: string | null): string | null {
  if (!logs) return null;
  let text = logs;
  try {
    // iDeploy stores its log as JSON entries ({ output }) or as plain text.
    const entries = JSON.parse(logs) as Array<{ output?: string }>;
    if (Array.isArray(entries)) text = entries.map((e) => e.output ?? '').join('\n');
  } catch {
    /* plain text */
  }
  return text.split('\n').slice(-40).join('\n');
}

export default router;

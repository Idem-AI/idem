/**
 * How an application's domains are served: HTTPS forced, HSTS, every domain
 * redirected to the primary one, www or not. Applied live when the
 * application's routes are in the proxy's file provider.
 */
import pool from '../config/db.config';
import { notFound, unprocessable } from '../utils/errors';
import { ApplicationRow, PrivateKeyRow, ServerRow } from '../models/ideploy.types';
import * as appService from './application.service';
import * as serverService from './server.service';
import { applyRoutes } from './routes-file.service';

export interface DomainOptions {
  forceHttps: boolean;
  hsts: boolean;
  redirectToPrimary: boolean;
  /** `both`: www and the bare domain both serve; `www` / `non-www`: one redirects to the other. */
  redirect: 'both' | 'www' | 'non-www';
}

export async function getDomainOptions(teamId: number, uuid: string): Promise<DomainOptions> {
  const app = await appService.getApplication(teamId, uuid);
  if (!app) throw notFound('Application');
  const { rows } = await pool.query(
    `SELECT COALESCE(aps.is_force_https_enabled, true) AS force_https,
            COALESCE(aps.is_hsts_enabled, false) AS hsts,
            COALESCE(aps.is_redirect_to_primary_enabled, false) AS redirect_to_primary,
            a.redirect
       FROM applications a LEFT JOIN application_settings aps ON aps.application_id = a.id
      WHERE a.id = $1 LIMIT 1`,
    [app.id]
  );
  const r = rows[0];
  return {
    forceHttps: Boolean(r.force_https),
    hsts: Boolean(r.hsts),
    redirectToPrimary: Boolean(r.redirect_to_primary),
    redirect: (['www', 'non-www'].includes(r.redirect) ? r.redirect : 'both') as DomainOptions['redirect'],
  };
}

export async function updateDomainOptions(teamId: number, uuid: string, patch: Partial<DomainOptions>): Promise<DomainOptions> {
  const app = await appService.getApplication(teamId, uuid);
  if (!app) throw notFound('Application');
  if (patch.redirect !== undefined && !['both', 'www', 'non-www'].includes(patch.redirect)) {
    throw unprocessable('INVALID_REDIRECT', 'redirect must be both, www or non-www');
  }
  if (patch.hsts && patch.forceHttps === false) {
    throw unprocessable('HSTS_NEEDS_HTTPS', 'HSTS only makes sense with HTTPS forced.');
  }
  const settings: [string, boolean | undefined][] = [
    ['is_force_https_enabled', patch.forceHttps],
    ['is_hsts_enabled', patch.hsts],
    ['is_redirect_to_primary_enabled', patch.redirectToPrimary],
  ];
  const sets = settings.filter(([, v]) => v !== undefined);
  if (sets.length) {
    const assignments = sets.map(([c], i) => `${c} = $${i + 2}`).join(', ');
    const values = sets.map(([, v]) => v);
    const updated = await pool.query(`UPDATE application_settings SET ${assignments}, updated_at = now() WHERE application_id = $1`, [app.id, ...values]);
    if (updated.rowCount === 0) {
      await pool.query(
        `INSERT INTO application_settings (application_id, ${sets.map(([c]) => c).join(', ')}, created_at, updated_at)
         VALUES ($1, ${sets.map((_, i) => `$${i + 2}`).join(', ')}, now(), now())`,
        [app.id, ...values]
      );
    }
  }
  if (patch.redirect !== undefined) {
    await pool.query('UPDATE applications SET redirect = $2, updated_at = now() WHERE id = $1', [app.id, patch.redirect]);
  }
  return getDomainOptions(teamId, uuid);
}

/** The application's server and key, to apply its routes. */
export async function executionTarget(teamId: number, app: ApplicationRow): Promise<{ server: ServerRow; key: PrivateKeyRow } | null> {
  const ref = await appService.getApplicationServer(app.id);
  if (!ref) return null;
  const server = await serverService.getExecutionServer(teamId, ref.serverId);
  const key = server ? await serverService.getExecutionKey(server) : null;
  return server && key ? { server, key } : null;
}

/**
 * Apply the application's domains and options now, when its routes are in the
 * file provider. Otherwise (container from before), they wait for a deployment.
 */
export async function applyDomainsLive(
  teamId: number,
  uuid: string
): Promise<{ applied: true; routed: string[]; waiting: string[] } | { applied: false }> {
  const app = await appService.getApplication(teamId, uuid);
  if (!app || !app.routes_file_at) return { applied: false };
  const target = await executionTarget(teamId, app);
  if (!target) return { applied: false };
  const result = await applyRoutes(target.server, target.key, app);
  return { applied: true, ...result };
}

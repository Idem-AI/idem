/**
 * The address of a first publish, prepared before the click.
 *
 * A first publish used to spend most of its time on the address, not the
 * site: the record `monapp.ideploy.site` written at Namecheap, then up to
 * 90 s waiting for the zone to serve it, then Let's Encrypt asked for the
 * certificate (Traefik's HTTP-01) only once the route was written — and iCode
 * waited up to 45 s more for HTTPS.
 *
 * iCode now reserves the application when its publish window opens
 * (`quick-deploy` with `reserve: true`): the application and its record are
 * created, nothing is deployed, and here the route is written as soon as the
 * zone serves the name. Traefik then obtains the certificate while the user
 * reads the window and the site builds. The click becomes an update of the
 * reserved application: the address is usually already secure.
 *
 * A reservation never published is deleted after RESERVATION_TTL_MS (its
 * record goes back to the zone), by the domain sweep every 5 minutes. Kept in
 * a Redis sorted set: no table, no setting.
 */
import redis from '../config/redis.config';
import logger from '../config/logger';
import pool from '../config/db.config';
import type { ApplicationRow } from '../models/ideploy.types';

const KEY = 'ideploy:address-reservations';
/** A window left open for a day without publishing: the reservation is given back. */
export const RESERVATION_TTL_MS = 24 * 60 * 60 * 1000;
/** Namecheap usually serves a new record within a minute; the 5-minute sweep takes over after. */
const DNS_WAIT_MS = 10 * 60 * 1000;

const member = (teamId: number, uuid: string) => `${teamId}:${uuid}`;

/**
 * Record the reservation, and in the background: route the address as soon as
 * DNS serves it, and get the build ready — the Node image pulled and, given the
 * site's package.json, its dependencies installed. The first build then only builds.
 */
export async function reserveAddress(teamId: number, app: ApplicationRow, manifests?: Record<string, string> | null): Promise<void> {
  await redis.zadd(KEY, Date.now(), member(teamId, app.uuid));
  void prepareRoute(teamId, app);
  void prepareBuild(teamId, app, manifests ?? null);
}

async function prepareBuild(teamId: number, app: ApplicationRow, manifests: Record<string, string> | null): Promise<void> {
  try {
    const { executionTarget } = await import('./domain-options.service');
    const target = await executionTarget(teamId, app);
    if (!target) return;
    const { ensureBuildImage, prepareDependencies, normalizeBaseDir } = await import('../jobs/static-build');
    if (!manifests) return ensureBuildImage(target.server, target.key);
    const { withApplicationLock } = await import('../jobs/deployment.worker');
    const { appWorkdir } = await import('../docker/compose');
    const started = Date.now();
    // Under the application's deployment lock: a publish clicked meanwhile waits for the install, then reuses it.
    const installed = await withApplicationLock(app.id, `prepare-${app.uuid}`, async () => undefined, () =>
      prepareDependencies({
        server: target.server,
        key: target.key,
        workdir: appWorkdir(app),
        baseDir: normalizeBaseDir(app.base_directory),
        files: manifests,
        tag: app.uuid.slice(0, 8),
      }),
      { pollMs: 500 }
    );
    logger.info('address.build_prepared', { event: 'address.build_prepared', uuid: app.uuid, installed, durationMs: Date.now() - started });
  } catch (err) {
    logger.warn('address.build_prepare_failed', { uuid: app.uuid, message: (err as Error).message });
  }
}

async function prepareRoute(teamId: number, app: ApplicationRow): Promise<void> {
  try {
    const { executionTarget } = await import('./domain-options.service');
    const { applyRoutes } = await import('./routes-file.service');
    const target = await executionTarget(teamId, app);
    if (!target) return;
    const started = Date.now();
    const { routed, waiting } = await applyRoutes(target.server, target.key, app, { port: 80, waitForPlatformDnsMs: DNS_WAIT_MS });
    logger.info('address.prepared', {
      event: 'address.prepared',
      uuid: app.uuid,
      routed,
      waiting,
      durationMs: Date.now() - started,
    });
  } catch (err) {
    // Never blocking: the deployment writes the routes again anyway.
    logger.warn('address.prepare_failed', { uuid: app.uuid, message: (err as Error).message });
  }
}

/** Reservations past their time: deleted when nothing was ever published, forgotten otherwise. */
export async function sweepReservations(now = Date.now()): Promise<number> {
  const expired = await redis.zrangebyscore(KEY, '-inf', now - RESERVATION_TTL_MS, 'LIMIT', 0, 50);
  let removed = 0;
  for (const entry of expired) {
    const [teamPart, uuid] = entry.split(':');
    const teamId = Number(teamPart);
    try {
      const { rows } = await pool.query(
        `SELECT a.id,
                EXISTS (SELECT 1 FROM application_sources s WHERE s.application_id = a.id) AS has_source,
                EXISTS (SELECT 1 FROM application_deployment_queues q WHERE q.application_id = a.id::text) AS deployed
           FROM applications a WHERE a.uuid = $1`,
        [uuid]
      );
      if (rows[0] && !rows[0].has_source && !rows[0].deployed) {
        const appService = await import('./application.service');
        await appService.deleteApplication(teamId, uuid);
        removed++;
      }
      await redis.zrem(KEY, entry);
    } catch (err) {
      logger.warn('address.reservation_sweep_failed', { uuid, message: (err as Error).message });
    }
  }
  if (removed) logger.info('address.reservations_released', { event: 'address.reservations_released', removed });
  return removed;
}

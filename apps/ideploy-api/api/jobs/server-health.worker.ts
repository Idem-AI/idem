/**
 * Server health worker — replaces Coolify's `ServerManagerJob` + `ServerCheckJob`
 * and their per-minute Console/Kernel cron entry.
 *
 * A single repeatable job sweeps the whole fleet, rather than one repeatable job
 * per server: servers come and go, and BullMQ repeatable jobs keyed on a server
 * would then need adding and removing in lockstep with the database. One sweep
 * that reads the current fleet each time cannot drift out of sync.
 */
import { Job } from 'bullmq';
import logger from '../config/logger';
import { QUEUE_NAMES, getQueue } from '../queue/queues';
import { registerWorker } from '../queue/worker';
import { checkAllServers } from '../services/server-health.service';
import { refreshAllLoadScores } from '../services/server-scheduling.service';

/** How often the fleet is swept. Matches Coolify's per-minute cadence. */
const SWEEP_PATTERN = process.env.SERVER_HEALTH_CRON || '* * * * *';

const JOB_NAME = 'server-health-sweep';
const DOMAINS_JOB = 'domain-verification';
const DOMAINS_PATTERN = process.env.DOMAIN_VERIFICATION_CRON || '*/5 * * * *';
/** Compteurs IDEM : arrêt et relance des applications selon leur solde. */
const METERS_JOB = 'idem-meters';
const METERS_PATTERN = process.env.IDEM_METERS_CRON || '*/5 * * * *';

/** Domains waiting for DNS are routed as soon as it reaches their server. */
async function processDomainSweep(): Promise<void> {
  const { sweepDomains, applyRoutes } = await import('../services/routes-file.service');
  const { executionTarget } = await import('../services/domain-options.service');
  const pool = (await import('../config/db.config')).default;
  const checked = await sweepDomains(async (applicationId) => {
    const { rows } = await pool.query(
      `SELECT a.uuid, p.team_id FROM applications a JOIN environments e ON e.id = a.environment_id
         JOIN projects p ON p.id = e.project_id WHERE a.id = $1`,
      [applicationId]
    );
    if (!rows[0]) return;
    const appService = await import('../services/application.service');
    const app = await appService.getApplication(Number(rows[0].team_id), String(rows[0].uuid));
    if (!app) return;
    const target = await executionTarget(Number(rows[0].team_id), app);
    if (target) await applyRoutes(target.server, target.key, app);
  });
  if (checked > 0) logger.info('domains.swept', { event: 'domains.swept', applications: checked });
}

/** Le certificat `*.idem.africa` : renouvelé avant échéance, présent sur chaque serveur d'IDEM qui sert une adresse de plateforme. */
const CERT_JOB = 'platform-certificate';
const CERT_PATTERN = process.env.PLATFORM_CERT_CRON || '17 */6 * * *';

async function processPlatformCertificate(): Promise<void> {
  const { ensurePlatformCertificate, ensurePlatformCertificateOn, platformDomain } = await import('../services/platform-certificate.service');
  const domain = platformDomain();
  if (!domain) return;
  const { cert, renewed } = await ensurePlatformCertificate();
  if (!cert) return;
  const { executionTarget } = await import('../services/domain-options.service');
  const appService = await import('../services/application.service');
  const pool = (await import('../config/db.config')).default;
  // Une application par serveur suffit à l'atteindre.
  const { rows } = await pool.query(
    `SELECT DISTINCT ON (sd.server_id) a.uuid, p.team_id
       FROM applications a
       JOIN environments e ON e.id = a.environment_id
       JOIN projects p ON p.id = e.project_id
       JOIN standalone_dockers sd ON sd.id = a.destination_id AND a.destination_type LIKE '%StandaloneDocker'
       JOIN servers s ON s.id = sd.server_id
      WHERE COALESCE(s.idem_managed, false) = true AND a.fqdn ILIKE $1
      ORDER BY sd.server_id`,
    [`%.${domain}%`]
  );
  let installedOn = 0;
  for (const row of rows) {
    const app = await appService.getApplication(Number(row.team_id), String(row.uuid));
    const target = app ? await executionTarget(Number(row.team_id), app) : null;
    if (target && (await ensurePlatformCertificateOn(target.server, target.key))) installedOn++;
  }
  logger.info('platform_certificate.swept', { event: 'platform_certificate.swept', renewed, servers: rows.length, installedOn });
}

async function processMeterSweep(): Promise<void> {
  const { applyPendingMeters } = await import('../services/meter-enforcement.service');
  const applied = await applyPendingMeters();
  if (applied > 0) logger.info('meters.swept', { event: 'meters.swept', applied });
}

async function processSweep(job: Job): Promise<void> {
  if (job.name === DOMAINS_JOB) return processDomainSweep();
  if (job.name === METERS_JOB) return processMeterSweep();
  // En arrière-plan : une émission attend la propagation DNS (minutes) et bloquerait la file des serveurs.
  if (job.name === CERT_JOB) {
    void processPlatformCertificate().catch((err) =>
      logger.error('platform_certificate.sweep_failed', { event: 'platform_certificate.sweep_failed', message: (err as Error).message })
    );
    return;
  }
  const outcomes = await checkAllServers();
  // Orders the managed servers whose measurements are missing or stale (placement).
  await refreshAllLoadScores().catch((err) =>
    logger.error('Could not refresh server load scores', { message: (err as Error).message })
  );
  const unreachable = outcomes.filter((o) => !o.reachable);
  const alerted = outcomes.filter((o) => o.notifications.length > 0);

  // Only log when there is something to say: a per-minute "all fine" line buries
  // the entries that matter.
  if (unreachable.length > 0 || alerted.length > 0) {
    logger.info('Server health sweep', {
      checked: outcomes.length,
      unreachable: unreachable.map((o) => o.serverName),
      stateChanges: alerted.flatMap((o) => o.notifications.map((n) => `${o.serverName}:${n.kind}`)),
    });
  }
}

export function registerServerHealthWorker(): void {
  registerWorker(QUEUE_NAMES.servers, processSweep, 1);
  logger.info('Server health worker registered');
}

/** Schedule the sweep. Safe to call again — BullMQ dedups on `jobId`. */
export async function registerServerHealthScheduler(): Promise<void> {
  try {
    await getQueue(QUEUE_NAMES.servers).add(
      JOB_NAME,
      {},
      { repeat: { pattern: SWEEP_PATTERN }, jobId: 'server-health-sweep' }
    );
    logger.info(`Server health sweep scheduled (${SWEEP_PATTERN})`);
    await getQueue(QUEUE_NAMES.servers).add(DOMAINS_JOB, {}, { repeat: { pattern: DOMAINS_PATTERN }, jobId: DOMAINS_JOB });
    await getQueue(QUEUE_NAMES.servers).add(METERS_JOB, {}, { repeat: { pattern: METERS_PATTERN }, jobId: METERS_JOB });
    await getQueue(QUEUE_NAMES.servers).add(CERT_JOB, {}, { repeat: { pattern: CERT_PATTERN }, jobId: CERT_JOB });
    // Une fois au démarrage : le premier certificat n'attend pas six heures.
    await getQueue(QUEUE_NAMES.servers).add(CERT_JOB, {}, { jobId: `${CERT_JOB}-boot`, removeOnComplete: true, removeOnFail: true });
  } catch (err) {
    logger.warn('Could not schedule the server health sweep', {
      message: (err as Error).message,
    });
  }
}

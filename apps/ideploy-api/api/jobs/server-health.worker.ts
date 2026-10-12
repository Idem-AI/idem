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

async function processSweep(job: Job): Promise<void> {
  if (job.name === DOMAINS_JOB) return processDomainSweep();
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
  } catch (err) {
    logger.warn('Could not schedule the server health sweep', {
      message: (err as Error).message,
    });
  }
}

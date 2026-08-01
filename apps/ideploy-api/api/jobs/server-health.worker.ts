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

/** How often the fleet is swept. Matches Coolify's per-minute cadence. */
const SWEEP_PATTERN = process.env.SERVER_HEALTH_CRON || '* * * * *';

const JOB_NAME = 'server-health-sweep';

async function processSweep(_job: Job): Promise<void> {
  const outcomes = await checkAllServers();
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
  } catch (err) {
    logger.warn('Could not schedule the server health sweep', {
      message: (err as Error).message,
    });
  }
}

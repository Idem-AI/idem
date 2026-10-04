/**
 * Keeping the firewall's observability tables filled — and from becoming the
 * problem.
 *
 * Traffic rows arrive per event. Left alone they fill the disk of the machine
 * running the API — and a full disk breaks deployments in ways that look
 * unrelated, which is exactly what the Docker log rotation in the server setup
 * work exists to prevent. Retention here is the same class of protection, not
 * housekeeping.
 *
 * The same worker imports CrowdSec's alerts and decisions every few minutes:
 * without it, the alert and traffic views stay empty whatever CrowdSec blocks.
 *
 * Everything runs on its own queue. It used to share `scheduler` with users'
 * scheduled tasks, and BullMQ hands every job of a queue to any of its
 * workers: this one received scheduled tasks, ignored them, and marked them
 * done — so those tasks silently never ran.
 */
import { Job } from 'bullmq';
import logger from '../config/logger';
import { QUEUE_NAMES, getQueue } from '../queue/queues';
import { registerWorker } from '../queue/worker';
import { listServersToSync, purgeExpired, syncServer } from '../services/firewall-observability.service';

export const PURGE_JOB = 'firewall-observability-purge';
export const SYNC_JOB = 'firewall-observability-sync';

/** Daily is enough: retention is measured in days, not minutes. */
const PURGE_PATTERN = process.env.FIREWALL_PURGE_CRON || '17 3 * * *';
/** Often enough for an incident to show up while it is happening. */
const SYNC_PATTERN = process.env.FIREWALL_SYNC_CRON || '*/5 * * * *';

export async function processFirewallJob(job: Job): Promise<void> {
  if (job.name === PURGE_JOB) {
    try {
      await purgeExpired();
    } catch (err) {
      // The next run catches up: retention is not urgent to the minute.
      logger.error('Firewall observability purge failed', { message: (err as Error).message });
    }
    return;
  }

  if (job.name === SYNC_JOB) {
    for (const serverId of await listServersToSync()) {
      try {
        await syncServer(serverId);
      } catch (err) {
        // One unreachable CrowdSec must not keep the other servers unsynced.
        logger.warn('Firewall observability sync failed', { serverId, message: (err as Error).message });
      }
    }
  }
}

export function registerFirewallObservabilityWorker(): void {
  registerWorker(QUEUE_NAMES.firewall, processFirewallJob, 1);
  logger.info('Firewall observability worker registered');
}

/** Schedule the purge and the sync. Safe to call again — BullMQ dedups repeatables. */
export async function registerFirewallObservabilityScheduler(): Promise<void> {
  try {
    await removeLegacySchedule();
    const queue = getQueue(QUEUE_NAMES.firewall);
    await queue.add(PURGE_JOB, {}, { repeat: { pattern: PURGE_PATTERN }, jobId: PURGE_JOB });
    await queue.add(SYNC_JOB, {}, { repeat: { pattern: SYNC_PATTERN }, jobId: SYNC_JOB });
    logger.info(`Firewall observability scheduled (purge ${PURGE_PATTERN}, sync ${SYNC_PATTERN})`);
  } catch (err) {
    logger.warn('Could not schedule firewall observability', { message: (err as Error).message });
  }
}

/**
 * The purge used to repeat on the `scheduler` queue, where Redis keeps it after
 * the code has moved: left there, the scheduled-task worker would receive it
 * every night.
 */
async function removeLegacySchedule(): Promise<void> {
  const scheduler = getQueue(QUEUE_NAMES.scheduler);
  for (const repeatable of await scheduler.getRepeatableJobs()) {
    if (repeatable.name === PURGE_JOB) {
      await scheduler.removeRepeatableByKey(repeatable.key);
      logger.info('Removed the firewall purge from the scheduler queue');
    }
  }
}

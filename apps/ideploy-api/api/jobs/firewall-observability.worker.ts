/**
 * Keeping the firewall's observability tables from becoming the problem.
 *
 * Traffic rows arrive per event. Left alone they fill the disk of the machine
 * running the API — and a full disk breaks deployments in ways that look
 * unrelated, which is exactly what the Docker log rotation in the server setup
 * work exists to prevent. Retention here is the same class of protection, not
 * housekeeping.
 */
import { Job } from 'bullmq';
import logger from '../config/logger';
import { QUEUE_NAMES, getQueue } from '../queue/queues';
import { registerWorker } from '../queue/worker';
import { purgeExpired } from '../services/firewall-observability.service';

const JOB_NAME = 'firewall-observability-purge';

/** Daily is enough: retention is measured in days, not minutes. */
const PURGE_PATTERN = process.env.FIREWALL_PURGE_CRON || '17 3 * * *';

async function processPurge(job: Job): Promise<void> {
  if (job.name !== JOB_NAME) return;

  try {
    await purgeExpired();
  } catch (err) {
    // A failed purge must not take the scheduler queue down with it: the next
    // run catches up, and retention is not urgent to the minute.
    logger.error('Firewall observability purge failed', { message: (err as Error).message });
  }
}

export function registerFirewallObservabilityWorker(): void {
  registerWorker(QUEUE_NAMES.scheduler, processPurge, 1);
  logger.info('Firewall observability worker registered');
}

/** Schedule the purge. Safe to call again — BullMQ dedups on `jobId`. */
export async function registerFirewallObservabilityScheduler(): Promise<void> {
  try {
    await getQueue(QUEUE_NAMES.scheduler).add(
      JOB_NAME,
      {},
      { repeat: { pattern: PURGE_PATTERN }, jobId: JOB_NAME }
    );
    logger.info(`Firewall observability purge scheduled (${PURGE_PATTERN})`);
  } catch (err) {
    logger.warn('Could not schedule the firewall observability purge', {
      message: (err as Error).message,
    });
  }
}

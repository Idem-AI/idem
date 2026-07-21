/**
 * Scheduled-task worker (BullMQ) — runs user-defined cron commands inside app
 * containers. Replaces Coolify's ScheduledTaskJob + the Console/Kernel cron.
 */
import { Job } from 'bullmq';
import logger from '../config/logger';
import { QUEUE_NAMES, getQueue } from '../queue/queues';
import { registerWorker } from '../queue/worker';
import * as taskService from '../services/scheduled-task.service';

interface TaskJobData {
  teamId: number;
  taskUuid: string;
}

async function processTask(job: Job<TaskJobData>): Promise<void> {
  const result = await taskService.runNow(job.data.teamId, job.data.taskUuid);
  if (!result.success) throw new Error('Scheduled task failed');
}

export function registerScheduledTaskWorker(): void {
  registerWorker<TaskJobData>(QUEUE_NAMES.scheduler, processTask, 3);
  logger.info('Scheduled-task worker registered');
}

export async function registerScheduledTaskScheduler(): Promise<void> {
  let tasks: Awaited<ReturnType<typeof taskService.listAllEnabled>> = [];
  try {
    tasks = await taskService.listAllEnabled();
  } catch (err) {
    logger.warn('Could not load scheduled tasks (DB not ready?)', { message: (err as Error).message });
    return;
  }
  const queue = getQueue(QUEUE_NAMES.scheduler);
  for (const t of tasks) {
    await queue.add(
      'scheduled-task',
      { teamId: t.team_id, taskUuid: t.uuid } satisfies TaskJobData,
      { repeat: { pattern: t.frequency }, jobId: `task:${t.uuid}` }
    );
  }
  logger.info(`Registered ${tasks.length} scheduled task(s)`);
}

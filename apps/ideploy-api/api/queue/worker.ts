/**
 * Worker registration helper. Workers run in the same process in dev; in
 * production they can be split into a dedicated `worker` entrypoint.
 */
import { Worker, Job, Processor } from 'bullmq';
import { redisOptions } from '../config/redis.config';
import { QueueName, QUEUE_PREFIX } from './queues';
import logger from '../config/logger';

const workers: Worker[] = [];

export function registerWorker<T = unknown>(
  queueName: QueueName,
  processor: Processor<T>,
  concurrency = 5
): Worker<T> {
  const worker = new Worker<T>(queueName, processor, {
    connection: redisOptions,
    prefix: QUEUE_PREFIX,
    concurrency,
  });

  worker.on('completed', (job: Job) => {
    logger.info('Job completed', { queue: queueName, jobId: job.id, name: job.name });
  });
  worker.on('failed', (job: Job | undefined, err: Error) => {
    logger.error('Job failed', {
      queue: queueName,
      jobId: job?.id,
      name: job?.name,
      message: err.message,
    });
  });

  workers.push(worker);
  return worker;
}

export async function closeWorkers(): Promise<void> {
  await Promise.all(workers.map((w) => w.close()));
}

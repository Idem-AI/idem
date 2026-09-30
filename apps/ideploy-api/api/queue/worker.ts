/**
 * Worker registration helper. Workers run in the same process in dev; in
 * production they can be split into a dedicated `worker` entrypoint.
 */
import { Worker, Job, Processor } from 'bullmq';
import { redisOptions } from '../config/redis.config';
import { QueueName, QUEUE_PREFIX } from './queues';
import logger from '../config/logger';
import { runWithTrace, TraceContext } from '../utils/trace.util';

const workers: Worker[] = [];

export function registerWorker<T = unknown>(
  queueName: QueueName,
  processor: Processor<T>,
  concurrency = 5
): Worker<T> {
  const worker = new Worker<T>(queueName, tracedProcessor(queueName, processor), {
    connection: redisOptions,
    prefix: QUEUE_PREFIX,
    concurrency,
  });

  worker.on('failed', (job: Job | undefined, err: Error) => {
    const maxAttempts = job?.opts.attempts ?? 1;
    const final = !job || job.attemptsMade >= maxAttempts;
    runWithTrace(jobTrace(queueName, job), () => {
      // Une tentative ratée qui sera rejouée n'est qu'un avertissement ;
      // l'abandon définitif est une erreur (compté par les alertes Grafana).
      logger.log(final ? 'error' : 'warn', final ? 'job.failed' : 'job.retry', {
        event: final ? 'job.failed' : 'job.retry',
        attempt: job?.attemptsMade,
        maxAttempts,
        durationMs: job?.processedOn ? Date.now() - job.processedOn : undefined,
        error: err,
      });
    });
  });
  // Erreurs du worker lui-même (Redis perdu, processeur introuvable) : aucune
  // tâche de cette file ne s'exécute tant qu'elles durent.
  worker.on('error', (err: Error) => {
    logger.error('job.worker_error', { event: 'job.worker_error', queue: queueName, error: err });
  });
  worker.on('stalled', (jobId: string) => {
    logger.warn('job.stalled', { event: 'job.stalled', queue: queueName, jobId });
  });

  workers.push(worker);
  return worker;
}

type TraceCarrier = { __trace?: { requestId?: string; userId?: string | number } };

/** Contexte de la tâche : reprend l'identifiant de la requête qui l'a créée. */
function jobTrace(queueName: string, job: Job | undefined): TraceContext {
  const carried = (job?.data as TraceCarrier | undefined)?.__trace;
  return {
    requestId: carried?.requestId ?? `job-${queueName}-${job?.id ?? 'unknown'}`,
    userId: carried?.userId,
    startedAt: Date.now(),
    queue: queueName,
    jobId: job?.id,
    jobName: job?.name,
  };
}

/**
 * Exécute chaque tâche dans son contexte de traçage : tout ce que journalisent
 * le worker, le SSH et Docker porte `queue`, `jobId` et le `requestId` d'origine.
 */
function tracedProcessor<T>(queueName: string, processor: Processor<T>): Processor<T> {
  return (job, token) =>
    runWithTrace(jobTrace(queueName, job), async () => {
      const startedAt = Date.now();
      logger.info('job.started', {
        event: 'job.started',
        attempt: job.attemptsMade + 1,
        maxAttempts: job.opts.attempts ?? 1,
        waitedMs: startedAt - job.timestamp,
      });
      const result = await processor(job, token);
      logger.info('job.completed', { event: 'job.completed', durationMs: Date.now() - startedAt });
      return result;
    });
}

export async function closeWorkers(): Promise<void> {
  await Promise.all(workers.map((w) => w.close()));
}

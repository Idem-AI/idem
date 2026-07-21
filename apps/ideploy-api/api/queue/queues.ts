/**
 * BullMQ queue registry — replaces Laravel Horizon/Redis queues.
 *
 * Each Laravel Job maps to a BullMQ job on one of these queues. Workers are
 * registered with `registerWorker` (see worker.ts). The scheduler (replacing
 * Console/Kernel cron) uses repeatable jobs on the `scheduler` queue.
 */
import { Queue, QueueOptions } from 'bullmq';
import { redisOptions } from '../config/redis.config';

// NOTE: BullMQ forbids ':' in queue names (it's the Redis key separator).
// Use hyphens; a shared key prefix is set via QueueOptions.prefix instead.
export const QUEUE_NAMES = {
  deployments: 'ideploy-deployments',
  pipelines: 'ideploy-pipelines',
  servers: 'ideploy-servers',
  databases: 'ideploy-databases',
  notifications: 'ideploy-notifications',
  scheduler: 'ideploy-scheduler',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export const QUEUE_PREFIX = 'ideploy';

const baseOptions: QueueOptions = {
  connection: redisOptions,
  prefix: QUEUE_PREFIX,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { age: 3600, count: 1000 },
    removeOnFail: { age: 24 * 3600 },
  },
};

const registry = new Map<string, Queue>();

export function getQueue(name: QueueName): Queue {
  let q = registry.get(name);
  if (!q) {
    q = new Queue(name, baseOptions);
    registry.set(name, q);
  }
  return q;
}

export const deploymentQueue = getQueue(QUEUE_NAMES.deployments);
export const serverQueue = getQueue(QUEUE_NAMES.servers);
export const databaseQueue = getQueue(QUEUE_NAMES.databases);
export const notificationQueue = getQueue(QUEUE_NAMES.notifications);
export const schedulerQueue = getQueue(QUEUE_NAMES.scheduler);

export async function closeQueues(): Promise<void> {
  await Promise.all([...registry.values()].map((q) => q.close()));
}

/**
 * Shared teardown for suites that import the route graph.
 *
 * Importing a controller pulls in `queue/queues.ts`, which instantiates BullMQ
 * queues eagerly — each holding a Redis connection. Closing them keeps Vitest
 * from reporting dangling handles (and stops a test run from lingering).
 */
import { closeQueues } from '../../api/queue/queues';
import redis from '../../api/config/redis.config';
import pool from '../../api/config/db.config';
import { closeTestPool } from './db';

export async function closeInfrastructure(): Promise<void> {
  await Promise.allSettled([
    closeQueues(),
    redis.status === 'end' ? Promise.resolve() : redis.quit(),
    pool.end(),
    closeTestPool(),
  ]);
}

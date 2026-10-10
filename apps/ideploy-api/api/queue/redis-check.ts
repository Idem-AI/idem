/**
 * Redis settings the queues depend on, checked at start-up.
 *
 * BullMQ keeps every job in Redis. With an eviction policy other than
 * `noeviction`, Redis silently drops jobs under memory pressure; without
 * persistence, a restart of Redis loses every queued deployment. Neither
 * stops iDeploy from starting — both are logged as critical so the alert
 * reaches the team.
 */
import redis from '../config/redis.config';
import logger, { logCritical } from '../config/logger';

export async function checkRedisForQueues(): Promise<void> {
  try {
    const [, policy] = (await redis.config('GET', 'maxmemory-policy')) as string[];
    const [, aof] = (await redis.config('GET', 'appendonly')) as string[];
    const [, rdb] = (await redis.config('GET', 'save')) as string[];
    if (policy !== 'noeviction') {
      logCritical('redis.eviction_policy', {
        message: `Redis maxmemory-policy is "${policy}": queued jobs can be evicted. Set it to noeviction.`,
        policy,
      });
    }
    if (aof !== 'yes' && !rdb) {
      logCritical('redis.no_persistence', {
        message: 'Redis has neither AOF nor RDB snapshots: a Redis restart loses every queued job.',
      });
    }
    logger.info('redis.checked', { event: 'redis.checked', policy, appendonly: aof, save: rdb || 'off' });
  } catch (err) {
    // CONFIG may be disabled on a managed Redis: not a reason to stop.
    logger.warn('redis.check_skipped', { event: 'redis.check_skipped', error: err });
  }
}

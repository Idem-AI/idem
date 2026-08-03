/**
 * Shared Redis connection (ioredis). Used for caching and as the BullMQ
 * backend. BullMQ requires `maxRetriesPerRequest: null` on its connection.
 */
import Redis, { RedisOptions } from 'ioredis';
import logger from './logger';

export const redisOptions: RedisOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
};

/**
 * Standalone client for caching and ad-hoc commands.
 *
 * `lazyConnect` so importing this module never opens a socket: the API can boot
 * and answer /health (reporting `redis: false`) while Redis is still starting,
 * and tests that import a route graph do not silently hold a connection open.
 * BullMQ keeps its own eager connections — see queue/queues.ts.
 */
const redis = new Redis({ ...redisOptions, lazyConnect: true });

redis.on('connect', () => logger.info('Connected to Redis'));
redis.on('error', (err: Error) => logger.error('Redis error', { message: err.message }));

export default redis;

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

const redis = new Redis(redisOptions);

redis.on('connect', () => logger.info('Connected to Redis'));
redis.on('error', (err: Error) => logger.error('Redis error', { message: err.message }));

export default redis;

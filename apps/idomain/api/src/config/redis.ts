/**
 * Redis : les files BullMQ des tâches longues (enregistrement, connexion d'un domaine, événements)
 * et les verrous courts. BullMQ exige `maxRetriesPerRequest: null` sur sa connexion.
 */
import Redis, { RedisOptions } from 'ioredis';
import logger from './logger';

export const redisOptions: RedisOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || '0', 10),
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
};

/** Client des commandes ponctuelles (verrous) ; `lazyConnect` : importer ce module n'ouvre rien. */
const redis = new Redis({ ...redisOptions, lazyConnect: true });
redis.on('error', (error: Error) => logger.error('redis.error', { event: 'redis.error', error }));

export default redis;

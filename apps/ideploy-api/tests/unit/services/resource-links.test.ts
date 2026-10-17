/**
 * An application's variables linked to its workspace's Redis, RabbitMQ or
 * database — only where the value is an example, never the user's own.
 */
import { describe, it, expect } from 'vitest';
import { classifyVariable, isPlaceholder, linkVariables, targetKindOf } from '../../../api/services/resource-links';

const targets = {
  database: { name: 'shop-db', type: 'postgresql', connectionUrl: 'postgres://app:dbpass@postgresql-1:5432/shop' },
  redis: { name: 'shop-cache', type: 'redis', connectionUrl: 'redis://:redispass@redis-2:6379' },
  queue: { name: 'shop-mq', type: 'rabbitmq', connectionUrl: 'amqp://rabbit:mqpass@rabbitmq-3:5672' },
};

describe('which resource a variable names', () => {
  it('reads cache, queue and database variables, and their separate parts', () => {
    expect(classifyVariable('REDIS_URL')).toEqual({ resource: 'redis', field: 'url' });
    expect(classifyVariable('CACHE_URL')?.resource).toBe('redis');
    expect(classifyVariable('BULL_REDIS_URL')?.resource).toBe('redis');
    expect(classifyVariable('QUEUE_REDIS_URL')?.resource).toBe('redis');
    expect(classifyVariable('SIDEKIQ_REDIS_URL')?.resource).toBe('redis');
    expect(classifyVariable('RABBITMQ_URL')).toEqual({ resource: 'queue', field: 'url' });
    expect(classifyVariable('AMQP_URL')?.resource).toBe('queue');
    expect(classifyVariable('CELERY_BROKER_URL')).toEqual({ resource: 'queue', field: 'url', anyBroker: true });
    expect(classifyVariable('DATABASE_URL')?.resource).toBe('database');
    expect(classifyVariable('REDIS_HOST')).toEqual({ resource: 'redis', field: 'host' });
    expect(classifyVariable('RABBITMQ_DEFAULT_PASS')).toEqual({ resource: 'queue', field: 'password' });
    // Never a bare secret, nor another service's.
    expect(classifyVariable('PASSWORD')).toBeNull();
    expect(classifyVariable('SMTP_PASSWORD')).toBeNull();
    expect(classifyVariable('STRIPE_URL')).toBeNull();
  });

  it('tells an example value from the user’s own', () => {
    expect(isPlaceholder('')).toBe(true);
    expect(isPlaceholder('redis://localhost:6379')).toBe(true);
    expect(isPlaceholder('redis://redis:6379')).toBe(true);
    expect(isPlaceholder('amqp://guest:guest@rabbitmq:5672')).toBe(true);
    expect(isPlaceholder('db')).toBe(true);
    expect(isPlaceholder('6379')).toBe(true);
    expect(isPlaceholder('redis://:s3cr3t@cache.prod.internal:6379')).toBe(false);
  });
});

describe('linking the variables', () => {
  it('fills examples with the workspace resources, keeps what the user set', () => {
    const linked = linkVariables(
      [
        { key: 'REDIS_URL', value: 'redis://localhost:6379' },
        { key: 'RABBITMQ_URL', value: '' },
        { key: 'REDIS_HOST', value: 'redis' },
        { key: 'REDIS_PASSWORD', value: '' },
        { key: 'RABBITMQ_USER', value: 'guest' },
        { key: 'DATABASE_URL', value: 'postgres://user:pass@localhost:5432/dev' },
        { key: 'CACHE_URL', value: 'redis://:mine@cache.prod.internal:6379' },
        { key: 'APP_NAME', value: 'shop' },
      ],
      targets
    );
    const value = (key: string) => linked.find((l) => l.key === key);
    expect(value('REDIS_URL')).toEqual({ key: 'REDIS_URL', value: 'redis://:redispass@redis-2:6379', linkedTo: 'shop-cache' });
    expect(value('RABBITMQ_URL')?.value).toBe('amqp://rabbit:mqpass@rabbitmq-3:5672');
    expect(value('REDIS_HOST')?.value).toBe('redis-2');
    expect(value('REDIS_PASSWORD')?.value).toBe('redispass');
    expect(value('RABBITMQ_USER')?.value).toBe('rabbit');
    expect(value('DATABASE_URL')?.value).toBe('postgres://app:dbpass@postgresql-1:5432/shop');
    expect(value('CACHE_URL')).toEqual({ key: 'CACHE_URL', value: 'redis://:mine@cache.prod.internal:6379' });
    expect(value('APP_NAME')?.linkedTo).toBeUndefined();
  });

  it('sends a generic broker to Redis when there is no RabbitMQ, never an AMQP one', () => {
    const noQueue = { database: targets.database, redis: targets.redis };
    const linked = linkVariables(
      [
        { key: 'CELERY_BROKER_URL', value: 'redis://localhost:6379/0' },
        { key: 'AMQP_URL', value: 'amqp://localhost' },
      ],
      noQueue
    );
    expect(linked[0].value).toBe('redis://:redispass@redis-2:6379');
    expect(linked[1].linkedTo).toBeUndefined();
  });

  it('never links a database variable written for another engine', () => {
    const linked = linkVariables([{ key: 'DATABASE_URL', value: 'mysql://root@localhost/app' }], targets);
    expect(linked[0].linkedTo).toBeUndefined();
    expect(targetKindOf('clickhouse')).toBeNull();
    expect(targetKindOf('keydb')).toBe('redis');
  });
});

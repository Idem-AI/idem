import { DatabaseType } from '../models/ideploy.models';

/**
 * Each engine with its official logo (public/assets/svgs/, the same files the
 * one-click services use), a short description, and what it is for — a
 * database, a cache, or a message broker.
 */
export interface DbEngine {
  type: DatabaseType;
  name: string;
  description: string;
  color: string;
  kind: 'database' | 'cache' | 'queue';
  /** Markup bound via [innerHTML] by the pickers and lists — trusted (built below, never user input). */
  svg: string;
}

/** The engine's logo file, sized to the box it is shown in. */
function logo(file: string): string {
  return `<img src="assets/svgs/${file}" alt="" style="width:78%;height:78%;object-fit:contain" />`;
}

export const DB_ENGINES: DbEngine[] = [
  {
    type: 'postgresql',
    name: 'PostgreSQL',
    description: 'Open-source object-relational database, built for reliability and complex queries.',
    color: '#336791',
    kind: 'database',
    svg: logo('postgresql.svg'),
  },
  {
    type: 'mysql',
    name: 'MySQL',
    description: 'The world’s most widely deployed open-source relational database.',
    color: '#00758f',
    kind: 'database',
    svg: logo('mysql.svg'),
  },
  {
    type: 'mariadb',
    name: 'MariaDB',
    description: 'Community-developed MySQL fork, drop-in compatible with extra storage engines.',
    color: '#c0765a',
    kind: 'database',
    svg: logo('mariadb.svg'),
  },
  {
    type: 'mongodb',
    name: 'MongoDB',
    description: 'Document-oriented NoSQL database, storing data as flexible, JSON-like records.',
    color: '#13aa52',
    kind: 'database',
    svg: logo('mongodb.svg'),
  },
  {
    type: 'clickhouse',
    name: 'ClickHouse',
    description: 'Column-oriented database built for real-time analytical queries at scale.',
    color: '#faff69',
    kind: 'database',
    svg: logo('clickhouse.svg'),
  },
  {
    type: 'redis',
    name: 'Redis',
    description: 'In-memory store: cache, sessions, and job queues (BullMQ, Sidekiq, Celery, Laravel queues run on it).',
    color: '#dc382d',
    kind: 'cache',
    svg: logo('redis.svg'),
  },
  {
    type: 'keydb',
    name: 'KeyDB',
    description: 'Multithreaded, high-performance fork of Redis, drop-in compatible (cache and BullMQ queues).',
    color: '#f5c518',
    kind: 'cache',
    svg: logo('keydb.svg'),
  },
  {
    type: 'dragonfly',
    name: 'Dragonfly',
    description: 'Modern in-memory store, Redis/Memcached-compatible with far higher throughput.',
    color: '#5a3ee0',
    kind: 'cache',
    svg: logo('dragonfly.svg'),
  },
  {
    type: 'rabbitmq',
    name: 'RabbitMQ',
    description: 'Message broker (AMQP): queues between services, background jobs, events. Management UI included.',
    color: '#ff6600',
    kind: 'queue',
    svg: logo('rabbitmq.svg'),
  },
];

export function dbEngine(type: DatabaseType): DbEngine {
  return DB_ENGINES.find((e) => e.type === type) ?? DB_ENGINES[0];
}

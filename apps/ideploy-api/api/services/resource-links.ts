/**
 * Variables of an application linked to the resources of its workspace.
 *
 * An application's .env.example names what it needs: `REDIS_URL`, `CACHE_URL`,
 * `BULL_REDIS_URL`, `RABBITMQ_URL`, `CELERY_BROKER_URL`, `DATABASE_URL`,
 * `REDIS_HOST`… with a development value (`redis://localhost:6379`). When its
 * workspace has the matching resource — a Redis, a RabbitMQ, a database — the
 * variable gets that resource's internal address. A value the user set is
 * never replaced: only an empty one or a development placeholder.
 *
 * Pure: classification and filling; the service reads the resources.
 */

export type LinkedResource = 'database' | 'redis' | 'queue';
export type LinkField = 'url' | 'host' | 'port' | 'username' | 'password' | 'name';

export interface VariableClass {
  resource: LinkedResource;
  field: LinkField;
  /** A generic broker variable (`BROKER_URL`, `CELERY_BROKER_URL`, `QUEUE_URL`): RabbitMQ when there is one, else Redis. */
  anyBroker?: boolean;
}

const URL_SUFFIX = '(?:URL|URI|DSN|CONNECTION_STRING)';

/** Redis and what runs on it: cache, sessions, BullMQ, Sidekiq, Celery's result backend. */
const REDIS_URL = new RegExp(`^(?:[A-Z0-9]+_)*(?:REDIS|CACHE|KV|VALKEY|KEYDB|DRAGONFLY|BULL|BULLMQ|SIDEKIQ|SESSION_STORE)(?:_[A-Z0-9]+)*_${URL_SUFFIX}$|^REDIS_TLS_URL$|^CELERY_RESULT_BACKEND$`, 'i');
/** A message broker that can only be RabbitMQ (AMQP). */
const AMQP_URL = new RegExp(`^(?:[A-Z0-9]+_)*(?:AMQP|AMQPS|RABBITMQ|RABBIT|CLOUDAMQP)(?:_[A-Z0-9]+)*_${URL_SUFFIX}$`, 'i');
/** A broker of either kind. */
const ANY_BROKER_URL = /^(?:CELERY_BROKER_URL|BROKER_URL|MESSAGE_BROKER_URL|QUEUE_URL|JOBS_URL|MQ_URL|EVENT_BUS_URL)$/i;
/** A database (SQL or MongoDB). */
const DATABASE_URL = new RegExp(
  '^(?:DATABASE_URL|DB_URL|DATABASE_URI|DB_URI|DATABASE_CONNECTION_STRING|DB_CONNECTION_STRING|POSTGRES(?:QL)?_URL|MYSQL_URL|MARIADB_URL|' +
    'MONGO(?:DB)?_UR[LI]|SQLALCHEMY_DATABASE_URI|DJANGO_DATABASE_URL)$',
  'i'
);

/** Separate variables, by prefix — never a bare `PASSWORD` or `HOST`. */
const PARTS: { prefix: string; resource: LinkedResource }[] = [
  { prefix: 'REDIS', resource: 'redis' },
  { prefix: '(?:RABBITMQ|RABBIT|AMQP)', resource: 'queue' },
];
const PART_FIELDS: { suffix: string; field: LinkField }[] = [
  { suffix: 'HOST|HOSTNAME', field: 'host' },
  { suffix: 'PORT', field: 'port' },
  { suffix: 'USER|USERNAME|DEFAULT_USER|LOGIN', field: 'username' },
  { suffix: 'PASSWORD|PASS|PWD|DEFAULT_PASS', field: 'password' },
];

export function classifyVariable(key: string): VariableClass | null {
  const k = key.trim();
  if (REDIS_URL.test(k)) return { resource: 'redis', field: 'url' };
  if (AMQP_URL.test(k)) return { resource: 'queue', field: 'url' };
  if (ANY_BROKER_URL.test(k)) return { resource: 'queue', field: 'url', anyBroker: true };
  if (DATABASE_URL.test(k)) return { resource: 'database', field: 'url' };
  for (const { prefix, resource } of PARTS) {
    for (const { suffix, field } of PART_FIELDS) {
      if (new RegExp(`^${prefix}_(?:${suffix})$`, 'i').test(k)) return { resource, field };
    }
  }
  return null;
}

/** Docker Compose service names an example file uses as hosts (`redis://redis:6379`, `DB_HOST=db`). */
const COMPOSE_HOSTS = /^(redis|db|database|postgres(ql)?|pg|mysql|mariadb|mongo(db)?|rabbitmq|rabbit|amqp|cache|broker|queue|keydb|dragonfly|valkey)$/i;
/** Example credentials and ports nobody deploys with. */
const EXAMPLE_VALUES = /^(guest|root|admin|secret|password|pass|user|test|postgres|mysql|redis|rabbitmq|\d{2,5})$/i;

/** An empty value, or one that only works on a developer's machine (an example). */
export function isPlaceholder(value: string | null | undefined): boolean {
  const v = (value ?? '').trim();
  if (!v) return true;
  if (/localhost|127\.0\.0\.1|0\.0\.0\.0|host\.docker\.internal|example\.(com|org)|changeme|your[-_]|<[^>]+>|\bxxx\b/i.test(v)) return true;
  if (COMPOSE_HOSTS.test(v) || EXAMPLE_VALUES.test(v)) return true;
  try {
    return COMPOSE_HOSTS.test(new URL(v).hostname);
  } catch {
    return false;
  }
}

/** A resource to link: its kind, engine and internal connection URL. */
export interface LinkTarget {
  name: string;
  type: string;
  connectionUrl: string;
}

export interface LinkTargets {
  database?: LinkTarget;
  redis?: LinkTarget;
  queue?: LinkTarget;
}

/** The URL's parts, for the separate variables. */
function partsOf(url: string): Partial<Record<LinkField, string>> {
  try {
    const u = new URL(url);
    return {
      url,
      host: u.hostname,
      port: u.port,
      username: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      name: decodeURIComponent(u.pathname.replace(/^\//, '')),
    };
  } catch {
    return { url };
  }
}

/** The engine a URL names (`mysql://…` → mysql), to never link a MySQL app to a PostgreSQL database. */
function engineOfUrl(url: string): string | null {
  const scheme = /^(?:jdbc:)?([a-z0-9+]+):\/\//i.exec(url)?.[1]?.toLowerCase();
  if (!scheme) return null;
  if (scheme === 'postgres' || scheme === 'postgresql') return 'postgresql';
  if (scheme.startsWith('mongodb')) return 'mongodb';
  if (scheme === 'mariadb') return 'mysql';
  return scheme;
}

const sameFamily = (a: string, b: string) => (a === 'mariadb' ? 'mysql' : a) === (b === 'mariadb' ? 'mysql' : b);

export interface LinkedVariable {
  key: string;
  value: string;
  /** The resource the value now comes from. */
  linkedTo?: string;
}

/** Fill the variables the workspace's resources answer. */
export function linkVariables(variables: { key: string; value: string }[], targets: LinkTargets): LinkedVariable[] {
  return variables.map((variable) => {
    const cls = classifyVariable(variable.key);
    if (!cls || !isPlaceholder(variable.value)) return variable;
    let target: LinkTarget | undefined;
    if (cls.resource === 'queue') target = targets.queue ?? (cls.anyBroker ? targets.redis : undefined);
    else target = targets[cls.resource];
    if (!target) return variable;
    // A database variable whose example names another engine is left alone.
    if (cls.resource === 'database') {
      const wanted = variable.value ? engineOfUrl(variable.value) : null;
      if (wanted && !sameFamily(wanted, target.type)) return variable;
    }
    const value = partsOf(target.connectionUrl)[cls.field];
    return value ? { key: variable.key, value, linkedTo: target.name } : variable;
  });
}

/** Which kind of target a database engine is — null for ClickHouse (analytics over HTTP, never an app's DATABASE_URL). */
export function targetKindOf(type: string): keyof LinkTargets | null {
  if (type === 'redis' || type === 'keydb' || type === 'dragonfly') return 'redis';
  if (type === 'rabbitmq') return 'queue';
  if (type === 'clickhouse') return null;
  return 'database';
}

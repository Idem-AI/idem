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

const PART_FIELDS: { suffix: string; field: LinkField }[] = [
  { suffix: 'HOST|HOSTNAME', field: 'host' },
  { suffix: 'PORT', field: 'port' },
  { suffix: 'USER|USERNAME|USER_NAME|DEFAULT_USER|LOGIN', field: 'username' },
  { suffix: 'PASSWORD|PASS|PWD|DEFAULT_PASS', field: 'password' },
];

/**
 * Separate variables, by prefix — never a bare `PASSWORD` or `HOST`. A
 * database's are what Laravel, Symfony, Django and Spring read most
 * (`DB_HOST`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`…).
 */
const PARTS: { prefix: string; resource: LinkedResource; fields: { suffix: string; field: LinkField }[] }[] = [
  { prefix: 'REDIS', resource: 'redis', fields: PART_FIELDS },
  { prefix: '(?:RABBITMQ|RABBIT|AMQP)', resource: 'queue', fields: PART_FIELDS },
  {
    prefix: '(?:DB|DATABASE|POSTGRES(?:QL)?|PG|MYSQL|MARIADB)',
    resource: 'database',
    fields: [...PART_FIELDS, { suffix: 'NAME|DATABASE|DB', field: 'name' }],
  },
];

export function classifyVariable(key: string): VariableClass | null {
  const k = key.trim();
  if (REDIS_URL.test(k)) return { resource: 'redis', field: 'url' };
  if (AMQP_URL.test(k)) return { resource: 'queue', field: 'url' };
  if (ANY_BROKER_URL.test(k)) return { resource: 'queue', field: 'url', anyBroker: true };
  if (DATABASE_URL.test(k)) return { resource: 'database', field: 'url' };
  for (const { prefix, resource, fields } of PARTS) {
    for (const { suffix, field } of fields) {
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
  // Empty, or an example's way of saying so: Laravel's .env.example ships
  // `REDIS_PASSWORD=null`, which reached a Redis that requires a password.
  if (!v || /^(?:null|nil|none|undefined|~|""|'')$/i.test(v)) return true;
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

/** The variable an application names its database driver with (Laravel's DB_CONNECTION…). */
const ENGINE_KEY = /^(?:DB_CONNECTION|DB_ENGINE|DB_DRIVER|DB_TYPE|DATABASE_ENGINE|DATABASE_DRIVER|DATABASE_TYPE)$/i;

/** `pgsql`, `mysql`, `django.db.backends.postgresql`… → the engine family, `sqlite` for a local file. */
export function engineOfDriver(value: string): string | null {
  const v = value.trim().toLowerCase().replace(/^django\.db\.backends\./, '');
  if (/^(?:mysql|mysqli|pdo_mysql|mariadb)$/.test(v)) return 'mysql';
  if (/^(?:pgsql|pdo_pgsql|pg|postgres|postgresql|postgresql_psycopg2)$/.test(v)) return 'postgresql';
  if (/^(?:mongo|mongodb)$/.test(v)) return 'mongodb';
  if (/^(?:sqlite|sqlite3)$/.test(v)) return 'sqlite';
  return null;
}

/** Laravel's DB_CONNECTION for an engine. */
const LARAVEL_CONNECTION: Record<string, string> = { postgresql: 'pgsql', mysql: 'mysql', mariadb: 'mysql', mongodb: 'mongodb' };

/**
 * Fill the variables the workspace's resources answer.
 *
 * The separate variables of one resource go together: when its host is an
 * example (`DB_HOST=127.0.0.1`), the database name, user and password next to
 * it are the developer's too (`DB_DATABASE=laravel`, `DB_USERNAME=root`) and
 * all take the resource's values; when its host is the user's own, none is
 * touched — an external database keeps its own credentials.
 */
export function linkVariables(variables: { key: string; value: string }[], targets: LinkTargets): LinkedVariable[] {
  const classes = variables.map((v) => classifyVariable(v.key));
  // A group whose host is an example, or already the resource's own container,
  // is the resource's: all its parts follow it. Pointing DB_HOST at a
  // PostgreSQL container while DB_PORT/DB_CONNECTION stayed MySQL's hung every
  // query until "MySQL server has gone away".
  const hostState = (resource: LinkedResource, target: LinkTarget | undefined): 'example' | 'own' | 'none' => {
    const i = classes.findIndex((c) => c?.resource === resource && c.field === 'host');
    if (i === -1) return 'none';
    const value = variables[i].value.trim();
    if (isPlaceholder(value)) return 'example';
    return target && value.toLowerCase() === (partsOf(target.connectionUrl).host ?? '').toLowerCase() ? 'example' : 'own';
  };
  const states = {
    database: hostState('database', targets.database),
    redis: hostState('redis', targets.redis),
    queue: hostState('queue', targets.queue),
  };
  const declaredVar = variables.find((v) => ENGINE_KEY.test(v.key.trim()));
  const declared = declaredVar ? engineOfDriver(declaredVar.value) : null;
  const database = targets.database;
  // Laravel names its driver in DB_CONNECTION and ships every one of them:
  // pointed at the workspace's database, the driver follows that database.
  const laravelDriver =
    declaredVar && /^DB_CONNECTION$/i.test(declaredVar.key.trim()) && database ? (LARAVEL_CONNECTION[database.type] ?? null) : null;
  // Elsewhere (Django's ENGINE, Spring's driver) the code may carry one driver
  // only: a MySQL application is never pointed at a PostgreSQL database.
  const databaseRefused = Boolean(database && declared && declared !== 'sqlite' && !sameFamily(declared, database.type) && !laravelDriver);

  return variables.map((variable, i) => {
    const cls = classes[i];
    if (!cls) {
      if (
        variable === declaredVar &&
        laravelDriver &&
        database &&
        states.database === 'example' &&
        (declared === null || !sameFamily(declared === 'sqlite' ? '' : declared, database.type))
      ) {
        return { key: variable.key, value: laravelDriver, linkedTo: database.name };
      }
      return variable;
    }
    const part = cls.field !== 'url';
    const state = states[cls.resource];
    if (part ? state === 'own' || (state === 'none' && !isPlaceholder(variable.value)) : !isPlaceholder(variable.value)) {
      return variable;
    }
    let target: LinkTarget | undefined;
    if (cls.resource === 'queue') target = targets.queue ?? (cls.anyBroker ? targets.redis : undefined);
    else target = targets[cls.resource];
    if (!target) return variable;
    if (cls.resource === 'database') {
      if (databaseRefused) return variable;
      // A database URL whose example names another engine is left alone.
      const wanted = !part && variable.value ? engineOfUrl(variable.value) : null;
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

// ─── The application's own settings ─────────────────────────────────────────

/** Variables that hold the application's own public address. */
const SELF_URL = /^(?:APP_URL|BASE_URL|SITE_URL|PUBLIC_URL|NEXTAUTH_URL|AUTH_URL|NEXT_PUBLIC_SITE_URL|NEXT_PUBLIC_APP_URL|NEXT_PUBLIC_BASE_URL)$/i;
/** Secrets an application generates once and keeps: random when left empty or an example. */
const SECRETS: { key: RegExp; format: 'laravel' | 'hex64' | 'hex32' | 'django' }[] = [
  { key: /^APP_KEY$/i, format: 'laravel' },
  { key: /^SECRET_KEY_BASE$/i, format: 'hex64' },
  { key: /^(?:DJANGO_)?SECRET_KEY$/i, format: 'django' },
  { key: /^(?:JWT_SECRET|JWT_SECRET_KEY|SESSION_SECRET|COOKIE_SECRET|NEXTAUTH_SECRET|AUTH_SECRET|APP_SECRET)$/i, format: 'hex32' },
];

/** A secret in the format its framework expects, from `random(bytes)` (crypto.randomBytes). */
function secretOf(format: (typeof SECRETS)[number]['format'], random: (bytes: number) => Buffer): string {
  if (format === 'laravel') return `base64:${random(32).toString('base64')}`;
  if (format === 'hex64') return random(64).toString('hex');
  if (format === 'django') return random(40).toString('base64').replace(/[+/=]/g, '').slice(0, 50);
  return random(32).toString('hex');
}

/**
 * The settings an example file leaves for a developer's machine, made right
 * for this deployment: its public address instead of localhost, production
 * instead of local, no debug pages (a Laravel APP_DEBUG=true shows stack
 * traces and variables to anyone), and the secrets left empty generated —
 * without APP_KEY, Laravel answers every request with an error 500.
 * A value the user set is kept.
 */
export function applicationDefaults(
  variables: LinkedVariable[],
  opts: { appUrl: string | null; random: (bytes: number) => Buffer }
): LinkedVariable[] {
  const has = (key: string) => variables.some((v) => v.key.toUpperCase() === key);
  const laravel = has('APP_KEY');
  return variables.map((v) => {
    if (v.linkedTo) return v;
    const key = v.key.toUpperCase();
    const value = (v.value ?? '').trim();
    if (opts.appUrl && SELF_URL.test(key) && isPlaceholder(value)) return { ...v, value: opts.appUrl, linkedTo: 'this application' };
    if (key === 'APP_ENV' && /^(local|dev|development)$/i.test(value)) return { ...v, value: 'production', linkedTo: 'production' };
    if (laravel && key === 'APP_DEBUG' && /^(true|1)$/i.test(value)) return { ...v, value: 'false', linkedTo: 'production' };
    const secret = SECRETS.find((s) => s.key.test(key));
    if (secret && (!value || /^(?:secret|changeme|change_me|change-me|your[-_].*|<[^>]+>|x{3,}|django-insecure.*|base64:)$/i.test(value))) {
      return { ...v, value: secretOf(secret.format, opts.random), linkedTo: 'generated' };
    }
    return v;
  });
}

/**
 * Which detected environment variable keys are safe to auto-fill from an
 * architecture guide session — see `architecture-templates.ts`'s module doc
 * for why this is deliberately narrow.
 *
 * Both patterns only match a *combined* URL-shaped variable, never a bare
 * credential (`USERNAME`, `PASSWORD`, `HOST` alone) — a real repository's
 * detected env list already had `PAYMENT_USER_NAME`/`PAYMENT_PASSWORD`
 * sitting right next to genuine database ones, and a looser match keyed on
 * "USER" or "PASSWORD" anywhere in the name would have silently overwritten
 * a payment secret with a database credential instead of leaving it alone.
 * A full connection URL has no such neighbour to collide with.
 */

const DATABASE_URL_KEY = new RegExp(
  '^(' +
    'DATABASE_URL|DB_URL|DATABASE_URI|DB_URI|' +
    'DATABASE_CONNECTION_STRING|DB_CONNECTION_STRING|' +
    'POSTGRES(?:QL)?_URL|MYSQL_URL|MARIADB_URL|MONGO(?:DB)?_URL|MONGO(?:DB)?_URI|' +
    'SPRING_DATASOURCE_URL|SQLALCHEMY_DATABASE_URI|DJANGO_DATABASE_URL' +
    ')$',
  'i'
);

/** Deliberately separate from the SQL matcher above — a 3-tier guide step can create both a primary database and a Redis cache, and `DATABASE_URL`/`REDIS_URL` must never link to each other's resource. */
const REDIS_URL_KEY = /^(REDIS_URL|REDIS_URI|CACHE_URL|CACHE_URI)$/i;

export function isDatabaseUrlKey(key: string): boolean {
  return DATABASE_URL_KEY.test(key.trim());
}

export function isRedisUrlKey(key: string): boolean {
  return REDIS_URL_KEY.test(key.trim());
}

/** Common public-env prefixes a frontend build tool requires to expose a variable to the browser — stripped before matching the variable's own name. */
const PUBLIC_PREFIX = /^(VITE_|NEXT_PUBLIC_|REACT_APP_|PUBLIC_|NG_APP_|VUE_APP_)/i;

const API_URL_KEY = new RegExp('^(API|BACKEND|SERVER)_(URL|BASE_URL|ENDPOINT|HOST)$', 'i');

export function isApiUrlKey(key: string): boolean {
  return API_URL_KEY.test(key.trim().replace(PUBLIC_PREFIX, ''));
}

/**
 * Ecosystems whose datasource URL must be prefixed `jdbc:` — verified live
 * against a real failure: a Spring Boot repo's own env var was plain
 * `DATABASE_URL` (not the Spring-conventional `SPRING_DATASOURCE_URL`), so
 * this can't be decided from the *key name* the way `isDatabaseUrlKey` is —
 * only the detected *ecosystem* says whether the app is Java at all. Without
 * the prefix, `com.mysql.cj.jdbc.Driver` refuses the URL at its own
 * `acceptsURL` check before ever attempting to connect — confirmed against
 * that exact stack trace on the real server this session debugged live.
 */
const JDBC_ECOSYSTEMS = new Set(['java-maven', 'java-gradle']);

/** Applies the `jdbc:` prefix a detected ecosystem's datasource driver needs — a no-op for every ecosystem that isn't Java, and idempotent if the URL already has it. */
export function forEcosystem(connectionUrl: string, ecosystem: string | null | undefined): string {
  if (ecosystem && JDBC_ECOSYSTEMS.has(ecosystem) && !connectionUrl.startsWith('jdbc:')) {
    return `jdbc:${connectionUrl}`;
  }
  return connectionUrl;
}

/** Engine of a connection URL, from its scheme (`postgres://`, `mysql://`, …). */
export function engineOf(connectionUrl: string): string | null {
  const scheme = /^(?:jdbc:)?([a-z0-9+]+):\/\//i.exec(connectionUrl)?.[1]?.toLowerCase();
  if (!scheme) return null;
  if (scheme === 'postgres' || scheme === 'postgresql') return 'postgresql';
  if (scheme.startsWith('mongodb')) return 'mongodb';
  return scheme;
}

/** MySQL and MariaDB speak the same protocol: either driver talks to either server. */
export function engineCompatible(databaseType: string, engines: string[]): boolean {
  if (engines.length === 0) return true;
  const family = (e: string) => (e === 'mariadb' ? 'mysql' : e === 'postgres' ? 'postgresql' : e);
  return engines.some((e) => family(e) === family(databaseType));
}

const JDBC_DRIVERS: Record<string, string> = {
  postgresql: 'org.postgresql.Driver',
  mysql: 'com.mysql.cj.jdbc.Driver',
  mariadb: 'org.mariadb.jdbc.Driver',
};

/**
 * Database-specific companion variables — prefixed by a database word only, so
 * `PAYMENT_USER_NAME` or `SMTP_PASSWORD` are never touched.
 */
const DB_PREFIX = '(?:DATABASE|DB|SPRING_DATASOURCE|POSTGRES(?:QL)?|PG|MYSQL|MARIADB)';
const COMPANIONS: { key: RegExp; field: 'username' | 'password' | 'driver' | 'host' | 'port' | 'name' }[] = [
  { key: new RegExp(`^${DB_PREFIX}_(?:USER|USERNAME|USER_NAME)$`, 'i'), field: 'username' },
  { key: new RegExp(`^${DB_PREFIX}_(?:PASSWORD|PASS|PWD)$`, 'i'), field: 'password' },
  { key: new RegExp(`^${DB_PREFIX}_(?:DRIVER|DRIVER_CLASS|DRIVER_CLASS_NAME)$`, 'i'), field: 'driver' },
  { key: new RegExp(`^${DB_PREFIX}_HOST$`, 'i'), field: 'host' },
  { key: new RegExp(`^${DB_PREFIX}_PORT$`, 'i'), field: 'port' },
  { key: new RegExp(`^${DB_PREFIX}_(?:NAME|DATABASE|DB)$`, 'i'), field: 'name' },
];

export interface DatasourceValues {
  url: string;
  /** Companion variable values, by field. */
  fields: Partial<Record<'username' | 'password' | 'driver' | 'host' | 'port' | 'name', string>>;
}

/**
 * What a database connection URL becomes for a given application: the URL
 * itself, and the separate variables most projects also read.
 *
 * Java's JDBC needs `jdbc:postgresql://host:port/db` with the credentials in
 * their own variables: the guide used to set `jdbc:postgres://user:pass@…`,
 * which no JDBC driver accepts, and left the repository's own
 * `DATABASE_USERNAME=root` and MySQL driver class in place.
 */
export function datasourceValues(connectionUrl: string, ecosystem: string | null | undefined): DatasourceValues {
  let parsed: URL;
  try {
    parsed = new URL(connectionUrl);
  } catch {
    return { url: forEcosystem(connectionUrl, ecosystem), fields: {} };
  }
  const engine = engineOf(connectionUrl) ?? '';
  const name = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  const fields: DatasourceValues['fields'] = {
    username: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    host: parsed.hostname,
    port: parsed.port,
    name,
  };
  if (ecosystem && JDBC_ECOSYSTEMS.has(ecosystem)) {
    if (JDBC_DRIVERS[engine]) fields.driver = JDBC_DRIVERS[engine];
    const port = parsed.port ? `:${parsed.port}` : '';
    return { url: `jdbc:${engine}://${parsed.hostname}${port}/${name}`, fields };
  }
  return { url: connectionUrl, fields };
}

/** Which companion field a variable stands for, or null. */
export function datasourceFieldOf(key: string): keyof DatasourceValues['fields'] | null {
  return COMPANIONS.find((c) => c.key.test(key.trim()))?.field ?? null;
}

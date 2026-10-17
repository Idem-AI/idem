import { shellQuote } from '../ssh/ssh';
/**
 * Registry of the 8 standalone database types Coolify supports. Each entry
 * maps the logical type to its table, default image, internal port, and the
 * credential columns + their container env mapping.
 *
 * Encryption rule (consistent with every confirmed Coolify model cast):
 *   text-typed password columns are Laravel-`encrypted`; string-typed
 *   user/db-name columns are plaintext. `encrypted: true` fields are stored via
 *   laravel-crypto and decrypted before being injected into the container.
 */
export interface DbField {
  /** DB column name (also the key credentials are looked up by, even for a `viaEnvVar` field). */
  col: string;
  /** Container env var name (omit for columns not passed as env, e.g. redis pass via command). */
  env?: string;
  /** Default value when not provided. */
  default?: string;
  /** Stored Laravel-encrypted at rest. */
  encrypted?: boolean;
  /** Auto-generate a random secret when not provided. */
  generate?: boolean;
  /**
   * This field has no column on the engine's own table — its real storage is
   * a row in the polymorphic `environment_variables` table, under this key.
   * Confirmed against the live schema: Coolify's own `move_redis_password_to_envs`
   * migration dropped `standalone_redis.redis_password` and moved it there;
   * `standalone_redis` genuinely has no password column to write to. Adding
   * the column back would just diverge from the schema a real migration
   * already changed on purpose.
   */
  viaEnvVar?: string;
}

export interface DbType {
  key: string;
  table: string;
  /** Eloquent model class (used for polymorphic `database` morphs in backups). */
  model: string;
  image: string;
  port: number;
  fields: DbField[];
  /** Optional container command (e.g. redis --requirepass). Receives decrypted creds. */
  command?: (creds: Record<string, string>) => string | undefined;
  /** Build the in-container dump command (for `backup now`). */
  dumpCommand?: (creds: Record<string, string>, outFile: string) => string;
  /**
   * Where the engine keeps its data inside the container — mounted on a named
   * volume, so stopping, restarting or changing the credentials of a database
   * never starts it again on an empty one.
   */
  dataDir: string;
  /**
   * The engine's own client, signed in — the database console. A fixed script
   * run inside the container: it reads the credentials from the container
   * itself (its environment, or Redis's own arguments), so no secret is ever
   * part of the command iDeploy sends.
   */
  client?: { binary: string; script: string };
  /**
   * Run under a fixed hostname (the container's name). RabbitMQ keeps its
   * data under its node name, which comes from the hostname: a new random one
   * on each recreation would leave its queues behind.
   */
  fixedHostname?: boolean;
}

/** Redis-family password, read from the server's own arguments (`--requirepass x`, or `--requirepass=x`). */
const REQUIREPASS_FROM_ARGS =
  'export REDISCLI_AUTH="$(tr "\\000" "\\n" < /proc/1/cmdline | sed -n -e "/^--requirepass$/{n;p;}" -e "s/^--requirepass=//p")"';

export const DB_TYPES: Record<string, DbType> = {
  postgresql: {
    key: 'postgresql',
    table: 'standalone_postgresqls',
    model: 'App\\Models\\StandalonePostgresql',
    image: 'postgres:16-alpine',
    port: 5432,
    fields: [
      { col: 'postgres_user', env: 'POSTGRES_USER', default: 'postgres' },
      { col: 'postgres_password', env: 'POSTGRES_PASSWORD', encrypted: true, generate: true },
      { col: 'postgres_db', env: 'POSTGRES_DB', default: 'postgres' },
    ],
    dataDir: '/var/lib/postgresql/data',
    // Local connections inside the container are trusted by the image.
    client: { binary: 'psql', script: 'exec psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' },
    dumpCommand: (c, out) =>
      `PGPASSWORD=${shellQuote(c.postgres_password ?? '')} pg_dump -U ${shellQuote(c.postgres_user ?? '')} ${shellQuote(c.postgres_db ?? '')} > ${out}`,
  },
  mysql: {
    key: 'mysql',
    table: 'standalone_mysqls',
    model: 'App\\Models\\StandaloneMysql',
    image: 'mysql:8',
    port: 3306,
    fields: [
      { col: 'mysql_root_password', env: 'MYSQL_ROOT_PASSWORD', encrypted: true, generate: true },
      { col: 'mysql_user', env: 'MYSQL_USER', default: 'mysql' },
      { col: 'mysql_password', env: 'MYSQL_PASSWORD', encrypted: true, generate: true },
      { col: 'mysql_database', env: 'MYSQL_DATABASE', default: 'default' },
    ],
    dataDir: '/var/lib/mysql',
    client: { binary: 'mysql', script: 'export MYSQL_PWD="$MYSQL_ROOT_PASSWORD"; exec mysql -uroot "$MYSQL_DATABASE"' },
    dumpCommand: (c, out) =>
      `mysqldump -u root -p${shellQuote(c.mysql_root_password ?? '')} --all-databases > ${out}`,
  },
  mariadb: {
    key: 'mariadb',
    table: 'standalone_mariadbs',
    model: 'App\\Models\\StandaloneMariadb',
    image: 'mariadb:11',
    port: 3306,
    fields: [
      { col: 'mariadb_root_password', env: 'MARIADB_ROOT_PASSWORD', encrypted: true, generate: true },
      { col: 'mariadb_user', env: 'MARIADB_USER', default: 'mariadb' },
      { col: 'mariadb_password', env: 'MARIADB_PASSWORD', encrypted: true, generate: true },
      { col: 'mariadb_database', env: 'MARIADB_DATABASE', default: 'default' },
    ],
    dataDir: '/var/lib/mysql',
    client: { binary: 'mariadb', script: 'export MYSQL_PWD="$MARIADB_ROOT_PASSWORD"; exec mariadb -uroot "$MARIADB_DATABASE"' },
    dumpCommand: (c, out) =>
      `mariadb-dump -u root -p${shellQuote(c.mariadb_root_password ?? '')} --all-databases > ${out}`,
  },
  mongodb: {
    key: 'mongodb',
    table: 'standalone_mongodbs',
    model: 'App\\Models\\StandaloneMongodb',
    image: 'mongo:7',
    port: 27017,
    fields: [
      { col: 'mongo_initdb_root_username', env: 'MONGO_INITDB_ROOT_USERNAME', encrypted: true, default: 'root' },
      { col: 'mongo_initdb_root_password', env: 'MONGO_INITDB_ROOT_PASSWORD', encrypted: true, generate: true },
      { col: 'mongo_initdb_database', env: 'MONGO_INITDB_DATABASE', encrypted: true, default: 'default' },
    ],
    dataDir: '/data/db',
    client: {
      binary: 'mongosh',
      script: 'exec mongosh --quiet -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin "$MONGO_INITDB_DATABASE"',
    },
    dumpCommand: (c, out) =>
      `mongodump --username=${shellQuote(c.mongo_initdb_root_username ?? '')} --password=${shellQuote(c.mongo_initdb_root_password ?? '')} --authenticationDatabase=admin --archive=${out}`,
  },
  redis: {
    key: 'redis',
    table: 'standalone_redis',
    model: 'App\\Models\\StandaloneRedis',
    image: 'redis:7-alpine',
    port: 6379,
    // No `standalone_redis.redis_password` column exists (see `viaEnvVar`'s
    // own doc comment) — confirmed live: creating a Redis database threw
    // `column "redis_password" of relation "standalone_redis" does not
    // exist` before this fix.
    fields: [{ col: 'redis_password', encrypted: true, generate: true, viaEnvVar: 'REDIS_PASSWORD' }],
    // Persistence stays the image's default (RDB snapshots in /data): turning
    // on --appendonly over an existing dump.rdb can start Redis empty.
    command: (c) => `redis-server --requirepass ${shellQuote(c.redis_password ?? '')}`,
    dataDir: '/data',
    client: { binary: 'redis-cli', script: `${REQUIREPASS_FROM_ARGS}; exec redis-cli` },
  },
  keydb: {
    key: 'keydb',
    table: 'standalone_keydbs',
    model: 'App\\Models\\StandaloneKeydb',
    image: 'eqalpha/keydb:latest',
    port: 6379,
    fields: [{ col: 'keydb_password', encrypted: true, generate: true }],
    command: (c) => `keydb-server --requirepass ${shellQuote(c.keydb_password ?? '')}`,
    dataDir: '/data',
    client: { binary: 'keydb-cli', script: `${REQUIREPASS_FROM_ARGS}; exec keydb-cli` },
  },
  dragonfly: {
    key: 'dragonfly',
    table: 'standalone_dragonflies',
    model: 'App\\Models\\StandaloneDragonfly',
    image: 'docker.dragonflydb.io/dragonflydb/dragonfly',
    port: 6379,
    fields: [{ col: 'dragonfly_password', encrypted: true, generate: true }],
    command: (c) => `dragonfly ${shellQuote(`--requirepass=${c.dragonfly_password ?? ''}`)} --dir=/data`,
    dataDir: '/data',
    client: { binary: 'redis-cli', script: `${REQUIREPASS_FROM_ARGS}; exec redis-cli` },
  },
  clickhouse: {
    key: 'clickhouse',
    table: 'standalone_clickhouses',
    model: 'App\\Models\\StandaloneClickhouse',
    image: 'clickhouse/clickhouse-server',
    port: 8123,
    fields: [
      { col: 'clickhouse_admin_user', env: 'CLICKHOUSE_USER', default: 'default' },
      { col: 'clickhouse_admin_password', env: 'CLICKHOUSE_PASSWORD', encrypted: true, generate: true },
    ],
    dataDir: '/var/lib/clickhouse',
    client: { binary: 'clickhouse-client', script: 'exec clickhouse-client --user "$CLICKHOUSE_USER" --password "$CLICKHOUSE_PASSWORD"' },
  },
  rabbitmq: {
    key: 'rabbitmq',
    table: 'standalone_rabbitmqs',
    model: 'App\\Models\\StandaloneRabbitmq',
    // The management plugin: its web interface (15672) on the internal network.
    image: 'rabbitmq:4-management',
    port: 5672,
    fields: [
      { col: 'rabbitmq_user', env: 'RABBITMQ_DEFAULT_USER', default: 'rabbitmq' },
      { col: 'rabbitmq_password', env: 'RABBITMQ_DEFAULT_PASS', encrypted: true, generate: true },
    ],
    dataDir: '/var/lib/rabbitmq',
    fixedHostname: true,
    // No interactive client: the queues (messages, consumers) first, then a shell with rabbitmqctl.
    client: { binary: 'rabbitmqctl', script: 'rabbitmqctl list_queues name messages consumers; exec sh' },
  },
};

/** Engines that are message brokers, not databases: shown as such, linked to queue variables. */
export const QUEUE_ENGINES = new Set(['rabbitmq']);

export function getDbType(key: string): DbType | null {
  return DB_TYPES[key] ?? null;
}

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
  /** DB column name. */
  col: string;
  /** Container env var name (omit for columns not passed as env, e.g. redis pass via command). */
  env?: string;
  /** Default value when not provided. */
  default?: string;
  /** Stored Laravel-encrypted at rest. */
  encrypted?: boolean;
  /** Auto-generate a random secret when not provided. */
  generate?: boolean;
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
}

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
    dumpCommand: (c, out) =>
      `PGPASSWORD=${JSON.stringify(c.postgres_password)} pg_dump -U ${c.postgres_user} ${c.postgres_db} > ${out}`,
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
    dumpCommand: (c, out) =>
      `mysqldump -u root -p${JSON.stringify(c.mysql_root_password)} --all-databases > ${out}`,
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
    dumpCommand: (c, out) =>
      `mariadb-dump -u root -p${JSON.stringify(c.mariadb_root_password)} --all-databases > ${out}`,
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
    dumpCommand: (c, out) =>
      `mongodump --username=${JSON.stringify(c.mongo_initdb_root_username)} --password=${JSON.stringify(c.mongo_initdb_root_password)} --authenticationDatabase=admin --archive=${out}`,
  },
  redis: {
    key: 'redis',
    table: 'standalone_redis',
    model: 'App\\Models\\StandaloneRedis',
    image: 'redis:7-alpine',
    port: 6379,
    fields: [{ col: 'redis_password', encrypted: true, generate: true }],
    command: (c) => `redis-server --requirepass ${c.redis_password}`,
  },
  keydb: {
    key: 'keydb',
    table: 'standalone_keydbs',
    model: 'App\\Models\\StandaloneKeydb',
    image: 'eqalpha/keydb:latest',
    port: 6379,
    fields: [{ col: 'keydb_password', encrypted: true, generate: true }],
    command: (c) => `keydb-server --requirepass ${c.keydb_password}`,
  },
  dragonfly: {
    key: 'dragonfly',
    table: 'standalone_dragonflies',
    model: 'App\\Models\\StandaloneDragonfly',
    image: 'docker.dragonflydb.io/dragonflydb/dragonfly',
    port: 6379,
    fields: [{ col: 'dragonfly_password', encrypted: true, generate: true }],
    command: (c) => `dragonfly --requirepass=${c.dragonfly_password}`,
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
  },
};

export function getDbType(key: string): DbType | null {
  return DB_TYPES[key] ?? null;
}

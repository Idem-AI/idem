/**
 * Turns a raw credential column name (`postgres_user`, `mongo_initdb_root_password`…)
 * into a human label and tells whether it should render masked. Column names
 * come straight from `database-types.ts`'s own field registry, so a generic
 * derivation here avoids hand-maintaining a duplicate label table per engine
 * that would drift the moment a field is added there.
 */
const ENGINE_PREFIXES = [
  'postgres_',
  'mysql_',
  'mariadb_',
  'mongo_initdb_',
  'redis_',
  'keydb_',
  'dragonfly_',
  'clickhouse_admin_',
];

export function credentialLabel(col: string): string {
  let rest = col;
  for (const prefix of ENGINE_PREFIXES) {
    if (rest.startsWith(prefix)) {
      rest = rest.slice(prefix.length);
      break;
    }
  }
  if (!rest) rest = 'password';
  const words = rest.split('_').map((w) => (w === 'db' ? 'Database' : w.charAt(0).toUpperCase() + w.slice(1)));
  return words.join(' ');
}

export function isSecretField(col: string): boolean {
  return /password/i.test(col);
}

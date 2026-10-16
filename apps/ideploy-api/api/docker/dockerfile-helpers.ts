/**
 * Small pieces every generated Dockerfile uses.
 */

/** Build-time Variables become ARGs: the build steps see them as environment. Names that are not identifiers are dropped. */
export function argLines(buildArgKeys: string[]): string[] {
  return [...new Set(buildArgKeys)].filter((k) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(k)).map((k) => `ARG ${k}`);
}

/** A JSON string for an exec-form instruction. */
export const json = (value: string): string => JSON.stringify(value);

/** A value single-quoted for sh. */
export const sq = (value: string): string => `'${value.replace(/'/g, `'\\''`)}'`;

/**
 * Libraries a build compiled against, installed in the slim run image:
 * libpq (psycopg2, pg gems), MariaDB (mysqlclient, mysql2), SQLite, YAML.
 * Not fatal: a mirror outage must not fail the build of an app that needs none.
 */
export function runtimeLibraries(packages: string[]): string {
  return (
    `RUN (apt-get update && apt-get install -y --no-install-recommends ${packages.join(' ')} && rm -rf /var/lib/apt/lists/*) ` +
    `|| echo "Some runtime libraries could not be installed (${packages.join(', ')})."`
  );
}

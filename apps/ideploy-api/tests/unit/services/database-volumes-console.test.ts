/**
 * Databases keep their data across stop/start, and open a console signed in
 * without any secret in the command iDeploy sends.
 */
import { describe, it, expect } from 'vitest';
import { DB_TYPES } from '../../../api/services/database-types';
import { dataVolumeFor, dataVolumeScript } from '../../../api/services/database.service';

describe('database data volumes', () => {
  it('gives every engine a data directory', () => {
    for (const t of Object.values(DB_TYPES)) expect(t.dataDir, t.key).toMatch(/^\/[\w/.-]+$/);
  });

  it('names one volume per database, and moves the data of a container that has none', () => {
    const script = dataVolumeScript('mysql-abc', '/var/lib/mysql', 'mysql:8');
    expect(dataVolumeFor('mysql-abc')).toBe('mysql-abc-data');
    expect(script).toContain("VOL='mysql-abc-data'");
    expect(script).toContain('if ! docker volume inspect "$VOL"');
    // The anonymous volume the running container writes to is found by its mount point…
    expect(script).toContain('{{if eq .Destination "/var/lib/mysql"}}{{.Name}}{{end}}');
    // …copied with the engine's own image (no other pull), the old volume left in place.
    expect(script).toContain(`docker run --rm --entrypoint sh -v "$OLD":/from:ro -v "$VOL":/to 'mysql:8' -c 'cp -a /from/. /to/'`);
    expect(script).not.toContain('docker volume rm "$OLD"');
    // A failed copy restarts the database as it was.
    expect(script).toContain('docker start mysql-abc');
  });
});

describe('database console', () => {
  it('signs in with what the container already holds: no secret in the script', () => {
    for (const t of Object.values(DB_TYPES)) {
      if (!t.client) continue;
      expect(t.client.binary, t.key).toMatch(/^[a-z-]+$/);
      // Credentials come from the container's environment or the server's own arguments.
      expect(t.client.script, t.key).not.toMatch(/password=\w|-p\w/i);
    }
    expect(DB_TYPES.mysql.client?.script).toContain('MYSQL_PWD="$MYSQL_ROOT_PASSWORD"');
    expect(DB_TYPES.redis.client?.script).toContain('/proc/1/cmdline');
  });
});

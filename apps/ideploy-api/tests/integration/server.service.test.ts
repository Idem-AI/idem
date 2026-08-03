/**
 * Integration coverage for server creation.
 *
 * The bug this suite exists to prevent: creating a server used to insert only the
 * `servers` row, leaving no `server_settings` (a row the schema expects 1:1) and
 * no Docker destination. The server appeared in the list, and then every
 * deployment onto it failed with `NO_DESTINATION`. Nothing surfaced the missing
 * pieces, which is what made it expensive to diagnose.
 *
 * These tests assert the companion rows exist, that the whole thing is atomic,
 * and that team scoping holds.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import * as servers from '../../api/services/server.service';
import { isDomainError } from '../../api/utils/errors';
import { isTestDatabaseAvailable, testPool, truncateAll } from '../helpers/db';
import { makeApplication, makePrivateKey, makeProject, makeTeam } from '../helpers/factories';
import { closeInfrastructure } from '../helpers/teardown';

beforeAll(async () => {
  if (!(await isTestDatabaseAvailable())) {
    throw new Error(
      'Integration tests need the test database. Run scripts/prepare-test-db.sh from the repo root.'
    );
  }
});

beforeEach(async () => {
  await truncateAll();
});

afterAll(async () => {
  await closeInfrastructure();
});

async function countRows(table: string, serverId: number): Promise<number> {
  const { rows } = await testPool().query<{ count: string }>(
    `SELECT count(*)::text AS count FROM ${table} WHERE server_id = $1`,
    [serverId]
  );
  return Number(rows[0].count);
}

/** A team with a usable private key — the precondition for adding a server. */
async function teamWithKey() {
  const team = await makeTeam();
  const key = await makePrivateKey(team.id);
  return { team, key };
}

/**
 * Put an application on a destination, so occupancy checks have something to
 * find. Inserted directly: this suite is about the server lifecycle, not about
 * how applications get created.
 */
async function addApplicationOn(destinationId: number, teamId: number): Promise<void> {
  const project = await makeProject(teamId);
  await makeApplication(project.environmentId, destinationId);
}

describe('createServer', () => {
  it('creates the server row with the supplied connection details', async () => {
    const { team, key } = await teamWithKey();

    const { server } = await servers.createServer(team.id, {
      name: 'web-1',
      ip: '203.0.113.20',
      port: 2222,
      user: 'deploy',
      private_key_id: key.id,
    });

    expect(server).toMatchObject({
      name: 'web-1',
      ip: '203.0.113.20',
      port: 2222,
      user: 'deploy',
      team_id: team.id,
      private_key_id: key.id,
    });
    expect(server.uuid).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('creates the server_settings row the schema expects', async () => {
    const { team, key } = await teamWithKey();

    const { server } = await servers.createServer(team.id, {
      name: 'web-1',
      ip: '203.0.113.20',
      private_key_id: key.id,
    });

    expect(await countRows('server_settings', server.id)).toBe(1);
  });

  it('creates a Docker destination so the server is immediately deployable', async () => {
    const { team, key } = await teamWithKey();

    const { server, destinationId } = await servers.createServer(team.id, {
      name: 'web-1',
      ip: '203.0.113.20',
      private_key_id: key.id,
    });

    expect(destinationId).toBeGreaterThan(0);

    const { rows } = await testPool().query<{ network: string; server_id: string }>(
      'SELECT network, server_id FROM standalone_dockers WHERE id = $1',
      [destinationId]
    );
    expect(rows[0].network).toBe(servers.DEFAULT_NETWORK);
    expect(Number(rows[0].server_id)).toBe(server.id);
  });

  it('defaults the port and user when not supplied', async () => {
    const { team, key } = await teamWithKey();

    const { server } = await servers.createServer(team.id, {
      name: 'web-1',
      ip: '203.0.113.20',
      private_key_id: key.id,
    });

    expect(server.port).toBe(22);
    expect(server.user).toBe('root');
  });

  it('refuses a private key belonging to another team', async () => {
    const { team } = await teamWithKey();
    const other = await teamWithKey();

    const attempt = servers.createServer(team.id, {
      name: 'web-1',
      ip: '203.0.113.20',
      private_key_id: other.key.id,
    });

    await expect(attempt).rejects.toThrow();
    await attempt.catch((err) => {
      expect(isDomainError(err) && err.code).toBe('NOT_FOUND');
    });
  });

  it('leaves nothing behind when the key does not exist', async () => {
    // Atomicity guard: a rejected creation must not leave a stray server row.
    const team = await makeTeam();

    await servers
      .createServer(team.id, { name: 'web-1', ip: '203.0.113.20', private_key_id: 999_999 })
      .catch(() => undefined);

    const { rows } = await testPool().query<{ count: string }>(
      'SELECT count(*)::text AS count FROM servers WHERE team_id = $1',
      [team.id]
    );
    expect(Number(rows[0].count)).toBe(0);
  });

  it('creates independent destinations for two servers', async () => {
    const { team, key } = await teamWithKey();

    const first = await servers.createServer(team.id, {
      name: 'web-1',
      ip: '203.0.113.20',
      private_key_id: key.id,
    });
    const second = await servers.createServer(team.id, {
      name: 'web-2',
      ip: '203.0.113.21',
      private_key_id: key.id,
    });

    expect(first.destinationId).not.toBe(second.destinationId);
  });
});

describe('team isolation', () => {
  it('lists only the calling team’s servers', async () => {
    const mine = await teamWithKey();
    const theirs = await teamWithKey();

    await servers.createServer(mine.team.id, {
      name: 'mine',
      ip: '203.0.113.20',
      private_key_id: mine.key.id,
    });
    await servers.createServer(theirs.team.id, {
      name: 'theirs',
      ip: '203.0.113.21',
      private_key_id: theirs.key.id,
    });

    const listed = await servers.listServers(mine.team.id);
    expect(listed.map((s) => s.name)).toEqual(['mine']);
  });

  it('refuses to read another team’s server', async () => {
    const mine = await teamWithKey();
    const theirs = await teamWithKey();
    const { server } = await servers.createServer(theirs.team.id, {
      name: 'theirs',
      ip: '203.0.113.21',
      private_key_id: theirs.key.id,
    });

    expect(await servers.getServer(mine.team.id, server.uuid)).toBeNull();
    expect(await servers.getServerById(mine.team.id, server.id)).toBeNull();
  });

  it('refuses to delete another team’s server, and leaves it intact', async () => {
    const mine = await teamWithKey();
    const theirs = await teamWithKey();
    const { server } = await servers.createServer(theirs.team.id, {
      name: 'theirs',
      ip: '203.0.113.21',
      private_key_id: theirs.key.id,
    });

    expect(await servers.deleteServer(mine.team.id, server.uuid)).toBe(false);
    expect(await servers.getServer(theirs.team.id, server.uuid)).not.toBeNull();
  });
});

describe('deleteServer', () => {
  it('removes the server and leaves no orphaned infrastructure rows', async () => {
    // Neither server_settings nor standalone_dockers has a cascading foreign
    // key — the database will not clean them up, so the service must.
    const { team, key } = await teamWithKey();
    const { server } = await servers.createServer(team.id, {
      name: 'web-1',
      ip: '203.0.113.20',
      private_key_id: key.id,
    });

    expect(await servers.deleteServer(team.id, server.uuid)).toBe(true);

    expect(await countRows('server_settings', server.id)).toBe(0);
    expect(await countRows('standalone_dockers', server.id)).toBe(0);
    expect(await servers.getServer(team.id, server.uuid)).toBeNull();
  });

  it('reports false for a server that does not exist', async () => {
    const team = await makeTeam();
    expect(await servers.deleteServer(team.id, 'ffffffff-0000-0000-0000-000000000000')).toBe(false);
  });

  it('refuses to delete a server that still hosts an application', async () => {
    // Cascading here would silently destroy a customer's application.
    const { team, key } = await teamWithKey();
    const { server, destinationId } = await servers.createServer(team.id, {
      name: 'web-1',
      ip: '203.0.113.20',
      private_key_id: key.id,
    });
    await addApplicationOn(destinationId, team.id);

    const attempt = servers.deleteServer(team.id, server.uuid);

    await expect(attempt).rejects.toThrow();
    await attempt.catch((err) => {
      expect(isDomainError(err) && err.code).toBe('SERVER_HAS_RESOURCES');
      // The message must say what to remove, not just that it failed.
      expect((err as Error).message).toMatch(/1 application/);
    });

    expect(await servers.getServer(team.id, server.uuid)).not.toBeNull();
  });
});

describe('getServerOccupancy', () => {
  it('reports an empty server as unoccupied', async () => {
    const { team, key } = await teamWithKey();
    const { server } = await servers.createServer(team.id, {
      name: 'web-1',
      ip: '203.0.113.20',
      private_key_id: key.id,
    });

    expect(await servers.getServerOccupancy(server.id)).toEqual({
      applications: 0,
      databases: 0,
      services: 0,
      total: 0,
    });
  });

  it('counts applications deployed on the server', async () => {
    const { team, key } = await teamWithKey();
    const { server, destinationId } = await servers.createServer(team.id, {
      name: 'web-1',
      ip: '203.0.113.20',
      private_key_id: key.id,
    });
    await addApplicationOn(destinationId, team.id);
    await addApplicationOn(destinationId, team.id);

    const occupancy = await servers.getServerOccupancy(server.id);

    expect(occupancy.applications).toBe(2);
    expect(occupancy.total).toBe(2);
  });

  it('does not count resources deployed on a different server', async () => {
    const { team, key } = await teamWithKey();
    const first = await servers.createServer(team.id, {
      name: 'web-1',
      ip: '203.0.113.20',
      private_key_id: key.id,
    });
    const second = await servers.createServer(team.id, {
      name: 'web-2',
      ip: '203.0.113.21',
      private_key_id: key.id,
    });
    await addApplicationOn(first.destinationId, team.id);

    expect((await servers.getServerOccupancy(second.server.id)).total).toBe(0);
  });
});

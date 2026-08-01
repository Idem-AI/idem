/**
 * Domain collision detection.
 *
 * Two resources claiming the same host is not a cosmetic validation issue: the
 * proxy picks a winner arbitrarily, so one application starts serving another's
 * traffic. That reads as a routing glitch and is in fact a data exposure, which
 * is why this is checked before a domain is accepted rather than after.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import * as domains from '../../api/services/domain.service';
import { isDomainError } from '../../api/utils/errors';
import { isTestDatabaseAvailable, testPool, truncateAll } from '../helpers/db';
import { makeApplication, makeManagedServer, makeProject, makeTeam } from '../helpers/factories';
import { closeInfrastructure } from '../helpers/teardown';

beforeAll(async () => {
  if (!(await isTestDatabaseAvailable())) {
    throw new Error('Integration tests need the test database (scripts/prepare-test-db.sh).');
  }
});

beforeEach(async () => {
  await truncateAll();
});

afterAll(async () => {
  await closeInfrastructure();
});

/** An application already claiming `fqdn`. */
async function existingAppWith(fqdn: string, name = 'incumbent'): Promise<number> {
  const team = await makeTeam();
  const server = await makeManagedServer();
  const project = await makeProject(team.id);
  const app = await makeApplication(project.environmentId, server.destinationId, { name });
  await testPool().query('UPDATE applications SET fqdn = $2 WHERE id = $1', [app.id, fqdn]);
  return app.id;
}

describe('toClaim', () => {
  it('normalises to the host and path the proxy routes on', () => {
    expect(domains.toClaim('https://Shop.Example.com/api')).toMatchObject({
      host: 'shop.example.com',
      path: '/api',
      key: 'shop.example.com/api',
    });
  });

  it('treats http and https as the same claim', () => {
    // The proxy cannot serve two different apps on the same host by scheme.
    expect(domains.toClaim('http://shop.example.com')?.key).toBe(
      domains.toClaim('https://shop.example.com')?.key
    );
  });

  it('ignores a trailing slash', () => {
    expect(domains.toClaim('https://shop.example.com/api/')?.key).toBe(
      domains.toClaim('https://shop.example.com/api')?.key
    );
  });

  it('distinguishes different paths on one host', () => {
    // Two applications may legitimately share a host on different sub-paths.
    expect(domains.toClaim('https://x.com/a')?.key).not.toBe(domains.toClaim('https://x.com/b')?.key);
  });

  it('returns null for unusable input', () => {
    expect(domains.toClaim('')).toBeNull();
  });
});

describe('findConflicts', () => {
  it('reports nothing when the domain is free', async () => {
    await existingAppWith('https://taken.example.com');

    expect(await domains.findConflicts(['https://free.example.com'])).toEqual([]);
  });

  it('reports a clash, naming the current owner', async () => {
    await existingAppWith('https://shop.example.com', 'the-incumbent');

    const conflicts = await domains.findConflicts(['https://shop.example.com']);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].usedBy).toBe('the-incumbent');
  });

  it('detects a clash across schemes', async () => {
    await existingAppWith('http://shop.example.com');

    expect(await domains.findConflicts(['https://shop.example.com'])).toHaveLength(1);
  });

  it('detects a clash within a comma-separated list', async () => {
    await existingAppWith('https://a.example.com,https://b.example.com');

    expect(await domains.findConflicts(['https://b.example.com'])).toHaveLength(1);
  });

  it('allows the same host on a different path', async () => {
    await existingAppWith('https://shop.example.com/admin');

    expect(await domains.findConflicts(['https://shop.example.com/shop'])).toEqual([]);
  });

  it('does not report an application against itself', async () => {
    // Re-saving a resource without changing its domain must not fail.
    const id = await existingAppWith('https://shop.example.com');

    expect(await domains.findConflicts(['https://shop.example.com'], id)).toEqual([]);
  });

  it('reports clashes for several domains at once', async () => {
    await existingAppWith('https://a.example.com', 'first');
    await existingAppWith('https://b.example.com', 'second');

    const conflicts = await domains.findConflicts([
      'https://a.example.com',
      'https://b.example.com',
      'https://c.example.com',
    ]);

    expect(conflicts.map((c) => c.usedBy).sort()).toEqual(['first', 'second']);
  });
});

describe('assertDomainsAvailable', () => {
  it('passes silently when everything is free', async () => {
    await expect(domains.assertDomainsAvailable(['https://free.example.com'])).resolves.toBeUndefined();
  });

  it('raises a typed error explaining the consequence', async () => {
    await existingAppWith('https://shop.example.com', 'the-incumbent');

    const attempt = domains.assertDomainsAvailable(['https://shop.example.com']);

    await expect(attempt).rejects.toThrow();
    await attempt.catch((err) => {
      expect(isDomainError(err) && err.code).toBe('DOMAIN_ALREADY_USED');
      expect((err as Error).message).toContain('the-incumbent');
      // The message says *why* it matters, not just that it is taken.
      expect((err as Error).message).toMatch(/whichever answers first/);
    });
  });
});

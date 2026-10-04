/**
 * Names that DNS accepts, and a server wildcard that actually reaches its server.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { resolve4 } = vi.hoisted(() => ({ resolve4: vi.fn() }));
vi.mock('dns/promises', () => ({ default: { resolve4 }, resolve4 }));

import {
  MAX_DNS_LABEL,
  assertWildcardReaches,
  checkDomains,
  isValidHostname,
  subdomainSlug,
} from '../../../api/services/domain.service';

const UUID = '0b6f3c9e-2d4a-4f7b-9c1e-5a8d7e6f4b3a';

beforeEach(() => resolve4.mockReset());

describe('subdomainSlug', () => {
  it('keeps `<name>-<uuid>` when it fits', () => {
    expect(subdomainSlug('Shop', UUID)).toBe(`shop-${UUID}`);
  });

  it('shortens a long name so the label stays within what DNS allows', () => {
    // A name past 26 characters made a label DNS refuses: no certificate, ever.
    const slug = subdomainSlug('my-very-long-application-name-for-the-shop', UUID);
    expect(slug.length).toBeLessThanOrEqual(MAX_DNS_LABEL);
    expect(slug.endsWith(UUID)).toBe(true);
    expect(isValidHostname(`${slug}.apps.example.com`)).toBe(true);
  });
});

describe('isValidHostname', () => {
  it('accepts real names and refuses broken ones', () => {
    expect(isValidHostname('app.example.com')).toBe(true);
    expect(isValidHostname('-app.example.com')).toBe(false);
    expect(isValidHostname('app..example.com')).toBe(false);
    expect(isValidHostname(`${'a'.repeat(64)}.example.com`)).toBe(false);
    expect(isValidHostname('app_name.example.com')).toBe(false);
  });
});

describe('assertWildcardReaches', () => {
  it('accepts a wildcard whose names resolve to the server', async () => {
    resolve4.mockResolvedValue(['203.0.113.10']);
    await expect(assertWildcardReaches('apps.example.com', '203.0.113.10')).resolves.toBeUndefined();
    // A random name is resolved, so the `*` record itself is what is tested.
    expect(resolve4.mock.calls[0][0]).toMatch(/^ideploy-check-[a-z0-9]+\.apps\.example\.com$/);
  });

  it("refuses the platform's own domain, whose wildcard points at another server", async () => {
    resolve4.mockResolvedValue(['46.62.236.34']);
    await expect(assertWildcardReaches('idem.africa', '2.29.27.151')).rejects.toMatchObject({
      code: 'WILDCARD_DNS_MISMATCH',
    });
  });

  it('refuses a wildcard that does not resolve, and one that is not a domain', async () => {
    resolve4.mockResolvedValue([]);
    await expect(assertWildcardReaches('apps.example.com', '203.0.113.10')).rejects.toMatchObject({
      code: 'WILDCARD_DNS_MISMATCH',
    });
    await expect(assertWildcardReaches('not a domain', '203.0.113.10')).rejects.toMatchObject({
      code: 'WILDCARD_INVALID',
    });
  });
});

describe('checkDomains', () => {
  it('says where each domain points', async () => {
    resolve4.mockImplementation(async (host: string) => (host === 'good.example.com' ? ['203.0.113.10'] : ['198.51.100.1']));
    const checks = await checkDomains(['https://good.example.com', 'https://bad.example.com'], '203.0.113.10');
    expect(checks.map((c) => [c.host, c.pointsHere])).toEqual([
      ['good.example.com', true],
      ['bad.example.com', false],
    ]);
  });
});

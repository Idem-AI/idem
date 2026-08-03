/**
 * CrowdSec Local API client.
 *
 * Run against a real HTTP server rather than a mocked client, because what can
 * go wrong here is the *shape* of the request: the header the key travels in,
 * whether a filter reaches the query string, how a duration is spelled. A mock
 * would confirm the call we intended to make, not the one CrowdSec receives.
 *
 * The other half of the suite is about failure. This client is the channel a
 * firewall rule travels through, so a caller must always be able to tell "the
 * ban was refused" from "the ban never arrived".
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { CrowdSecLapiClient } from '../../../api/services/crowdsec-lapi.client';
import { isDomainError } from '../../../api/utils/errors';
import { StubServer } from '../../helpers/stub-server';

const stub = new StubServer();
let client: CrowdSecLapiClient;

beforeAll(async () => {
  await stub.start();
});

afterAll(async () => {
  await stub.stop();
});

beforeEach(() => {
  stub.reset();
  client = new CrowdSecLapiClient({ baseUrl: stub.url, apiKey: 'test-key', timeoutMs: 2000 });
});

afterEach(() => {
  stub.reset();
});

/** Assert a rejection carries the expected machine code. */
async function expectCode(promise: Promise<unknown>, code: string): Promise<void> {
  await expect(promise).rejects.toThrow();
  await promise.catch((err) => {
    expect(isDomainError(err), `expected a DomainError, got ${err}`).toBe(true);
    expect(isDomainError(err) && err.code).toBe(code);
  });
}

describe('authentication', () => {
  it('sends the key in the header CrowdSec reads', async () => {
    stub.on('GET', '/v1/decisions', { body: [] });

    await client.listDecisions();

    expect(stub.lastRequest().headers['x-api-key']).toBe('test-key');
  });

  it('never puts the key in the query string, where it would land in access logs', async () => {
    stub.on('GET', '/v1/decisions', { body: [] });

    await client.listDecisions();

    expect(JSON.stringify(stub.lastRequest().query)).not.toContain('test-key');
  });

  it('reports a rejected key distinctly from any other failure', async () => {
    // "Wrong key" and "CrowdSec is down" need different fixes.
    stub.on('GET', '/v1/decisions', { status: 403 });

    await expectCode(client.listDecisions(), 'CROWDSEC_UNAUTHORIZED');
  });
});

describe('listDecisions', () => {
  it('returns the decisions CrowdSec reports', async () => {
    stub.on('GET', '/v1/decisions', {
      body: [{ id: 1, type: 'ban', value: '203.0.113.5', scope: 'ip', duration: '3600s', origin: 'ideploy' }],
    });

    const decisions = await client.listDecisions();

    expect(decisions).toHaveLength(1);
    expect(decisions[0].value).toBe('203.0.113.5');
  });

  it('treats CrowdSec’s null for "nothing" as an empty list', async () => {
    // CrowdSec answers `null`, not `[]`, when no decision matches; returning it
    // raw would make every caller crash on `.length`.
    stub.on('GET', '/v1/decisions', { body: null });

    expect(await client.listDecisions()).toEqual([]);
  });

  it('passes filters through as query parameters', async () => {
    stub.on('GET', '/v1/decisions', { body: [] });

    await client.listDecisions({ scope: 'ip', type: 'ban' });

    expect(stub.lastRequest().query).toMatchObject({ scope: 'ip', type: 'ban' });
  });

  it('filters by address for decisionsForIp', async () => {
    stub.on('GET', '/v1/decisions', { body: [] });

    await client.decisionsForIp('203.0.113.5');

    expect(stub.lastRequest().query.ip).toBe('203.0.113.5');
  });
});

describe('banIp', () => {
  it('posts a decision in the envelope CrowdSec expects', async () => {
    stub.on('POST', '/v1/decisions', { status: 201 });

    await client.banIp({ ip: '203.0.113.5', durationSeconds: 3600 });

    const body = stub.lastRequest().body as { decisions: Record<string, string>[] };
    expect(body.decisions).toHaveLength(1);
    expect(body.decisions[0]).toMatchObject({
      value: '203.0.113.5',
      scope: 'ip',
      type: 'ban',
      // Duration is a string with a unit; a bare number is rejected.
      duration: '3600s',
      origin: 'ideploy',
    });
  });

  it('attributes the decision to us, so ours can be told from CrowdSec’s own', async () => {
    stub.on('POST', '/v1/decisions', { status: 201 });

    await client.banIp({ ip: '203.0.113.5', durationSeconds: 60 });

    const body = stub.lastRequest().body as { decisions: Record<string, string>[] };
    expect(body.decisions[0].origin).toBe('ideploy');
    expect(body.decisions[0].scenario).toBe('manual:ban');
  });

  it('carries the reason so an operator can see why an address is blocked', async () => {
    stub.on('POST', '/v1/decisions', { status: 201 });

    await client.banIp({ ip: '203.0.113.5', durationSeconds: 60, reason: 'Rule: block-scanners' });

    const body = stub.lastRequest().body as { decisions: Record<string, string>[] };
    expect(body.decisions[0].reason).toBe('Rule: block-scanners');
  });

  it('supports a captcha remediation as well as an outright ban', async () => {
    stub.on('POST', '/v1/decisions', { status: 201 });

    await client.banIp({ ip: '203.0.113.5', durationSeconds: 60, type: 'captcha' });

    const body = stub.lastRequest().body as { decisions: Record<string, string>[] };
    expect(body.decisions[0].type).toBe('captcha');
  });

  it('throws when CrowdSec refuses, rather than returning a quiet false', async () => {
    // A boolean here is what let "not banned" pass for an ordinary outcome.
    stub.on('POST', '/v1/decisions', { status: 500 });

    await expectCode(
      client.banIp({ ip: '203.0.113.5', durationSeconds: 60 }),
      'CROWDSEC_REQUEST_FAILED'
    );
  });

  it('reports an unreachable API as such', async () => {
    const offline = new CrowdSecLapiClient({
      // Reserved TEST-NET-1: nothing listens, connection is refused fast.
      baseUrl: 'http://127.0.0.1:9',
      apiKey: 'k',
      timeoutMs: 1500,
    });

    await expectCode(
      offline.banIp({ ip: '203.0.113.5', durationSeconds: 60 }),
      'CROWDSEC_UNREACHABLE'
    );
  });
});

describe('unbanIp', () => {
  it('deletes by address', async () => {
    stub.on('DELETE', '/v1/decisions', { status: 200 });

    await client.unbanIp('203.0.113.5');

    const request = stub.lastRequest();
    expect(request.method).toBe('DELETE');
    expect(request.query.ip).toBe('203.0.113.5');
  });

  it('throws when the deletion fails', async () => {
    stub.on('DELETE', '/v1/decisions', { status: 500 });

    await expectCode(client.unbanIp('203.0.113.5'), 'CROWDSEC_REQUEST_FAILED');
  });
});

describe('alerts', () => {
  it('lists with paging', async () => {
    stub.on('GET', '/v1/alerts', { body: [{ id: 1 }] });

    await client.listAlerts({ limit: 50, offset: 10 });

    expect(stub.lastRequest().query).toMatchObject({ limit: '50', offset: '10' });
  });

  it('defaults the paging so a caller need not think about it', async () => {
    stub.on('GET', '/v1/alerts', { body: [] });

    await client.listAlerts();

    expect(stub.lastRequest().query.limit).toBe('100');
  });

  it('deletes one by id', async () => {
    stub.on('DELETE', '/v1/alerts/42', { status: 200 });

    await client.deleteAlert(42);

    expect(stub.lastRequest().path).toBe('/v1/alerts/42');
  });
});

describe('bouncers', () => {
  it('returns the key the proxy will authenticate with', async () => {
    stub.on('POST', '/v1/bouncers', { status: 201, body: { api_key: 'bouncer-secret' } });

    expect(await client.createBouncer('traefik-app-1')).toBe('bouncer-secret');
  });

  it('refuses a registration that returned no key', async () => {
    // Without a key the middleware cannot authenticate, so the bouncer would
    // exist while every request bypassed it.
    stub.on('POST', '/v1/bouncers', { status: 201, body: {} });

    await expectCode(client.createBouncer('traefik-app-1'), 'CROWDSEC_NO_BOUNCER_KEY');
  });

  it('escapes the name in the path when deleting', async () => {
    stub.on('DELETE', '/v1/bouncers/app%2Fone', { status: 200 });

    await client.deleteBouncer('app/one');

    expect(stub.lastRequest().path).toBe('/v1/bouncers/app%2Fone');
  });
});

describe('health', () => {
  it('reports a reachable API without throwing', async () => {
    stub.on('GET', '/v1/decisions', { body: [], headers: { 'x-crowdsec-version': 'v1.6.0' } });

    const health = await client.health();

    expect(health.reachable).toBe(true);
    expect(health.version).toBe('v1.6.0');
  });

  it('answers instead of throwing when the API is down', async () => {
    // A probe that throws forces every caller into a try/catch to hear the
    // answer it exists to give.
    const offline = new CrowdSecLapiClient({
      baseUrl: 'http://127.0.0.1:9',
      apiKey: 'k',
      timeoutMs: 1500,
    });

    const health = await offline.health();

    expect(health.reachable).toBe(false);
    expect(health.detail).toBeTruthy();
  });

  it('distinguishes "running but rejecting our key" from "not running"', async () => {
    stub.on('GET', '/v1/decisions', { status: 403 });

    const health = await client.health();

    expect(health.reachable).toBe(true);
    expect(health.detail).toMatch(/key/i);
  });

  it('tolerates a missing version header', async () => {
    stub.on('GET', '/v1/decisions', { body: [] });

    const health = await client.health();

    expect(health.reachable).toBe(true);
    expect(health.version).toBeNull();
  });
});

describe('base URL handling', () => {
  it('tolerates a trailing slash in the configured URL', async () => {
    const withSlash = new CrowdSecLapiClient({ baseUrl: `${stub.url}/`, apiKey: 'k' });
    stub.on('GET', '/v1/decisions', { body: [] });

    await withSlash.listDecisions();

    // A doubled slash would 404 against some deployments.
    expect(stub.lastRequest().path).toBe('/v1/decisions');
  });
});

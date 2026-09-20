/**
 * CrowdSec Local API client.
 *
 * Run against a real HTTP server rather than a mocked client, because what can
 * go wrong here is the *shape* of the request: which header a credential
 * travels in, whether a filter reaches the query string, how a duration is
 * spelled. A mock would confirm the call we intended to make, not the one
 * CrowdSec receives — which is exactly how the previous version of this
 * client (and this suite) went unnoticed for as long as it did: it agreed
 * with itself about an API shape (`POST /v1/decisions`, static `X-Api-Key`
 * writes, REST bouncer management) that a real CrowdSec instance simply does
 * not have. Every request shape asserted below was checked against a real
 * CrowdSec v1.7.8 container first.
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

const MACHINE_ID = 'localhost';
const MACHINE_PASSWORD = 'test-password';
const BOUNCER_KEY = 'test-bouncer-key';

/** A real login response never has an unbounded lifetime; this is a valid-shaped JWT with no real signature. */
function fakeJwt(expiresInSeconds = 3600): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + expiresInSeconds })
  ).toString('base64url');
  return `${header}.${payload}.`;
}

function stubLogin(token = fakeJwt()): void {
  stub.on('POST', '/v1/watchers/login', { status: 200, body: { token } });
}

beforeAll(async () => {
  await stub.start();
});

afterAll(async () => {
  await stub.stop();
});

beforeEach(() => {
  stub.reset();
  client = new CrowdSecLapiClient({
    baseUrl: stub.url,
    bouncerKey: BOUNCER_KEY,
    machineId: MACHINE_ID,
    machinePassword: MACHINE_PASSWORD,
    timeoutMs: 2000,
  });
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

describe('reads — bouncer key, no login', () => {
  it('sends the bouncer key in the header CrowdSec reads', async () => {
    stub.on('GET', '/v1/decisions', { body: [] });

    await client.listDecisions();

    expect(stub.lastRequest().headers['x-api-key']).toBe(BOUNCER_KEY);
    // A read must never need a machine login — the whole point of a bouncer
    // key is that a read-only caller does not need a machine identity at all.
    expect(stub.requests.some((r) => r.path === '/v1/watchers/login')).toBe(false);
  });

  it('never puts the key in the query string, where it would land in access logs', async () => {
    stub.on('GET', '/v1/decisions', { body: [] });

    await client.listDecisions();

    expect(JSON.stringify(stub.lastRequest().query)).not.toContain(BOUNCER_KEY);
  });

  it('reports a rejected key distinctly from any other failure', async () => {
    // "Wrong key" and "CrowdSec is down" need different fixes.
    stub.on('GET', '/v1/decisions', { status: 403 });

    await expectCode(client.listDecisions(), 'CROWDSEC_UNAUTHORIZED');
  });

  it('falls back to a machine login when no bouncer key was supplied', async () => {
    const machineOnly = new CrowdSecLapiClient({
      baseUrl: stub.url,
      machineId: MACHINE_ID,
      machinePassword: MACHINE_PASSWORD,
    });
    stubLogin();
    stub.on('GET', '/v1/decisions', { body: [] });

    await machineOnly.listDecisions();

    expect(stub.lastRequest().headers.authorization).toMatch(/^Bearer /);
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
  it('requires machine credentials, not the bouncer key', async () => {
    // Verified against real CrowdSec: a bouncer key gets 405 on every write.
    const bouncerOnly = new CrowdSecLapiClient({ baseUrl: stub.url, bouncerKey: BOUNCER_KEY });

    await expectCode(
      bouncerOnly.banIp({ ip: '203.0.113.5', durationSeconds: 60 }),
      'CROWDSEC_NO_MACHINE_CREDENTIALS'
    );
    // Refused before any request left the client — nothing to observe the shape of.
    expect(stub.requests).toHaveLength(0);
  });

  it('logs in, then posts the ban as an alert — not to /v1/decisions, which is read-only', async () => {
    stubLogin();
    stub.on('POST', '/v1/alerts', { status: 201, body: ['1'] });

    await client.banIp({ ip: '203.0.113.5', durationSeconds: 3600 });

    expect(stub.requests.some((r) => r.method === 'POST' && r.path === '/v1/decisions')).toBe(false);
    const alertRequest = stub.requests.find((r) => r.path === '/v1/alerts');
    expect(alertRequest?.headers.authorization).toMatch(/^Bearer /);
    const body = alertRequest!.body as Array<{ decisions: Record<string, string>[] }>;
    expect(body[0].decisions).toHaveLength(1);
    expect(body[0].decisions[0]).toMatchObject({
      value: '203.0.113.5',
      scope: 'ip',
      type: 'ban',
      // Duration is a string with a unit; a bare number is rejected.
      duration: '3600s',
      origin: 'ideploy',
    });
  });

  it('attributes the decision to us, so ours can be told from CrowdSec’s own', async () => {
    stubLogin();
    stub.on('POST', '/v1/alerts', { status: 201, body: ['1'] });

    await client.banIp({ ip: '203.0.113.5', durationSeconds: 60 });

    const body = stub.requests.find((r) => r.path === '/v1/alerts')!.body as Array<{
      decisions: Record<string, string>[];
    }>;
    expect(body[0].decisions[0].origin).toBe('ideploy');
    expect(body[0].decisions[0].scenario).toBe('manual:ban');
  });

  it('carries the reason as the alert message, so an operator can see why an address is blocked', async () => {
    stubLogin();
    stub.on('POST', '/v1/alerts', { status: 201, body: ['1'] });

    await client.banIp({ ip: '203.0.113.5', durationSeconds: 60, reason: 'Rule: block-scanners' });

    const body = stub.requests.find((r) => r.path === '/v1/alerts')!.body as Array<{ message: string }>;
    expect(body[0].message).toBe('Rule: block-scanners');
  });

  it('supports a captcha remediation as well as an outright ban', async () => {
    stubLogin();
    stub.on('POST', '/v1/alerts', { status: 201, body: ['1'] });

    await client.banIp({ ip: '203.0.113.5', durationSeconds: 60, type: 'captcha' });

    const body = stub.requests.find((r) => r.path === '/v1/alerts')!.body as Array<{
      decisions: Record<string, string>[];
    }>;
    expect(body[0].decisions[0].type).toBe('captcha');
  });

  it('throws when CrowdSec refuses, rather than returning a quiet false', async () => {
    // A boolean here is what let "not banned" pass for an ordinary outcome.
    stubLogin();
    stub.on('POST', '/v1/alerts', { status: 500 });

    await expectCode(
      client.banIp({ ip: '203.0.113.5', durationSeconds: 60 }),
      'CROWDSEC_REQUEST_FAILED'
    );
  });

  it('reports an unreachable API as such', async () => {
    const offline = new CrowdSecLapiClient({
      // Reserved TEST-NET-1: nothing listens, connection is refused fast.
      baseUrl: 'http://127.0.0.1:9',
      machineId: MACHINE_ID,
      machinePassword: MACHINE_PASSWORD,
      timeoutMs: 1500,
    });

    await expectCode(
      offline.banIp({ ip: '203.0.113.5', durationSeconds: 60 }),
      'CROWDSEC_UNREACHABLE'
    );
  });

  it('caches the machine token instead of logging in on every call', async () => {
    stubLogin();
    stub.on('POST', '/v1/alerts', { status: 201, body: ['1'] });

    await client.banIp({ ip: '203.0.113.5', durationSeconds: 60 });
    await client.banIp({ ip: '203.0.113.6', durationSeconds: 60 });

    expect(stub.requests.filter((r) => r.path === '/v1/watchers/login')).toHaveLength(1);
  });
});

describe('unbanIp', () => {
  it('requires machine credentials — a bouncer key gets 401 on delete', async () => {
    const bouncerOnly = new CrowdSecLapiClient({ baseUrl: stub.url, bouncerKey: BOUNCER_KEY });

    await expectCode(bouncerOnly.unbanIp('203.0.113.5'), 'CROWDSEC_NO_MACHINE_CREDENTIALS');
  });

  it('deletes by address, authenticated as the machine', async () => {
    stubLogin();
    stub.on('DELETE', '/v1/decisions', { status: 200, body: { nbDeleted: '1' } });

    await client.unbanIp('203.0.113.5');

    const request = stub.requests.find((r) => r.method === 'DELETE' && r.path === '/v1/decisions')!;
    expect(request.query.ip).toBe('203.0.113.5');
    expect(request.headers.authorization).toMatch(/^Bearer /);
  });

  it('throws when the deletion fails', async () => {
    stubLogin();
    stub.on('DELETE', '/v1/decisions', { status: 500 });

    await expectCode(client.unbanIp('203.0.113.5'), 'CROWDSEC_REQUEST_FAILED');
  });
});

describe('alerts', () => {
  it('lists with paging, authenticated as the machine', async () => {
    stubLogin();
    stub.on('GET', '/v1/alerts', { body: [{ id: 1 }] });

    await client.listAlerts({ limit: 50, offset: 10 });

    const request = stub.requests.find((r) => r.path === '/v1/alerts')!;
    expect(request.query).toMatchObject({ limit: '50', offset: '10' });
    expect(request.headers.authorization).toMatch(/^Bearer /);
  });

  it('defaults the paging so a caller need not think about it', async () => {
    stubLogin();
    stub.on('GET', '/v1/alerts', { body: [] });

    await client.listAlerts();

    expect(stub.requests.find((r) => r.path === '/v1/alerts')!.query.limit).toBe('100');
  });

  it('deletes one by id', async () => {
    stubLogin();
    stub.on('DELETE', '/v1/alerts/42', { status: 200 });

    await client.deleteAlert(42);

    expect(stub.requests.find((r) => r.method === 'DELETE')!.path).toBe('/v1/alerts/42');
  });
});

describe('bouncer management', () => {
  it('is not offered by this client — CrowdSec has no REST endpoint for it', () => {
    // Verified against real CrowdSec: POST /v1/bouncers is 404 under both a
    // bouncer key and a machine JWT. Registering one is a `cscli` operation,
    // run over SSH during proxy provisioning (proxy.service.ts) — not
    // something this HTTP client can or should pretend to do.
    expect((client as unknown as Record<string, unknown>).createBouncer).toBeUndefined();
    expect((client as unknown as Record<string, unknown>).deleteBouncer).toBeUndefined();
  });
});

describe('health', () => {
  it('reports a reachable API without throwing', async () => {
    stub.on('GET', '/v1/decisions', { body: [], headers: { 'x-crowdsec-version': 'v1.7.8' } });

    const health = await client.health();

    expect(health.reachable).toBe(true);
    expect(health.version).toBe('v1.7.8');
  });

  it('answers instead of throwing when the API is down', async () => {
    const offline = new CrowdSecLapiClient({
      baseUrl: 'http://127.0.0.1:9',
      bouncerKey: BOUNCER_KEY,
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

  it('reports unreachable, not a throw, when no credential at all was supplied', async () => {
    const bare = new CrowdSecLapiClient({ baseUrl: stub.url });

    const health = await bare.health();

    expect(health.reachable).toBe(false);
  });
});

describe('base URL handling', () => {
  it('tolerates a trailing slash in the configured URL', async () => {
    const withSlash = new CrowdSecLapiClient({ baseUrl: `${stub.url}/`, bouncerKey: BOUNCER_KEY });
    stub.on('GET', '/v1/decisions', { body: [] });

    await withSlash.listDecisions();

    // A doubled slash would 404 against some deployments.
    expect(stub.lastRequest().path).toBe('/v1/decisions');
  });
});

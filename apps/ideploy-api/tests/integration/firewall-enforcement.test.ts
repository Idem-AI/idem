/**
 * Firewall enforcement, end to end against a stub Local API.
 *
 * The property under test is the split introduced by the proxy-capability
 * arbitration: an address rule and a country rule are enforced by different
 * layers, on different schedules, and `enforce()`/`getLiveStatus()` must never
 * report one as if it were the other. Concretely: pushing a decision to
 * CrowdSec must never happen for a country rule (nothing there could consult
 * it), and a CrowdSec outage must never hide that a country rule is configured
 * and will apply at the next deploy.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import * as enforcement from '../../api/services/firewall-enforcement.service';
import { getOrCreateConfig, createRule, updateConfig } from '../../api/services/firewall.service';
import { encryptString } from '../../api/utils/laravel-crypto';
import { isTestDatabaseAvailable, testPool, truncateAll } from '../helpers/db';
import { makeApplication, makeManagedServer, makeProject, makeTeam } from '../helpers/factories';
import { StubServer } from '../helpers/stub-server';
import { closeInfrastructure } from '../helpers/teardown';

const stub = new StubServer();

beforeAll(async () => {
  if (!(await isTestDatabaseAvailable())) {
    throw new Error('Integration tests need the test database (scripts/prepare-test-db.sh).');
  }
  await stub.start();
});

afterAll(async () => {
  await stub.stop();
  await closeInfrastructure();
});

beforeEach(async () => {
  await truncateAll();
  stub.reset();
});

/**
 * An application with a usable firewall config, pointed at the stub LAPI.
 *
 * CrowdSec credentials live on the *server* row, not on `firewall_configs`
 * (`firewall_configs.crowdsec_api_key`/`crowdsec_lapi_url` are vestigial —
 * inherited from the Laravel schema, never read by `loadConfig()` since the
 * per-server refactor — see its own doc comment). Encrypted the same way
 * `getCrowdSecCredentials` expects to decrypt it: a plaintext value there
 * silently reads back as `null`, which is indistinguishable from "not
 * configured" and was exactly what made this whole suite fail — the
 * *server* on 159.69.185.176 has always had real, working credentials; only
 * this fixture was pointed at the wrong table.
 */
async function anApplication(): Promise<{ teamId: number; uuid: string; appId: number; serverId: number }> {
  const team = await makeTeam();
  const server = await makeManagedServer();
  const project = await makeProject(team.id);
  const app = await makeApplication(project.environmentId, server.destinationId);
  await getOrCreateConfig(team.id, app.uuid);
  await updateConfig(team.id, app.uuid, { enabled: true });
  // Every call this client makes without a bouncer key (decisions, health)
  // logs in as the machine first — the stub's unmatched-route fallback is
  // `{ status: 200, body: [] }`, which has no `.token`, so without this every
  // one of those calls failed on "CrowdSec accepted the login but returned
  // no token" before ever reaching the behaviour a test actually meant to
  // check.
  stub.on('POST', '/v1/watchers/login', { body: { token: 'stub-machine-jwt' } });
  // A bouncer key is a `cscli bouncers add` artefact of provisioning
  // (`proxy.service.ts`'s `ensureCrowdSecCredentials`, run over SSH) — not
  // something `enforce()` itself ever registers over HTTP (`POST
  // /v1/bouncers` doesn't exist on a real Local API; see
  // `crowdsec-lapi.client.ts`'s own module doc). A server this test treats
  // as already provisioned needs one set from the start, the same as the
  // real server at 159.69.185.176 has had since it was set up.
  await testPool().query(
    `UPDATE servers SET crowdsec_lapi_url = $2, crowdsec_api_key = $3, crowdsec_bouncer_key = $4 WHERE id = $1`,
    [server.id, stub.url, encryptString('management-key'), encryptString('bouncer-key')]
  );
  return { teamId: team.id, uuid: app.uuid, appId: app.id, serverId: server.id };
}

async function anAddressRule(teamId: number, uuid: string, ip = '203.0.113.5'): Promise<void> {
  await createRule(teamId, uuid, {
    name: 'block-one',
    conditions: [{ field: 'ip', operator: 'equals', value: ip }],
  });
}

async function aCountryRule(teamId: number, uuid: string, country = 'RU'): Promise<void> {
  await createRule(teamId, uuid, {
    name: 'geo-blocking',
    conditions: [{ field: 'country', operator: 'in', value: [country] }],
  });
}

/**
 * A minimal, in-memory Local API: `GET /v1/decisions` answers with whatever
 * `POST /v1/alerts` most recently pushed, the way a real CrowdSec actually
 * behaves. `banIp` sends the decision embedded in `alert[0].decisions[0]`
 * (see `crowdsec-lapi.client.ts`); `ourDecisions` needs it back with
 * `origin: 'ideploy'` and a `scope` that's case-insensitively "ip" — real
 * CrowdSec echoes it title-cased ("Ip"), so this does too, to keep the stub
 * honest about that specific quirk rather than a shape nothing real sends.
 */
function withPushedDecisionsStub(): void {
  let decisions: Record<string, unknown>[] = [];
  stub.on('GET', '/v1/decisions', () => ({ body: decisions }));
  stub.on('POST', '/v1/alerts', (request) => {
    const alerts = request.body as { decisions?: Record<string, unknown>[] }[];
    const pushed = alerts.flatMap((a) => a.decisions ?? []);
    decisions = [...decisions, ...pushed.map((d) => ({ ...d, scope: 'Ip' }))];
    return { body: null };
  });
}

/**
 * Point an application's firewall at a port nothing listens on.
 *
 * An unregistered stub route is not an outage — `StubServer` falls back to a
 * plain 200 for anything unmatched, so it would report the Local API as
 * healthy. A genuinely closed port is what actually produces `ECONNREFUSED`.
 */
async function simulateLapiOutage(serverId: number): Promise<void> {
  await testPool().query('UPDATE servers SET crowdsec_lapi_url = $2 WHERE id = $1', [
    serverId,
    'http://127.0.0.1:1',
  ]);
}

describe('enforce — address rules go to CrowdSec', () => {
  it('pushes a decision for a new address rule', async () => {
    const { teamId, uuid } = await anApplication();
    stub.on('GET', '/v1/decisions', { body: [] });
    await anAddressRule(teamId, uuid);

    const result = await enforcement.enforce(teamId, uuid);

    expect(result.blocked).toEqual([{ scope: 'ip', value: '203.0.113.5' }]);
    expect(result.pendingRedeploy).toEqual([]);
    // A ban is a `POST /v1/alerts` whose `decisions[]` carries it — real
    // CrowdSec (v1.7.8, verified live) answers 405 to `POST /v1/decisions`;
    // that route is GET-only. See `crowdsec-lapi.client.ts`'s module doc.
    expect(stub.requests.filter((r) => r.method === 'POST' && r.path === '/v1/alerts')).toHaveLength(1);
  });

  it('releases a decision whose rule was removed', async () => {
    const { teamId, uuid } = await anApplication();
    // CrowdSec already holds a decision this application no longer asks for.
    stub.on('GET', '/v1/decisions', { body: [{ value: '203.0.113.9', scope: 'ip', origin: 'ideploy' }] });
    stub.on('DELETE', '/v1/decisions', { body: null });

    const result = await enforcement.enforce(teamId, uuid);

    expect(result.released).toEqual([{ scope: 'ip', value: '203.0.113.9' }]);
    expect(stub.requests.filter((r) => r.method === 'DELETE' && r.path === '/v1/decisions')).toHaveLength(1);
  });

  it('does not require a redeploy for an address rule — it takes effect immediately', async () => {
    // A CrowdSec decision applies the instant it is pushed, because the
    // bouncer asks the Local API on every request — unlike a country rule,
    // nothing here waits for the container to restart. Registering a
    // bouncer is a one-time, SSH-driven step during proxy provisioning
    // (`proxy.service.ts`), not something `enforce()` itself does, so it can
    // never be *this* call's reason for a redeploy.
    const { teamId, uuid } = await anApplication();
    stub.on('GET', '/v1/decisions', { body: [] });
    await anAddressRule(teamId, uuid);

    const result = await enforcement.enforce(teamId, uuid);

    expect(result.redeployRequired).toBe(false);
    expect(result.reason).toBeUndefined();
  });
});

describe('enforce — country rules never reach CrowdSec', () => {
  it('creates no decision for a country rule', async () => {
    const { teamId, uuid } = await anApplication();
    stub.on('GET', '/v1/decisions', { body: [] });
    await aCountryRule(teamId, uuid);

    const result = await enforcement.enforce(teamId, uuid);

    // Pushing this to CrowdSec would look like protection while blocking
    // nothing — the exact failure this arbitration exists to prevent.
    expect(stub.requests.filter((r) => r.method === 'POST' && r.path === '/v1/alerts')).toHaveLength(0);
    expect(result.blocked).toEqual([]);
    expect(result.pendingRedeploy).toEqual([{ scope: 'country', value: 'RU' }]);
  });

  it('reports the redeploy reason in terms of the country rule', async () => {
    const { teamId, uuid } = await anApplication();
    stub.on('GET', '/v1/decisions', { body: [] });
    await aCountryRule(teamId, uuid);

    const result = await enforcement.enforce(teamId, uuid);

    expect(result.redeployRequired).toBe(true);
    expect(result.reason).toMatch(/country/i);
  });

  it('still reconciles address rules when a country rule is also present', async () => {
    const { teamId, uuid } = await anApplication();
    stub.on('GET', '/v1/decisions', { body: [] });
    await anAddressRule(teamId, uuid);
    await aCountryRule(teamId, uuid);

    const result = await enforcement.enforce(teamId, uuid);

    expect(result.blocked).toEqual([{ scope: 'ip', value: '203.0.113.5' }]);
    expect(result.pendingRedeploy).toEqual([{ scope: 'country', value: 'RU' }]);
  });

  it('still needs a redeploy to drop the label when the firewall is turned off', async () => {
    const { teamId, uuid } = await anApplication();
    stub.on('GET', '/v1/decisions', { body: [] });
    await aCountryRule(teamId, uuid);
    await updateConfig(teamId, uuid, { enabled: false });

    const result = await enforcement.enforce(teamId, uuid);

    expect(result.redeployRequired).toBe(true);
    expect(result.reason).toMatch(/turned off/i);
  });
});

describe('getLiveStatus — the two layers are judged independently', () => {
  it('reports enforced when every rule is address-scoped and CrowdSec is healthy', async () => {
    const { teamId, uuid } = await anApplication();
    // `getLiveStatus` now re-checks CrowdSec's own decision list rather than
    // trusting reachability alone (see its own doc comment) — a static `[]`
    // stub would make it correctly report "not enforced" even right after a
    // real push, so this one needs to actually remember what `enforce()`
    // pushed, the way a real Local API would.
    withPushedDecisionsStub();
    await anAddressRule(teamId, uuid);
    await enforcement.enforce(teamId, uuid);

    const status = await enforcement.getLiveStatus(teamId, uuid);

    expect(status.state).toBe('enforced');
    expect(status.rulesEnforced).toBe(1);
    expect(status.rulesPendingRedeploy).toBe(0);
  });

  it('reports partially_enforced when a country rule is only pending redeploy', async () => {
    const { teamId, uuid } = await anApplication();
    withPushedDecisionsStub();
    await anAddressRule(teamId, uuid);
    await aCountryRule(teamId, uuid);
    await enforcement.enforce(teamId, uuid);

    const status = await enforcement.getLiveStatus(teamId, uuid);

    expect(status.state).toBe('partially_enforced');
    expect(status.rulesEnforced).toBe(1);
    expect(status.rulesPendingRedeploy).toBe(1);
  });

  it('does not hide a configured country rule behind a CrowdSec outage', async () => {
    // The country rule depends on the proxy, not on CrowdSec. Reporting
    // "not_enforced" here would bury the one thing that is actually configured.
    const { teamId, uuid, serverId } = await anApplication();
    await aCountryRule(teamId, uuid);
    await simulateLapiOutage(serverId);

    const status = await enforcement.getLiveStatus(teamId, uuid);

    expect(status.state).toBe('partially_enforced');
    expect(status.rulesPendingRedeploy).toBe(1);
    expect(status.lapiReachable).toBe(false);
  });

  it('reports not_enforced when CrowdSec is down and there is no country rule to fall back on', async () => {
    const { teamId, uuid, serverId } = await anApplication();
    await anAddressRule(teamId, uuid);
    await simulateLapiOutage(serverId);

    const status = await enforcement.getLiveStatus(teamId, uuid);

    expect(status.state).toBe('not_enforced');
    expect(status.rulesEnforced).toBe(0);
    expect(status.lapiReachable).toBe(false);
  });

  it('reports not_enforced when CrowdSec is reachable but no bouncer is registered', async () => {
    // A different failure from an outage: the Local API answers, but nothing
    // has told it that this application's proxy exists yet — `anApplication`
    // sets a bouncer key by default (a real provisioned server always has
    // one), so this one scenario clears it back out deliberately.
    const { teamId, uuid, serverId } = await anApplication();
    await testPool().query('UPDATE servers SET crowdsec_bouncer_key = NULL WHERE id = $1', [serverId]);
    stub.on('GET', '/v1/decisions', { body: [] });
    await anAddressRule(teamId, uuid);

    const status = await enforcement.getLiveStatus(teamId, uuid);

    expect(status.state).toBe('not_enforced');
    expect(status.lapiReachable).toBe(true);
    expect(status.bouncerRegistered).toBe(false);
  });

  it('reports not_enforced, not vacuously enforced, when no rule exists at all', async () => {
    const { teamId, uuid } = await anApplication();

    const status = await enforcement.getLiveStatus(teamId, uuid);

    expect(status.state).toBe('not_enforced');
    expect(status.reason).toMatch(/no rule is configured/i);
  });

  it('reports not_enforced when the firewall is turned off, regardless of rules', async () => {
    const { teamId, uuid } = await anApplication();
    await aCountryRule(teamId, uuid);
    await updateConfig(teamId, uuid, { enabled: false });

    const status = await enforcement.getLiveStatus(teamId, uuid);

    expect(status.state).toBe('not_enforced');
    expect(status.reason).toMatch(/turned off/i);
  });
});

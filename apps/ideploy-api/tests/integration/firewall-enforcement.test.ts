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

/** An application with a usable firewall config, pointed at the stub LAPI. */
async function anApplication(): Promise<{ teamId: number; uuid: string; appId: number }> {
  const team = await makeTeam();
  const server = await makeManagedServer();
  const project = await makeProject(team.id);
  const app = await makeApplication(project.environmentId, server.destinationId);
  const config = await getOrCreateConfig(team.id, app.uuid);
  await updateConfig(team.id, app.uuid, { enabled: true });
  await testPool().query(
    `UPDATE firewall_configs
     SET crowdsec_api_key = 'management-key', crowdsec_lapi_url = $2
     WHERE id = $1`,
    [config.id, stub.url]
  );
  return { teamId: team.id, uuid: app.uuid, appId: app.id };
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
 * Point an application's firewall at a port nothing listens on.
 *
 * An unregistered stub route is not an outage — `StubServer` falls back to a
 * plain 200 for anything unmatched, so it would report the Local API as
 * healthy. A genuinely closed port is what actually produces `ECONNREFUSED`.
 */
async function simulateLapiOutage(teamId: number, uuid: string): Promise<void> {
  const config = await getOrCreateConfig(teamId, uuid);
  await testPool().query('UPDATE firewall_configs SET crowdsec_lapi_url = $2 WHERE id = $1', [
    config.id,
    'http://127.0.0.1:1',
  ]);
}

describe('enforce — address rules go to CrowdSec', () => {
  it('pushes a decision for a new address rule', async () => {
    const { teamId, uuid } = await anApplication();
    stub.on('POST', '/v1/bouncers', { body: { api_key: 'bouncer-key' } });
    stub.on('GET', '/v1/decisions', { body: [] });
    stub.on('POST', '/v1/decisions', { body: null });
    await anAddressRule(teamId, uuid);

    const result = await enforcement.enforce(teamId, uuid);

    expect(result.blocked).toEqual([{ scope: 'ip', value: '203.0.113.5' }]);
    expect(result.pendingRedeploy).toEqual([]);
    expect(stub.requests.filter((r) => r.method === 'POST' && r.path === '/v1/decisions')).toHaveLength(1);
  });

  it('releases a decision whose rule was removed', async () => {
    const { teamId, uuid } = await anApplication();
    stub.on('POST', '/v1/bouncers', { body: { api_key: 'bouncer-key' } });
    // CrowdSec already holds a decision this application no longer asks for.
    stub.on('GET', '/v1/decisions', { body: [{ value: '203.0.113.9', scope: 'ip', origin: 'ideploy' }] });
    stub.on('DELETE', '/v1/decisions', { body: null });

    const result = await enforcement.enforce(teamId, uuid);

    expect(result.released).toEqual([{ scope: 'ip', value: '203.0.113.9' }]);
    expect(stub.requests.filter((r) => r.method === 'DELETE' && r.path === '/v1/decisions')).toHaveLength(1);
  });

  it('reports a redeploy is needed only when a bouncer was just registered', async () => {
    const { teamId, uuid } = await anApplication();
    stub.on('POST', '/v1/bouncers', { body: { api_key: 'bouncer-key' } });
    stub.on('GET', '/v1/decisions', { body: [] });
    stub.on('POST', '/v1/decisions', { body: null });
    await anAddressRule(teamId, uuid);

    const result = await enforcement.enforce(teamId, uuid);

    expect(result.redeployRequired).toBe(true);
    expect(result.reason).toMatch(/bouncer/i);
  });
});

describe('enforce — country rules never reach CrowdSec', () => {
  it('creates no decision for a country rule', async () => {
    const { teamId, uuid } = await anApplication();
    stub.on('POST', '/v1/bouncers', { body: { api_key: 'bouncer-key' } });
    stub.on('GET', '/v1/decisions', { body: [] });
    await aCountryRule(teamId, uuid);

    const result = await enforcement.enforce(teamId, uuid);

    // Pushing this to CrowdSec would look like protection while blocking
    // nothing — the exact failure this arbitration exists to prevent.
    expect(stub.requests.filter((r) => r.method === 'POST' && r.path === '/v1/decisions')).toHaveLength(0);
    expect(result.blocked).toEqual([]);
    expect(result.pendingRedeploy).toEqual([{ scope: 'country', value: 'RU' }]);
  });

  it('reports the redeploy reason in terms of the country rule', async () => {
    const { teamId, uuid } = await anApplication();
    stub.on('POST', '/v1/bouncers', { body: { api_key: 'bouncer-key' } });
    stub.on('GET', '/v1/decisions', { body: [] });
    await aCountryRule(teamId, uuid);

    const result = await enforcement.enforce(teamId, uuid);

    expect(result.redeployRequired).toBe(true);
    expect(result.reason).toMatch(/country/i);
  });

  it('still reconciles address rules when a country rule is also present', async () => {
    const { teamId, uuid } = await anApplication();
    stub.on('POST', '/v1/bouncers', { body: { api_key: 'bouncer-key' } });
    stub.on('GET', '/v1/decisions', { body: [] });
    stub.on('POST', '/v1/decisions', { body: null });
    await anAddressRule(teamId, uuid);
    await aCountryRule(teamId, uuid);

    const result = await enforcement.enforce(teamId, uuid);

    expect(result.blocked).toEqual([{ scope: 'ip', value: '203.0.113.5' }]);
    expect(result.pendingRedeploy).toEqual([{ scope: 'country', value: 'RU' }]);
  });

  it('still needs a redeploy to drop the label when the firewall is turned off', async () => {
    const { teamId, uuid } = await anApplication();
    stub.on('POST', '/v1/bouncers', { body: { api_key: 'bouncer-key' } });
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
    stub.on('POST', '/v1/bouncers', { body: { api_key: 'bouncer-key' } });
    stub.on('GET', '/v1/decisions', { body: [] });
    stub.on('POST', '/v1/decisions', { body: null });
    await anAddressRule(teamId, uuid);
    await enforcement.enforce(teamId, uuid);

    const status = await enforcement.getLiveStatus(teamId, uuid);

    expect(status.state).toBe('enforced');
    expect(status.rulesEnforced).toBe(1);
    expect(status.rulesPendingRedeploy).toBe(0);
  });

  it('reports partially_enforced when a country rule is only pending redeploy', async () => {
    const { teamId, uuid } = await anApplication();
    stub.on('POST', '/v1/bouncers', { body: { api_key: 'bouncer-key' } });
    stub.on('GET', '/v1/decisions', { body: [] });
    stub.on('POST', '/v1/decisions', { body: null });
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
    const { teamId, uuid } = await anApplication();
    await aCountryRule(teamId, uuid);
    await simulateLapiOutage(teamId, uuid);

    const status = await enforcement.getLiveStatus(teamId, uuid);

    expect(status.state).toBe('partially_enforced');
    expect(status.rulesPendingRedeploy).toBe(1);
    expect(status.lapiReachable).toBe(false);
  });

  it('reports not_enforced when CrowdSec is down and there is no country rule to fall back on', async () => {
    const { teamId, uuid } = await anApplication();
    await anAddressRule(teamId, uuid);
    await simulateLapiOutage(teamId, uuid);

    const status = await enforcement.getLiveStatus(teamId, uuid);

    expect(status.state).toBe('not_enforced');
    expect(status.rulesEnforced).toBe(0);
    expect(status.lapiReachable).toBe(false);
  });

  it('reports not_enforced when CrowdSec is reachable but no bouncer is registered', async () => {
    // A different failure from an outage: the Local API answers, but nothing
    // has told it that this application's proxy exists yet.
    const { teamId, uuid } = await anApplication();
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

/**
 * The firewall must never claim to protect what it does not.
 *
 * The invariant is unchanged since task 4.0; what enforces it has moved. Rules
 * are now reconciled into CrowdSec decisions, so the reported state depends on
 * live conditions — is a bouncer registered, does the Local API answer — rather
 * than on the presence of rows.
 *
 * Nothing is enforced in this environment: no CrowdSec runs, and the tests below
 * assert that the API says exactly that instead of inferring protection from a
 * rule count. An absent security control is a manageable problem; one that
 * reports itself active while absent is worse, because nobody goes looking.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import * as firewall from '../../api/services/firewall.service';
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

/** An application with a firewall config and `ruleCount` saved rules. */
async function protectedApp(ruleCount = 0): Promise<{ teamId: number; uuid: string }> {
  const team = await makeTeam();
  const server = await makeManagedServer();
  const project = await makeProject(team.id);
  const app = await makeApplication(project.environmentId, server.destinationId);

  await firewall.updateConfig(team.id, app.uuid, { enabled: true });
  for (let i = 0; i < ruleCount; i++) {
    await firewall.createRule(team.id, app.uuid, {
      name: `block-bad-actor-${i}`,
      conditions: [{ field: 'ip', operator: 'equals', value: `203.0.113.${i + 1}` }],
      action: 'block',
    });
  }

  return { teamId: team.id, uuid: app.uuid };
}

describe('deploy', () => {
  it('refuses when CrowdSec is not configured, rather than reporting a success', async () => {
    // No API key means no channel to push decisions through. Answering "applied"
    // here is the exact failure this suite guards against.
    const app = await protectedApp(2);

    const attempt = firewall.deploy(app.teamId, app.uuid);

    await expect(attempt).rejects.toThrow();
    await attempt.catch((err) => {
      expect(isDomainError(err) && err.code).toBe('CROWDSEC_NOT_CONFIGURED');
    });
  });

  it('tells the operator what is missing', async () => {
    const app = await protectedApp(1);

    await firewall.deploy(app.teamId, app.uuid).catch((err) => {
      expect((err as Error).message).toMatch(/install crowdsec/i);
    });
  });

  it('still renders the rules, so nothing is lost', async () => {
    const app = await protectedApp(2);

    await firewall.deploy(app.teamId, app.uuid).catch(() => undefined);

    const { rows } = await testPool().query<{ generated_yaml: string | null }>(
      `SELECT r.generated_yaml FROM firewall_rules r
       JOIN firewall_configs c ON c.id = r.firewall_config_id
       JOIN applications a ON a.id = c.application_id
       WHERE a.uuid = $1`,
      [app.uuid]
    );

    expect(rows).toHaveLength(2);
    expect(rows.every((r) => (r.generated_yaml ?? '').includes('action:'))).toBe(true);
  });
});

describe('prepareRules', () => {
  it('renders each rule and says only that', async () => {
    // Named for what it does. The previous name — deploy — is what let a
    // rendering step be read as an applied one.
    const app = await protectedApp(3);

    expect(await firewall.prepareRules(app.teamId, app.uuid)).toEqual({ rules: 3 });
  });
});

describe('getEnforcementStatus', () => {
  it('reports nothing enforced while CrowdSec is unreachable', async () => {
    const app = await protectedApp(5);

    const status = await firewall.getEnforcementStatus(app.teamId, app.uuid);

    expect(status.state).toBe('not_enforced');
    expect(status.rulesConfigured).toBe(5);
    // The number that matters: rules actually filtering traffic.
    expect(status.rulesEnforced).toBe(0);
  });

  it('names the missing link rather than saying only "not enforced"', async () => {
    const app = await protectedApp(1);

    const status = await firewall.getEnforcementStatus(app.teamId, app.uuid);

    expect(status.reason).toBeTruthy();
    expect(status.lapiReachable).toBe(false);
    expect(status.bouncerRegistered).toBe(false);
  });

  it('does not become enforced merely because the config is enabled', async () => {
    // Enabling the firewall is a statement of intent, not of effect.
    const app = await protectedApp(2);
    await firewall.updateConfig(app.teamId, app.uuid, { enabled: true });

    expect((await firewall.getEnforcementStatus(app.teamId, app.uuid)).state).toBe('not_enforced');
  });

  it('reports which rules could never be enforced, and why', async () => {
    // The rule builder only produces path conditions, so this is the common case.
    const team = await makeTeam();
    const server = await makeManagedServer();
    const project = await makeProject(team.id);
    const app = await makeApplication(project.environmentId, server.destinationId);
    await firewall.updateConfig(team.id, app.uuid, { enabled: true });
    await firewall.createRule(team.id, app.uuid, {
      name: 'block-admin-path',
      conditions: [{ field: 'request_path', operator: 'equals', value: '/admin' }],
      action: 'block',
    });

    const status = await firewall.getEnforcementStatus(team.id, app.uuid);

    expect(status.unsupported).toHaveLength(1);
    expect(status.unsupported[0].reason).toMatch(/AppSec/);
  });

  it('reports a disabled firewall as turned off, not as broken', async () => {
    const app = await protectedApp(1);
    await firewall.updateConfig(app.teamId, app.uuid, { enabled: false });

    const status = await firewall.getEnforcementStatus(app.teamId, app.uuid);

    expect(status.state).toBe('not_enforced');
    expect(status.reason).toMatch(/turned off/i);
  });
});

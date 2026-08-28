/**
 * Firewall observability.
 *
 * Two properties matter. Alerts must import **idempotently**, because the sync
 * runs on a schedule and on demand — an incident duplicated on every pass buries
 * the one an operator is looking for. And retention must actually delete, because
 * traffic rows arrive per event and a table nobody prunes fills the disk of the
 * machine running the API.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import * as observability from '../../api/services/firewall-observability.service';
import { CrowdSecLapiClient } from '../../api/services/crowdsec-lapi.client';
import { isTestDatabaseAvailable, testPool, truncateAll } from '../helpers/db';
import { makeApplication, makeManagedServer, makeProject, makeTeam } from '../helpers/factories';
import { StubServer } from '../helpers/stub-server';
import { closeInfrastructure } from '../helpers/teardown';

const stub = new StubServer();
let client: CrowdSecLapiClient;

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
  client = new CrowdSecLapiClient({ baseUrl: stub.url, apiKey: 'k', timeoutMs: 2000 });
});

/** An application row to hang observability data off. */
async function anApplication(): Promise<number> {
  const team = await makeTeam();
  const server = await makeManagedServer();
  const project = await makeProject(team.id);
  const app = await makeApplication(project.environmentId, server.destinationId);
  return app.id;
}

function crowdsecAlert(id: number, ip = '203.0.113.5'): Record<string, unknown> {
  return {
    id,
    scenario: 'crowdsecurity/http-probing',
    message: 'HTTP probing detected',
    created_at: '2026-01-01T10:00:00Z',
    source: { value: ip, scope: 'ip' },
  };
}

async function countIn(table: string, applicationId: number): Promise<number> {
  const { rows } = await testPool().query<{ n: string }>(
    `SELECT count(*)::text AS n FROM ${table} WHERE application_id = $1`,
    [applicationId]
  );
  return Number(rows[0].n);
}

describe('syncAlerts', () => {
  it('imports what CrowdSec detected', async () => {
    const applicationId = await anApplication();
    stub.on('GET', '/v1/alerts', { body: [crowdsecAlert(1), crowdsecAlert(2, '203.0.113.6')] });

    const result = await observability.syncAlerts(applicationId, client);

    expect(result.imported).toBe(2);
    expect(await countIn('firewall_alerts', applicationId)).toBe(2);
  });

  it('does not duplicate an alert already recorded', async () => {
    // The sync runs on a schedule and on demand; duplicates would bury the
    // incident an operator is actually looking for.
    const applicationId = await anApplication();
    stub.on('GET', '/v1/alerts', { body: [crowdsecAlert(1)] });

    await observability.syncAlerts(applicationId, client);
    const second = await observability.syncAlerts(applicationId, client);

    expect(second.imported).toBe(0);
    expect(second.skipped).toBe(1);
    expect(await countIn('firewall_alerts', applicationId)).toBe(1);
  });

  it('records the address, scenario and message', async () => {
    const applicationId = await anApplication();
    stub.on('GET', '/v1/alerts', { body: [crowdsecAlert(1)] });

    await observability.syncAlerts(applicationId, client);

    const { rows } = await testPool().query<{
      ip_address: string;
      scenario: string;
      message: string;
    }>(// `host()`, not `::text`: a raw `inet` renders as `203.0.113.5/32`, which is
      // what the service normalises away before returning it.
      'SELECT host(ip_address) AS ip_address, scenario, message FROM firewall_alerts WHERE application_id = $1', [
      applicationId,
    ]);
    expect(rows[0]).toMatchObject({
      ip_address: '203.0.113.5',
      scenario: 'crowdsecurity/http-probing',
      message: 'HTTP probing detected',
    });
  });

  it('skips an alert with no address rather than inventing one', async () => {
    // The column is `inet NOT NULL`; a placeholder would be a fabricated fact
    // sitting in a security log.
    const applicationId = await anApplication();
    stub.on('GET', '/v1/alerts', { body: [{ id: 9, scenario: 'x', source: {} }] });

    const result = await observability.syncAlerts(applicationId, client);

    expect(result.imported).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it('keeps two applications’ alerts apart', async () => {
    const [first, second] = [await anApplication(), await anApplication()];
    stub.on('GET', '/v1/alerts', { body: [crowdsecAlert(1)] });

    await observability.syncAlerts(first, client);

    expect(await countIn('firewall_alerts', first)).toBe(1);
    expect(await countIn('firewall_alerts', second)).toBe(0);
  });
});

describe('queryTraffic', () => {
  /** Insert a traffic row directly: this suite is about reading, not writing. */
  async function addTraffic(
    applicationId: number,
    values: { ip: string; decision: string; ageDays?: number }
  ): Promise<void> {
    await testPool().query(
      `INSERT INTO firewall_traffic_logs (application_id, ip_address, decision, timestamp)
       VALUES ($1, $2::inet, $3, now() - ($4 || ' days')::interval)`,
      [applicationId, values.ip, values.decision, String(values.ageDays ?? 0)]
    );
  }

  it('returns the application’s entries, newest first', async () => {
    const applicationId = await anApplication();
    await addTraffic(applicationId, { ip: '203.0.113.1', decision: 'blocked', ageDays: 2 });
    await addTraffic(applicationId, { ip: '203.0.113.2', decision: 'blocked', ageDays: 0 });

    const rows = await observability.queryTraffic(applicationId);

    expect(rows).toHaveLength(2);
    expect(String(rows[0].ip_address)).toBe('203.0.113.2');
  });

  it('filters by address', async () => {
    const applicationId = await anApplication();
    await addTraffic(applicationId, { ip: '203.0.113.1', decision: 'blocked' });
    await addTraffic(applicationId, { ip: '203.0.113.2', decision: 'blocked' });

    const rows = await observability.queryTraffic(applicationId, { ip: '203.0.113.1' });

    expect(rows).toHaveLength(1);
  });

  it('filters by decision', async () => {
    const applicationId = await anApplication();
    await addTraffic(applicationId, { ip: '203.0.113.1', decision: 'blocked' });
    await addTraffic(applicationId, { ip: '203.0.113.2', decision: 'allowed' });

    expect(await observability.queryTraffic(applicationId, { decision: 'blocked' })).toHaveLength(1);
  });

  it('caps the page size, so one request cannot pull the whole table', async () => {
    const applicationId = await anApplication();
    for (let i = 0; i < 5; i++) {
      await addTraffic(applicationId, { ip: `203.0.113.${i + 1}`, decision: 'blocked' });
    }

    expect(await observability.queryTraffic(applicationId, { limit: 2 })).toHaveLength(2);
  });

  it('never returns another application’s traffic', async () => {
    const [mine, theirs] = [await anApplication(), await anApplication()];
    await addTraffic(theirs, { ip: '203.0.113.9', decision: 'blocked' });

    expect(await observability.queryTraffic(mine)).toEqual([]);
  });
});

describe('purgeExpired', () => {
  async function addOldTraffic(applicationId: number, ageDays: number): Promise<void> {
    await testPool().query(
      `INSERT INTO firewall_traffic_logs (application_id, ip_address, decision, timestamp)
       VALUES ($1, '203.0.113.1'::inet, 'blocked', now() - ($2 || ' days')::interval)`,
      [applicationId, String(ageDays)]
    );
  }

  it('deletes traffic past the retention window', async () => {
    const applicationId = await anApplication();
    await addOldTraffic(applicationId, observability.TRAFFIC_RETENTION_DAYS + 1);
    await addOldTraffic(applicationId, 0);

    const result = await observability.purgeExpired();

    expect(result.trafficRemoved).toBe(1);
    expect(await countIn('firewall_traffic_logs', applicationId)).toBe(1);
  });

  it('keeps an unresolved alert however old it is', async () => {
    // An incident nobody has looked at does not stop mattering with age.
    const applicationId = await anApplication();
    await testPool().query(
      `INSERT INTO firewall_alerts
         (application_id, alert_type, severity, ip_address, status, created_at, updated_at)
       VALUES ($1, 'crowdsec', 'high', '203.0.113.1'::inet, 'open',
               now() - ($2 || ' days')::interval, now())`,
      [applicationId, String(observability.ALERT_RETENTION_DAYS + 10)]
    );

    await observability.purgeExpired();

    expect(await countIn('firewall_alerts', applicationId)).toBe(1);
  });

  it('deletes a resolved alert past the window', async () => {
    const applicationId = await anApplication();
    await testPool().query(
      `INSERT INTO firewall_alerts
         (application_id, alert_type, severity, ip_address, status, created_at, updated_at)
       VALUES ($1, 'crowdsec', 'low', '203.0.113.1'::inet, 'resolved',
               now() - ($2 || ' days')::interval, now())`,
      [applicationId, String(observability.ALERT_RETENTION_DAYS + 1)]
    );

    const result = await observability.purgeExpired();

    expect(result.alertsRemoved).toBe(1);
  });

  it('does nothing when everything is within the window', async () => {
    const applicationId = await anApplication();
    await addOldTraffic(applicationId, 0);

    expect(await observability.purgeExpired()).toEqual({ trafficRemoved: 0, alertsRemoved: 0 });
  });
});

describe('refreshCounters', () => {
  it('derives the counters instead of incrementing them', async () => {
    // A counter that only goes up drifts from reality the first time a write is
    // lost, and nothing surfaces the drift.
    const applicationId = await anApplication();
    await testPool().query(
      `INSERT INTO firewall_traffic_logs (application_id, ip_address, decision, timestamp)
       VALUES ($1, '203.0.113.1'::inet, 'blocked', now()),
              ($1, '203.0.113.2'::inet, 'blocked', now()),
              ($1, '203.0.113.3'::inet, 'allowed', now())`,
      [applicationId]
    );
    await testPool().query(
      `INSERT INTO firewall_configs (application_id, total_blocked, created_at, updated_at)
       VALUES ($1, 999, now(), now())`,
      [applicationId]
    );
    stub.on('GET', '/v1/decisions', { body: [{ type: 'ban', value: '203.0.113.1', scope: 'ip' }] });

    const counters = await observability.refreshCounters(applicationId, client);

    expect(counters.totalBlocked).toBe(2);
    expect(counters.activeDecisions).toBe(1);

    // The stale 999 is replaced, not added to.
    const { rows } = await testPool().query<{ total_blocked: number }>(
      'SELECT total_blocked FROM firewall_configs WHERE application_id = $1',
      [applicationId]
    );
    expect(Number(rows[0].total_blocked)).toBe(2);
  });
});

describe('toCsv', () => {
  it('emits a header and one row per entry', () => {
    const csv = observability.toCsv([
      { timestamp: '2026-01-01T10:00:00Z', ip_address: '203.0.113.1', decision: 'blocked' },
    ]);

    expect(csv.split('\n')[0]).toContain('timestamp,ip_address,decision');
    expect(csv.split('\n')).toHaveLength(2);
  });

  it('quotes values that would otherwise break the row apart', () => {
    // A URI containing a comma is ordinary; splitting the row on it is not.
    const csv = observability.toCsv([{ uri: '/search?a=1,b=2', decision: 'blocked' }]);

    expect(csv).toContain('"/search?a=1,b=2"');
  });

  it('escapes an embedded quote', () => {
    const csv = observability.toCsv([{ uri: '/a"b' }]);

    expect(csv).toContain('"/a""b"');
  });

  it('renders a missing value as empty rather than "undefined"', () => {
    const csv = observability.toCsv([{ decision: 'blocked' }]);

    expect(csv).not.toContain('undefined');
  });
});

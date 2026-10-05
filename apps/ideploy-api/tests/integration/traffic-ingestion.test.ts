/**
 * Reading the proxy's access log into per-minute counts and blocked requests.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import redis from '../../api/config/redis.config';
import { ingestServer, trafficStats } from '../../api/services/traffic-ingestion.service';
import { FakeRemoteExecutor } from '../helpers/fake-executor';
import { setRemoteExecutor } from '../../api/ssh/ssh';
import { isTestDatabaseAvailable, testPool, truncateAll } from '../helpers/db';
import { makeApplication, makeManagedServer, makeProject, makeTeam } from '../helpers/factories';
import { closeInfrastructure } from '../helpers/teardown';
import { PrivateKeyRow, ServerRow } from '../../api/models/ideploy.types';

let ssh: FakeRemoteExecutor;

beforeAll(async () => {
  if (!(await isTestDatabaseAvailable())) throw new Error('Integration tests need the test database.');
});
beforeEach(async () => {
  await truncateAll();
  ssh = new FakeRemoteExecutor();
  setRemoteExecutor(ssh);
});
afterAll(async () => closeInfrastructure());

async function setup() {
  const team = await makeTeam();
  const server = await makeManagedServer();
  const project = await makeProject(team.id);
  const app = await makeApplication(project.environmentId, server.destinationId);
  await redis.del(`ideploy:traffic-offset:${server.id}`);
  const row = { id: server.id, uuid: 'srv', name: 'srv', ip: '203.0.113.10', port: 22, user: 'root' } as unknown as ServerRow;
  return { app, server: row, key: {} as PrivateKeyRow };
}

const now = new Date();
now.setUTCSeconds(30, 0);
const entry = (uuid: string, fields: Record<string, unknown>) =>
  JSON.stringify({
    RouterName: `https-0-${uuid}@docker`,
    ClientHost: '198.51.100.4',
    RequestMethod: 'GET',
    RequestPath: '/admin',
    RequestHost: 'shop.example.com',
    StartUTC: now.toISOString(),
    ...fields,
  });

describe('ingestServer', () => {
  it('counts allowed and blocked requests, keeps the blocked ones, and reads only what is new', async () => {
    const { app, server, key } = await setup();
    const log =
      [
        entry(app.uuid, { DownstreamStatus: 200, OriginStatus: 200 }),
        entry(app.uuid, { DownstreamStatus: 200, OriginStatus: 200 }),
        entry(app.uuid, { DownstreamStatus: 403 }),
      ].join('\n') + '\n';
    ssh.on(/stat -c %s/, { stdout: String(Buffer.byteLength(log)) });
    ssh.on(/tail -c \+1 /, { stdout: log });

    await testPool().query('INSERT INTO firewall_configs (application_id, created_at, updated_at) VALUES ($1, now(), now())', [app.id]);
    const first = await ingestServer(server, key);
    expect(first).toEqual({ requests: 3, blocked: 1 });

    const stats = await trafficStats(app.id, 24);
    expect(stats.totals).toEqual({ requests: 3, blocked: 1 });
    const kept = await testPool().query(
      'SELECT decision, status_code, rule_name FROM firewall_traffic_logs WHERE application_id = $1 ORDER BY decision',
      [app.id]
    );
    // Blocked ones in detail, and the allowed ones for "Recent traffic", with their status.
    expect(kept.rows).toEqual([
      { decision: 'allowed', status_code: 200, rule_name: null },
      { decision: 'allowed', status_code: 200, rule_name: null },
      { decision: 'blocked', status_code: 403, rule_name: 'firewall' },
    ]);

    // The counters every screen shows move with the ingestion itself.
    const totals = await testPool().query('SELECT total_requests, total_blocked FROM firewall_configs WHERE application_id = $1', [app.id]);
    expect(totals.rows[0]).toMatchObject({ total_requests: '3', total_blocked: '1' });

    // Nothing new: nothing read twice.
    const second = await ingestServer(server, key);
    expect(second).toEqual({ requests: 0, blocked: 0 });
    // The day's series covers the whole range, empty intervals included.
    const day = await trafficStats(app.id, 24);
    expect(day.buckets.length).toBeGreaterThanOrEqual(96);
    expect(day.bucketMinutes).toBe(15);
    expect((await trafficStats(app.id, 24)).totals.requests).toBe(3);
  });

  it('starts over when the log was rotated', async () => {
    const { server, key } = await setup();
    await redis.set(`ideploy:traffic-offset:${server.id}`, '5000');
    ssh.on(/stat -c %s/, { stdout: '0' });

    await ingestServer(server, key);

    expect(await redis.get(`ideploy:traffic-offset:${server.id}`)).toBe('0');
  });
});

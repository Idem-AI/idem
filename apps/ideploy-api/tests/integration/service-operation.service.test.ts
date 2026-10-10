/**
 * A service start: the `.env` that Compose needs is always written, the
 * variables are stored encrypted, and the console output is recorded.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import * as serviceService from '../../api/services/service.service';
import * as serviceEnv from '../../api/services/service-env.service';
import * as operations from '../../api/services/service-operation.service';
import { setRemoteExecutor } from '../../api/ssh/ssh';
import { FakeRemoteExecutor } from '../helpers/fake-executor';
import { isTestDatabaseAvailable, testPool, truncateAll } from '../helpers/db';
import { makeManagedServer, makeProject, makeTeam } from '../helpers/factories';
import { closeInfrastructure } from '../helpers/teardown';

const COMPOSE = 'services:\n  api:\n    image: acme/api\n    env_file: .env\n    environment:\n      DB: ${DB_PASSWORD:-x}\n';

let ssh: FakeRemoteExecutor;

beforeAll(async () => {
  if (!(await isTestDatabaseAvailable())) throw new Error('Integration tests need the test database.');
});
beforeEach(async () => {
  await truncateAll();
  ssh = new FakeRemoteExecutor();
  ssh.on(/compose ps/, { stdout: '{"Service":"api","State":"running"}' });
  setRemoteExecutor(ssh);
});
afterAll(async () => {
  await closeInfrastructure();
});

async function aService() {
  const team = await makeTeam();
  const server = await makeManagedServer();
  const project = await makeProject(team.id);
  const service = await serviceService.createService(team.id, {
    name: 'custom',
    environment_id: project.environmentId,
    destination_id: server.destinationId,
    docker_compose_raw: COMPOSE,
  });
  return { teamId: team.id, service };
}

async function finished(teamId: number, uuid: string) {
  for (let i = 0; i < 100; i++) {
    const op = await operations.latest(teamId, uuid);
    if (op && op.status !== 'running') return op;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('operation did not finish');
}

describe('service variables', () => {
  it('are stored encrypted and read back', async () => {
    const { teamId, service } = await aService();
    await serviceEnv.replaceForService(teamId, service.uuid, [{ key: 'DB_PASSWORD', value: 'p$ss' }]);
    const { rows } = await testPool().query("SELECT value FROM environment_variables WHERE resourceable_type = 'App\\Models\\Service'");
    expect(rows[0].value).not.toContain('p$ss');
    expect(await serviceEnv.listForService(teamId, service.uuid)).toEqual([{ key: 'DB_PASSWORD', value: 'p$ss' }]);
  });

  it('refuse an invalid or duplicated name', async () => {
    const { teamId, service } = await aService();
    await expect(serviceEnv.replaceForService(teamId, service.uuid, [{ key: '1X', value: '' }])).rejects.toThrow(/valid variable name/);
    await expect(
      serviceEnv.replaceForService(teamId, service.uuid, [{ key: 'A', value: '' }, { key: 'A', value: '' }])
    ).rejects.toThrow(/twice/);
  });
});

describe('starting a service', () => {
  it('writes the .env before compose up and records the console', async () => {
    const { teamId, service } = await aService();
    await serviceEnv.replaceForService(teamId, service.uuid, [{ key: 'DB_PASSWORD', value: 'secret-1' }]);

    const started = await operations.begin(teamId, service.uuid, 'start');
    expect(started.status).toBe('running');
    const op = await finished(teamId, service.uuid);

    expect(op.status).toBe('succeeded');
    expect(op.output).toMatch(/Writing \.env \(1 variable\)/);
    const command = ssh.calls.map((c) => c.command).find((c) => c.includes('docker compose up'))!;
    expect(command.indexOf('/.env')).toBeGreaterThan(-1);
    expect(command.indexOf('/.env')).toBeLessThan(command.indexOf('docker compose up'));
    const b64 = /echo '([^']+)' \| base64 -d > \S+\/\.env/.exec(command)![1];
    expect(Buffer.from(b64, 'base64').toString()).toBe("DB_PASSWORD='secret-1'\n");
    // The value is never part of what the console shows.
    expect(op.output).not.toContain('secret-1');
  });

  it('still writes an empty .env when no variable is set', async () => {
    const { teamId, service } = await aService();
    await operations.begin(teamId, service.uuid, 'start');
    await finished(teamId, service.uuid);
    expect(ssh.calls.some((c) => /base64 -d > \S+\/\.env/.test(c.command))).toBe(true);
  });

  it('records a failure with its output, and refuses a second operation while one runs', async () => {
    const { teamId, service } = await aService();
    ssh.on(/docker compose up/, { exitCode: 1 }, ['env file .env not found']);
    await operations.begin(teamId, service.uuid, 'start');
    await expect(operations.begin(teamId, service.uuid, 'stop')).rejects.toThrow(/already running/);
    const op = await finished(teamId, service.uuid);
    expect(op.status).toBe('failed');
    expect(op.output).toContain('env file .env not found');
  });
});

describe('editing the compose file', () => {
  it('stores it and lists the containers it now declares', async () => {
    const { teamId, service } = await aService();
    await serviceService.updateCompose(teamId, service.uuid, 'services:\n  web:\n    image: nginx\n  worker:\n    image: acme/worker\n');
    const { rows } = await testPool().query('SELECT name FROM service_applications WHERE service_id = $1 ORDER BY name', [service.id]);
    expect(rows.map((r) => r.name)).toEqual(['web', 'worker']);
    expect(await serviceService.updateCompose(teamId, '00000000-0000-0000-0000-000000000000', 'services: {}')).toBeNull();
  });
});

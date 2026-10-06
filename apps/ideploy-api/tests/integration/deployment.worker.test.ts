/**
 * The deployment worker, through a fake SSH executor.
 *
 * What must hold:
 *   - a build that fails never touches the version that is serving;
 *   - the application's secrets never appear in what is run or shown;
 *   - a requested commit is the one deployed, and the deployed commit is kept,
 *     so a later rollback has something to go back to;
 *   - every Compose command targets the application's own project.
 */
import type { Job } from 'bullmq';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { processDeployment } from '../../api/jobs/deployment.worker';
import * as envVarService from '../../api/services/env-var.service';
import { createDeployment, DeploymentJobData } from '../../api/services/deployment.service';
import * as pipelineService from '../../api/services/pipeline.service';
import { setRemoteExecutor } from '../../api/ssh/ssh';
import { FakeRemoteExecutor } from '../helpers/fake-executor';
import { isTestDatabaseAvailable, testPool, truncateAll } from '../helpers/db';
import { makeApplication, makeManagedServer, makeProject, makeTeam } from '../helpers/factories';
import { closeInfrastructure } from '../helpers/teardown';

const SHA = 'a3f1c9e2b7d4085f6c1e2d3b4a5968778695a4b3';

let ssh: FakeRemoteExecutor;

beforeAll(async () => {
  if (!(await isTestDatabaseAvailable())) {
    throw new Error('Integration tests need the test database (scripts/prepare-test-db.sh).');
  }
});

/** A fake server whose container listens on the given /proc/net/tcp content. */
function useExecutor(listening: string): void {
  ssh = new FakeRemoteExecutor();
  // First match wins: the port probe also runs `compose ps -q`, so it goes first.
  ssh.on(/\/net\/tcp/, { stdout: listening });
  ssh.on(/compose -p \S+ ps/, { stdout: '{"Service":"web","State":"running","ExitCode":0,"Health":""}' });
  ssh.on(/compose -p \S+ logs/, { stdout: 'Server listening on http://0.0.0.0:3000' });
  ssh.on(/git fetch/, { stdout: `COMMIT=${SHA}\n` });
  setRemoteExecutor(ssh);
}

/** The container listens on 3000, the port it was given. */
const LISTENING_3000 = '  sl  local_address rem_address   st\n   0: 00000000:0BB8 00000000:0000 0A 0 0 0\n';

beforeEach(async () => {
  await truncateAll();
  useExecutor(LISTENING_3000);
});

afterAll(async () => {
  await closeInfrastructure();
});

async function anApplication(status = 'running') {
  const team = await makeTeam();
  const server = await makeManagedServer();
  const project = await makeProject(team.id);
  const app = await makeApplication(project.environmentId, server.destinationId);
  await testPool().query('UPDATE applications SET status = $2 WHERE id = $1', [app.id, status]);
  return { teamId: team.id, app };
}

async function run(
  teamId: number,
  app: { id: number; uuid: string },
  commit = 'HEAD'
): Promise<{ deploymentUuid: string; outcome: Promise<void> }> {
  const { deploymentUuid } = await createDeployment(app, teamId, { commit });
  const outcome = processDeployment({
    data: { deploymentUuid, applicationId: app.id, applicationUuid: app.uuid, teamId, commit, forceRebuild: false },
  } as Job<DeploymentJobData>);
  return { deploymentUuid, outcome };
}

async function row(deploymentUuid: string) {
  const { rows } = await testPool().query(
    'SELECT status, commit, finished_at, logs FROM application_deployment_queues WHERE deployment_uuid = $1',
    [deploymentUuid]
  );
  return rows[0];
}

describe('a build that fails', () => {
  it('leaves the serving version and the application status alone', async () => {
    const { teamId, app } = await anApplication('running');
    ssh.on(/nixpacks|docker build/, { exitCode: 1, stderr: 'npm ERR! missing script: build' });

    const { deploymentUuid, outcome } = await run(teamId, app);
    await expect(outcome).rejects.toThrow(/failed/);

    // Built in its own release; the application's directory was never wiped,
    // and nothing was brought up or down.
    expect(ssh.ranMatching(new RegExp(`rm -rf '?/data/ideploy/applications/${app.uuid}'? `))).toBe(false);
    expect(ssh.ranMatching(/releases\//)).toBe(true);
    expect(ssh.ranMatching(/compose -p \S+ (up|down)/)).toBe(false);

    const { rows } = await testPool().query('SELECT status FROM applications WHERE id = $1', [app.id]);
    expect(rows[0].status).toBe('running');
    const deployment = await row(deploymentUuid);
    expect(deployment.status).toBe('failed');
    expect(deployment.finished_at).not.toBeNull();
    // The log stays with the deployment, ending with the cause.
    expect(deployment.logs).toMatch(/Deployment failed: .*failed/);
  });
});

describe('the root directory', () => {
  it('builds from the folder that holds a file named as root directory, and says so', async () => {
    // Saved from a free-text field as "./Dockerfile": every deployment failed
    // on `cd: …/Dockerfile: Not a directory`.
    const { teamId, app } = await anApplication('exited');
    await testPool().query("UPDATE applications SET base_directory = './Dockerfile' WHERE id = $1", [app.id]);
    ssh.on(/KIND=dir/, { stdout: 'KIND=file\n' });

    const { deploymentUuid, outcome } = await run(teamId, app);
    await outcome;

    expect(ssh.ranMatching(/cd '[^']*\/src\/Dockerfile'/)).toBe(false);
    expect((await row(deploymentUuid)).logs).toMatch(/root directory "\.\/Dockerfile" is a file/);
  }, 45_000);

  it('fails with what to set when the folder does not exist', async () => {
    const { teamId, app } = await anApplication('exited');
    await testPool().query("UPDATE applications SET base_directory = 'backend' WHERE id = $1", [app.id]);
    ssh.on(/KIND=dir/, { stdout: 'KIND=none\n' });

    const { outcome } = await run(teamId, app);
    await expect(outcome).rejects.toThrow(/root directory "backend" does not exist/);
  });
});

describe('the port the application listens on', () => {
  it('routes to the port the container really listens on, whatever was configured', async () => {
    // A home-grown server on 4721, with the default 3000 configured: it used to be a 502.
    const { teamId, app } = await anApplication('exited');
    useExecutor('  sl  local_address rem_address   st\n   0: 00000000:1271 00000000:0000 0A 0 0 0\n   1: 0100007F:1F90 00000000:0000 0A 0 0 0\n');

    const { deploymentUuid, outcome } = await run(teamId, app);
    await outcome;

    const { rows } = await testPool().query('SELECT ports_exposes FROM applications WHERE id = $1', [app.id]);
    expect(rows[0].ports_exposes).toBe('4721');
    expect((await row(deploymentUuid)).logs).toMatch(/listens there, not on 3000.*routing to 4721/);
    // Rewritten and brought up again with the real port.
    const rewrites = ssh.calls.filter((c) => c.command.includes('base64 -d >'));
    const last = Buffer.from(/echo '([^']+)'/.exec(rewrites[rewrites.length - 1].command)![1], 'base64').toString();
    expect(last).toContain('PORT=4721');
  }, 60_000);
});

describe('the image scan of a pipeline deployment', () => {
  async function runFromPipeline(teamId: number, app: { id: number; uuid: string }, executionId: number) {
    const { deploymentUuid } = await createDeployment(app, teamId, { commit: 'HEAD', pipelineExecutionId: executionId });
    const outcome = processDeployment({
      data: { deploymentUuid, applicationId: app.id, applicationUuid: app.uuid, teamId, commit: 'HEAD', forceRebuild: false, pipelineExecutionId: executionId },
    } as Job<DeploymentJobData>);
    return { deploymentUuid, outcome };
  }

  async function anExecution(teamId: number, appUuid: string): Promise<number> {
    const { executionUuid } = await pipelineService.trigger(teamId, appUuid, { branch: 'main' });
    const { rows } = await testPool().query('SELECT id FROM pipeline_executions WHERE uuid = $1', [executionUuid]);
    return Number(rows[0].id);
  }

  it('records the scan and stops before switching when the image has a critical vulnerability', async () => {
    const { teamId, app } = await anApplication('running');
    const executionId = await anExecution(teamId, app.uuid);
    ssh.on(/aquasec\/trivy.*image/, {
      stdout: JSON.stringify({ Results: [{ Target: 'alpine', Vulnerabilities: [{ VulnerabilityID: 'CVE-1', PkgName: 'openssl', InstalledVersion: '3.0', Severity: 'CRITICAL' }] }] }),
    });

    const { outcome } = await runFromPipeline(teamId, app, executionId);
    await expect(outcome).rejects.toThrow(/vulnerabilities at or above CRITICAL/);

    const scan = await testPool().query("SELECT status, critical_count FROM pipeline_scan_results WHERE tool = 'trivy-image'");
    expect(scan.rows[0]).toMatchObject({ status: 'failed', critical_count: 1 });
    // Nothing was switched: the serving version and status stay.
    expect(ssh.ranMatching(/compose -p \S+ up/)).toBe(false);
    const { rows } = await testPool().query('SELECT status FROM applications WHERE id = $1', [app.id]);
    expect(rows[0].status).toBe('running');
  });

  it('deploys when the image is clean, and a normal deployment never runs the scan', async () => {
    const { teamId, app } = await anApplication('exited');
    const executionId = await anExecution(teamId, app.uuid);
    ssh.on(/aquasec\/trivy.*image/, { stdout: JSON.stringify({ Results: [] }) });

    const { outcome } = await runFromPipeline(teamId, app, executionId);
    await outcome;
    expect(ssh.ranMatching(/aquasec\/trivy.*image/)).toBe(true);

    ssh.clear();
    useExecutor(LISTENING_3000);
    const plain = await run(teamId, app);
    await plain.outcome;
    expect(ssh.ranMatching(/aquasec\/trivy/)).toBe(false);
  }, 90_000);
});

describe('a deployment that succeeds', () => {
  it('deploys the requested commit, keeps it, never prints secrets, and stays on its project', async () => {
    const { teamId, app } = await anApplication('exited');
    await envVarService.upsertForApplication(teamId, app.uuid, {
      key: 'API_SECRET',
      value: 'very-secret-value',
      is_runtime: true,
      // Runtime only: it reaches the container through the compose file alone.
      is_buildtime: false,
    });

    const { deploymentUuid, outcome } = await run(teamId, app, SHA);
    await outcome;

    // The commit asked for is fetched, not the branch's latest.
    expect(ssh.ranMatching(new RegExp(`git fetch -q --depth 1 origin '${SHA}'`))).toBe(true);
    const deployment = await row(deploymentUuid);
    expect(deployment.status).toBe('finished');
    expect(deployment.commit).toBe(SHA);
    const { rows } = await testPool().query('SELECT status, git_commit_sha FROM applications WHERE id = $1', [app.id]);
    expect(rows[0]).toMatchObject({ status: 'running', git_commit_sha: SHA });

    // The compose file carries the secret: it is written, never printed.
    expect(ssh.calls.some((c) => c.command.includes('very-secret-value'))).toBe(false);
    expect(ssh.ranMatching(/cat \S*docker-compose\.yml/)).toBe(false);

    // The log is kept, and old images of this application only are removed.
    expect(deployment.logs).toContain('Deployment finished successfully');
    expect(ssh.ranMatching(new RegExp(`docker images 'ideploy-${app.uuid.toLowerCase()}'.*docker rmi`))).toBe(true);

    // Every compose command on the stack names the application's project.
    const composeCalls = ssh.calls.filter((c) => /docker compose (?!version)/.test(c.command));
    expect(composeCalls.length).toBeGreaterThan(0);
    for (const call of composeCalls) {
      expect(call.command).toContain(`-p '${app.uuid.toLowerCase()}'`);
    }
  }, 45_000);
});

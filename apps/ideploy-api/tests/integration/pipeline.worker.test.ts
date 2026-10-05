/**
 * The pipeline worker, through a fake SSH executor.
 *
 *   - the deploy stage deploys the commit the pipeline cloned — it passed the
 *     branch name, which the deployment worker refuses as a commit id;
 *   - SonarQube is never reported as passed when no analysis ran.
 */
import type { Job } from 'bullmq';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { processPipeline } from '../../api/jobs/pipeline.worker';
import * as pipelineService from '../../api/services/pipeline.service';
import { PipelineJobData } from '../../api/services/pipeline.service';
import { setRemoteExecutor } from '../../api/ssh/ssh';
import { FakeRemoteExecutor } from '../helpers/fake-executor';
import { isTestDatabaseAvailable, testPool, truncateAll } from '../helpers/db';
import { makeApplication, makeManagedServer, makeProject, makeTeam } from '../helpers/factories';
import { closeInfrastructure } from '../helpers/teardown';
import { StubServer } from '../helpers/stub-server';

const SHA = '9c2b7a1e4f3d5a6b8c0e1f2a3b4c5d6e7f809112';
let ssh: FakeRemoteExecutor;
const sonar = new StubServer();

beforeAll(async () => {
  if (!(await isTestDatabaseAvailable())) throw new Error('Integration tests need the test database.');
  await sonar.start();
});

beforeEach(async () => {
  await truncateAll();
  sonar.reset();
  delete process.env.SONARQUBE_URL;
  delete process.env.SONARQUBE_ADMIN_TOKEN;
  ssh = new FakeRemoteExecutor();
  ssh.on(/git clone/, { stdout: `COMMIT=${SHA}\nREADME.md\n` });
  setRemoteExecutor(ssh);
});

afterAll(async () => {
  await sonar.stop();
  await closeInfrastructure();
});

async function runPipeline(stages: string[]) {
  const team = await makeTeam();
  const server = await makeManagedServer();
  const project = await makeProject(team.id);
  const app = await makeApplication(project.environmentId, server.destinationId);
  const { executionUuid } = await pipelineService.trigger(team.id, app.uuid, { branch: 'main' });
  const { rows } = await testPool().query('SELECT id FROM pipeline_executions WHERE uuid = $1', [executionUuid]);
  const data: PipelineJobData = {
    executionUuid,
    executionId: Number(rows[0].id),
    applicationId: app.id,
    applicationUuid: app.uuid,
    teamId: team.id,
    stages,
    branch: 'main',
  };
  await processPipeline({ data } as Job<PipelineJobData>);
  return { app, executionId: data.executionId };
}

describe('the pipeline', () => {
  it('deploys the commit it cloned, not the branch name', async () => {
    const { app } = await runPipeline(['language_detection', 'deploy']);

    const { rows } = await testPool().query(
      'SELECT commit FROM application_deployment_queues WHERE application_id = $1',
      [String(app.id)]
    );
    expect(rows[0].commit).toBe(SHA);
    // Quoted, and the token-bearing remote is not left on the server.
    expect(ssh.ranMatching(/git clone --depth 1 -b 'main' -- '/)).toBe(true);
    expect(ssh.ranMatching(/remote remove origin/)).toBe(true);
  });

  it('reports SonarQube as not run, never as a passed quality gate', async () => {
    const { executionId } = await runPipeline(['language_detection', 'sonarqube']);

    const { rows } = await testPool().query(
      "SELECT status FROM pipeline_jobs WHERE pipeline_execution_id = $1 AND name = 'sonarqube'",
      [executionId]
    );
    if (rows[0]) expect(rows[0].status).toBe('skipped');
    const scan = await testPool().query(
      "SELECT * FROM pipeline_scan_results WHERE pipeline_execution_id = $1 AND tool = 'sonarqube'",
      [executionId]
    );
    expect(JSON.stringify(scan.rows[0] ?? {})).not.toMatch(/"OK"/);
  });
});

describe('the scans', () => {
  it('reads Trivy\'s JSON into counts and findings, and fails on a critical one', async () => {
    ssh.on(/aquasec\/trivy/, {
      stdout: JSON.stringify({
        Results: [{ Target: 'package-lock.json', Vulnerabilities: [{ VulnerabilityID: 'CVE-9', PkgName: 'x', InstalledVersion: '1', Severity: 'CRITICAL' }] }],
      }),
    });
    const team = await makeTeam();
    const server = await makeManagedServer();
    const project = await makeProject(team.id);
    const app = await makeApplication(project.environmentId, server.destinationId);
    const { executionUuid } = await pipelineService.trigger(team.id, app.uuid, { branch: 'main' });
    const { rows } = await testPool().query('SELECT id FROM pipeline_executions WHERE uuid = $1', [executionUuid]);
    const data: PipelineJobData = {
      executionUuid, executionId: Number(rows[0].id), applicationId: app.id, applicationUuid: app.uuid,
      teamId: team.id, stages: ['language_detection', 'trivy', 'deploy'], branch: 'main',
    };

    await expect(processPipeline({ data } as Job<PipelineJobData>)).rejects.toThrow(/CRITICAL/);

    const scan = await testPool().query("SELECT status, critical_count, vulnerabilities_detail FROM pipeline_scan_results WHERE tool = 'trivy'");
    expect(scan.rows[0]).toMatchObject({ status: 'failed', critical_count: 1 });
    expect(scan.rows[0].vulnerabilities_detail[0]).toMatchObject({ id: 'CVE-9', severity: 'CRITICAL' });
    // A failed scan stops the pipeline before it deploys.
    const deployed = await testPool().query('SELECT count(*)::int AS n FROM application_deployment_queues');
    expect(deployed.rows[0].n).toBe(0);
  });

  it('runs SonarQube through its API: project, one-off token, gate and measures, token revoked', async () => {
    process.env.SONARQUBE_URL = sonar.url;
    process.env.SONARQUBE_ADMIN_TOKEN = 'admin-token';
    sonar.on('GET', '/api/system/status', { body: { status: 'UP' } });
    sonar.on('POST', '/api/projects/create', { body: {} });
    sonar.on('POST', '/api/user_tokens/generate', { body: { token: 'squ_analysis' } });
    sonar.on('POST', '/api/user_tokens/revoke', { status: 204, body: null });
    sonar.on('GET', '/api/qualitygates/project_status', { body: { projectStatus: { status: 'OK' } } });
    sonar.on('GET', '/api/measures/component', {
      body: { component: { measures: [{ metric: 'bugs', value: '3' }, { metric: 'coverage', value: '71.5' }] } },
    });

    const { executionId, app } = await runPipeline(['language_detection', 'sonarqube']);

    const scan = await testPool().query(
      "SELECT status, quality_gate_status, bugs, coverage, sonar_project_key, sonar_dashboard_url FROM pipeline_scan_results WHERE pipeline_execution_id = $1 AND tool = 'sonarqube'",
      [executionId]
    );
    expect(scan.rows[0]).toMatchObject({ status: 'success', quality_gate_status: 'OK', bugs: 3, sonar_project_key: `ideploy-${app.uuid}` });
    expect(Number(scan.rows[0].coverage)).toBe(71.5);
    expect(scan.rows[0].sonar_dashboard_url).toContain(`/dashboard?id=ideploy-${app.uuid}`);
    // The scanner got the one-off token, never the admin one, and it is revoked.
    const scanner = ssh.calls.find((c) => c.command.includes('sonar-scanner-cli'))!;
    expect(scanner.command).toContain("SONAR_TOKEN='squ_analysis'");
    expect(scanner.command).not.toContain('admin-token');
    expect(scanner.opts.redact).toContain('squ_analysis');
    expect(sonar.requests.some((r) => r.path === '/api/user_tokens/revoke')).toBe(true);
  });
});

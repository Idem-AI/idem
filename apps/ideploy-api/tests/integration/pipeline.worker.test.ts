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

const SHA = '9c2b7a1e4f3d5a6b8c0e1f2a3b4c5d6e7f809112';
let ssh: FakeRemoteExecutor;

beforeAll(async () => {
  if (!(await isTestDatabaseAvailable())) throw new Error('Integration tests need the test database.');
});

beforeEach(async () => {
  await truncateAll();
  ssh = new FakeRemoteExecutor();
  ssh.on(/git clone/, { stdout: `COMMIT=${SHA}\nREADME.md\n` });
  setRemoteExecutor(ssh);
});

afterAll(async () => {
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

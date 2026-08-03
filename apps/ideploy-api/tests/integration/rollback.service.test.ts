/**
 * Rollback.
 *
 * Reached for when production is broken, so the failure modes that matter are
 * the ones that would waste that moment: offering a deployment that itself
 * failed, or one recorded as `HEAD`, which redeploys whatever the branch points
 * at now rather than what was running before.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import * as deployments from '../../api/services/deployment.service';
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

/** An application with a deployment history, newest last. */
async function appWithHistory(
  history: Array<{ commit: string; status: string }>
): Promise<{ teamId: number; uuid: string; deploymentUuids: string[] }> {
  const team = await makeTeam();
  const server = await makeManagedServer();
  const project = await makeProject(team.id);
  const app = await makeApplication(project.environmentId, server.destinationId);

  const deploymentUuids: string[] = [];
  for (const [index, entry] of history.entries()) {
    const uuid = `deploy-${index}-${app.uuid.slice(0, 8)}`;
    await testPool().query(
      `INSERT INTO application_deployment_queues
         (application_id, deployment_uuid, pull_request_id, force_rebuild, commit, status,
          is_webhook, created_at, updated_at)
       VALUES ($1,$2,0,false,$3,$4,false, now() + ($5 || ' seconds')::interval, now())`,
      [app.id, uuid, entry.commit, entry.status, String(index)]
    );
    deploymentUuids.push(uuid);
  }

  return { teamId: team.id, uuid: app.uuid, deploymentUuids };
}

async function expectCode(promise: Promise<unknown>, code: string): Promise<void> {
  await expect(promise).rejects.toThrow();
  await promise.catch((err) => {
    expect(isDomainError(err) && err.code).toBe(code);
  });
}

describe('listRollbackTargets', () => {
  it('offers previous successful deployments, newest first', async () => {
    const app = await appWithHistory([
      { commit: 'aaa111', status: 'finished' },
      { commit: 'bbb222', status: 'finished' },
      { commit: 'ccc333', status: 'finished' },
    ]);

    const targets = await deployments.listRollbackTargets(app.teamId, app.uuid);

    // The newest is excluded: it is what you are rolling back *from*.
    expect(targets.map((t) => t.commit)).toEqual(['bbb222', 'aaa111']);
  });

  it('never offers a deployment that failed', async () => {
    // Rolling back to a failure reproduces the failure.
    const app = await appWithHistory([
      { commit: 'good111', status: 'finished' },
      { commit: 'bad222', status: 'failed' },
      { commit: 'current', status: 'finished' },
    ]);

    const targets = await deployments.listRollbackTargets(app.teamId, app.uuid);

    expect(targets.map((t) => t.commit)).toEqual(['good111']);
  });

  it('offers nothing when there is no history to return to', async () => {
    const app = await appWithHistory([{ commit: 'only', status: 'finished' }]);

    expect(await deployments.listRollbackTargets(app.teamId, app.uuid)).toEqual([]);
  });

  it('does not leak another team’s history', async () => {
    const app = await appWithHistory([
      { commit: 'aaa', status: 'finished' },
      { commit: 'bbb', status: 'finished' },
    ]);
    const stranger = await makeTeam();

    expect(await deployments.listRollbackTargets(stranger.id, app.uuid)).toEqual([]);
  });
});

describe('rollbackTo', () => {
  it('queues a rebuild of the chosen commit', async () => {
    const app = await appWithHistory([
      { commit: 'aaa111', status: 'finished' },
      { commit: 'current', status: 'finished' },
    ]);

    const result = await deployments.rollbackTo(app.teamId, app.uuid, app.deploymentUuids[0]);

    expect(result.commit).toBe('aaa111');
    expect(result.deploymentUuid).toBeTruthy();
  });

  it('records the new deployment as a rollback', async () => {
    const app = await appWithHistory([
      { commit: 'aaa111', status: 'finished' },
      { commit: 'current', status: 'finished' },
    ]);

    const result = await deployments.rollbackTo(app.teamId, app.uuid, app.deploymentUuids[0]);

    const { rows } = await testPool().query<{ rollback: boolean; commit: string }>(
      'SELECT rollback, commit FROM application_deployment_queues WHERE deployment_uuid = $1',
      [result.deploymentUuid]
    );
    expect(rows[0].rollback).toBe(true);
    expect(rows[0].commit).toBe('aaa111');
  });

  it('refuses a deployment that never succeeded', async () => {
    const app = await appWithHistory([
      { commit: 'bad', status: 'failed' },
      { commit: 'current', status: 'finished' },
    ]);

    await expectCode(
      deployments.rollbackTo(app.teamId, app.uuid, app.deploymentUuids[0]),
      'NOT_ROLLBACKABLE'
    );
  });

  it('refuses a deployment recorded only as HEAD', async () => {
    // HEAD is whatever the branch points at now, so redeploying it would not
    // restore the previous state — that is a redeploy, not a rollback.
    const app = await appWithHistory([
      { commit: 'HEAD', status: 'finished' },
      { commit: 'current', status: 'finished' },
    ]);

    const attempt = deployments.rollbackTo(app.teamId, app.uuid, app.deploymentUuids[0]);
    await expectCode(attempt, 'NOT_ROLLBACKABLE');
    await attempt.catch((err) => {
      expect((err as Error).message).toMatch(/redeploy/i);
    });
  });

  it('refuses another team’s deployment', async () => {
    const app = await appWithHistory([
      { commit: 'aaa', status: 'finished' },
      { commit: 'current', status: 'finished' },
    ]);
    const stranger = await makeTeam();

    await expectCode(
      deployments.rollbackTo(stranger.id, app.uuid, app.deploymentUuids[0]),
      'NOT_FOUND'
    );
  });

  it('refuses an unknown deployment', async () => {
    const app = await appWithHistory([{ commit: 'aaa', status: 'finished' }]);

    await expectCode(deployments.rollbackTo(app.teamId, app.uuid, 'no-such-deploy'), 'NOT_FOUND');
  });
});

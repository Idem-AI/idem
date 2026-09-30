/**
 * Quick deploy asks where a new workspace runs — IDEM's infrastructure or one of
 * the team's servers — and must create it there, not on IDEM by default.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resolveWorkspace } from '../../api/services/quick-deploy.service';
import * as workspaces from '../../api/services/workspace.service';
import { isDomainError } from '../../api/utils/errors';
import { isTestDatabaseAvailable, truncateAll } from '../helpers/db';
import { makeManagedServer, makePrivateKey, makeServer, makeTeam } from '../helpers/factories';
import { closeInfrastructure } from '../helpers/teardown';

beforeAll(async () => {
  if (!(await isTestDatabaseAvailable())) {
    throw new Error(
      'Integration tests need the test database. Run scripts/prepare-test-db.sh from the repo root.'
    );
  }
});

beforeEach(async () => {
  await truncateAll();
});

afterAll(async () => {
  await closeInfrastructure();
});

describe('resolveWorkspace — a workspace created by name', () => {
  it('runs on IDEM when nothing was said', async () => {
    const team = await makeTeam();
    await makeManagedServer({ countryCode: 'DE', loadScore: 0 });

    const ws = await resolveWorkspace(team.id, { name: 'shop', workspace_name: 'Shop' });

    const created = await workspaces.getWorkspace(team.id, ws.uuid);
    expect(created?.deploymentType).toBe('saas');
  });

  it('runs on the chosen server of the team', async () => {
    const team = await makeTeam();
    const key = await makePrivateKey(team.id);
    const own = await makeServer(team.id, key.id);

    const ws = await resolveWorkspace(team.id, {
      name: 'shop',
      workspace_name: 'Shop',
      deployment_type: 'own',
      server_uuid: own.uuid,
    });

    const created = await workspaces.getWorkspace(team.id, ws.uuid);
    expect(created?.deploymentType).toBe('own');
    expect(created?.assignedServerId).toBe(own.id);
  });

  it('reuses a same-name workspace on the same target', async () => {
    const team = await makeTeam();
    const key = await makePrivateKey(team.id);
    const own = await makeServer(team.id, key.id);
    const first = await workspaces.createWorkspace(team.id, {
      name: 'Shop',
      deployment_type: 'own',
      server_uuid: own.uuid,
    });

    const ws = await resolveWorkspace(team.id, {
      name: 'api',
      workspace_name: 'shop',
      deployment_type: 'own',
      server_uuid: own.uuid,
    });

    expect(ws.uuid).toBe(first.uuid);
  });

  it('refuses a same-name workspace that runs elsewhere', async () => {
    const team = await makeTeam();
    await makeManagedServer({ countryCode: 'DE', loadScore: 0 });
    await workspaces.createWorkspace(team.id, { name: 'Shop' });
    const key = await makePrivateKey(team.id);
    const own = await makeServer(team.id, key.id);

    const attempt = resolveWorkspace(team.id, {
      name: 'api',
      workspace_name: 'Shop',
      deployment_type: 'own',
      server_uuid: own.uuid,
    });

    await expect(attempt).rejects.toThrow();
    await attempt.catch((err) => {
      expect(isDomainError(err) && err.code).toBe('WORKSPACE_NAME_TAKEN');
    });
  });
});

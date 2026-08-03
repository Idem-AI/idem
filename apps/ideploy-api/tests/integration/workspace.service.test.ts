/**
 * Workspaces: the deployment boundary that restores what the simplified flow lost.
 *
 * The property this suite exists to protect is **co-location**. Two projects in
 * one workspace must land on the same server and the same Docker network,
 * because that is what lets an API reach its database by hostname. The previous
 * code took the team's first destination *anywhere*, so co-location was
 * accidental and its absence was silent — the failure mode being a backend that
 * simply cannot resolve its database, with nothing pointing at why.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import * as workspaces from '../../api/services/workspace.service';
import * as scheduling from '../../api/services/server-scheduling.service';
import * as subscriptions from '../../api/services/subscription.service';
import { isDomainError } from '../../api/utils/errors';
import { isTestDatabaseAvailable, testPool, truncateAll } from '../helpers/db';
import {
  makeApplication,
  makeManagedServer,
  makePrivateKey,
  makeServer,
  makeTeam,
} from '../helpers/factories';
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
  await seedPlans();
});

afterAll(async () => {
  await closeInfrastructure();
});

/** The plan rows the subscription logic reads limits and entitlements from. */
async function seedPlans(): Promise<void> {
  await testPool().query(
    `INSERT INTO idem_subscription_plans
       (name, display_name, price, currency, billing_period, app_limit, server_limit,
        features, allows_region_selection, is_active, sort_order, created_at, updated_at)
     VALUES
       ('free', 'Free', 0, 'EUR', 'monthly', 5, 2, '[]'::json, false, true, 1, now(), now()),
       ('pro',  'Pro', 20, 'EUR', 'monthly', 50, 10, '[]'::json, true,  true, 3, now(), now()),
       ('enterprise', 'Enterprise', 0, 'EUR', 'monthly', -1, -1, '[]'::json, true, true, 4, now(), now())`
  );
}

async function setPlan(teamId: number, plan: string): Promise<void> {
  await testPool().query('UPDATE teams SET idem_subscription_plan = $2 WHERE id = $1', [
    teamId,
    plan,
  ]);
}

/** Assert a rejection is a DomainError with the expected machine code. */
async function expectCode(promise: Promise<unknown>, code: string): Promise<void> {
  await expect(promise).rejects.toThrow();
  await promise.catch((err) => {
    expect(isDomainError(err), `expected a DomainError, got ${err}`).toBe(true);
    expect(isDomainError(err) && err.code).toBe(code);
  });
}

describe('createWorkspace — IDEM-managed target', () => {
  it('places the workspace on a healthy managed server', async () => {
    const team = await makeTeam();
    const managed = await makeManagedServer({ countryCode: 'DE', loadScore: 0 });

    const workspace = await workspaces.createWorkspace(team.id, { name: 'Shop' });

    expect(workspace.deploymentType).toBe('saas');
    expect(workspace.assignedServerId).toBe(managed.id);
  });

  it('creates the production environment in the same transaction', async () => {
    const team = await makeTeam();
    await makeManagedServer();

    const workspace = await workspaces.createWorkspace(team.id, { name: 'Shop' });

    expect(workspace.environments.map((e) => e.name)).toEqual(['production']);
  });

  it('prefers the least loaded server', async () => {
    const team = await makeTeam();
    await makeManagedServer({ name: 'busy', loadScore: 40 });
    const idle = await makeManagedServer({ name: 'idle', loadScore: 1 });

    const workspace = await workspaces.createWorkspace(team.id, { name: 'Shop' });

    expect(workspace.assignedServerId).toBe(idle.id);
  });

  it('ignores managed servers that are not healthy', async () => {
    // A server that answers SSH but has no working Docker would accept the
    // placement and fail every deployment onto it.
    const team = await makeTeam();
    await makeManagedServer({ name: 'broken', loadScore: 0, isUsable: false });
    const healthy = await makeManagedServer({ name: 'healthy', loadScore: 99 });

    const workspace = await workspaces.createWorkspace(team.id, { name: 'Shop' });

    expect(workspace.assignedServerId).toBe(healthy.id);
  });

  it('ignores a force-disabled server', async () => {
    const team = await makeTeam();
    await makeManagedServer({ name: 'disabled', loadScore: 0, forceDisabled: true });
    const healthy = await makeManagedServer({ name: 'healthy', loadScore: 99 });

    const workspace = await workspaces.createWorkspace(team.id, { name: 'Shop' });
    expect(workspace.assignedServerId).toBe(healthy.id);
  });

  it('refuses, with a usable message, when the managed fleet has no capacity', async () => {
    const team = await makeTeam();

    await expectCode(workspaces.createWorkspace(team.id, { name: 'Shop' }), 'NO_MANAGED_CAPACITY');
  });

  it('does not leave a workspace behind when placement fails', async () => {
    const team = await makeTeam();

    await workspaces.createWorkspace(team.id, { name: 'Shop' }).catch(() => undefined);

    expect(await workspaces.listWorkspaces(team.id)).toEqual([]);
  });

  it('rejects a duplicate name, case-insensitively', async () => {
    const team = await makeTeam();
    await makeManagedServer();
    await workspaces.createWorkspace(team.id, { name: 'Shop' });

    await expectCode(
      workspaces.createWorkspace(team.id, { name: 'shop' }),
      'WORKSPACE_NAME_TAKEN'
    );
  });

  it('lets two teams use the same workspace name', async () => {
    const [one, two] = [await makeTeam(), await makeTeam()];
    await makeManagedServer();

    await workspaces.createWorkspace(one.id, { name: 'Shop' });
    const second = await workspaces.createWorkspace(two.id, { name: 'Shop' });

    expect(second.name).toBe('Shop');
  });
});

describe('createWorkspace — region selection', () => {
  it('honours the requested region on a plan that allows it', async () => {
    const team = await makeTeam();
    await setPlan(team.id, 'pro');
    await makeManagedServer({ countryCode: 'DE', loadScore: 0 });
    const cameroon = await makeManagedServer({ countryCode: 'CM', loadScore: 50 });

    const workspace = await workspaces.createWorkspace(team.id, { name: 'Shop', region: 'CM' });

    // Chosen despite being the more loaded server: the explicit region wins.
    expect(workspace.assignedServerId).toBe(cameroon.id);
    expect(workspace.region).toBe('CM');
  });

  it('refuses an explicit region on a plan that does not allow it', async () => {
    // Silently ignoring the choice would be worse: the user would believe their
    // data sits in a country it does not.
    const team = await makeTeam();
    await setPlan(team.id, 'free');
    await makeManagedServer({ countryCode: 'CM' });

    await expectCode(
      workspaces.createWorkspace(team.id, { name: 'Shop', region: 'CM' }),
      'REGION_SELECTION_NOT_ALLOWED'
    );
  });

  it('creates in the default region without a request, on any plan', async () => {
    const team = await makeTeam();
    await setPlan(team.id, 'free');
    await makeManagedServer({ countryCode: scheduling.DEFAULT_REGION });

    const workspace = await workspaces.createWorkspace(team.id, { name: 'Shop' });

    expect(workspace.region).toBe(scheduling.DEFAULT_REGION);
  });

  it('falls back to another region rather than refusing the deployment', async () => {
    const team = await makeTeam();
    await setPlan(team.id, 'pro');
    const elsewhere = await makeManagedServer({ countryCode: 'US' });

    const workspace = await workspaces.createWorkspace(team.id, { name: 'Shop', region: 'CM' });

    expect(workspace.assignedServerId).toBe(elsewhere.id);
    expect(workspace.region).toBe('US');
  });
});

describe('createWorkspace — own server target', () => {
  it('assigns the chosen server', async () => {
    const team = await makeTeam();
    const key = await makePrivateKey(team.id);
    const own = await makeServer(team.id, key.id);

    const workspace = await workspaces.createWorkspace(team.id, {
      name: 'Client X',
      deployment_type: 'own',
      server_uuid: own.uuid,
    });

    expect(workspace.deploymentType).toBe('own');
    expect(workspace.assignedServerId).toBe(own.id);
    // A region describes IDEM's fleet, not someone else's machine.
    expect(workspace.region).toBeNull();
  });

  it('requires a server to be named', async () => {
    const team = await makeTeam();

    await expectCode(
      workspaces.createWorkspace(team.id, { name: 'Client X', deployment_type: 'own' }),
      'SERVER_REQUIRED'
    );
  });

  it('refuses another team’s server', async () => {
    const team = await makeTeam();
    const other = await makeTeam();
    const key = await makePrivateKey(other.id);
    const theirs = await makeServer(other.id, key.id);

    await expectCode(
      workspaces.createWorkspace(team.id, {
        name: 'Client X',
        deployment_type: 'own',
        server_uuid: theirs.uuid,
      }),
      'NOT_FOUND'
    );
  });
});

describe('resolveWorkspaceDestination — the co-location guarantee', () => {
  it('returns the workspace’s own destination, not the team’s first one', async () => {
    // The regression this replaces: an unrelated server created earlier used to
    // win, silently separating resources meant to talk to each other.
    const team = await makeTeam();
    const key = await makePrivateKey(team.id);
    const unrelated = await makeServer(team.id, key.id, { name: 'unrelated' });
    await testPool().query(
      `INSERT INTO standalone_dockers (uuid, name, network, server_id, created_at, updated_at)
       VALUES (gen_random_uuid()::text, 'ideploy', 'ideploy', $1, now(), now())`,
      [unrelated.id]
    );

    const managed = await makeManagedServer();
    const workspace = await workspaces.createWorkspace(team.id, { name: 'Shop' });

    const resolved = await workspaces.resolveWorkspaceDestination(team.id, workspace.uuid);

    expect(resolved.serverId).toBe(managed.id);
    expect(resolved.serverId).not.toBe(unrelated.id);
  });

  it('gives every project in a workspace the same destination', async () => {
    const team = await makeTeam();
    await makeManagedServer();
    const workspace = await workspaces.createWorkspace(team.id, { name: 'Shop' });

    const [frontend, backend, database] = await Promise.all([
      workspaces.resolveWorkspaceDestination(team.id, workspace.uuid),
      workspaces.resolveWorkspaceDestination(team.id, workspace.uuid),
      workspaces.resolveWorkspaceDestination(team.id, workspace.uuid),
    ]);

    expect(backend.destinationId).toBe(frontend.destinationId);
    expect(database.destinationId).toBe(frontend.destinationId);
  });

  it('keeps two workspaces apart', async () => {
    const team = await makeTeam();
    await makeManagedServer({ name: 'a', loadScore: 0 });
    await makeManagedServer({ name: 'b', loadScore: 0 });

    const first = await workspaces.createWorkspace(team.id, { name: 'One' });
    // Placing the first workspace does not itself change load scores, so pin the
    // second explicitly to the other server to assert isolation.
    await testPool().query('UPDATE servers SET load_score = 99 WHERE id = $1', [
      first.assignedServerId,
    ]);
    const second = await workspaces.createWorkspace(team.id, { name: 'Two' });

    expect(second.assignedServerId).not.toBe(first.assignedServerId);

    const a = await workspaces.resolveWorkspaceDestination(team.id, first.uuid);
    const b = await workspaces.resolveWorkspaceDestination(team.id, second.uuid);
    expect(a.destinationId).not.toBe(b.destinationId);
  });

  it('resolves the requested environment', async () => {
    const team = await makeTeam();
    await makeManagedServer();
    const workspace = await workspaces.createWorkspace(team.id, { name: 'Shop' });
    const staging = await workspaces.createEnvironment(team.id, workspace.uuid, 'staging');

    const resolved = await workspaces.resolveWorkspaceDestination(
      team.id,
      workspace.uuid,
      'staging'
    );

    expect(resolved.environmentId).toBe(staging.id);
  });

  it('repairs a legacy workspace that has no assigned server', async () => {
    // Workspaces created before placement existed must keep working rather than
    // fail on their next deployment.
    const team = await makeTeam();
    const managed = await makeManagedServer();
    await makeManagedServer(); // capacity exists
    const workspace = await workspaces.createWorkspace(team.id, { name: 'Legacy' });
    await testPool().query('UPDATE projects SET assigned_server_id = NULL WHERE id = $1', [
      workspace.id,
    ]);

    const resolved = await workspaces.resolveWorkspaceDestination(team.id, workspace.uuid);

    expect(resolved.serverId).toBeGreaterThan(0);
    // And the repair is persisted, not repeated on every deployment.
    const reloaded = await workspaces.getWorkspace(team.id, workspace.uuid);
    expect(reloaded!.assignedServerId).toBe(resolved.serverId);
    expect([managed.id, resolved.serverId]).toContain(resolved.serverId);
  });

  it('asks the user to choose when an own-server workspace has none', async () => {
    const team = await makeTeam();
    const key = await makePrivateKey(team.id);
    const own = await makeServer(team.id, key.id);
    const workspace = await workspaces.createWorkspace(team.id, {
      name: 'Client X',
      deployment_type: 'own',
      server_uuid: own.uuid,
    });
    await testPool().query('UPDATE projects SET assigned_server_id = NULL WHERE id = $1', [
      workspace.id,
    ]);

    await expectCode(
      workspaces.resolveWorkspaceDestination(team.id, workspace.uuid),
      'WORKSPACE_HAS_NO_SERVER'
    );
  });

  it('reports a server that was never provisioned', async () => {
    const team = await makeTeam();
    const key = await makePrivateKey(team.id);
    // makeServer does not create a destination, standing in for a server added
    // but never set up.
    const bare = await makeServer(team.id, key.id);
    const workspace = await workspaces.createWorkspace(team.id, {
      name: 'Client X',
      deployment_type: 'own',
      server_uuid: bare.uuid,
    });

    await expectCode(
      workspaces.resolveWorkspaceDestination(team.id, workspace.uuid),
      'SERVER_NOT_PROVISIONED'
    );
  });

  it('resolves a named project, distinct from an unnamed one', async () => {
    // The three-tier scenario this whole module exists for: a frontend, a
    // backend and a database, told apart by name inside one workspace.
    const team = await makeTeam();
    await makeManagedServer();
    const workspace = await workspaces.createWorkspace(team.id, { name: 'Shop' });

    const frontend = await workspaces.resolveWorkspaceDestination(
      team.id,
      workspace.uuid,
      undefined,
      'frontend'
    );
    const backend = await workspaces.resolveWorkspaceDestination(
      team.id,
      workspace.uuid,
      undefined,
      'backend'
    );
    const unnamed = await workspaces.resolveWorkspaceDestination(team.id, workspace.uuid);

    expect(frontend.projectId).not.toBeNull();
    expect(backend.projectId).not.toBeNull();
    expect(frontend.projectId).not.toBe(backend.projectId);
    // Both still share the same destination — naming a project changes nothing
    // about the co-location guarantee, it only labels what sits on it.
    expect(backend.destinationId).toBe(frontend.destinationId);
    expect(unnamed.projectId).toBeNull();
  });

  it('resolves the same project again on a second call with the same name', async () => {
    // The find-or-create property: naming "frontend" twice must not produce two
    // frontends.
    const team = await makeTeam();
    await makeManagedServer();
    const workspace = await workspaces.createWorkspace(team.id, { name: 'Shop' });

    const first = await workspaces.resolveWorkspaceDestination(
      team.id,
      workspace.uuid,
      undefined,
      'api'
    );
    const second = await workspaces.resolveWorkspaceDestination(
      team.id,
      workspace.uuid,
      undefined,
      'api'
    );

    expect(second.projectId).toBe(first.projectId);
  });
});

describe('projects — a named grouping within an environment', () => {
  it('creates a project and lists it back', async () => {
    const team = await makeTeam();
    await makeManagedServer();
    const workspace = await workspaces.createWorkspace(team.id, { name: 'Shop' });

    const project = await workspaces.createProject(team.id, workspace.uuid, { name: 'frontend' });

    const listed = await workspaces.listProjects(team.id, workspace.uuid);
    expect(listed.map((p) => p.uuid)).toContain(project.uuid);
  });

  it('refuses two projects sharing a name in the same environment', async () => {
    const team = await makeTeam();
    await makeManagedServer();
    const workspace = await workspaces.createWorkspace(team.id, { name: 'Shop' });
    await workspaces.createProject(team.id, workspace.uuid, { name: 'frontend' });

    await expectCode(
      workspaces.createProject(team.id, workspace.uuid, { name: 'frontend' }),
      'PROJECT_NAME_TAKEN'
    );
  });

  it('allows the same name in a different environment', async () => {
    const team = await makeTeam();
    await makeManagedServer();
    const workspace = await workspaces.createWorkspace(team.id, { name: 'Shop' });
    const staging = await workspaces.createEnvironment(team.id, workspace.uuid, 'staging');
    await workspaces.createProject(team.id, workspace.uuid, { name: 'frontend' });

    const project = await workspaces.createProject(team.id, workspace.uuid, {
      name: 'frontend',
      environment_name: staging.name,
    });

    expect(project.environmentId).toBe(staging.id);
  });

  it('find-or-creates: the second call returns the first project, not a duplicate', async () => {
    const team = await makeTeam();
    await makeManagedServer();
    const workspace = await workspaces.createWorkspace(team.id, { name: 'Shop' });

    const first = await workspaces.findOrCreateProject(team.id, workspace.uuid, 'backend');
    const second = await workspaces.findOrCreateProject(team.id, workspace.uuid, 'backend');

    expect(second.id).toBe(first.id);
    expect(await workspaces.listProjects(team.id, workspace.uuid)).toHaveLength(1);
  });

  it('is case-insensitive when finding an existing project by name', async () => {
    const team = await makeTeam();
    await makeManagedServer();
    const workspace = await workspaces.createWorkspace(team.id, { name: 'Shop' });
    const created = await workspaces.findOrCreateProject(team.id, workspace.uuid, 'Backend');

    const found = await workspaces.findOrCreateProject(team.id, workspace.uuid, 'backend');

    expect(found.id).toBe(created.id);
  });

  it('deletes an empty project', async () => {
    const team = await makeTeam();
    await makeManagedServer();
    const workspace = await workspaces.createWorkspace(team.id, { name: 'Shop' });
    const project = await workspaces.createProject(team.id, workspace.uuid, { name: 'frontend' });

    expect(await workspaces.deleteProject(team.id, workspace.uuid, project.uuid)).toBe(true);
    expect(await workspaces.listProjects(team.id, workspace.uuid)).toHaveLength(0);
  });

  it('refuses to delete a project that still holds a resource', async () => {
    const team = await makeTeam();
    const managed = await makeManagedServer();
    const workspace = await workspaces.createWorkspace(team.id, { name: 'Shop' });
    const project = await workspaces.createProject(team.id, workspace.uuid, { name: 'frontend' });
    const fetched = await workspaces.getWorkspace(team.id, workspace.uuid);
    await makeApplication(fetched!.environments[0].id, managed.destinationId, {
      name: 'app-in-project',
    }).then(async (app) => {
      await testPool().query('UPDATE applications SET project_id = $1 WHERE id = $2', [
        project.id,
        app.id,
      ]);
    });

    await expectCode(
      workspaces.deleteProject(team.id, workspace.uuid, project.uuid),
      'PROJECT_NOT_EMPTY'
    );
  });

  it('reports nothing deleted for an unknown project', async () => {
    const team = await makeTeam();
    await makeManagedServer();
    const workspace = await workspaces.createWorkspace(team.id, { name: 'Shop' });

    // `workspace_projects.uuid` is a real `uuid` column — well-formed but absent.
    expect(
      await workspaces.deleteProject(team.id, workspace.uuid, '00000000-0000-0000-0000-000000000000')
    ).toBe(false);
  });
});

describe('environments', () => {
  it('adds one, and rejects a duplicate name', async () => {
    const team = await makeTeam();
    await makeManagedServer();
    const workspace = await workspaces.createWorkspace(team.id, { name: 'Shop' });

    await workspaces.createEnvironment(team.id, workspace.uuid, 'staging');
    await expectCode(
      workspaces.createEnvironment(team.id, workspace.uuid, 'staging'),
      'ENVIRONMENT_NAME_TAKEN'
    );
  });

  it('refuses to delete the last environment', async () => {
    const team = await makeTeam();
    await makeManagedServer();
    const workspace = await workspaces.createWorkspace(team.id, { name: 'Shop' });
    const [production] = workspace.environments;

    await expectCode(
      workspaces.deleteEnvironment(team.id, workspace.uuid, production.uuid),
      'LAST_ENVIRONMENT'
    );
  });

  it('refuses to delete an environment that still holds a project', async () => {
    const team = await makeTeam();
    await makeManagedServer();
    const workspace = await workspaces.createWorkspace(team.id, { name: 'Shop' });
    const staging = await workspaces.createEnvironment(team.id, workspace.uuid, 'staging');
    const { destinationId } = await workspaces.resolveWorkspaceDestination(team.id, workspace.uuid);
    await makeApplication(staging.id, destinationId);

    await expectCode(
      workspaces.deleteEnvironment(team.id, workspace.uuid, staging.uuid),
      'ENVIRONMENT_NOT_EMPTY'
    );
  });

  it('deletes an empty non-final environment', async () => {
    const team = await makeTeam();
    await makeManagedServer();
    const workspace = await workspaces.createWorkspace(team.id, { name: 'Shop' });
    const staging = await workspaces.createEnvironment(team.id, workspace.uuid, 'staging');

    expect(await workspaces.deleteEnvironment(team.id, workspace.uuid, staging.uuid)).toBe(true);
  });
});

describe('deleteWorkspace', () => {
  it('deletes an empty workspace and its environments', async () => {
    const team = await makeTeam();
    await makeManagedServer();
    const workspace = await workspaces.createWorkspace(team.id, { name: 'Shop' });

    expect(await workspaces.deleteWorkspace(team.id, workspace.uuid)).toBe(true);
    expect(await workspaces.getWorkspace(team.id, workspace.uuid)).toBeNull();
  });

  it('refuses while it still holds a project', async () => {
    const team = await makeTeam();
    await makeManagedServer();
    const workspace = await workspaces.createWorkspace(team.id, { name: 'Shop' });
    const { destinationId, environmentId } = await workspaces.resolveWorkspaceDestination(
      team.id,
      workspace.uuid
    );
    await makeApplication(environmentId, destinationId);

    await expectCode(
      workspaces.deleteWorkspace(team.id, workspace.uuid),
      'WORKSPACE_NOT_EMPTY'
    );
  });

  it('reports false for another team’s workspace, and leaves it intact', async () => {
    const [mine, theirs] = [await makeTeam(), await makeTeam()];
    await makeManagedServer();
    const workspace = await workspaces.createWorkspace(theirs.id, { name: 'Theirs' });

    expect(await workspaces.deleteWorkspace(mine.id, workspace.uuid)).toBe(false);
    expect(await workspaces.getWorkspace(theirs.id, workspace.uuid)).not.toBeNull();
  });
});

describe('projectCount', () => {
  it('counts the deployable units across environments', async () => {
    const team = await makeTeam();
    await makeManagedServer();
    const workspace = await workspaces.createWorkspace(team.id, { name: 'Shop' });
    const { destinationId, environmentId } = await workspaces.resolveWorkspaceDestination(
      team.id,
      workspace.uuid
    );
    const staging = await workspaces.createEnvironment(team.id, workspace.uuid, 'staging');

    await makeApplication(environmentId, destinationId);
    await makeApplication(environmentId, destinationId);
    await makeApplication(staging.id, destinationId);

    const reloaded = await workspaces.getWorkspace(team.id, workspace.uuid);
    expect(reloaded!.projectCount).toBe(3);
  });
});

describe('subscription limits', () => {
  it('treats -1 as unlimited, matching the Laravel convention', async () => {
    // Previously the code used 0 as the unlimited sentinel while the plan table
    // uses -1, so an enterprise team was reported as over quota.
    const team = await makeTeam();
    await setPlan(team.id, 'enterprise');

    const quota = await subscriptions.getQuota(team.id);

    expect(quota.apps.limit).toBe(subscriptions.UNLIMITED);
    expect(quota.apps.ok).toBe(true);
    expect(quota.servers.ok).toBe(true);
  });

  it('reads the plan’s server limit rather than defaulting to unlimited', async () => {
    // `teams.custom_server_limit` is NULL for most teams; reading limits from
    // that column alone gave every free team unlimited servers.
    const team = await makeTeam();
    await setPlan(team.id, 'free');

    const quota = await subscriptions.getQuota(team.id);

    expect(quota.servers.limit).toBe(2);
  });

  it('honours an explicit per-team override', async () => {
    const team = await makeTeam();
    await setPlan(team.id, 'free');
    await testPool().query('UPDATE teams SET custom_server_limit = 7 WHERE id = $1', [team.id]);

    expect((await subscriptions.getQuota(team.id)).servers.limit).toBe(7);
  });

  it('gates region selection on the plan', async () => {
    const team = await makeTeam();

    await setPlan(team.id, 'free');
    expect(await subscriptions.canSelectRegion(team.id)).toBe(false);

    await setPlan(team.id, 'pro');
    expect(await subscriptions.canSelectRegion(team.id)).toBe(true);
  });
});

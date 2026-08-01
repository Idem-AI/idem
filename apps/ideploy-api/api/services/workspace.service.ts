/**
 * Workspaces — the deployment boundary that holds related projects.
 *
 * ## Why this exists
 *
 * The V1 flow asked, before you could deploy anything: pick a hosting region,
 * pick a deployment target (IDEM's infrastructure or your own server), and only
 * then create a project. In exchange, everything inside that project landed on
 * the same server and could talk to its neighbours by name — which is what makes
 * a three-tier application possible.
 *
 * The rewrite's Vercel-style flow dropped all of that for a single "paste a repo"
 * step. Much better to start with, but a frontend and a backend created that way
 * had no guarantee of sharing a network, and no way to express "put these
 * together, in this region".
 *
 * A **workspace** puts the infrastructure question back, asked once, one level up:
 *
 *     Team → Workspace → environment → projects (a frontend, an API, a database)
 *
 * Creating a workspace is where the target and region are decided. Creating a
 * project inside it stays a single step, inheriting all of it.
 *
 * ## Mapping
 *
 * A workspace *is* a row in `projects`: that table already carries
 * `deployment_type`, `deployment_region` and `assigned_server_id` — the Laravel
 * side had modelled this exact concept. No new table, no new columns; what was
 * missing was the API and the guarantee below.
 *
 * ## The guarantee
 *
 * Every project in a workspace resolves to the *workspace's* destination. The
 * previous code took `firstDestination(teamId)` — the team's first destination
 * anywhere — so two resources meant to talk to each other could land on different
 * servers, and nothing said so.
 */
import { randomUUID } from 'crypto';
import { PoolClient } from 'pg';
import pool, { withTransaction } from '../config/db.config';
import logger from '../config/logger';
import { conflict, forbidden, notFound, unprocessable } from '../utils/errors';
import { DB_TYPES } from './database-types';
import {
  DEFAULT_REGION,
  destinationForServer,
  placeOnManagedServer,
} from './server-scheduling.service';
import { canSelectRegion } from './subscription.service';

/** Where a workspace's projects run. Values match the Laravel column. */
export type DeploymentType = 'saas' | 'own';

export const DEPLOYMENT_TYPES: readonly DeploymentType[] = ['saas', 'own'] as const;

/** The environment every workspace starts with, and the only one most ever need. */
export const DEFAULT_ENVIRONMENT = 'production';

export interface WorkspaceEnvironment {
  id: number;
  uuid: string;
  name: string;
}

export interface Workspace {
  id: number;
  uuid: string;
  name: string;
  description: string | null;
  deploymentType: DeploymentType;
  /** Two-letter country code, or null for the default region. */
  region: string | null;
  assignedServerId: number | null;
  assignedServerName: string | null;
  environments: WorkspaceEnvironment[];
  /** Deployable units inside, across all environments. */
  projectCount: number;
}

function toDeploymentType(value: unknown): DeploymentType {
  return value === 'own' ? 'own' : 'saas';
}

// ── Reads ─────────────────────────────────────────────────

const WORKSPACE_COLUMNS = `
  p.id, p.uuid, p.name, p.description,
  p.deployment_type, p.deployment_region, p.assigned_server_id,
  s.name AS assigned_server_name`;

const WORKSPACE_FROM = `
  FROM projects p
  LEFT JOIN servers s ON s.id = p.assigned_server_id`;

async function hydrate(rows: Record<string, unknown>[]): Promise<Workspace[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => Number(r.id));

  const environments = await pool.query(
    `SELECT id, uuid, name, project_id FROM environments
     WHERE project_id = ANY($1::bigint[]) ORDER BY name`,
    [ids]
  );
  const counts = await countProjectsPerWorkspace(ids);

  const byWorkspace = new Map<number, WorkspaceEnvironment[]>();
  for (const row of environments.rows) {
    const list = byWorkspace.get(Number(row.project_id)) ?? [];
    list.push({ id: Number(row.id), uuid: String(row.uuid), name: String(row.name) });
    byWorkspace.set(Number(row.project_id), list);
  }

  return rows.map((r) => {
    const id = Number(r.id);
    return {
      id,
      uuid: String(r.uuid),
      name: String(r.name),
      description: (r.description as string) ?? null,
      deploymentType: toDeploymentType(r.deployment_type),
      region: (r.deployment_region as string) ?? null,
      assignedServerId: r.assigned_server_id ? Number(r.assigned_server_id) : null,
      assignedServerName: (r.assigned_server_name as string) ?? null,
      environments: byWorkspace.get(id) ?? [],
      projectCount: counts.get(id) ?? 0,
    };
  });
}

/**
 * Count deployable units per workspace in one pass.
 *
 * Applications, services and every database type are separate tables, all linked
 * to an environment; a query per table per workspace would make the list view
 * quadratic in the number of resource kinds.
 */
async function countProjectsPerWorkspace(workspaceIds: number[]): Promise<Map<number, number>> {
  const resourceTables = [
    'applications',
    'services',
    ...new Set(Object.values(DB_TYPES).map((t) => t.table)),
  ];

  const unions = resourceTables
    .map(
      (table) => `
      SELECT e.project_id, count(*)::int AS n
      FROM ${table} r
      JOIN environments e ON e.id = r.environment_id
      WHERE e.project_id = ANY($1::bigint[])
      GROUP BY e.project_id`
    )
    .join(' UNION ALL ');

  const { rows } = await pool.query(
    `SELECT project_id, sum(n)::int AS total FROM (${unions}) counts GROUP BY project_id`,
    [workspaceIds]
  );

  return new Map(rows.map((r) => [Number(r.project_id), Number(r.total)]));
}

export async function listWorkspaces(teamId: number): Promise<Workspace[]> {
  const { rows } = await pool.query(
    `SELECT ${WORKSPACE_COLUMNS} ${WORKSPACE_FROM} WHERE p.team_id = $1 ORDER BY p.name`,
    [teamId]
  );
  return hydrate(rows);
}

export async function getWorkspace(teamId: number, uuid: string): Promise<Workspace | null> {
  const { rows } = await pool.query(
    `SELECT ${WORKSPACE_COLUMNS} ${WORKSPACE_FROM} WHERE p.team_id = $1 AND p.uuid = $2 LIMIT 1`,
    [teamId, uuid]
  );
  return (await hydrate(rows))[0] ?? null;
}

/** Like `getWorkspace`, but raises instead of returning null. */
async function requireWorkspace(teamId: number, uuid: string): Promise<Workspace> {
  const workspace = await getWorkspace(teamId, uuid);
  if (!workspace) throw notFound('Workspace');
  return workspace;
}

// ── Creation ──────────────────────────────────────────────

export interface CreateWorkspaceDto {
  name: string;
  description?: string;
  deployment_type?: DeploymentType;
  /** Two-letter country code. Requires a plan that allows region selection. */
  region?: string;
  /** Required when `deployment_type` is `own`. */
  server_uuid?: string;
}

export interface ResolvedTarget {
  assignedServerId: number | null;
  region: string | null;
  /** Set when the requested region had no capacity and another was used. */
  placedOutsideRequestedRegion?: boolean;
}

/**
 * Decide where a workspace will run, before anything is written.
 *
 * Kept separate from the insert so the decision — including its refusals — is
 * testable on its own, and so a failure to place leaves no half-created workspace.
 */
export async function resolveTarget(
  teamId: number,
  dto: CreateWorkspaceDto
): Promise<ResolvedTarget> {
  const type = dto.deployment_type ?? 'saas';

  if (type === 'own') {
    if (!dto.server_uuid) {
      throw unprocessable(
        'SERVER_REQUIRED',
        'Choose which of your servers this workspace should deploy to.'
      );
    }
    const { rows } = await pool.query(
      'SELECT id FROM servers WHERE team_id = $1 AND uuid = $2 LIMIT 1',
      [teamId, dto.server_uuid]
    );
    if (!rows[0]) throw notFound('Server');

    // Region is a property of IDEM's fleet; on your own server it is wherever
    // that server is, and not ours to record.
    return { assignedServerId: Number(rows[0].id), region: null };
  }

  let region = DEFAULT_REGION;
  if (dto.region) {
    if (!(await canSelectRegion(teamId))) {
      throw forbidden(
        'REGION_SELECTION_NOT_ALLOWED',
        'Choosing a hosting region is available on the Pro and Enterprise plans. ' +
          'Your workspace will be created in the default region.'
      );
    }
    region = dto.region.toUpperCase();
  }

  const placement = await placeOnManagedServer(region);
  return {
    assignedServerId: placement.serverId,
    region: placement.region,
    placedOutsideRequestedRegion: placement.fellBackToAnyRegion,
  };
}

/**
 * Create a workspace and its `production` environment.
 *
 * Both in one transaction: a workspace with no environment cannot hold a project,
 * and the previous code path had to self-heal exactly that case at deploy time.
 */
export async function createWorkspace(
  teamId: number,
  dto: CreateWorkspaceDto
): Promise<Workspace> {
  const type = dto.deployment_type ?? 'saas';
  const target = await resolveTarget(teamId, dto);

  const { rows } = await pool.query(
    'SELECT 1 FROM projects WHERE team_id = $1 AND lower(name) = lower($2) LIMIT 1',
    [teamId, dto.name]
  );
  if (rows[0]) {
    throw conflict('WORKSPACE_NAME_TAKEN', `You already have a workspace called "${dto.name}".`);
  }

  const uuid = await withTransaction(async (client: PoolClient) => {
    const workspaceUuid = randomUUID();
    const created = await client.query(
      `INSERT INTO projects
         (uuid, name, description, team_id, deployment_type, deployment_region, assigned_server_id,
          created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7, now(), now())
       RETURNING id`,
      [
        workspaceUuid,
        dto.name,
        dto.description ?? null,
        teamId,
        type,
        target.region,
        target.assignedServerId,
      ]
    );

    await client.query(
      `INSERT INTO environments (uuid, name, project_id, created_at, updated_at)
       VALUES ($1, $2, $3, now(), now())`,
      [randomUUID(), DEFAULT_ENVIRONMENT, Number(created.rows[0].id)]
    );

    return workspaceUuid;
  });

  logger.info('Workspace created', {
    teamId,
    uuid,
    deploymentType: type,
    region: target.region,
    assignedServerId: target.assignedServerId,
  });

  return requireWorkspace(teamId, uuid);
}

// ── Updates ───────────────────────────────────────────────

export interface UpdateWorkspaceDto {
  name?: string;
  description?: string;
}

/**
 * Rename or re-describe a workspace.
 *
 * The deployment target is deliberately not editable: moving a workspace means
 * relocating everything already running in it, which is a migration, not a field
 * update.
 */
export async function updateWorkspace(
  teamId: number,
  uuid: string,
  dto: UpdateWorkspaceDto
): Promise<Workspace> {
  const workspace = await requireWorkspace(teamId, uuid);

  if (dto.name && dto.name.toLowerCase() !== workspace.name.toLowerCase()) {
    const { rows } = await pool.query(
      'SELECT 1 FROM projects WHERE team_id = $1 AND lower(name) = lower($2) AND id <> $3 LIMIT 1',
      [teamId, dto.name, workspace.id]
    );
    if (rows[0]) {
      throw conflict('WORKSPACE_NAME_TAKEN', `You already have a workspace called "${dto.name}".`);
    }
  }

  await pool.query(
    `UPDATE projects
     SET name = COALESCE($3, name), description = COALESCE($4, description), updated_at = now()
     WHERE team_id = $1 AND id = $2`,
    [teamId, workspace.id, dto.name ?? null, dto.description ?? null]
  );

  return requireWorkspace(teamId, uuid);
}

/**
 * Delete a workspace.
 *
 * Refuses while it still holds projects: cascading would silently destroy
 * applications and databases. Same reasoning as deleting a server.
 */
export async function deleteWorkspace(teamId: number, uuid: string): Promise<boolean> {
  const workspace = await getWorkspace(teamId, uuid);
  if (!workspace) return false;

  if (workspace.projectCount > 0) {
    throw conflict(
      'WORKSPACE_NOT_EMPTY',
      `This workspace still holds ${workspace.projectCount} project(s). Delete them first.`
    );
  }

  await withTransaction(async (client) => {
    await client.query('DELETE FROM environments WHERE project_id = $1', [workspace.id]);
    await client.query('DELETE FROM projects WHERE id = $1', [workspace.id]);
  });

  logger.info('Workspace deleted', { teamId, uuid });
  return true;
}

// ── Environments ──────────────────────────────────────────

/**
 * Add an environment (`staging`, …) to a workspace.
 *
 * Environments were previously read-only over the API, so `production` was all
 * anyone could ever have.
 */
export async function createEnvironment(
  teamId: number,
  workspaceUuid: string,
  name: string
): Promise<WorkspaceEnvironment> {
  const workspace = await requireWorkspace(teamId, workspaceUuid);

  if (workspace.environments.some((e) => e.name.toLowerCase() === name.toLowerCase())) {
    throw conflict('ENVIRONMENT_NAME_TAKEN', `This workspace already has a "${name}" environment.`);
  }

  const uuid = randomUUID();
  const { rows } = await pool.query(
    `INSERT INTO environments (uuid, name, project_id, created_at, updated_at)
     VALUES ($1, $2, $3, now(), now()) RETURNING id`,
    [uuid, name, workspace.id]
  );
  return { id: Number(rows[0].id), uuid, name };
}

/** Remove an environment. Refuses when it still holds projects, and never the last one. */
export async function deleteEnvironment(
  teamId: number,
  workspaceUuid: string,
  environmentUuid: string
): Promise<boolean> {
  const workspace = await requireWorkspace(teamId, workspaceUuid);
  const environment = workspace.environments.find((e) => e.uuid === environmentUuid);
  if (!environment) return false;

  if (workspace.environments.length === 1) {
    throw conflict(
      'LAST_ENVIRONMENT',
      'A workspace needs at least one environment. Delete the workspace instead.'
    );
  }

  const occupancy = await countResourcesInEnvironment(environment.id);
  if (occupancy > 0) {
    throw conflict(
      'ENVIRONMENT_NOT_EMPTY',
      `This environment still holds ${occupancy} resource(s). Delete them first.`
    );
  }

  await pool.query('DELETE FROM environments WHERE id = $1', [environment.id]);
  return true;
}

/**
 * Applications, services and databases directly in one environment.
 *
 * Named for what it counts now that "project" means something more specific
 * (see `WorkspaceProject` below) — this predates that entity and was counting
 * *resources*, not Projects, all along.
 */
async function countResourcesInEnvironment(environmentId: number): Promise<number> {
  const tables = ['applications', 'services', ...new Set(Object.values(DB_TYPES).map((t) => t.table))];
  const unions = tables
    .map((table) => `SELECT count(*)::int AS n FROM ${table} WHERE environment_id = $1`)
    .join(' UNION ALL ');

  const { rows } = await pool.query<{ total: string }>(
    `SELECT COALESCE(sum(n), 0)::text AS total FROM (${unions}) counts`,
    [environmentId]
  );
  return Number(rows[0].total);
}

// ── Projects ──────────────────────────────────────────────
//
// The level the original design called for and the code never built: a named
// grouping of resources within one environment — "frontend", "backend", "the
// database" — so a three-tier application is three named things sharing a
// workspace, not three unlabelled rows an operator has to tell apart by URL.

export interface WorkspaceProject {
  id: number;
  uuid: string;
  name: string;
  description: string | null;
  environmentId: number;
}

function mapProject(r: Record<string, unknown>): WorkspaceProject {
  return {
    id: Number(r.id),
    uuid: String(r.uuid),
    name: String(r.name),
    description: (r.description as string) ?? null,
    environmentId: Number(r.environment_id),
  };
}

/** Find the environment an operation targets, defaulting the same way deployment does. */
function pickEnvironment(
  workspace: Workspace,
  environmentName?: string
): WorkspaceEnvironment {
  const environment =
    workspace.environments.find((e) => e.name === (environmentName ?? DEFAULT_ENVIRONMENT)) ??
    workspace.environments[0];
  if (!environment) {
    throw unprocessable(
      'WORKSPACE_HAS_NO_ENVIRONMENT',
      'This workspace has no environment. Recreate it, or add one.'
    );
  }
  return environment;
}

/**
 * Projects in a workspace, optionally narrowed to one environment.
 *
 * Narrowing is optional because most workspaces have exactly one environment
 * and asking a caller to name it every time would be friction for no benefit.
 */
export async function listProjects(
  teamId: number,
  workspaceUuid: string,
  environmentName?: string
): Promise<WorkspaceProject[]> {
  const workspace = await requireWorkspace(teamId, workspaceUuid);
  const environmentIds = environmentName
    ? [pickEnvironment(workspace, environmentName).id]
    : workspace.environments.map((e) => e.id);

  if (environmentIds.length === 0) return [];
  const { rows } = await pool.query(
    'SELECT * FROM workspace_projects WHERE environment_id = ANY($1::bigint[]) ORDER BY name',
    [environmentIds]
  );
  return rows.map(mapProject);
}

export async function getProject(
  teamId: number,
  workspaceUuid: string,
  projectUuid: string
): Promise<WorkspaceProject | null> {
  await requireWorkspace(teamId, workspaceUuid);
  const { rows } = await pool.query(
    `SELECT wp.* FROM workspace_projects wp WHERE wp.team_id = $1 AND wp.uuid = $2 LIMIT 1`,
    [teamId, projectUuid]
  );
  return rows[0] ? mapProject(rows[0]) : null;
}

export interface CreateProjectDto {
  name: string;
  description?: string;
  /** Defaults to the workspace's default environment. */
  environment_name?: string;
}

export async function createProject(
  teamId: number,
  workspaceUuid: string,
  dto: CreateProjectDto
): Promise<WorkspaceProject> {
  const workspace = await requireWorkspace(teamId, workspaceUuid);
  const environment = pickEnvironment(workspace, dto.environment_name);

  const uuid = randomUUID();
  try {
    const { rows } = await pool.query(
      `INSERT INTO workspace_projects (uuid, name, description, environment_id, team_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, now(), now()) RETURNING *`,
      [uuid, dto.name, dto.description ?? null, environment.id, teamId]
    );
    return mapProject(rows[0]);
  } catch (err) {
    // `workspace_projects (environment_id, name)` is unique — a duplicate name
    // in the same environment is the one constraint violation this can hit.
    if ((err as { code?: string }).code === '23505') {
      throw conflict(
        'PROJECT_NAME_TAKEN',
        `This environment already has a project called "${dto.name}".`
      );
    }
    throw err;
  }
}

/**
 * Find a project by name in an environment, creating it if it does not exist.
 *
 * The path resource creation actually uses: naming a project you have not
 * created yet should not be a separate step, the same way `quickDeploy`
 * find-or-creates the workspace itself.
 */
export async function findOrCreateProject(
  teamId: number,
  workspaceUuid: string,
  name: string,
  environmentName?: string
): Promise<WorkspaceProject> {
  const workspace = await requireWorkspace(teamId, workspaceUuid);
  const environment = pickEnvironment(workspace, environmentName);

  const existing = await pool.query(
    'SELECT * FROM workspace_projects WHERE environment_id = $1 AND lower(name) = lower($2) LIMIT 1',
    [environment.id, name]
  );
  if (existing.rows[0]) return mapProject(existing.rows[0]);

  return createProject(teamId, workspaceUuid, { name, environment_name: environmentName });
}

/** Remove a project. Refuses while it still holds resources — deleting it must not orphan them silently. */
export async function deleteProject(
  teamId: number,
  workspaceUuid: string,
  projectUuid: string
): Promise<boolean> {
  const project = await getProject(teamId, workspaceUuid, projectUuid);
  if (!project) return false;

  const occupancy = await countResourcesInProject(project.id);
  if (occupancy > 0) {
    throw conflict(
      'PROJECT_NOT_EMPTY',
      `This project still holds ${occupancy} resource(s). Delete or move them first.`
    );
  }

  await pool.query('DELETE FROM workspace_projects WHERE id = $1', [project.id]);
  return true;
}

async function countResourcesInProject(projectId: number): Promise<number> {
  const tables = ['applications', 'services', ...new Set(Object.values(DB_TYPES).map((t) => t.table))];
  const unions = tables
    .map((table) => `SELECT count(*)::int AS n FROM ${table} WHERE project_id = $1`)
    .join(' UNION ALL ');

  const { rows } = await pool.query<{ total: string }>(
    `SELECT COALESCE(sum(n), 0)::text AS total FROM (${unions}) counts`,
    [projectId]
  );
  return Number(rows[0].total);
}

// ── The co-location guarantee ─────────────────────────────

/**
 * The Laravel polymorphic type string for a Docker destination.
 *
 * Every destination `resolveWorkspaceDestination` ever returns is a
 * `standalone_dockers` row — there is no other kind yet — so this is a
 * constant, not something a caller decides.
 */
export const STANDALONE_DOCKER_TYPE = 'App\\Models\\StandaloneDocker';

export interface WorkspaceDestination {
  destinationId: number;
  serverId: number;
  environmentId: number;
  /** Set only when a `projectName` was given. */
  projectId: number | null;
}

/**
 * The destination every resource in this workspace must deploy onto.
 *
 * This is the guarantee that makes a workspace mean something: sharing a Docker
 * network is what lets the API reach the database by hostname.
 *
 * Legacy workspaces created before this existed have no assigned server; rather
 * than fail, one is placed for them on first use and recorded — the same
 * repair-on-read approach used for missing Docker destinations.
 *
 * Optionally resolves a Project too — find-or-create by name, the same way the
 * workspace itself is find-or-created for `quickDeploy` — so naming "frontend"
 * for the first time is not a separate step from creating the application.
 */
export async function resolveWorkspaceDestination(
  teamId: number,
  workspaceUuid: string,
  environmentName = DEFAULT_ENVIRONMENT,
  projectName?: string
): Promise<WorkspaceDestination> {
  const workspace = await requireWorkspace(teamId, workspaceUuid);

  let serverId = workspace.assignedServerId;
  if (!serverId) {
    if (workspace.deploymentType === 'own') {
      throw unprocessable(
        'WORKSPACE_HAS_NO_SERVER',
        'This workspace has no server assigned. Edit it and choose one of your servers.'
      );
    }
    const placement = await placeOnManagedServer(workspace.region ?? DEFAULT_REGION);
    serverId = placement.serverId;
    await pool.query(
      `UPDATE projects SET assigned_server_id = $2, deployment_region = COALESCE(deployment_region, $3),
                           updated_at = now()
       WHERE id = $1`,
      [workspace.id, serverId, placement.region]
    );
    logger.info('Assigned a managed server to a workspace that had none', {
      workspaceUuid,
      serverId,
    });
  }

  const environment = pickEnvironment(workspace, environmentName);
  const project = projectName
    ? await findOrCreateProject(teamId, workspaceUuid, projectName, environmentName)
    : null;

  return {
    destinationId: await destinationForServer(serverId),
    serverId,
    environmentId: environment.id,
    projectId: project?.id ?? null,
  };
}

/**
 * Internal hostname a project is reachable at from its neighbours.
 *
 * Containers on the same Docker network resolve each other by container name, so
 * this is what a backend puts in its database URL. Exposing it is what turns
 * "same network" from an implementation detail into a usable feature.
 */
export function internalHostname(resourceName: string, resourceUuid: string): string {
  return `${resourceName}-${resourceUuid}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
}

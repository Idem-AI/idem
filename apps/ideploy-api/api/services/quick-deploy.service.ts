/**
 * One-click "quick deploy" for non-technical users.
 *
 * Given just a name + a Git repository (or a one-click template), this:
 *  1. ensures a project + production environment exist,
 *  2. auto-selects the team's first server + Docker destination,
 *  3. creates the application (or a service from a template),
 *  4. triggers a deployment.
 *
 * Returns a friendly, actionable error when the team has no server/destination
 * yet (so the UI can guide the user to add one).
 */
import pool from '../config/db.config';
import * as projectService from './project.service';
import * as appService from './application.service';
import * as deploymentService from './deployment.service';
import * as serviceService from './service.service';
import { getTemplateCompose } from './templates.service';

const STANDALONE_DOCKER_MODEL = 'App\\Models\\StandaloneDocker';

/** First usable destination (server + StandaloneDocker) for the team. */
async function firstDestination(
  teamId: number
): Promise<{ destinationId: number; serverName: string } | null> {
  const { rows } = await pool.query(
    `SELECT sd.id AS destination_id, s.name AS server_name
     FROM standalone_dockers sd
     JOIN servers s ON s.id = sd.server_id
     WHERE s.team_id = $1
     ORDER BY sd.id ASC LIMIT 1`,
    [teamId]
  );
  if (!rows[0]) return null;
  return { destinationId: Number(rows[0].destination_id), serverName: String(rows[0].server_name) };
}

/** Ensure a project + production environment; returns the environment id. */
async function ensureProjectEnvironment(teamId: number, projectName: string): Promise<number> {
  // Reuse an existing project named like this, else create one.
  const existing = await pool.query(
    'SELECT id FROM projects WHERE team_id = $1 AND name = $2 LIMIT 1',
    [teamId, projectName]
  );
  let projectUuid: string;
  if (existing.rows[0]) {
    const r = await pool.query('SELECT uuid FROM projects WHERE id = $1', [existing.rows[0].id]);
    projectUuid = String(r.rows[0].uuid);
  } else {
    const project = await projectService.createProject(teamId, { name: projectName });
    projectUuid = project.uuid;
  }
  const envs = await projectService.listEnvironments(teamId, projectUuid);
  const prod = envs.find((e) => e.name === 'production') ?? envs[0];
  if (!prod) throw new Error('No environment available');
  return prod.id;
}

export interface QuickDeployDto {
  name: string;
  git_repository?: string;
  git_branch?: string;
  build_pack?: string;
  template?: string;
  project_name?: string;
}

export interface QuickDeployResult {
  kind: 'application' | 'service';
  deploymentUuid?: string;
  serviceUuid?: string;
  server: string;
}

export async function quickDeploy(teamId: number, dto: QuickDeployDto): Promise<QuickDeployResult> {
  const dest = await firstDestination(teamId);
  if (!dest) {
    throw new Error(
      'NO_DESTINATION: Add a server first (Servers → Add server), then create a destination on it.'
    );
  }

  const environmentId = await ensureProjectEnvironment(teamId, dto.project_name || dto.name);

  // Template path → create a service (docker-compose stack) and start it.
  if (dto.template) {
    const compose = getTemplateCompose(dto.template);
    if (!compose) throw new Error(`Unknown template: ${dto.template}`);
    const service = await serviceService.createService(teamId, {
      name: dto.name,
      environment_id: environmentId,
      destination_id: dest.destinationId,
      docker_compose_raw: compose,
      service_type: dto.template,
    });
    await serviceService.lifecycle(teamId, service.uuid, 'start');
    return { kind: 'service', serviceUuid: service.uuid, server: dest.serverName };
  }

  // Git path → create an application and deploy it.
  if (!dto.git_repository) {
    throw new Error('Provide a Git repository URL or pick a template.');
  }
  const app = await appService.createApplication(teamId, {
    name: dto.name,
    environment_id: environmentId,
    git_repository: dto.git_repository,
    git_branch: dto.git_branch || 'main',
    build_pack: dto.build_pack || 'nixpacks',
    destination_id: dest.destinationId,
    destination_type: STANDALONE_DOCKER_MODEL,
  });
  const { deploymentUuid } = await deploymentService.createDeployment(app, teamId, {});
  return { kind: 'application', deploymentUuid, server: dest.serverName };
}

/**
 * One-click "quick deploy" — the Vercel-style path.
 *
 * Given a name and a Git repository (or a one-click template), this creates the
 * deployable unit and starts it. The infrastructure question is not asked here:
 * it was answered once when the workspace was created, and the destination is
 * resolved from it (see workspace.service).
 *
 * Callers may pass an explicit `workspace_uuid`; otherwise a workspace is found
 * or created by name, so the simplest flow stays one step.
 */
import pool from '../config/db.config';
import * as appService from './application.service';
import * as deploymentService from './deployment.service';
import * as serviceService from './service.service';
import * as workspaceService from './workspace.service';
import { STANDALONE_DOCKER_TYPE } from './workspace.service';
import { getTemplateCompose } from './templates.service';
import { unprocessable } from '../utils/errors';

/**
 * Resolve the workspace this deployment belongs to, creating one if needed.
 *
 * Replaces the previous `firstDestination(teamId)`, which took the team's first
 * destination *anywhere*. That made co-location accidental: a frontend and a
 * backend created moments apart could land on different servers with no way to
 * reach each other, and nothing reported it.
 */
async function resolveWorkspace(
  teamId: number,
  dto: QuickDeployDto
): Promise<{ uuid: string; name: string }> {
  if (dto.workspace_uuid) {
    const workspace = await workspaceService.getWorkspace(teamId, dto.workspace_uuid);
    if (!workspace) {
      throw unprocessable('WORKSPACE_NOT_FOUND', 'That workspace does not exist.');
    }
    return { uuid: workspace.uuid, name: workspace.name };
  }

  const name = dto.workspace_name || dto.project_name || dto.name;
  const existing = await pool.query(
    'SELECT uuid, name FROM projects WHERE team_id = $1 AND lower(name) = lower($2) LIMIT 1',
    [teamId, name]
  );
  if (existing.rows[0]) {
    return { uuid: String(existing.rows[0].uuid), name: String(existing.rows[0].name) };
  }

  // No workspace yet: create one on IDEM's infrastructure in the default region,
  // which is the zero-configuration path the simplified flow promises.
  const created = await workspaceService.createWorkspace(teamId, { name, deployment_type: 'saas' });
  return { uuid: created.uuid, name: created.name };
}

export interface QuickDeployDto {
  name: string;
  git_repository?: string;
  git_branch?: string;
  build_pack?: string;
  template?: string;
  /** Deploy into this existing workspace. */
  workspace_uuid?: string;
  /** Find-or-create a workspace by name. */
  workspace_name?: string;
  /** @deprecated Use `workspace_name`. Kept so existing clients keep working. */
  project_name?: string;
  /** Environment within the workspace. Defaults to `production`. */
  environment?: string;
  base_directory?: string;
  build_command?: string;
  start_command?: string;
  ports_exposes?: string;
}

export interface QuickDeployResult {
  kind: 'application' | 'service';
  deploymentUuid?: string;
  serviceUuid?: string;
  /** Workspace the unit was created in. */
  workspace: { uuid: string; name: string };
  /** Hostname its neighbours in the same workspace can reach it at. */
  internalHostname: string;
}

export async function quickDeploy(teamId: number, dto: QuickDeployDto): Promise<QuickDeployResult> {
  const workspace = await resolveWorkspace(teamId, dto);

  // The workspace decides the server and network — that is what guarantees the
  // units inside it can reach each other.
  const { destinationId, environmentId } = await workspaceService.resolveWorkspaceDestination(
    teamId,
    workspace.uuid,
    dto.environment
  );

  // Template path → create a service (docker-compose stack) and start it.
  if (dto.template) {
    const compose = getTemplateCompose(dto.template);
    if (!compose) {
      throw unprocessable('UNKNOWN_TEMPLATE', `There is no template called "${dto.template}".`);
    }
    const service = await serviceService.createService(teamId, {
      name: dto.name,
      environment_id: environmentId,
      destination_id: destinationId,
      docker_compose_raw: compose,
      service_type: dto.template,
    });
    await serviceService.lifecycle(teamId, service.uuid, 'start');
    return {
      kind: 'service',
      serviceUuid: service.uuid,
      workspace,
      internalHostname: workspaceService.internalHostname(dto.name, service.uuid),
    };
  }

  // Git path → create an application and deploy it.
  if (!dto.git_repository) {
    throw unprocessable(
      'SOURCE_REQUIRED',
      'Provide a Git repository URL, or pick a one-click template.'
    );
  }
  const app = await appService.createApplication(teamId, {
    name: dto.name,
    environment_id: environmentId,
    git_repository: dto.git_repository,
    git_branch: dto.git_branch || 'main',
    build_pack: dto.build_pack || 'nixpacks',
    destination_id: destinationId,
    destination_type: STANDALONE_DOCKER_TYPE,
    base_directory: dto.base_directory,
    build_command: dto.build_command,
    start_command: dto.start_command,
    ports_exposes: dto.ports_exposes,
  });
  const { deploymentUuid } = await deploymentService.createDeployment(app, teamId, {});
  return {
    kind: 'application',
    deploymentUuid,
    workspace,
    internalHostname: workspaceService.internalHostname(app.name, app.uuid),
  };
}

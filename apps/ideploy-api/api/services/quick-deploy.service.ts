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
import * as registryService from './registry-credentials.service';
import { registryOf } from '../validation/git-input';
import pool from '../config/db.config';
import * as appService from './application.service';
import * as deploymentService from './deployment.service';
import * as serviceService from './service.service';
import * as workspaceService from './workspace.service';
import * as envVarService from './env-var.service';
import { STANDALONE_DOCKER_TYPE } from './workspace.service';
import { getTemplateCompose } from './templates.service';
import { conflict, unprocessable } from '../utils/errors';
import { randomBytes } from 'crypto';
import * as databaseService from './database.service';
import { IncomingFiles, saveSourceForApplication } from './application-source.service';
import { claimPlatformHost } from './platform-domain.service';
import { getServerForDestination } from './domain.service';

/**
 * Resolve the workspace this deployment belongs to, creating one if needed.
 *
 * Replaces the previous `firstDestination(teamId)`, which took the team's first
 * destination *anywhere*. That made co-location accidental: a frontend and a
 * backend created moments apart could land on different servers with no way to
 * reach each other, and nothing reported it.
 */
export async function resolveWorkspace(
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
  const type = dto.deployment_type ?? 'saas';
  if (!workspaceService.DEPLOYMENT_TYPES.includes(type)) {
    throw unprocessable('INVALID_DEPLOYMENT_TYPE', 'Choose IDEM\'s infrastructure or one of your servers.');
  }

  const existing = await pool.query(
    `SELECT p.uuid, p.name, p.deployment_type, s.uuid AS server_uuid
       FROM projects p
       LEFT JOIN servers s ON s.id = p.assigned_server_id
      WHERE p.team_id = $1 AND lower(p.name) = lower($2)
      LIMIT 1`,
    [teamId, name]
  );
  const found = existing.rows[0];
  if (found) {
    // Reusing a workspace by name is what keeps a second import of the same
    // repository next to the first. But when the caller said where it should
    // run, landing somewhere else in silence would betray that answer.
    const explicit = dto.deployment_type !== undefined;
    const sameTarget =
      String(found.deployment_type ?? 'saas') === type &&
      (type !== 'own' || String(found.server_uuid) === dto.server_uuid);
    if (explicit && !sameTarget) {
      throw conflict(
        'WORKSPACE_NAME_TAKEN',
        `You already have a workspace called "${found.name}" that runs elsewhere. Pick it, or choose another name.`
      );
    }
    return { uuid: String(found.uuid), name: String(found.name) };
  }

  // No workspace yet: create it where the operator said — IDEM's
  // infrastructure in the default region when nothing was said.
  const created = await workspaceService.createWorkspace(teamId, {
    name,
    deployment_type: type,
    server_uuid: type === 'own' ? dto.server_uuid : undefined,
    region: type === 'saas' ? dto.region : undefined,
  });
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
  /** Where a workspace created by name runs. Defaults to `saas`; ignored with `workspace_uuid`. */
  deployment_type?: workspaceService.DeploymentType;
  /** Required with `deployment_type: 'own'`: which of the team's servers. */
  server_uuid?: string;
  /** SaaS only, on plans that allow it. */
  region?: string;
  /** @deprecated Use `workspace_name`. Kept so existing clients keep working. */
  project_name?: string;
  /** Environment within the workspace. Defaults to `production`. */
  environment?: string;
  /**
   * The code itself, when there is no repository — what iCode sends. Text as a
   * string, binary as `{ base64 }`. Kept in `application_sources` and unpacked
   * on the server by the deployment worker.
   */
  files?: IncomingFiles;
  /** Run an image already in a registry instead of building one (`build_pack: 'dockerimage'`). */
  docker_image?: string;
  docker_image_tag?: string;
  /** Registry login for a private image, saved for the team. */
  registry_username?: string;
  registry_password?: string;
  publish_directory?: string;
  base_directory?: string;
  install_command?: string;
  build_command?: string;
  start_command?: string;
  ports_exposes?: string;
  /**
   * Set before the first deployment is created, not after — a build that
   * needs one of these to compile (an API base URL baked in at build time,
   * for instance) must have it on the very first attempt, the same way it
   * would need it on every attempt after.
   */
  environment_variables?: { key: string; value: string }[];
  /**
   * Give the application an address on the platform domain
   * (`monapp.idem.africa`, or `monapp-<id>` when taken) instead of the
   * automatic one. What iCode asks for; off for every other caller.
   */
  platform_domain?: boolean;
}

/**
 * The platform address for an application about to be created, or undefined
 * to let `createApplication` generate the automatic one (feature off, or the
 * DNS could not be updated — never a reason to fail the deployment).
 */
async function platformFqdn(name: string, destinationId: number, wanted?: boolean): Promise<string | undefined> {
  if (!wanted) return undefined;
  const server = await getServerForDestination(destinationId);
  if (!server) return undefined;
  return (await claimPlatformHost(name, server.ip)) ?? undefined;
}

export interface QuickDeployResult {
  kind: 'application' | 'service';
  deploymentUuid?: string;
  /** The application created (git or files path). */
  applicationUuid?: string;
  /** Where it will answer once deployed. */
  url?: string | null;
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

  // Git path, or files sent directly (iCode) → create an application and deploy it.
  const isImage = dto.build_pack === 'dockerimage';
  if (isImage && !dto.docker_image) {
    throw unprocessable('SOURCE_REQUIRED', 'Provide the image to run, e.g. registry.example.com/organisation/app.');
  }
  if (!isImage && !dto.git_repository && !dto.files) {
    throw unprocessable(
      'SOURCE_REQUIRED',
      'Provide a Git repository URL, the files of the project, or pick a one-click template.'
    );
  }
  if (isImage && dto.registry_username && dto.registry_password) {
    await registryService.saveRegistryCredential(teamId, {
      registry: registryOf(dto.docker_image as string),
      username: dto.registry_username,
      password: dto.registry_password,
    });
  }
  const app = await appService.createApplication(teamId, {
    name: dto.name,
    environment_id: environmentId,
    fqdn: await platformFqdn(dto.name, destinationId, dto.platform_domain),
    // Vide quand le code arrive en fichiers : le worker lit alors l'archive.
    git_repository: dto.git_repository ?? '',
    git_branch: dto.git_branch || 'main',
    build_pack: dto.build_pack || 'nixpacks',
    destination_id: destinationId,
    destination_type: STANDALONE_DOCKER_TYPE,
    base_directory: dto.base_directory,
    install_command: dto.install_command,
    build_command: dto.build_command,
    start_command: dto.start_command,
    ports_exposes: dto.ports_exposes,
    publish_directory: dto.publish_directory,
    ...(isImage
      ? { docker_registry_image_name: dto.docker_image, docker_registry_image_tag: dto.docker_image_tag || 'latest' }
      : {}),
  });

  // The code must be stored before the deployment is queued: the worker reads it.
  if (dto.files) await saveSourceForApplication(app.id, dto.files);

  // Saved before the first deployment is created (see the DTO field's own
  // doc comment) — both build-time and runtime by default, since this form
  // has no way yet to ask which a given key is for and a var a build needed
  // is one the running container plausibly needs too.
  for (const { key, value } of dto.environment_variables ?? []) {
    if (!key.trim()) continue;
    await envVarService.upsertForApplication(teamId, app.uuid, {
      key: key.trim(),
      value,
      is_runtime: true,
      is_buildtime: true,
    });
  }

  const { deploymentUuid } = await deploymentService.createDeployment(app, teamId, {});
  return {
    kind: 'application',
    deploymentUuid,
    applicationUuid: app.uuid,
    url: appService.computeAppLink(app),
    workspace,
    internalHostname: workspaceService.internalHostname(app.name, app.uuid),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Complete application in one call: database + server + interface, linked.
// ─────────────────────────────────────────────────────────────────────────────

export interface FullstackDeployDto {
  /** Shown to the user: the interface takes this name, the others derive from it. */
  name: string;
  /** The whole project: `backend/` and `frontend/` side by side (iCode's layout). */
  files: IncomingFiles;
  workspace_uuid?: string;
  workspace_name?: string;
  deployment_type?: workspaceService.DeploymentType;
  server_uuid?: string;
  region?: string;
  /** `monapp.idem.africa` for the interface, `monapp-api.idem.africa` for the server. */
  platform_domain?: boolean;
}

export interface FullstackDeployResult {
  workspace: { uuid: string; name: string };
  database: { uuid: string; name: string };
  backend: { uuid: string; url: string | null; deploymentUuid: string };
  frontend: { uuid: string; url: string | null; deploymentUuid: string };
}

/** Ports and folders of iCode's full-stack contract (skill `webcontainer-fullstack`). */
export const FULLSTACK = {
  backendDir: '/backend',
  frontendDir: '/frontend',
  backendPort: '3001',
  staticPort: '80',
} as const;

/**
 * The 3-tier guide, done server-side in one call — for people who do not know
 * what a database URL is and should never have to.
 *
 *   1. a PostgreSQL in the workspace, started;
 *   2. the server (`backend/`, nixpacks) with `DATABASE_URL` pointing at it on
 *      the private network, plus `PORT`, `JWT_SECRET` and `CORS_ORIGIN`;
 *   3. the interface (`frontend/`, static build) with `VITE_API_URL` set to the
 *      server's public address at build time.
 *
 * Both applications are created before anything is deployed, so each knows the
 * other's address. Both deployments are queued at once: the server is ready
 * long before the interface finishes building.
 */
export async function quickDeployFullstack(
  teamId: number,
  dto: FullstackDeployDto
): Promise<FullstackDeployResult> {
  const files = dto.files ?? {};
  for (const required of ['backend/package.json', 'frontend/package.json']) {
    if (!(required in files)) {
      throw unprocessable(
        'NOT_A_FULLSTACK_PROJECT',
        'A complete application needs a backend/ and a frontend/ folder, each with its package.json.'
      );
    }
  }

  const workspace = await resolveWorkspace(teamId, {
    name: dto.name,
    workspace_uuid: dto.workspace_uuid,
    workspace_name: dto.workspace_name ?? dto.name,
    deployment_type: dto.deployment_type,
    server_uuid: dto.server_uuid,
    region: dto.region,
  });
  const { destinationId, environmentId } = await workspaceService.resolveWorkspaceDestination(
    teamId,
    workspace.uuid
  );

  // 1. Database — started before the server is even queued.
  const database = await databaseService.createDatabase(teamId, 'postgresql', {
    name: `${dto.name}-db`,
    environment_id: environmentId,
    destination_id: destinationId,
  });
  await databaseService.lifecycle(teamId, 'postgresql', database.uuid, 'start');
  const detail = await databaseService.getDatabaseDetail(teamId, 'postgresql', database.uuid);
  if (!detail?.connection_url) {
    throw new Error('The database was created but its address could not be built.');
  }

  // 2 & 3. Both applications first, so each has the other's address.
  const backend = await appService.createApplication(teamId, {
    name: `${dto.name}-api`,
    environment_id: environmentId,
    fqdn: await platformFqdn(`${dto.name}-api`, destinationId, dto.platform_domain),
    git_repository: '',
    build_pack: 'nixpacks',
    base_directory: FULLSTACK.backendDir,
    start_command: 'npm start',
    ports_exposes: FULLSTACK.backendPort,
    destination_id: destinationId,
    destination_type: STANDALONE_DOCKER_TYPE,
  });
  const frontend = await appService.createApplication(teamId, {
    name: dto.name,
    environment_id: environmentId,
    fqdn: await platformFqdn(dto.name, destinationId, dto.platform_domain),
    git_repository: '',
    build_pack: 'static',
    base_directory: FULLSTACK.frontendDir,
    install_command: 'npm install',
    build_command: 'npm run build',
    publish_directory: 'dist',
    ports_exposes: FULLSTACK.staticPort,
    destination_id: destinationId,
    destination_type: STANDALONE_DOCKER_TYPE,
  });
  const backendUrl = appService.computeAppLink(backend);
  const frontendUrl = appService.computeAppLink(frontend);

  const runtime = { is_runtime: true, is_buildtime: false };
  const backendEnv: Array<[string, string]> = [
    ['DATABASE_URL', detail.connection_url],
    ['PORT', FULLSTACK.backendPort],
    ['NODE_ENV', 'production'],
    ['JWT_SECRET', randomBytes(32).toString('hex')],
    ['CORS_ORIGIN', frontendUrl ?? '*'],
  ];
  for (const [key, value] of backendEnv) {
    await envVarService.upsertForApplication(teamId, backend.uuid, { key, value, ...runtime });
  }
  if (backendUrl) {
    // Read by Vite at build time only: the interface is plain files afterwards.
    await envVarService.upsertForApplication(teamId, frontend.uuid, {
      key: 'VITE_API_URL',
      value: backendUrl,
      is_runtime: false,
      is_buildtime: true,
    });
  }

  await saveSourceForApplication(backend.id, files);
  await saveSourceForApplication(frontend.id, files);

  const backendDeployment = await deploymentService.createDeployment(backend, teamId, {});
  const frontendDeployment = await deploymentService.createDeployment(frontend, teamId, {});

  return {
    workspace,
    database: { uuid: database.uuid, name: database.name },
    backend: { uuid: backend.uuid, url: backendUrl, deploymentUuid: backendDeployment.deploymentUuid },
    frontend: { uuid: frontend.uuid, url: frontendUrl, deploymentUuid: frontendDeployment.deploymentUuid },
  };
}

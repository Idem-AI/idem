import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  ApiResponse,
  ApiToken,
  Application,
  ApplicationPreview,
  CloudToken,
  ContainerUsage,
  IssuedApiToken,
  BackupExecution,
  BackupSchedule,
  PipelineConfig,
  PipelineExecution,
  RollbackTarget,
  Database,
  DatabaseDetail,
  DatabaseType,
  DeploymentHistoryItem,
  DeployResponse,
  Destination,
  EnvVar,
  PrivateKey,
  ProxyStatus,
  CrowdSecStatus,
  Server,
  ServerSettings,
  ServerHealth,
  ServerReadiness,
  ServerResource,
  ServerSetupResult,
  SslCertificate,
  Workspace,
  WorkspaceEnvironment,
  WorkspaceOptions,
  WorkspaceResource,
  WorkspaceProject,
  CreateWorkspaceProjectRequest,
  CreateWorkspaceRequest,
  Service,
  ServiceDetail,
  ServiceTemplate,
  ScheduledTask,
  AppVolumes,
  PersistentVolume,
  Tag,
  ApplyRequired,
  CountryCatalogue,
  DetectedFramework,
  FirewallConfig,
  FirewallRule,
  GeoMode,
  GeoRuleResult,
  GeoSelection,
  GithubRepo,
  RateLimitSettings,
  RateLimitTemplate,
  S3Storage,
  AdminTeamRow,
  AdminUserRow,
  AdminServerRow,
  ServerFleetStats,
  InstanceOverview,
  CloudInitScript,
  FileVolume,
  GeneratedPrivateKey,
  HetznerLocation,
  HetznerServerType,
  SshKeyType,
  TaskExecution,
  TeamInfo,
} from '../models/ideploy.models';

/**
 * Typed client for the iDeploy Node API. Unwraps the `{ success, data }`
 * envelope returned by every endpoint.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private base = `${environment.api.url}/api/${environment.api.version}`;

  private unwrap<T>(obs: Observable<ApiResponse<T>>): Observable<T> {
    return obs.pipe(map((r) => r.data));
  }

  // ── GitHub integration (self-contained in the iDeploy API) ──
  /** Connection status: returns the GitHub username if connected, else null. */
  githubStatus(): Observable<string | null> {
    return this.unwrap(
      this.http.get<ApiResponse<{ connected: boolean; username: string | null }>>(`${this.base}/github/user`)
    ).pipe(map((r) => r.username));
  }
  /** `returnTo` (a same-origin path, e.g. the architecture guide's own URL) is where the OAuth round-trip sends the browser back to — default `/new-project` otherwise. */
  githubAuthUrl(returnTo?: string): Observable<string> {
    const q = returnTo ? `?return_to=${encodeURIComponent(returnTo)}` : '';
    return this.unwrap(
      this.http.get<ApiResponse<{ authUrl: string }>>(`${this.base}/github/auth/url${q}`)
    ).pipe(map((r) => r.authUrl));
  }
  githubRepositories(): Observable<GithubRepo[]> {
    return this.unwrap(this.http.get<ApiResponse<GithubRepo[]>>(`${this.base}/github/repositories`));
  }
  githubDetect(repo: string): Observable<DetectedFramework> {
    return this.unwrap(
      this.http.get<ApiResponse<DetectedFramework>>(`${this.base}/github/detect?repo=${encodeURIComponent(repo)}`)
    );
  }
  githubDisconnect(): Observable<unknown> {
    return this.unwrap(this.http.delete<ApiResponse<unknown>>(`${this.base}/github/disconnect`));
  }

  // ── GitLab integration (mirrors GitHub above) ──
  gitlabStatus(): Observable<string | null> {
    return this.unwrap(
      this.http.get<ApiResponse<{ connected: boolean; username: string | null }>>(`${this.base}/gitlab/user`)
    ).pipe(map((r) => r.username));
  }
  /** See `githubAuthUrl`'s note on `returnTo`. */
  gitlabAuthUrl(returnTo?: string): Observable<string> {
    const q = returnTo ? `?return_to=${encodeURIComponent(returnTo)}` : '';
    return this.unwrap(
      this.http.get<ApiResponse<{ authUrl: string }>>(`${this.base}/gitlab/auth/url${q}`)
    ).pipe(map((r) => r.authUrl));
  }
  gitlabRepositories(): Observable<GithubRepo[]> {
    return this.unwrap(this.http.get<ApiResponse<GithubRepo[]>>(`${this.base}/gitlab/repositories`));
  }
  gitlabDetect(repo: string): Observable<DetectedFramework> {
    return this.unwrap(
      this.http.get<ApiResponse<DetectedFramework>>(`${this.base}/gitlab/detect?repo=${encodeURIComponent(repo)}`)
    );
  }
  gitlabDisconnect(): Observable<unknown> {
    return this.unwrap(this.http.delete<ApiResponse<unknown>>(`${this.base}/gitlab/disconnect`));
  }

  // ── Workspaces ───────────────────────────────────────
  /**
   * A workspace groups related projects onto one server and network. The
   * deployment target is decided here, once, instead of on every project.
   */
  listWorkspaces(): Observable<Workspace[]> {
    return this.unwrap(this.http.get<ApiResponse<Workspace[]>>(`${this.base}/workspaces`));
  }
  getWorkspace(uuid: string): Observable<Workspace> {
    return this.unwrap(this.http.get<ApiResponse<Workspace>>(`${this.base}/workspaces/${uuid}`));
  }
  /** Every application, database and service in this workspace — rows, not a count. */
  listWorkspaceResources(uuid: string): Observable<WorkspaceResource[]> {
    return this.unwrap(
      this.http.get<ApiResponse<WorkspaceResource[]>>(`${this.base}/workspaces/${uuid}/resources`)
    );
  }
  /** Targets and regions this team may actually pick — plan and capacity aware. */
  workspaceOptions(): Observable<WorkspaceOptions> {
    return this.unwrap(
      this.http.get<ApiResponse<WorkspaceOptions>>(`${this.base}/workspaces/options`)
    );
  }
  createWorkspace(body: CreateWorkspaceRequest): Observable<Workspace> {
    return this.unwrap(this.http.post<ApiResponse<Workspace>>(`${this.base}/workspaces`, body));
  }
  updateWorkspace(uuid: string, body: { name?: string; description?: string }): Observable<Workspace> {
    return this.unwrap(
      this.http.patch<ApiResponse<Workspace>>(`${this.base}/workspaces/${uuid}`, body)
    );
  }
  deleteWorkspace(uuid: string): Observable<unknown> {
    return this.unwrap(this.http.delete<ApiResponse<unknown>>(`${this.base}/workspaces/${uuid}`));
  }
  addEnvironment(uuid: string, name: string): Observable<WorkspaceEnvironment> {
    return this.unwrap(
      this.http.post<ApiResponse<WorkspaceEnvironment>>(
        `${this.base}/workspaces/${uuid}/environments`,
        { name }
      )
    );
  }
  deleteEnvironment(uuid: string, environmentUuid: string): Observable<unknown> {
    return this.unwrap(
      this.http.delete<ApiResponse<unknown>>(
        `${this.base}/workspaces/${uuid}/environments/${environmentUuid}`
      )
    );
  }
  /**
   * Named groupings of resources within a workspace — "frontend", "backend",
   * "the database" — for the three-tier scenario a workspace exists for.
   */
  listWorkspaceProjects(uuid: string, environmentName?: string): Observable<WorkspaceProject[]> {
    const q = environmentName ? `?environment_name=${encodeURIComponent(environmentName)}` : '';
    return this.unwrap(
      this.http.get<ApiResponse<WorkspaceProject[]>>(`${this.base}/workspaces/${uuid}/projects${q}`)
    );
  }
  createWorkspaceProject(
    uuid: string,
    body: CreateWorkspaceProjectRequest
  ): Observable<WorkspaceProject> {
    return this.unwrap(
      this.http.post<ApiResponse<WorkspaceProject>>(`${this.base}/workspaces/${uuid}/projects`, body)
    );
  }
  deleteWorkspaceProject(uuid: string, projectUuid: string): Observable<unknown> {
    return this.unwrap(
      this.http.delete<ApiResponse<unknown>>(`${this.base}/workspaces/${uuid}/projects/${projectUuid}`)
    );
  }

  // ── Servers ──────────────────────────────────────────
  listServers(): Observable<Server[]> {
    return this.unwrap(this.http.get<ApiResponse<Server[]>>(`${this.base}/servers`));
  }
  getServer(uuid: string): Observable<Server> {
    return this.unwrap(this.http.get<ApiResponse<Server>>(`${this.base}/servers/${uuid}`));
  }
  getServerSettings(uuid: string): Observable<ServerSettings> {
    return this.unwrap(this.http.get<ApiResponse<ServerSettings>>(`${this.base}/servers/${uuid}/settings`));
  }
  updateServerSettings(uuid: string, body: { wildcardDomain: string | null }): Observable<ServerSettings> {
    return this.unwrap(
      this.http.patch<ApiResponse<ServerSettings>>(`${this.base}/servers/${uuid}/settings`, body)
    );
  }
  /** Applications, databases and services currently deployed on this server. */
  listServerResources(uuid: string): Observable<ServerResource[]> {
    return this.unwrap(
      this.http.get<ApiResponse<ServerResource[]>>(`${this.base}/servers/${uuid}/resources`)
    );
  }
  /** Liveness and disk headroom, probed over SSH when the screen asks for it. */
  getServerHealth(uuid: string): Observable<ServerHealth> {
    return this.unwrap(
      this.http.get<ApiResponse<ServerHealth>>(`${this.base}/servers/${uuid}/health`)
    );
  }
  createServer(
    body: Partial<Server> & {
      private_key_id: number;
      is_build_server?: boolean;
      is_swarm_manager?: boolean;
      is_swarm_worker?: boolean;
    }
  ): Observable<Server> {
    return this.unwrap(this.http.post<ApiResponse<Server>>(`${this.base}/servers`, body));
  }
  /** Full readiness report: SSH, OS, Docker, Compose, shared network, disk. */
  validateServer(uuid: string): Observable<ServerReadiness> {
    return this.unwrap(
      this.http.post<ApiResponse<ServerReadiness>>(`${this.base}/servers/${uuid}/validate`, {})
    );
  }
  /**
   * Install and configure Docker (log rotation, shared network) and re-check.
   * Idempotent, so it is safe to re-run on a partially configured host.
   */
  setUpServer(uuid: string): Observable<ServerSetupResult> {
    return this.unwrap(
      this.http.post<ApiResponse<ServerSetupResult>>(`${this.base}/servers/${uuid}/setup`, {})
    );
  }
  /** Reclaim disk space — dangling images, stopped containers, unused build cache. */
  dockerCleanup(uuid: string, pruneVolumes = false): Observable<{ success: boolean; output: string }> {
    return this.unwrap(
      this.http.post<ApiResponse<{ success: boolean; output: string }>>(
        `${this.base}/servers/${uuid}/docker-cleanup`,
        { prune_volumes: pruneVolumes }
      )
    );
  }
  deleteServer(uuid: string): Observable<unknown> {
    return this.unwrap(this.http.delete<ApiResponse<unknown>>(`${this.base}/servers/${uuid}`));
  }
  /** One-click local server (this machine, local Docker) for testing. */
  createLocalServer(): Observable<{ destinationId: number; dockerOk: boolean }> {
    return this.unwrap(
      this.http.post<ApiResponse<{ destinationId: number; dockerOk: boolean }>>(`${this.base}/servers/local`, {})
    );
  }

  // ── Applications ─────────────────────────────────────
  listApplications(environmentId?: number): Observable<Application[]> {
    const q = environmentId ? `?environment_id=${environmentId}` : '';
    return this.unwrap(this.http.get<ApiResponse<Application[]>>(`${this.base}/applications${q}`));
  }
  /**
   * The destination is resolved server-side from the workspace — never a raw
   * `destination_id` the client picks. `project_name` is optional: naming
   * "frontend" here creates that project if it does not exist yet.
   */
  createApplication(body: {
    name: string;
    workspace_uuid: string;
    environment_name?: string;
    project_name?: string;
    git_repository: string;
    git_branch?: string;
    build_pack?: string;
  }): Observable<Application> {
    return this.unwrap(this.http.post<ApiResponse<Application>>(`${this.base}/applications`, body));
  }
  getApplication(uuid: string): Observable<Application> {
    return this.unwrap(this.http.get<ApiResponse<Application>>(`${this.base}/applications/${uuid}`));
  }
  updateApplication(uuid: string, body: Partial<Application>): Observable<Application> {
    return this.unwrap(
      this.http.patch<ApiResponse<Application>>(`${this.base}/applications/${uuid}`, body)
    );
  }
  appLifecycle(uuid: string, action: 'start' | 'stop' | 'restart'): Observable<unknown> {
    return this.unwrap(
      this.http.post<ApiResponse<unknown>>(`${this.base}/applications/${uuid}/${action}`, {})
    );
  }
  listEnvVars(uuid: string): Observable<EnvVar[]> {
    return this.unwrap(this.http.get<ApiResponse<EnvVar[]>>(`${this.base}/applications/${uuid}/envs`));
  }
  upsertEnvVar(uuid: string, body: Partial<EnvVar> & { key: string; value: string }): Observable<EnvVar> {
    return this.unwrap(
      this.http.post<ApiResponse<EnvVar>>(`${this.base}/applications/${uuid}/envs`, body)
    );
  }
  deleteEnvVar(uuid: string, key: string): Observable<unknown> {
    return this.unwrap(
      this.http.delete<ApiResponse<unknown>>(`${this.base}/applications/${uuid}/envs/${key}`)
    );
  }
  listDeployments(uuid: string): Observable<DeploymentHistoryItem[]> {
    return this.unwrap(
      this.http.get<ApiResponse<DeploymentHistoryItem[]>>(
        `${this.base}/applications/${uuid}/deployments`
      )
    );
  }

  // ── Databases (Phase 3) ──────────────────────────────
  listDatabases(): Observable<Database[]> {
    return this.unwrap(this.http.get<ApiResponse<Database[]>>(`${this.base}/databases`));
  }
  /**
   * As with applications, the destination is resolved from the workspace, not
   * client-chosen. `credentials` is optional and per-field: any column left
   * out (e.g. `postgres_password`) keeps the backend's own default or
   * securely auto-generated value — only what's actually supplied here
   * overrides it.
   */
  createDatabase(
    type: DatabaseType,
    body: { name: string; workspace_uuid: string; environment_name?: string; project_name?: string; credentials?: Record<string, string> }
  ): Observable<Database> {
    return this.unwrap(this.http.post<ApiResponse<Database>>(`${this.base}/databases/${type}`, body));
  }
  dbLifecycle(
    type: DatabaseType,
    uuid: string,
    action: 'start' | 'stop' | 'restart'
  ): Observable<unknown> {
    return this.unwrap(
      this.http.post<ApiResponse<unknown>>(`${this.base}/databases/${type}/${uuid}/${action}`, {})
    );
  }
  getDatabase(type: DatabaseType, uuid: string): Observable<DatabaseDetail> {
    return this.unwrap(
      this.http.get<ApiResponse<DatabaseDetail>>(`${this.base}/databases/${type}/${uuid}`)
    );
  }
  /** Only takes effect on the next start/restart — see the backend's own note on why a running container isn't live-reconfigured. */
  updateDatabaseCredentials(
    type: DatabaseType,
    uuid: string,
    updates: Record<string, string>
  ): Observable<DatabaseDetail> {
    return this.unwrap(
      this.http.patch<ApiResponse<DatabaseDetail>>(`${this.base}/databases/${type}/${uuid}/credentials`, updates)
    );
  }
  backupNow(type: DatabaseType, uuid: string): Observable<{ success: boolean; filename: string }> {
    return this.unwrap(
      this.http.post<ApiResponse<{ success: boolean; filename: string }>>(
        `${this.base}/databases/${type}/${uuid}/backup-now`,
        {}
      )
    );
  }
  deleteDatabase(type: DatabaseType, uuid: string): Observable<unknown> {
    return this.unwrap(this.http.delete<ApiResponse<unknown>>(`${this.base}/databases/${type}/${uuid}`));
  }

  // ── Scheduled backups ────────────────────────────────
  listBackupSchedules(type: DatabaseType, uuid: string): Observable<BackupSchedule[]> {
    return this.unwrap(
      this.http.get<ApiResponse<BackupSchedule[]>>(`${this.base}/databases/${type}/${uuid}/backups`)
    );
  }
  createBackupSchedule(
    type: DatabaseType,
    uuid: string,
    body: { frequency: string; save_s3?: boolean; number_of_backups_locally?: number }
  ): Observable<BackupSchedule> {
    return this.unwrap(
      this.http.post<ApiResponse<BackupSchedule>>(
        `${this.base}/databases/${type}/${uuid}/backups`,
        body
      )
    );
  }
  deleteBackupSchedule(scheduleUuid: string): Observable<unknown> {
    return this.unwrap(
      this.http.delete<ApiResponse<unknown>>(`${this.base}/databases/backups/${scheduleUuid}`)
    );
  }
  listBackupExecutions(scheduleUuid: string): Observable<BackupExecution[]> {
    return this.unwrap(
      this.http.get<ApiResponse<BackupExecution[]>>(
        `${this.base}/databases/backups/${scheduleUuid}/executions`
      )
    );
  }
  /**
   * The download streams a file, not the JSON envelope — so it bypasses
   * `unwrap` and asks for a blob. Errors still arrive as JSON, which the caller
   * has to read back out of the blob.
   */
  downloadBackupUrl(executionUuid: string): string {
    return `${this.base}/databases/backups/executions/${executionUuid}/download`;
  }
  downloadBackup(executionUuid: string): Observable<Blob> {
    return this.http.get(this.downloadBackupUrl(executionUuid), { responseType: 'blob' });
  }

  // ── Services (Phase 4) ───────────────────────────────
  listServices(): Observable<Service[]> {
    return this.unwrap(this.http.get<ApiResponse<Service[]>>(`${this.base}/services`));
  }
  listServiceTemplates(): Observable<ServiceTemplate[]> {
    return this.unwrap(
      this.http.get<ApiResponse<ServiceTemplate[]>>(`${this.base}/services/templates`)
    );
  }
  getServiceTemplate(name: string): Observable<ServiceTemplate> {
    return this.unwrap(
      this.http.get<ApiResponse<ServiceTemplate>>(`${this.base}/services/templates/${encodeURIComponent(name)}`)
    );
  }
  /** As with applications, the destination is resolved from the workspace, not client-chosen. */
  createService(body: {
    name: string;
    workspace_uuid: string;
    environment_name?: string;
    project_name?: string;
    docker_compose_raw: string;
  }): Observable<Service> {
    return this.unwrap(this.http.post<ApiResponse<Service>>(`${this.base}/services`, body));
  }
  createServiceFromTemplate(body: {
    template: string;
    name: string;
    workspace_uuid: string;
    environment_name?: string;
    project_name?: string;
  }): Observable<Service> {
    return this.unwrap(
      this.http.post<ApiResponse<Service>>(`${this.base}/services/from-template`, body)
    );
  }
  /** Returns the stack plus the containers and databases its compose file declares. */
  getService(uuid: string): Observable<ServiceDetail> {
    return this.unwrap(this.http.get<ApiResponse<ServiceDetail>>(`${this.base}/services/${uuid}`));
  }
  serviceLifecycle(uuid: string, action: 'start' | 'stop' | 'restart'): Observable<unknown> {
    return this.unwrap(
      this.http.post<ApiResponse<unknown>>(`${this.base}/services/${uuid}/${action}`, {})
    );
  }
  deleteService(uuid: string): Observable<unknown> {
    return this.unwrap(this.http.delete<ApiResponse<unknown>>(`${this.base}/services/${uuid}`));
  }

  // ── Scheduled tasks (Phase 5) ────────────────────────
  listTasks(uuid: string): Observable<ScheduledTask[]> {
    return this.unwrap(this.http.get<ApiResponse<ScheduledTask[]>>(`${this.base}/applications/${uuid}/tasks`));
  }
  createTask(uuid: string, body: { name: string; command: string; frequency: string }): Observable<ScheduledTask> {
    return this.unwrap(this.http.post<ApiResponse<ScheduledTask>>(`${this.base}/applications/${uuid}/tasks`, body));
  }
  runTask(uuid: string, taskUuid: string): Observable<unknown> {
    return this.unwrap(this.http.post<ApiResponse<unknown>>(`${this.base}/applications/${uuid}/tasks/${taskUuid}/run`, {}));
  }
  deleteTask(uuid: string, taskUuid: string): Observable<unknown> {
    return this.unwrap(this.http.delete<ApiResponse<unknown>>(`${this.base}/applications/${uuid}/tasks/${taskUuid}`));
  }

  // ── Volumes (Phase 5) ────────────────────────────────
  listVolumes(uuid: string): Observable<AppVolumes> {
    return this.unwrap(this.http.get<ApiResponse<AppVolumes>>(`${this.base}/applications/${uuid}/volumes`));
  }
  createPersistentVolume(uuid: string, body: { name: string; mount_path: string; host_path?: string }): Observable<PersistentVolume> {
    return this.unwrap(this.http.post<ApiResponse<PersistentVolume>>(`${this.base}/applications/${uuid}/volumes/persistent`, body));
  }

  // ── Ops (Phase 5) ────────────────────────────────────
  appStatus(uuid: string): Observable<{ status: string }> {
    return this.unwrap(this.http.get<ApiResponse<{ status: string }>>(`${this.base}/applications/${uuid}/status`));
  }
  appMetrics(uuid: string): Observable<{ metrics: string }> {
    return this.unwrap(this.http.get<ApiResponse<{ metrics: string }>>(`${this.base}/applications/${uuid}/metrics`));
  }
  /** Structured per-container usage — a snapshot, not a series. */
  appUsage(uuid: string): Observable<ContainerUsage[]> {
    return this.unwrap(
      this.http.get<ApiResponse<ContainerUsage[]>>(`${this.base}/applications/${uuid}/usage`)
    );
  }
  appExec(uuid: string, command: string): Observable<{ exitCode: number; output: string }> {
    return this.unwrap(this.http.post<ApiResponse<{ exitCode: number; output: string }>>(`${this.base}/applications/${uuid}/exec`, { command }));
  }

  // ── Tags (Phase 5) ───────────────────────────────────
  listTags(): Observable<Tag[]> {
    return this.unwrap(this.http.get<ApiResponse<Tag[]>>(`${this.base}/tags`));
  }
  createTag(name: string): Observable<Tag> {
    return this.unwrap(this.http.post<ApiResponse<Tag>>(`${this.base}/tags`, { name }));
  }
  deleteTag(uuid: string): Observable<unknown> {
    return this.unwrap(this.http.delete<ApiResponse<unknown>>(`${this.base}/tags/${uuid}`));
  }

  // ── Firewall / Security (Phase 6) ────────────────────
  getFirewall(uuid: string): Observable<FirewallConfig> {
    return this.unwrap(this.http.get<ApiResponse<FirewallConfig>>(`${this.base}/applications/${uuid}/firewall`));
  }
  updateFirewall(uuid: string, body: Partial<FirewallConfig>): Observable<FirewallConfig> {
    return this.unwrap(this.http.patch<ApiResponse<FirewallConfig>>(`${this.base}/applications/${uuid}/firewall`, body));
  }
  listFirewallRules(uuid: string): Observable<FirewallRule[]> {
    return this.unwrap(this.http.get<ApiResponse<FirewallRule[]>>(`${this.base}/applications/${uuid}/firewall/rules`));
  }
  createFirewallRule(uuid: string, body: { name: string; conditions: unknown[]; action?: string }): Observable<FirewallRule> {
    return this.unwrap(this.http.post<ApiResponse<FirewallRule>>(`${this.base}/applications/${uuid}/firewall/rules`, body));
  }
  deleteFirewallRule(uuid: string, ruleId: number): Observable<unknown> {
    return this.unwrap(this.http.delete<ApiResponse<unknown>>(`${this.base}/applications/${uuid}/firewall/rules/${ruleId}`));
  }
  deployFirewall(uuid: string): Observable<{ rules: number }> {
    return this.unwrap(this.http.post<ApiResponse<{ rules: number }>>(`${this.base}/applications/${uuid}/firewall/deploy`, {}));
  }
  /** Detections recorded by the agent, most recent first. */
  listFirewallAlerts(uuid: string): Observable<Record<string, unknown>[]> {
    return this.unwrap(
      this.http.get<ApiResponse<Record<string, unknown>[]>>(`${this.base}/applications/${uuid}/firewall/alerts`)
    );
  }
  listFirewallTraffic(uuid: string): Observable<Record<string, unknown>[]> {
    return this.unwrap(
      this.http.get<ApiResponse<Record<string, unknown>[]>>(`${this.base}/applications/${uuid}/firewall/traffic`)
    );
  }

  // ── Geo-blocking ─────────────────────────────────────
  /** Every country, named in the requested language, grouped by continent. */
  listCountries(locale: string): Observable<CountryCatalogue> {
    return this.unwrap(
      this.http.get<ApiResponse<CountryCatalogue>>(
        `${this.base}/firewall/countries?locale=${encodeURIComponent(locale)}`
      )
    );
  }
  /** Null when no geo rule is set for this application. */
  getGeoBlocking(uuid: string, locale: string): Observable<GeoSelection | null> {
    return this.unwrap(
      this.http.get<ApiResponse<GeoSelection | null>>(
        `${this.base}/applications/${uuid}/firewall/geo?locale=${encodeURIComponent(locale)}`
      )
    );
  }
  setGeoBlocking(
    uuid: string,
    body: { mode: GeoMode; countries?: string[]; continents?: string[] }
  ): Observable<GeoRuleResult> {
    return this.unwrap(
      this.http.put<ApiResponse<GeoRuleResult>>(`${this.base}/applications/${uuid}/firewall/geo`, body)
    );
  }
  removeGeoBlocking(uuid: string): Observable<ApplyRequired> {
    return this.unwrap(
      this.http.delete<ApiResponse<ApplyRequired>>(`${this.base}/applications/${uuid}/firewall/geo`)
    );
  }

  // ── Rate limiting ────────────────────────────────────
  listRateLimitTemplates(): Observable<RateLimitTemplate[]> {
    return this.unwrap(
      this.http.get<ApiResponse<RateLimitTemplate[]>>(`${this.base}/firewall/rate-limit-templates`)
    );
  }
  /** Null when no rate limit is set. */
  getRateLimit(uuid: string): Observable<RateLimitSettings | null> {
    return this.unwrap(
      this.http.get<ApiResponse<RateLimitSettings | null>>(
        `${this.base}/applications/${uuid}/firewall/rate-limit`
      )
    );
  }
  applyRateLimitTemplate(uuid: string, template: string): Observable<RateLimitSettings & ApplyRequired> {
    return this.unwrap(
      this.http.put<ApiResponse<RateLimitSettings & ApplyRequired>>(
        `${this.base}/applications/${uuid}/firewall/rate-limit/template`,
        { template }
      )
    );
  }
  setCustomRateLimit(
    uuid: string,
    body: { averagePerSecond: number; burst: number; periodSeconds: number; concurrencyLimit: number }
  ): Observable<RateLimitSettings & ApplyRequired> {
    return this.unwrap(
      this.http.put<ApiResponse<RateLimitSettings & ApplyRequired>>(
        `${this.base}/applications/${uuid}/firewall/rate-limit/custom`,
        body
      )
    );
  }
  removeRateLimit(uuid: string): Observable<ApplyRequired> {
    return this.unwrap(
      this.http.delete<ApiResponse<ApplyRequired>>(`${this.base}/applications/${uuid}/firewall/rate-limit`)
    );
  }
  installCrowdSec(serverUuid: string): Observable<{ success: boolean; output: string }> {
    return this.unwrap(this.http.post<ApiResponse<{ success: boolean; output: string }>>(`${this.base}/servers/${serverUuid}/crowdsec/install`, {}));
  }
  crowdSecStatus(serverUuid: string): Observable<CrowdSecStatus> {
    return this.unwrap(this.http.get<ApiResponse<CrowdSecStatus>>(`${this.base}/servers/${serverUuid}/crowdsec/status`));
  }

  // ── Pipelines (Phase 7) ──────────────────────────────
  getPipeline(uuid: string): Observable<PipelineConfig> {
    return this.unwrap(this.http.get<ApiResponse<PipelineConfig>>(`${this.base}/applications/${uuid}/pipeline`));
  }
  updatePipeline(
    uuid: string,
    body: Partial<Pick<PipelineConfig, 'enabled' | 'stages' | 'trigger_mode' | 'trigger_branches'>>
  ): Observable<PipelineConfig> {
    return this.unwrap(
      this.http.patch<ApiResponse<PipelineConfig>>(`${this.base}/applications/${uuid}/pipeline`, body)
    );
  }
  triggerPipeline(uuid: string, branch?: string): Observable<{ executionUuid: string }> {
    return this.unwrap(
      this.http.post<ApiResponse<{ executionUuid: string }>>(
        `${this.base}/applications/${uuid}/pipeline/trigger`,
        branch ? { branch } : {}
      )
    );
  }
  listPipelineExecutions(uuid: string): Observable<PipelineExecution[]> {
    return this.unwrap(this.http.get<ApiResponse<PipelineExecution[]>>(`${this.base}/applications/${uuid}/pipeline/executions`));
  }
  /** One execution with its jobs and scan results. */
  getPipelineExecution(executionUuid: string): Observable<PipelineExecution> {
    return this.unwrap(
      this.http.get<ApiResponse<PipelineExecution>>(`${this.base}/pipeline/executions/${executionUuid}`)
    );
  }
  rerunPipelineExecution(executionUuid: string): Observable<{ executionUuid: string }> {
    return this.unwrap(
      this.http.post<ApiResponse<{ executionUuid: string }>>(
        `${this.base}/pipeline/executions/${executionUuid}/rerun`,
        {}
      )
    );
  }
  deletePipelineExecution(executionUuid: string): Observable<{ deleted: boolean }> {
    return this.unwrap(
      this.http.delete<ApiResponse<{ deleted: boolean }>>(`${this.base}/pipeline/executions/${executionUuid}`)
    );
  }

  // ── Previews & rollback ──────────────────────────────
  listPreviews(uuid: string): Observable<ApplicationPreview[]> {
    return this.unwrap(
      this.http.get<ApiResponse<ApplicationPreview[]>>(`${this.base}/applications/${uuid}/previews`)
    );
  }
  /** Past deployments that can be redeployed — the current one is excluded. */
  listRollbackTargets(uuid: string): Observable<RollbackTarget[]> {
    return this.unwrap(
      this.http.get<ApiResponse<RollbackTarget[]>>(`${this.base}/applications/${uuid}/rollback-targets`)
    );
  }
  rollback(uuid: string, deploymentUuid: string): Observable<DeployResponse> {
    return this.unwrap(
      this.http.post<ApiResponse<DeployResponse>>(`${this.base}/applications/${uuid}/rollback`, {
        deployment_uuid: deploymentUuid,
      })
    );
  }

  // ── Notifications (Phase 8) ──────────────────────────
  getNotificationSettings(channel: string): Observable<Record<string, unknown>> {
    return this.unwrap(this.http.get<ApiResponse<Record<string, unknown>>>(`${this.base}/notifications/${channel}`));
  }
  updateNotificationSettings(channel: string, body: Record<string, unknown>): Observable<Record<string, unknown>> {
    return this.unwrap(this.http.put<ApiResponse<Record<string, unknown>>>(`${this.base}/notifications/${channel}`, body));
  }
  testNotification(channel: string): Observable<{ sent: boolean }> {
    return this.unwrap(this.http.post<ApiResponse<{ sent: boolean }>>(`${this.base}/notifications/${channel}/test`, {}));
  }

  // ── Team (Phase 9) ───────────────────────────────────
  listMembers(): Observable<{ user_id: number; name: string; email: string; role: string }[]> {
    return this.unwrap(this.http.get<ApiResponse<{ user_id: number; name: string; email: string; role: string }[]>>(`${this.base}/team/members`));
  }
  listInvitations(): Observable<{ uuid: string; email: string; role: string; link: string }[]> {
    return this.unwrap(this.http.get<ApiResponse<{ uuid: string; email: string; role: string; link: string }[]>>(`${this.base}/team/invitations`));
  }
  createInvitation(body: { email: string; role?: string }): Observable<{ uuid: string; link: string }> {
    return this.unwrap(this.http.post<ApiResponse<{ uuid: string; link: string }>>(`${this.base}/team/invitations`, body));
  }
  deleteInvitation(uuid: string): Observable<unknown> {
    return this.unwrap(this.http.delete<ApiResponse<unknown>>(`${this.base}/team/invitations/${uuid}`));
  }
  setMemberRole(userId: number, role: string): Observable<unknown> {
    return this.unwrap(this.http.patch<ApiResponse<unknown>>(`${this.base}/team/members/${userId}/role`, { role }));
  }

  // ── Subscription (Phase 9) ───────────────────────────
  getSubscription(): Observable<{ plan: string; appLimit: number; serverLimit: number; expiresAt: string | null }> {
    return this.unwrap(this.http.get<ApiResponse<{ plan: string; appLimit: number; serverLimit: number; expiresAt: string | null }>>(`${this.base}/subscription`));
  }
  listPlans(): Observable<Record<string, unknown>[]> {
    return this.unwrap(this.http.get<ApiResponse<Record<string, unknown>[]>>(`${this.base}/subscription/plans`));
  }
  getQuota(): Observable<{ apps: { used: number; limit: number; ok: boolean }; servers: { used: number; limit: number; ok: boolean } }> {
    return this.unwrap(this.http.get<ApiResponse<{ apps: { used: number; limit: number; ok: boolean }; servers: { used: number; limit: number; ok: boolean } }>>(`${this.base}/subscription/quota`));
  }
  checkout(priceId: string): Observable<{ url: string }> {
    return this.unwrap(this.http.post<ApiResponse<{ url: string }>>(`${this.base}/subscription/checkout`, { price_id: priceId }));
  }
  changePlan(plan: string): Observable<unknown> {
    return this.unwrap(this.http.post<ApiResponse<unknown>>(`${this.base}/subscription/change-plan`, { plan }));
  }

  // ── Settings / instance (Phase 10) ───────────────────
  getInstanceSettings(): Observable<Record<string, unknown>> {
    return this.unwrap(this.http.get<ApiResponse<Record<string, unknown>>>(`${this.base}/settings/instance`));
  }
  updateInstanceSettings(body: Record<string, unknown>): Observable<Record<string, unknown>> {
    return this.unwrap(this.http.patch<ApiResponse<Record<string, unknown>>>(`${this.base}/settings/instance`, body));
  }
  getVersion(): Observable<{ version: string; autoUpdate: boolean }> {
    return this.unwrap(this.http.get<ApiResponse<{ version: string; autoUpdate: boolean }>>(`${this.base}/settings/version`));
  }
  search(q: string): Observable<{ type: string; uuid: string; name: string }[]> {
    return this.unwrap(this.http.get<ApiResponse<{ type: string; uuid: string; name: string }[]>>(`${this.base}/settings/search?q=${encodeURIComponent(q)}`));
  }

  // ── Shell (me / catalog) ─────────────────────────────
  me(): Observable<{
    id: number;
    name: string;
    email: string;
    photoUrl: string | null;
    idemRole: string | null;
    role: string | null;
    team: { id: number; name: string } | null;
  }> {
    return this.unwrap(this.http.get<ApiResponse<{ id: number; name: string; email: string; photoUrl: string | null; idemRole: string | null; role: string | null; team: { id: number; name: string } | null }>>(`${this.base}/me`));
  }
  listSources(): Observable<{ uuid: string; name: string; provider: string; organization: string | null; html_url: string }[]> {
    return this.unwrap(this.http.get<ApiResponse<{ uuid: string; name: string; provider: string; organization: string | null; html_url: string }[]>>(`${this.base}/sources`));
  }
  listS3Storages(): Observable<S3Storage[]> {
    return this.unwrap(this.http.get<ApiResponse<S3Storage[]>>(`${this.base}/s3-storages`));
  }
  /** Key and secret are encrypted server-side and never returned. */
  createS3Storage(body: {
    name: string;
    bucket: string;
    key: string;
    secret: string;
    region?: string;
    endpoint?: string;
    description?: string;
  }): Observable<S3Storage> {
    return this.unwrap(this.http.post<ApiResponse<S3Storage>>(`${this.base}/s3-storages`, body));
  }
  deleteS3Storage(uuid: string): Observable<unknown> {
    return this.unwrap(this.http.delete<ApiResponse<unknown>>(`${this.base}/s3-storages/${uuid}`));
  }
  quickDeploy(body: {
    name: string;
    git_repository?: string;
    git_branch?: string;
    build_pack?: string;
    template?: string;
    /** Deploy into this existing workspace. */
    workspace_uuid?: string;
    /** Find-or-create a workspace by name. */
    workspace_name?: string;
    base_directory?: string;
    install_command?: string;
    build_command?: string;
    start_command?: string;
    ports_exposes?: string;
    /** Saved before the first deployment, so a build that needs one has it. */
    environment_variables?: { key: string; value: string }[];
  }): Observable<{ kind: 'application' | 'service'; deploymentUuid?: string; serviceUuid?: string; server: string }> {
    return this.unwrap(
      this.http.post<ApiResponse<{ kind: 'application' | 'service'; deploymentUuid?: string; serviceUuid?: string; server: string }>>(
        `${this.base}/quick-deploy`,
        body
      )
    );
  }

  getDeployment(deploymentUuid: string): Observable<any> {
    return this.unwrap(
      this.http.get<ApiResponse<any>>(`${this.base}/deploy/${deploymentUuid}`)
    );
  }

  // ── Shared variables (Phase 5) ───────────────────────
  listSharedVariables(scope: string, scopeId: number): Observable<{ id: number; key: string; value: string | null }[]> {
    return this.unwrap(this.http.get<ApiResponse<{ id: number; key: string; value: string | null }[]>>(`${this.base}/shared-variables/${scope}/${scopeId}`));
  }
  upsertSharedVariable(scope: string, scopeId: number, body: { key: string; value: string }): Observable<unknown> {
    return this.unwrap(this.http.post<ApiResponse<unknown>>(`${this.base}/shared-variables/${scope}/${scopeId}`, body));
  }

  // ── Deploy ───────────────────────────────────────────
  deploy(uuid: string, commit?: string): Observable<DeployResponse> {
    return this.unwrap(
      this.http.post<ApiResponse<DeployResponse>>(`${this.base}/deploy`, { uuid, commit })
    );
  }

  // ── Private keys (Phase 1) ───────────────────────────
  listPrivateKeys(): Observable<PrivateKey[]> {
    return this.unwrap(this.http.get<ApiResponse<PrivateKey[]>>(`${this.base}/security/keys`));
  }
  createPrivateKey(body: {
    name: string;
    private_key: string;
    description?: string;
  }): Observable<PrivateKey> {
    return this.unwrap(
      this.http.post<ApiResponse<PrivateKey>>(`${this.base}/security/keys`, body)
    );
  }

  // ── Personal access tokens ───────────────────────────
  listApiTokens(): Observable<ApiToken[]> {
    return this.unwrap(this.http.get<ApiResponse<ApiToken[]>>(`${this.base}/security/api-tokens`));
  }
  /** The response carries the plaintext once; it cannot be fetched again. */
  createApiToken(body: {
    name: string;
    abilities?: string[];
    expiresInDays?: number;
  }): Observable<IssuedApiToken> {
    return this.unwrap(
      this.http.post<ApiResponse<IssuedApiToken>>(`${this.base}/security/api-tokens`, body)
    );
  }
  revokeApiToken(id: number): Observable<unknown> {
    return this.unwrap(
      this.http.delete<ApiResponse<unknown>>(`${this.base}/security/api-tokens/${id}`)
    );
  }

  // ── Cloud provider credentials ───────────────────────
  listCloudTokens(): Observable<CloudToken[]> {
    return this.unwrap(this.http.get<ApiResponse<CloudToken[]>>(`${this.base}/cloud/tokens`));
  }
  createCloudToken(body: { provider: string; token: string; name?: string }): Observable<CloudToken> {
    return this.unwrap(this.http.post<ApiResponse<CloudToken>>(`${this.base}/cloud/tokens`, body));
  }
  deleteCloudToken(id: number): Observable<unknown> {
    return this.unwrap(this.http.delete<ApiResponse<unknown>>(`${this.base}/cloud/tokens/${id}`));
  }

  // ── Destinations (Phase 1) ───────────────────────────
  listDestinations(serverUuid: string): Observable<Destination[]> {
    return this.unwrap(
      this.http.get<ApiResponse<Destination[]>>(`${this.base}/servers/${serverUuid}/destinations`)
    );
  }
  createDestination(serverUuid: string, body: { network?: string }): Observable<Destination> {
    return this.unwrap(
      this.http.post<ApiResponse<Destination>>(
        `${this.base}/servers/${serverUuid}/destinations`,
        body
      )
    );
  }
  deleteDestination(uuid: string): Observable<unknown> {
    return this.unwrap(this.http.delete<ApiResponse<unknown>>(`${this.base}/destinations/${uuid}`));
  }

  // ── SSL certificates (server-scoped) ─────────────────
  listCertificates(serverUuid: string): Observable<SslCertificate[]> {
    return this.unwrap(
      this.http.get<ApiResponse<SslCertificate[]>>(`${this.base}/servers/${serverUuid}/certificates`)
    );
  }
  generateCertificate(
    serverUuid: string,
    body: { common_name: string; is_ca?: boolean }
  ): Observable<SslCertificate> {
    return this.unwrap(
      this.http.post<ApiResponse<SslCertificate>>(
        `${this.base}/servers/${serverUuid}/certificates`,
        body
      )
    );
  }
  deleteCertificate(serverUuid: string, id: number): Observable<unknown> {
    return this.unwrap(
      this.http.delete<ApiResponse<unknown>>(`${this.base}/servers/${serverUuid}/certificates/${id}`)
    );
  }

  // ── Proxy (Phase 1) ──────────────────────────────────
  getProxyStatus(serverUuid: string): Observable<ProxyStatus> {
    return this.unwrap(
      this.http.get<ApiResponse<ProxyStatus>>(`${this.base}/servers/${serverUuid}/proxy`)
    );
  }
  startProxy(serverUuid: string): Observable<{ success: boolean; output: string }> {
    return this.unwrap(
      this.http.post<ApiResponse<{ success: boolean; output: string }>>(
        `${this.base}/servers/${serverUuid}/proxy/start`,
        {}
      )
    );
  }
  stopProxy(serverUuid: string): Observable<{ success: boolean; output: string }> {
    return this.unwrap(
      this.http.post<ApiResponse<{ success: boolean; output: string }>>(
        `${this.base}/servers/${serverUuid}/proxy/stop`,
        {}
      )
    );
  }

  // ── Instance administration ──────────────────────────
  // Every one of these is refused by the API for non-administrators; the
  // route guard only decides whether the screen is offered.
  adminOverview(): Observable<InstanceOverview> {
    return this.unwrap(this.http.get<ApiResponse<InstanceOverview>>(`${this.base}/admin/overview`));
  }
  adminTeams(): Observable<AdminTeamRow[]> {
    return this.unwrap(this.http.get<ApiResponse<AdminTeamRow[]>>(`${this.base}/admin/teams`));
  }
  adminUsers(): Observable<AdminUserRow[]> {
    return this.unwrap(this.http.get<ApiResponse<AdminUserRow[]>>(`${this.base}/admin/users`));
  }
  adminServers(): Observable<{ servers: AdminServerRow[]; stats: ServerFleetStats }> {
    return this.unwrap(
      this.http.get<ApiResponse<{ servers: AdminServerRow[]; stats: ServerFleetStats }>>(
        `${this.base}/admin/servers`
      )
    );
  }
  /** The only way a server becomes part of the shared IDEM-managed fleet. */
  adminCreateManagedServer(body: {
    name: string;
    description?: string;
    ip: string;
    port?: number;
    user?: string;
    private_key_id: number;
    country_code?: string;
    region?: string;
    city?: string;
  }): Observable<unknown> {
    return this.unwrap(this.http.post<ApiResponse<unknown>>(`${this.base}/admin/servers`, body));
  }
  adminUpdateServerFleet(
    uuid: string,
    patch: { idem_managed?: boolean; country_code?: string | null; region?: string | null; city?: string | null }
  ): Observable<unknown> {
    return this.unwrap(this.http.patch<ApiResponse<unknown>>(`${this.base}/admin/servers/${uuid}`, patch));
  }

  // ── SSH keys (beyond create/list) ────────────────────
  /**
   * Generate a keypair server-side. The private half is stored encrypted and
   * never returned; the response carries only the public line to install on
   * the target host.
   */
  generatePrivateKey(body: {
    name: string;
    type?: SshKeyType;
    description?: string;
    is_git_related?: boolean;
  }): Observable<GeneratedPrivateKey> {
    return this.unwrap(
      this.http.post<ApiResponse<GeneratedPrivateKey>>(`${this.base}/security/keys/generate`, body)
    );
  }
  /** The `authorized_keys` line for an existing key, derived on demand. */
  getPublicKey(uuid: string): Observable<string> {
    return this.unwrap(
      this.http.get<ApiResponse<{ public_key: string }>>(`${this.base}/security/keys/${uuid}/public`)
    ).pipe(map((r) => r.public_key));
  }
  deletePrivateKey(uuid: string): Observable<unknown> {
    return this.unwrap(this.http.delete<ApiResponse<unknown>>(`${this.base}/security/keys/${uuid}`));
  }

  // ── Cloud-init scripts ───────────────────────────────
  listInitScripts(): Observable<CloudInitScript[]> {
    return this.unwrap(this.http.get<ApiResponse<CloudInitScript[]>>(`${this.base}/cloud/init-scripts`));
  }
  createInitScript(body: { name: string; script: string }): Observable<CloudInitScript> {
    return this.unwrap(
      this.http.post<ApiResponse<CloudInitScript>>(`${this.base}/cloud/init-scripts`, body)
    );
  }
  deleteInitScript(id: number): Observable<unknown> {
    return this.unwrap(this.http.delete<ApiResponse<unknown>>(`${this.base}/cloud/init-scripts/${id}`));
  }

  // ── Hetzner provisioning ─────────────────────────────
  // The token stays server-side: the client passes its id, never its value.
  hetznerLocations(tokenId: number): Observable<HetznerLocation[]> {
    return this.unwrap(
      this.http.get<ApiResponse<HetznerLocation[]>>(`${this.base}/cloud/hetzner/locations?token_id=${tokenId}`)
    );
  }
  hetznerServerTypes(tokenId: number): Observable<HetznerServerType[]> {
    return this.unwrap(
      this.http.get<ApiResponse<HetznerServerType[]>>(`${this.base}/cloud/hetzner/server-types?token_id=${tokenId}`)
    );
  }
  hetznerCreateServer(body: {
    token_id: number;
    name: string;
    server_type: string;
    image: string;
    location?: string;
    user_data?: string;
  }): Observable<unknown> {
    return this.unwrap(this.http.post<ApiResponse<unknown>>(`${this.base}/cloud/hetzner/servers`, body));
  }

  // ── Application volumes & tasks (completing the set) ──
  deletePersistentVolume(uuid: string, id: number): Observable<unknown> {
    return this.unwrap(
      this.http.delete<ApiResponse<unknown>>(`${this.base}/applications/${uuid}/volumes/persistent/${id}`)
    );
  }
  /** A file mounted into the container from content stored here. */
  createFileVolume(
    uuid: string,
    body: { mount_path: string; content: string }
  ): Observable<FileVolume> {
    return this.unwrap(
      this.http.post<ApiResponse<FileVolume>>(`${this.base}/applications/${uuid}/volumes/files`, body)
    );
  }
  listTaskExecutions(uuid: string, taskUuid: string): Observable<TaskExecution[]> {
    return this.unwrap(
      this.http.get<ApiResponse<TaskExecution[]>>(
        `${this.base}/applications/${uuid}/tasks/${taskUuid}/executions`
      )
    );
  }

  // ── Proxy configuration ──────────────────────────────
  /** The generated Traefik configuration, for inspection. */
  getProxyConfiguration(serverUuid: string): Observable<string> {
    return this.unwrap(
      this.http.get<ApiResponse<{ configuration?: string }>>(
        `${this.base}/servers/${serverUuid}/proxy/configuration`
      )
    ).pipe(map((r) => r.configuration ?? ''));
  }

  // ── CrowdSec bouncers ────────────────────────────────
  addCrowdSecBouncer(serverUuid: string, name: string): Observable<{ key?: string }> {
    return this.unwrap(
      this.http.post<ApiResponse<{ key?: string }>>(
        `${this.base}/servers/${serverUuid}/crowdsec/bouncers`,
        { name }
      )
    );
  }

  // ── Tags (attach / detach) ───────────────────────────
  /** Tags currently attached to one resource — the read side of attach/detach. */
  listTagsForResource(taggableType: string, taggableId: number): Observable<Tag[]> {
    return this.unwrap(
      this.http.get<ApiResponse<Tag[]>>(
        `${this.base}/tags/for/${encodeURIComponent(taggableType)}/${taggableId}`
      )
    );
  }
  // Field names match the API's Eloquent-style morph columns (taggable_*).
  attachTag(uuid: string, body: { taggable_type: string; taggable_id: number }): Observable<unknown> {
    return this.unwrap(this.http.post<ApiResponse<unknown>>(`${this.base}/tags/${uuid}/attach`, body));
  }
  detachTag(uuid: string, body: { taggable_type: string; taggable_id: number }): Observable<unknown> {
    return this.unwrap(this.http.post<ApiResponse<unknown>>(`${this.base}/tags/${uuid}/detach`, body));
  }

  // ── Team (completing the set) ────────────────────────
  getTeam(): Observable<TeamInfo> {
    return this.unwrap(this.http.get<ApiResponse<TeamInfo>>(`${this.base}/team`));
  }
  updateTeam(body: { name?: string; description?: string }): Observable<TeamInfo> {
    return this.unwrap(this.http.patch<ApiResponse<TeamInfo>>(`${this.base}/team`, body));
  }
  removeMember(userId: number): Observable<unknown> {
    return this.unwrap(this.http.delete<ApiResponse<unknown>>(`${this.base}/team/members/${userId}`));
  }

  // ── Subscription (completing the set) ────────────────
  /** Stripe customer portal — returns the URL to send the browser to. */
  billingPortal(): Observable<{ url: string }> {
    return this.unwrap(this.http.post<ApiResponse<{ url: string }>>(`${this.base}/subscription/portal`, {}));
  }
  cancelSubscription(): Observable<unknown> {
    return this.unwrap(this.http.post<ApiResponse<unknown>>(`${this.base}/subscription/cancel`, {}));
  }

  // ── Shared variables (completing the set) ────────────
  deleteSharedVariable(scope: string, scopeId: number, key: string): Observable<unknown> {
    return this.unwrap(
      this.http.delete<ApiResponse<unknown>>(
        `${this.base}/shared-variables/${scope}/${scopeId}/${encodeURIComponent(key)}`
      )
    );
  }
}

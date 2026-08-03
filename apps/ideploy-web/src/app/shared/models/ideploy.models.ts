/** Where a workspace's projects run. */
export type DeploymentType = 'saas' | 'own';

export interface WorkspaceEnvironment {
  id: number;
  uuid: string;
  name: string;
}

/**
 * A workspace groups the projects of one application — a frontend, an API, a
 * database — onto a shared server and network, so they can reach each other by
 * hostname. The deployment target and region are chosen once, here, rather than
 * on every project.
 */
export interface Workspace {
  id: number;
  uuid: string;
  name: string;
  description: string | null;
  deploymentType: DeploymentType;
  /** Two-letter country code, or null when hosted on the team's own server. */
  region: string | null;
  assignedServerId: number | null;
  assignedServerName: string | null;
  environments: WorkspaceEnvironment[];
  /** Applications, services and databases inside, across all environments — not a count of `WorkspaceProject`s. */
  projectCount: number;
}

/** What the creation form may offer, given the team's plan and fleet capacity. */
export interface WorkspaceOptions {
  regionSelectionAllowed: boolean;
  availableRegions: string[];
  defaultRegion: string;
  deploymentTypes: DeploymentType[];
}

export interface CreateWorkspaceRequest {
  name: string;
  description?: string;
  deployment_type: DeploymentType;
  region?: string;
  server_uuid?: string;
}

export interface Server {
  id: number;
  uuid: string;
  name: string;
  description: string | null;
  ip: string;
  port: number;
  user: string;
}

/** One item of the server readiness report. */
export interface ServerCheck {
  id:
    | 'ssh'
    | 'os'
    | 'docker_engine'
    | 'docker_version'
    | 'docker_compose'
    | 'network'
    | 'disk';
  /** Human label, supplied by the API alongside the diagnosis it belongs to. */
  label: string;
  status: 'ok' | 'failed' | 'warning' | 'skipped';
  /** What was observed. */
  detail?: string;
  /** What to do about it, when there is something to do. */
  remedy?: string;
}

/**
 * Result of validating a server. `ready` is false when any check failed;
 * warnings (a nearly full disk, say) do not block deployment.
 */
export interface ServerReadiness {
  ready: boolean;
  checks: ServerCheck[];
  raw: string;
}

/** Outcome of the setup step, including the readiness re-check that followed. */
export interface ServerSetupResult {
  success: boolean;
  output: string;
  readiness: ServerReadiness;
}

/**
 * A named grouping of resources within one workspace environment — "frontend",
 * "backend", "the database" — so a three-tier application is three named
 * things sharing a workspace, not three unlabelled rows told apart by URL.
 *
 * Optional: a resource created without naming one is simply ungrouped, not an
 * error — most workspaces only ever hold one thing.
 */
export interface WorkspaceProject {
  id: number;
  uuid: string;
  name: string;
  description: string | null;
  environmentId: number;
}

export interface CreateWorkspaceProjectRequest {
  name: string;
  description?: string;
  /** Defaults to the workspace's default environment. */
  environment_name?: string;
}

export interface Application {
  id: number;
  uuid: string;
  name: string;
  git_repository: string | null;
  git_branch: string | null;
  build_pack: string | null;
  status: string | null;
  link?: string | null;
  /** The named WorkspaceProject ("frontend", "backend", …) this belongs to, if any. */
  project_id?: number | null;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export interface DeployResponse {
  deploymentUuid: string;
  message: string;
}

export interface PrivateKey {
  id: number;
  uuid: string;
  name: string;
  description: string | null;
  is_git_related: boolean;
}

export interface ProxyStatus {
  status: 'running' | 'stopped' | 'unknown';
  raw: string;
}

export interface Destination {
  id: number;
  uuid: string;
  name: string;
  network: string;
  server_id: number;
}

export interface EnvVar {
  id: number;
  key: string;
  value: string | null;
  is_runtime: boolean;
  is_buildtime: boolean;
  is_preview: boolean;
}

export interface DeploymentHistoryItem {
  deployment_uuid: string;
  commit: string;
  status: string;
  is_webhook: boolean;
  created_at: string;
}

export type DatabaseType =
  | 'postgresql'
  | 'mysql'
  | 'mariadb'
  | 'mongodb'
  | 'redis'
  | 'keydb'
  | 'dragonfly'
  | 'clickhouse';

export interface Database {
  id: number;
  uuid: string;
  name: string;
  description: string | null;
  type: DatabaseType;
  image: string;
  status: string | null;
  is_public: boolean;
  public_port: number | null;
}

export interface Service {
  id: number;
  uuid: string;
  name: string;
  service_type: string | null;
}

export interface ServiceTemplate {
  name: string;
  slogan: string;
  documentation: string;
  category: string;
  logo: string | null;
  tags: string[];
}

export interface ScheduledTask {
  id: number;
  uuid: string;
  enabled: boolean;
  name: string;
  command: string;
  frequency: string;
  container: string | null;
}

export interface PersistentVolume {
  id: number;
  name: string;
  mount_path: string;
  host_path: string | null;
}

export interface FileVolume {
  id: number;
  uuid: string;
  fs_path: string;
  mount_path: string;
  content: string | null;
}

export interface AppVolumes {
  persistent: PersistentVolume[];
  files: FileVolume[];
}

export interface Tag {
  id: number;
  uuid: string;
  name: string;
}

export interface GithubRepo {
  name: string;
  fullName: string;
  description: string;
  private: boolean;
  htmlUrl: string;
  cloneUrl: string;
  updatedAt: string;
  defaultBranch?: string;
  language?: string;
}

/**
 * Whether the saved rules actually filter traffic.
 *
 * Saved and enforced are different states, and conflating them is how someone
 * ends up believing an application is protected when nothing inspects its
 * traffic. The API reports this on every read; the interface must show it.
 */
export interface FirewallEnforcement {
  state: 'enforced' | 'not_enforced';
  reason: string;
  rulesConfigured: number;
  rulesEnforced: number;
}

export interface FirewallConfig {
  id: number;
  application_id: number;
  enabled: boolean;
  enforcement?: FirewallEnforcement;
  appsec_enabled: boolean;
  inband_enabled: boolean;
  default_remediation: string;
  ban_duration: number;
  total_requests: number;
  total_blocked: number;
}

export interface FirewallRule {
  id: number;
  name: string;
  enabled: boolean;
  priority: number;
  action: string;
  conditions: unknown;
}

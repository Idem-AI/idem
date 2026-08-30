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

/** One application, database or service living in a workspace — a row, not a count. */
export interface WorkspaceResource {
  uuid: string;
  name: string;
  kind: 'application' | 'database' | 'service';
  /** The database engine (`postgresql`, `redis`, …) — null for the other kinds. */
  databaseType: string | null;
  status: string | null;
  environmentName: string;
  /** How its neighbours in this workspace reach it — same Docker network, resolved by name. */
  internalHost: string;
  /** Applications only: the URL the deployment worker gave it. */
  fqdn: string | null;
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

export interface ServerSettings {
  /** A real domain pointed at this server (wildcard record), replacing sslip.io. */
  wildcardDomain: string | null;
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
 * One resource deployed on a server, flattened across the three kinds so the
 * server screen can list them together.
 */
export interface ServerResource {
  uuid: string;
  name: string;
  kind: 'application' | 'database' | 'service';
  /** The engine (`postgresql`, `redis`, …) — null for applications and services. */
  databaseType: DatabaseType | null;
  status: string | null;
}

/**
 * On-demand liveness probe. An unreachable host answers `reachable: false`
 * rather than failing the request, so the screen can say so plainly.
 */
export interface ServerHealth {
  reachable: boolean;
  diskUsedPercent: number | null;
  output: string;
}

/** A TLS certificate held on a server, self-signed by iDeploy. */
export interface SslCertificate {
  id: number;
  common_name: string;
  is_ca_certificate: boolean;
  valid_until: string;
  server_id: number;
}

/** Whether the CrowdSec agent is running on a server. */
export interface CrowdSecStatus {
  running: boolean;
  raw: string;
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
  fqdn?: string | null;
  /** The named WorkspaceProject ("frontend", "backend", …) this belongs to, if any. */
  project_id?: number | null;
  /** Only populated by `listApplications` — the workspace this application lives in. */
  workspace_name?: string;
  workspace_uuid?: string;
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
  fingerprint?: string | null;
}

/** SSH key algorithms the API can generate. */
export type SshKeyType = 'ed25519' | 'rsa';

/**
 * A freshly generated key. `public_key` is the `authorized_keys` line that has
 * to be installed on the target host — the private half never leaves the API.
 */
export interface GeneratedPrivateKey extends PrivateKey {
  public_key: string;
  type: SshKeyType;
}

/**
 * A personal access token, as it can be shown after creation. The value itself
 * is stored hashed and is never part of this shape.
 */
export interface ApiToken {
  id: number;
  name: string;
  abilities: string[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string | null;
}

/** The one and only time the plaintext is available. */
export interface IssuedApiToken {
  token: ApiToken;
  plainTextToken: string;
}

/** An S3-compatible bucket backups can be copied to. Credentials are never returned. */
export interface S3Storage {
  uuid: string;
  name: string;
  region: string;
  /** Null for AWS itself; set for MinIO, Backblaze, Wasabi and friends. */
  endpoint: string | null;
}

/** A cloud provider credential. The token itself is encrypted and never read back. */
export interface CloudToken {
  id: number;
  provider: string;
  name: string | null;
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

/**
 * A past deployment that can be redeployed. The current one is excluded by the
 * API — "roll back to where I already am" is not an action.
 */
export interface RollbackTarget {
  deploymentUuid: string;
  commit: string;
  status: string;
  finishedAt: string | null;
}

/** A pull-request environment, deployed alongside the main application. */
export interface ApplicationPreview {
  uuid: string;
  pull_request_id: number;
  pull_request_html_url: string | null;
  fqdn: string | null;
  status: string | null;
}

/**
 * One container's resource use at a moment in time. Every field is nullable:
 * a container that is still starting reports `--` for most of them.
 */
export interface ContainerUsage {
  name: string;
  cpuPercent: number | null;
  memoryUsedBytes: number | null;
  memoryLimitBytes: number | null;
  memoryPercent: number | null;
  networkInBytes: number | null;
  networkOutBytes: number | null;
}

export interface PipelineConfig {
  id: number;
  application_id: number;
  enabled: boolean;
  /** Ordered stage keys — `language_detection`, `sonarqube`, `trivy`, `deploy`. */
  stages: string[];
  trigger_mode: string;
  trigger_branches: string[];
}

/** Every status a pipeline job or execution can be in. */
export type PipelineStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped' | 'cancelled';

export interface PipelineJob {
  uuid: string;
  name: string;
  status: PipelineStatus;
  order: number;
  started_at: string | null;
  finished_at: string | null;
  duration_seconds: number | null;
  /** Raw stage output — present once the job has run at least once. */
  logs: string | null;
  error_message: string | null;
}

/** The bare name/status pair the executions *list* carries per stage — just
 *  enough to draw the same small dots the detail page's big graph shows,
 *  without a second round trip per row. */
export interface PipelineStageSummary {
  name: string;
  status: PipelineStatus;
}

/** Static-analysis output attached to one execution. */
export interface PipelineScan {
  tool: string;
  status: string;
  quality_gate_status: string | null;
  bugs: number | null;
  vulnerabilities: number | null;
  code_smells: number | null;
  coverage: number | null;
}

export interface PipelineExecution {
  uuid: string;
  status: PipelineStatus;
  trigger_type?: string;
  trigger_user?: string | null;
  branch?: string;
  commit_sha?: string | null;
  commit_message?: string | null;
  error_message?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  duration_seconds?: number | null;
  created_at?: string;
  /** Only on the list endpoint — the detail endpoint carries `jobs` instead. */
  stages?: PipelineStageSummary[];
  jobs?: PipelineJob[];
  scans?: PipelineScan[];
  [key: string]: unknown;
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
  environment_id?: number | null;
  destination_id?: number | null;
  project_id?: number | null;
}

/** The single-record fetch — real credentials and a ready connection string, not just the list's metadata. */
export interface DatabaseDetail extends Database {
  /** Every credential column for this engine, decrypted — keyed by DB column name (e.g. `postgres_password`). */
  credentials: Record<string, string>;
  /** The internal port this engine listens on. */
  port: number;
  /** DNS name other resources on the shared network reach this database by. */
  internal_host: string;
  connection_url: string | null;
  /** Only present when `is_public` is set. */
  public_connection_url: string | null;
}

/** A recurring dump of one database, on a cron schedule. */
export interface BackupSchedule {
  id: number;
  uuid: string;
  enabled: boolean;
  frequency: string;
  save_s3: boolean;
  number_of_backups_locally: number;
  database_type: string;
  database_id: number;
}

/** One run of a schedule. `size` is bytes, as reported when the dump finished. */
export interface BackupExecution {
  uuid: string;
  status: string;
  size: string | number | null;
  filename: string | null;
  created_at: string;
}

export interface Service {
  id: number;
  uuid: string;
  name: string;
  service_type: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  /** Aggregated across the stack's containers — see `listServices()`. */
  status?: 'running' | 'exited' | 'partial' | 'unknown';
}

/** One container inside a stack, as recorded by the compose parser. */
export interface ServiceApplication {
  uuid: string;
  name: string;
  fqdn: string | null;
  status: string | null;
}

export interface ServiceDatabase {
  uuid: string;
  name: string;
  status: string | null;
}

/**
 * A stack with everything the compose file produced. `GET /services/:uuid`
 * returns the row and its sub-resources flattened together.
 */
export interface ServiceDetail extends Service {
  docker_compose_raw: string | null;
  environment_id: number;
  destination_id: number | null;
  project_id: number | null;
  applications: ServiceApplication[];
  databases: ServiceDatabase[];
}

export interface ServiceTemplate {
  name: string;
  slogan: string;
  documentation: string;
  category: string;
  logo: string | null;
  tags: string[];
  /** Longer, sourced description — only present for the curated subset. */
  overview?: string;
  /** Relative paths under `assets/service-screenshots/` — only for the curated subset. */
  screenshots?: string[];
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
  state: 'enforced' | 'partially_enforced' | 'not_enforced';
  /** English, for logs/API consumers — the UI renders reasonCode instead. */
  reason: string;
  reasonCode: string;
  reasonParams: Record<string, number>;
  rulesConfigured: number;
  rulesEnforced: number;
  rulesPendingRedeploy: number;
  bouncerRegistered: boolean;
  lapiReachable: boolean;
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

export interface Country {
  code: string;
  continent: string;
  name: string;
}

/** The catalogue the country picker is built from. */
export interface CountryCatalogue {
  continents: Record<string, { en: string; fr: string }>;
  countries: Country[];
}

/** Stored as a block list either way — the interface shows what is blocked. */
export type GeoMode = 'block' | 'allow_only';

export interface GeoSelection {
  mode: GeoMode;
  countries: Country[];
}

/**
 * Something unusual but permitted — blocking the country the server itself sits
 * in, say. Refusing would decide on the operator's behalf; warning does not.
 */
export interface GeoWarning {
  code: string;
  message: string;
}

export interface GeoRuleResult {
  rule: FirewallRule;
  blockedCountries: string[];
  warnings: GeoWarning[];
}

export interface RateLimitTemplate {
  key: string;
  name: string;
  description: string;
  averagePerSecond: number;
  burst: number;
  periodSeconds: number;
  concurrencyLimit: number;
}

export interface RateLimitSettings {
  averagePerSecond: number;
  burst: number;
  periodSeconds: number;
  concurrencyLimit: number;
  /** The template these numbers came from, or `custom`. Display only. */
  template: string;
}

/**
 * Saved is not applied: geo rules and rate limits are Docker labels Traefik
 * reads at container start, so they take effect on the next deploy. Every
 * mutation says so rather than letting the operator assume otherwise.
 */
export interface ApplyRequired {
  applyRequired: boolean;
}

// ── Instance administration ──────────────────────────────

/** Headline counts across every team. */
export interface InstanceOverview {
  users: number;
  teams: number;
  servers: number;
  applications: number;
  databases: number;
  services: number;
  unreachableServers: number;
}

export interface AdminTeamRow {
  id: number;
  name: string;
  members: number;
  servers: number;
  createdAt: string | null;
}

export interface AdminUserRow {
  id: number;
  name: string;
  email: string;
  instanceRole: string | null;
  teams: number;
  createdAt: string | null;
}

/** A server as seen by an instance admin — every team's, plus the shared fleet. */
export interface AdminServerRow {
  id: number;
  uuid: string;
  name: string;
  ip: string;
  team: string;
  idemManaged: boolean;
  countryCode: string | null;
  region: string | null;
  city: string | null;
  loadScore: number;
  isReachable: boolean;
  isUsable: boolean;
  createdAt: string | null;
}

export interface ServerFleetStats {
  total: number;
  managed: number;
  client: number;
  reachable: number;
}

/** A cloud-init script run on first boot of a provisioned server. */
export interface CloudInitScript {
  id: number;
  name: string;
}

/** Hetzner catalogue entries. Shapes come straight from their API. */
export interface HetznerLocation {
  id: number;
  name: string;
  description: string;
  country: string;
  city: string;
}

export interface HetznerServerType {
  id: number;
  name: string;
  description: string;
  cores: number;
  memory: number;
  disk: number;
  /** Hetzner returns prices per location; the first entry is enough to show. */
  prices?: { location: string; price_monthly?: { gross: string } }[];
}

/** One run of a scheduled task. */
export interface TaskExecution {
  uuid?: string;
  status?: string;
  message?: string;
  created_at?: string;
  [key: string]: unknown;
}

/** A file mounted into a container from content stored in iDeploy. */
export interface FileVolume {
  id: number;
  uuid: string;
  fs_path: string;
  mount_path: string;
  content: string | null;
}

export interface TeamInfo {
  id: number;
  name: string;
  description?: string | null;
}

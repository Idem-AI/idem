export interface Server {
  id: number;
  uuid: string;
  name: string;
  description: string | null;
  ip: string;
  port: number;
  user: string;
}

export interface ServerValidation {
  reachable: boolean;
  dockerInstalled: boolean;
  output: string;
}

export interface Project {
  id: number;
  uuid: string;
  name: string;
  description: string | null;
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

export interface FirewallConfig {
  id: number;
  application_id: number;
  enabled: boolean;
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

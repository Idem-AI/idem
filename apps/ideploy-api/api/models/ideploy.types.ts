/**
 * Hand-written row types for the iDeploy tables used by the vertical slice.
 * These mirror the Laravel schema (servers, private_keys, projects,
 * environments, applications). Once `prisma:introspect` has run, these can be
 * replaced by the generated Prisma types.
 */

export interface PrivateKeyRow {
  id: number;
  uuid: string;
  name: string;
  description: string | null;
  /** Laravel-encrypted PEM (decrypt with laravel-crypto). */
  private_key: string;
  is_git_related: boolean;
  team_id: number;
}

export interface ServerRow {
  id: number;
  uuid: string;
  name: string;
  description: string | null;
  ip: string;
  port: number;
  user: string;
  team_id: number;
  private_key_id: number;
  /** schemaless 'proxy' attributes (JSON) */
  proxy: Record<string, unknown> | null;
}

export interface ProjectRow {
  id: number;
  uuid: string;
  name: string;
  description: string | null;
  team_id: number;
}

export interface EnvironmentRow {
  id: number;
  uuid: string;
  name: string;
  project_id: number;
}

export interface StandaloneDockerRow {
  id: number;
  uuid: string;
  name: string;
  network: string;
  server_id: number;
}

export interface CloudProviderTokenRow {
  id: number;
  team_id: number;
  provider: string;
  /** Laravel-encrypted token (decrypt with laravel-crypto). */
  token: string;
  name: string | null;
}

export interface CloudInitScriptRow {
  id: number;
  team_id: number;
  name: string;
  /** Laravel-encrypted script. */
  script: string;
}

export interface DatabaseRow {
  id: number;
  uuid: string;
  name: string;
  description: string | null;
  type: string; // logical type key (postgresql, mysql, …)
  image: string;
  status: string | null;
  is_public: boolean;
  public_port: number | null;
  environment_id: number | null;
  destination_id: number | null;
  destination_type: string | null;
}

export interface ServiceRow {
  id: number;
  uuid: string;
  name: string;
  service_type: string | null;
  docker_compose_raw: string | null;
  environment_id: number;
  destination_id: number | null;
  destination_type: string | null;
}

export interface ApplicationRow {
  id: number;
  uuid: string;
  name: string;
  description: string | null;
  fqdn: string | null;
  git_repository: string | null;
  git_branch: string | null;
  build_pack: string | null;
  ports_exposes: string | null;
  ports_mappings: string | null;
  environment_id: number;
  destination_id: number | null;
  destination_type: string | null;
  status: string | null;
}

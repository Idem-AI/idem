/**
 * In-memory row builders for unit tests — no database involved.
 *
 * Integration tests should use `factories.ts` (real inserts, real constraints).
 * These are for pure functions that merely read a row's fields.
 */
import { ApplicationRow, PrivateKeyRow, ServerRow } from '../../api/models/ideploy.types';

export function serverRow(overrides: Partial<ServerRow> = {}): ServerRow {
  return {
    id: 1,
    uuid: 'srv-uuid',
    name: 'test-server',
    description: null,
    ip: '203.0.113.10',
    port: 22,
    user: 'root',
    team_id: 1,
    private_key_id: 1,
    proxy: {},
    ...overrides,
  };
}

export function privateKeyRow(overrides: Partial<PrivateKeyRow> = {}): PrivateKeyRow {
  return {
    id: 1,
    uuid: 'key-uuid',
    name: 'test-key',
    description: null,
    private_key: 'encrypted-placeholder',
    is_git_related: false,
    team_id: 1,
    ...overrides,
  };
}

export function applicationRow(overrides: Partial<ApplicationRow> = {}): ApplicationRow {
  return {
    id: 1,
    uuid: 'app-uuid',
    name: 'my-app',
    description: null,
    fqdn: null,
    git_repository: 'https://github.com/example/repo',
    git_branch: 'main',
    build_pack: 'nixpacks',
    ports_exposes: '3000',
    ports_mappings: null,
    environment_id: 1,
    destination_id: 1,
    destination_type: 'App\\Models\\StandaloneDocker',
    project_id: null,
    status: 'exited',
    base_directory: null,
    build_command: null,
    start_command: null,
    install_command: null,
    publish_directory: null,
    ...overrides,
  };
}

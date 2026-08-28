/**
 * Test data factories.
 *
 * Each factory inserts the minimum valid row and returns its identifiers, so
 * tests state only what they actually care about. Anything a test does not
 * specify gets a unique, obviously-fake default — collisions between tests are
 * a debugging tax nobody should pay twice.
 */
import { randomUUID } from 'crypto';
import { encryptString } from '../../api/utils/laravel-crypto';
import { testPool } from './db';

/** Short unique suffix to keep names/emails unique within a run. */
function tag(): string {
  return randomUUID().slice(0, 8);
}

export interface TeamFixture {
  id: number;
  name: string;
}

export async function makeTeam(overrides: { name?: string } = {}): Promise<TeamFixture> {
  const name = overrides.name ?? `Test Team ${tag()}`;
  const { rows } = await testPool().query<{ id: string }>(
    `INSERT INTO teams (name, description, personal_team, created_at, updated_at)
     VALUES ($1, 'Created by an integration test', true, now(), now())
     RETURNING id`,
    [name]
  );
  return { id: Number(rows[0].id), name };
}

export interface UserFixture {
  id: number;
  email: string;
  idemUid: string;
}

/** Create a user and, when `teamId` is given, make them owner of that team. */
export async function makeUser(
  teamId?: number,
  overrides: { email?: string; idemUid?: string; role?: string } = {}
): Promise<UserFixture> {
  const suffix = tag();
  const email = overrides.email ?? `user-${suffix}@example.test`;
  const idemUid = overrides.idemUid ?? `idem-uid-${suffix}`;

  const { rows } = await testPool().query<{ id: string }>(
    `INSERT INTO users (idem_uid, name, email, email_verified_at, password, created_at, updated_at)
     VALUES ($1, $2, $3, now(), NULL, now(), now())
     RETURNING id`,
    [idemUid, `Test User ${suffix}`, email]
  );
  const id = Number(rows[0].id);

  if (teamId !== undefined) {
    await testPool().query(
      `INSERT INTO team_user (team_id, user_id, role, created_at, updated_at)
       VALUES ($1, $2, $3, now(), now())`,
      [teamId, id, overrides.role ?? 'owner']
    );
  }

  return { id, email, idemUid };
}

export interface PrivateKeyFixture {
  id: number;
  uuid: string;
  /** The plaintext PEM, so tests can assert the encryption round-trip. */
  plaintext: string;
}

export async function makePrivateKey(
  teamId: number,
  overrides: { name?: string; plaintext?: string } = {}
): Promise<PrivateKeyFixture> {
  const uuid = randomUUID();
  const plaintext =
    overrides.plaintext ??
    `-----BEGIN OPENSSH PRIVATE KEY-----\nnot-a-real-key-${tag()}\n-----END OPENSSH PRIVATE KEY-----`;

  const { rows } = await testPool().query<{ id: string }>(
    `INSERT INTO private_keys (uuid, name, description, private_key, is_git_related, team_id, created_at, updated_at)
     VALUES ($1, $2, 'Created by an integration test', $3, false, $4, now(), now())
     RETURNING id`,
    [uuid, overrides.name ?? `key-${tag()}`, encryptString(plaintext), teamId]
  );

  return { id: Number(rows[0].id), uuid, plaintext };
}

export interface ServerFixture {
  id: number;
  uuid: string;
  ip: string;
}

export async function makeServer(
  teamId: number,
  privateKeyId: number,
  overrides: { name?: string; ip?: string; port?: number; user?: string } = {}
): Promise<ServerFixture> {
  const uuid = randomUUID();
  const ip = overrides.ip ?? '203.0.113.10'; // RFC 5737 documentation range
  const { rows } = await testPool().query<{ id: string }>(
    `INSERT INTO servers (uuid, name, description, ip, port, "user", team_id, private_key_id, proxy, created_at, updated_at)
     VALUES ($1, $2, 'Created by an integration test', $3, $4, $5, $6, $7, '{}', now(), now())
     RETURNING id`,
    [
      uuid,
      overrides.name ?? `server-${tag()}`,
      ip,
      overrides.port ?? 22,
      overrides.user ?? 'root',
      teamId,
      privateKeyId,
    ]
  );
  return { id: Number(rows[0].id), uuid, ip };
}

export interface ManagedServerFixture extends ServerFixture {
  destinationId: number;
}

/**
 * A server in IDEM's own managed fleet, ready to host workspaces.
 *
 * Managed servers belong to no customer team, so this creates its own owning team
 * and key. `is_reachable` / `is_usable` default to true because an unhealthy
 * server is excluded from placement — tests that want that case say so explicitly.
 */
export async function makeManagedServer(
  overrides: {
    name?: string;
    countryCode?: string;
    loadScore?: number;
    isReachable?: boolean;
    isUsable?: boolean;
    forceDisabled?: boolean;
  } = {}
): Promise<ManagedServerFixture> {
  const owner = await makeTeam({ name: `IDEM Fleet ${tag()}` });
  const key = await makePrivateKey(owner.id);
  const uuid = randomUUID();

  const { rows } = await testPool().query<{ id: string }>(
    `INSERT INTO servers
       (uuid, name, description, ip, port, "user", team_id, private_key_id, proxy,
        idem_managed, country_code, load_score, created_at, updated_at)
     VALUES ($1, $2, 'Managed fleet server (test)', $3, 22, 'root', $4, $5, '{}',
             true, $6, $7, now(), now())
     RETURNING id`,
    [
      uuid,
      overrides.name ?? `managed-${tag()}`,
      // RFC 5737 documentation range: never routable.
      `198.51.100.${Math.floor(Math.random() * 200) + 10}`,
      owner.id,
      key.id,
      overrides.countryCode ?? 'DE',
      overrides.loadScore ?? 0,
    ]
  );
  const id = Number(rows[0].id);

  await testPool().query(
    `INSERT INTO server_settings (server_id, is_reachable, is_usable, force_disabled, created_at, updated_at)
     VALUES ($1, $2, $3, $4, now(), now())`,
    [
      id,
      overrides.isReachable ?? true,
      overrides.isUsable ?? true,
      overrides.forceDisabled ?? false,
    ]
  );

  const destination = await testPool().query<{ id: string }>(
    `INSERT INTO standalone_dockers (uuid, name, network, server_id, created_at, updated_at)
     VALUES ($1, 'ideploy', 'ideploy', $2, now(), now()) RETURNING id`,
    [randomUUID(), id]
  );

  return {
    id,
    uuid,
    ip: `198.51.100.0`,
    destinationId: Number(destination.rows[0].id),
  };
}

export interface DestinationFixture {
  id: number;
  uuid: string;
  network: string;
}

export async function makeDestination(
  serverId: number,
  overrides: { network?: string } = {}
): Promise<DestinationFixture> {
  const uuid = randomUUID();
  const network = overrides.network ?? 'ideploy';
  const { rows } = await testPool().query<{ id: string }>(
    `INSERT INTO standalone_dockers (uuid, name, network, server_id, created_at, updated_at)
     VALUES ($1, $2, $3, $4, now(), now())
     RETURNING id`,
    [uuid, `dest-${tag()}`, network, serverId]
  );
  return { id: Number(rows[0].id), uuid, network };
}

export interface ProjectFixture {
  id: number;
  uuid: string;
  environmentId: number;
}

export interface ApplicationFixture {
  id: number;
  uuid: string;
  name: string;
}

/**
 * An application deployed onto `destinationId`.
 *
 * Supplies every column the table requires but that no test cares about
 * (`git_repository`, `build_pack`, …) so callers state only what they assert on.
 */
export async function makeApplication(
  environmentId: number,
  destinationId: number,
  overrides: { name?: string } = {}
): Promise<ApplicationFixture> {
  const uuid = randomUUID();
  const name = overrides.name ?? `app-${tag()}`;
  const { rows } = await testPool().query<{ id: string }>(
    `INSERT INTO applications
       (uuid, name, git_repository, git_branch, build_pack, ports_exposes,
        environment_id, destination_id, destination_type, created_at, updated_at)
     VALUES ($1, $2, 'https://github.com/example/repo', 'main', 'nixpacks', '3000',
             $3, $4, 'App\\Models\\StandaloneDocker', now(), now())
     RETURNING id`,
    [uuid, name, environmentId, destinationId]
  );
  return { id: Number(rows[0].id), uuid, name };
}

/** A project plus its `production` environment — the pair is always needed together. */
export async function makeProject(
  teamId: number,
  overrides: { name?: string } = {}
): Promise<ProjectFixture> {
  const uuid = randomUUID();
  const { rows } = await testPool().query<{ id: string }>(
    `INSERT INTO projects (uuid, name, description, team_id, created_at, updated_at)
     VALUES ($1, $2, 'Created by an integration test', $3, now(), now())
     RETURNING id`,
    [uuid, overrides.name ?? `project-${tag()}`, teamId]
  );
  const id = Number(rows[0].id);

  const env = await testPool().query<{ id: string }>(
    `INSERT INTO environments (uuid, name, project_id, created_at, updated_at)
     VALUES ($1, 'production', $2, now(), now())
     RETURNING id`,
    [randomUUID(), id]
  );

  return { id, uuid, environmentId: Number(env.rows[0].id) };
}

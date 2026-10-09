/**
 * Logins to private image registries, per team.
 *
 * Deploying `registry.example.com/organisation/app` needs the registry's login on the
 * server that pulls it. The token is stored encrypted, never returned, and
 * given to `docker login` only through a throw-away Docker config directory
 * for the pull (image-deploy.service in the worker): a login written to the
 * server's own ~/.docker would stay there for every team sharing the server.
 */
import pool from '../config/db.config';
import { encryptString, tryDecryptString } from '../utils/laravel-crypto';
import { notFound, unprocessable } from '../utils/errors';
import { registryOf } from '../validation/git-input';

export interface RegistryCredentialView {
  id: number;
  registry: string;
  username: string;
}

export interface RegistryLogin {
  registry: string;
  username: string;
  password: string;
}

/** A registry host as typed: no scheme, no path. */
export function normaliseRegistry(raw: string): string {
  return raw.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
}

export async function listRegistryCredentials(teamId: number): Promise<RegistryCredentialView[]> {
  const { rows } = await pool.query(
    'SELECT id, registry, username FROM registry_credentials WHERE team_id = $1 ORDER BY registry',
    [teamId]
  );
  return rows.map((r) => ({ id: Number(r.id), registry: String(r.registry), username: String(r.username) }));
}

/** Create or replace the login for a registry. */
export async function saveRegistryCredential(
  teamId: number,
  dto: { registry: string; username: string; password: string }
): Promise<RegistryCredentialView> {
  const registry = normaliseRegistry(dto.registry);
  if (!/^[a-z0-9]+(?:[.-][a-z0-9]+)*(?::[0-9]+)?$/.test(registry)) {
    throw unprocessable('INVALID_REGISTRY', 'The registry must be a host such as docker.io or registry.example.com:5000.');
  }
  if (!dto.username.trim() || !dto.password) {
    throw unprocessable('VALIDATION', 'A username and a token are required.');
  }
  const { rows } = await pool.query(
    `INSERT INTO registry_credentials (team_id, registry, username, password)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (team_id, registry)
     DO UPDATE SET username = EXCLUDED.username, password = EXCLUDED.password, updated_at = now()
     RETURNING id, registry, username`,
    [teamId, registry, dto.username.trim(), encryptString(dto.password)]
  );
  return { id: Number(rows[0].id), registry: String(rows[0].registry), username: String(rows[0].username) };
}

export async function deleteRegistryCredential(teamId: number, id: number): Promise<void> {
  const { rowCount } = await pool.query('DELETE FROM registry_credentials WHERE id = $1 AND team_id = $2', [id, teamId]);
  if (!rowCount) throw notFound('Registry credential');
}

/** What a failed `docker pull` means, in terms the user can act on. */
export function explainPullFailure(stderr: string, imageName: string, hadLogin: boolean): string {
  const text = stderr.trim();
  const registry = registryOf(imageName);
  if (/unauthorized|denied|authentication required|requested access to the resource is denied/i.test(text)) {
    return hadLogin
      ? `${registry} refused the saved login: check the token (it needs read access to the package).`
      : `the image is private: add a login for ${registry} (a token with read access), then retry.`;
  }
  if (/manifest unknown|not found|no such image|name unknown/i.test(text)) {
    return 'the image or the tag does not exist in that registry.';
  }
  return text.slice(-300);
}

/** The team's login for the registry an image lives on, or null (public image). */
export async function resolveRegistryLogin(teamId: number, imageName: string): Promise<RegistryLogin | null> {
  const registry = registryOf(imageName);
  const { rows } = await pool.query(
    'SELECT username, password FROM registry_credentials WHERE team_id = $1 AND registry = $2 LIMIT 1',
    [teamId, registry]
  );
  if (!rows[0]) return null;
  const password = tryDecryptString(String(rows[0].password));
  return password ? { registry, username: String(rows[0].username), password } : null;
}

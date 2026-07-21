/**
 * Persistent + file volumes for an application (Coolify LocalPersistentVolume /
 * LocalFileVolume, attached via the polymorphic `resource` morph).
 */
import { randomUUID } from 'crypto';
import pool from '../config/db.config';
import * as appService from './application.service';

const APP_MODEL = 'App\\Models\\Application';

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

async function appOr404(teamId: number, appUuid: string) {
  const app = await appService.getApplication(teamId, appUuid);
  if (!app) throw new Error('Application not found');
  return app;
}

export async function listPersistent(teamId: number, appUuid: string): Promise<PersistentVolume[]> {
  const app = await appOr404(teamId, appUuid);
  const { rows } = await pool.query(
    `SELECT id, name, mount_path, host_path FROM local_persistent_volumes
     WHERE resource_type = $1 AND resource_id = $2 ORDER BY mount_path`,
    [APP_MODEL, app.id]
  );
  return rows.map((r) => ({
    id: Number(r.id),
    name: String(r.name),
    mount_path: String(r.mount_path),
    host_path: (r.host_path as string) ?? null,
  }));
}

export async function createPersistent(
  teamId: number,
  appUuid: string,
  dto: { name: string; mount_path: string; host_path?: string }
): Promise<PersistentVolume> {
  const app = await appOr404(teamId, appUuid);
  const { rows } = await pool.query(
    `INSERT INTO local_persistent_volumes (name, mount_path, host_path, resource_type, resource_id, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5, now(), now()) RETURNING id, name, mount_path, host_path`,
    [dto.name, dto.mount_path, dto.host_path ?? null, APP_MODEL, app.id]
  );
  return {
    id: Number(rows[0].id),
    name: String(rows[0].name),
    mount_path: String(rows[0].mount_path),
    host_path: (rows[0].host_path as string) ?? null,
  };
}

export async function deletePersistent(teamId: number, appUuid: string, id: number): Promise<boolean> {
  const app = await appOr404(teamId, appUuid);
  const { rowCount } = await pool.query(
    `DELETE FROM local_persistent_volumes WHERE id = $1 AND resource_type = $2 AND resource_id = $3`,
    [id, APP_MODEL, app.id]
  );
  return (rowCount ?? 0) > 0;
}

export async function listFiles(teamId: number, appUuid: string): Promise<FileVolume[]> {
  const app = await appOr404(teamId, appUuid);
  const { rows } = await pool.query(
    `SELECT id, uuid, fs_path, mount_path, content FROM local_file_volumes
     WHERE resource_type = $1 AND resource_id = $2 ORDER BY mount_path`,
    [APP_MODEL, app.id]
  );
  return rows.map((r) => ({
    id: Number(r.id),
    uuid: String(r.uuid),
    fs_path: String(r.fs_path),
    mount_path: String(r.mount_path),
    content: (r.content as string) ?? null,
  }));
}

export async function createFile(
  teamId: number,
  appUuid: string,
  dto: { fs_path: string; mount_path: string; content?: string }
): Promise<FileVolume> {
  const app = await appOr404(teamId, appUuid);
  const uuid = randomUUID();
  const { rows } = await pool.query(
    `INSERT INTO local_file_volumes (uuid, fs_path, mount_path, content, resource_type, resource_id, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6, now(), now()) RETURNING id, uuid, fs_path, mount_path, content`,
    [uuid, dto.fs_path, dto.mount_path, dto.content ?? null, APP_MODEL, app.id]
  );
  return {
    id: Number(rows[0].id),
    uuid: String(rows[0].uuid),
    fs_path: String(rows[0].fs_path),
    mount_path: String(rows[0].mount_path),
    content: (rows[0].content as string) ?? null,
  };
}

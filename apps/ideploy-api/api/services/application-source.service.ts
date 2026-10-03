/**
 * The code of an application without a Git repository — what iCode sends when
 * a user publishes what they built there.
 *
 * Kept as a gzipped tar in `application_sources` (one row per application,
 * replaced on every publish). The deployment worker unpacks it on the server
 * where it would otherwise have cloned the repository, then builds exactly as
 * for a repository: the build packs never know where the files came from.
 */
import pool from '../config/db.config';
import { createTarGz, ArchiveFiles } from '../utils/tar';
import { notFound, unprocessable } from '../utils/errors';
import * as appService from './application.service';

/** A file as sent over JSON: text, or binary as base64 (images, fonts of a built site). */
export type IncomingFile = string | { base64: string };
export type IncomingFiles = Record<string, IncomingFile>;

export const MAX_SOURCE_FILES = 3000;
/** Raw size, before compression. The request itself is capped at 10 MB of JSON. */
export const MAX_SOURCE_BYTES = 9 * 1024 * 1024;

/**
 * Never shipped: dependencies are installed on the server, the preview's
 * embedded database is the preview's, and the edit-mode plugin is iCode's.
 */
const EXCLUDED = /(^|\/)(node_modules|\.git|\.pglite|\.idem|\.nixpacks)(\/|$)/;

/** A relative path inside the project, or null when it must be refused. */
export function normalizeSourcePath(path: string): string | null {
  const cleaned = path.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');
  if (!cleaned || cleaned.includes('\0')) return null;
  const parts = cleaned.split('/');
  if (parts.some((part) => part === '..' || part === '.' || part === '')) return null;
  return cleaned;
}

/**
 * Validate and pack what the client sent. Paths are normalised, excluded
 * folders dropped, and anything that could escape the project refused outright.
 */
export function packSource(files: IncomingFiles): { archive: Buffer; fileCount: number; byteSize: number } {
  if (!files || typeof files !== 'object' || Array.isArray(files)) {
    throw unprocessable('SOURCE_REQUIRED', 'Send the files of the project.');
  }

  const packed: ArchiveFiles = {};
  let byteSize = 0;

  for (const [rawPath, value] of Object.entries(files)) {
    const path = normalizeSourcePath(rawPath);
    if (!path) throw unprocessable('INVALID_SOURCE_PATH', `This file path is not allowed: ${rawPath}`);
    if (EXCLUDED.test(path)) continue;

    let data: Buffer;
    if (typeof value === 'string') data = Buffer.from(value, 'utf8');
    else if (value && typeof value === 'object' && typeof value.base64 === 'string') {
      data = Buffer.from(value.base64, 'base64');
    } else {
      throw unprocessable('INVALID_SOURCE_FILE', `This file has no readable contents: ${path}`);
    }

    byteSize += data.length;
    packed[path] = data;
  }

  const fileCount = Object.keys(packed).length;
  if (fileCount === 0) throw unprocessable('SOURCE_EMPTY', 'There is no file to publish.');
  if (fileCount > MAX_SOURCE_FILES) {
    throw unprocessable('SOURCE_TOO_MANY_FILES', `A project can have at most ${MAX_SOURCE_FILES} files.`);
  }
  if (byteSize > MAX_SOURCE_BYTES) {
    throw unprocessable('SOURCE_TOO_LARGE', 'The project is too large to publish this way (9 MB at most).');
  }

  return { archive: createTarGz(packed), fileCount, byteSize };
}

/** Store (or replace) the code of an application the team owns. */
export async function saveApplicationSource(
  teamId: number,
  applicationUuid: string,
  files: IncomingFiles
): Promise<{ applicationId: number; fileCount: number; byteSize: number }> {
  const app = await appService.getApplication(teamId, applicationUuid);
  if (!app) throw notFound('Application');
  return saveSourceForApplication(app.id, files);
}

/** Same, once the application is known to belong to the caller (creation paths). */
export async function saveSourceForApplication(
  applicationId: number,
  files: IncomingFiles
): Promise<{ applicationId: number; fileCount: number; byteSize: number }> {
  const { archive, fileCount, byteSize } = packSource(files);
  await pool.query(
    `INSERT INTO application_sources (application_id, archive, file_count, byte_size, updated_at)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (application_id)
     DO UPDATE SET archive = EXCLUDED.archive, file_count = EXCLUDED.file_count,
                   byte_size = EXCLUDED.byte_size, updated_at = now()`,
    [applicationId, archive, fileCount, byteSize]
  );
  return { applicationId, fileCount, byteSize };
}

/** The stored archive, or null when the application has none (it uses Git, or nothing yet). */
export async function getSourceArchive(applicationId: number): Promise<Buffer | null> {
  const { rows } = await pool.query(
    `SELECT archive FROM application_sources WHERE application_id = $1 LIMIT 1`,
    [applicationId]
  );
  return (rows[0]?.archive as Buffer | undefined) ?? null;
}

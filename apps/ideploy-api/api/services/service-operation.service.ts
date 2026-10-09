/**
 * Start / stop / restart of a service as a recorded operation.
 *
 * The request used to stay open for the whole `docker compose up` and the
 * output only travelled over the realtime channel: when that was down the user
 * saw nothing, and a failure left no trace. The operation now runs in the
 * background, its output is saved as it arrives and read back by polling.
 */
import pool from '../config/db.config';
import logger from '../config/logger';
import { conflict, notFound } from '../utils/errors';
import { realtime } from './realtime.service';
import * as serviceService from './service.service';

export type ServiceAction = 'start' | 'stop' | 'restart';

export interface ServiceOperation {
  id: number;
  action: ServiceAction;
  status: 'running' | 'succeeded' | 'failed';
  output: string;
  startedAt: string;
  finishedAt: string | null;
}

const FLUSH_MS = 700;
const MAX_OUTPUT = 200_000;
/** A running operation not updated for this long belongs to a dead process. */
const STALE_MS = 15 * 60_000;

function map(r: Record<string, unknown>): ServiceOperation {
  return {
    id: Number(r.id),
    action: r.action as ServiceAction,
    status: r.status as ServiceOperation['status'],
    output: String(r.output ?? ''),
    startedAt: new Date(r.started_at as string).toISOString(),
    finishedAt: r.finished_at ? new Date(r.finished_at as string).toISOString() : null,
  };
}

export async function latest(teamId: number, uuid: string): Promise<ServiceOperation | null> {
  const service = await serviceService.getService(teamId, uuid);
  if (!service) throw notFound('Service');
  // The process that was running it is gone (restart of the API): do not
  // leave the console spinning for ever.
  await pool.query(
    `UPDATE service_operations
        SET status = 'failed', finished_at = now(), output = output || E'\\n❌ Interrupted: the API restarted during this operation.\\n'
      WHERE service_id = $1 AND status = 'running' AND updated_at < now() - ($2 || ' milliseconds')::interval`,
    [service.id, STALE_MS]
  );
  const { rows } = await pool.query('SELECT * FROM service_operations WHERE service_id = $1 ORDER BY id DESC LIMIT 1', [
    service.id,
  ]);
  return rows[0] ? map(rows[0]) : null;
}

/** Record the operation and run it in the background; returns at once. */
export async function begin(teamId: number, uuid: string, action: ServiceAction): Promise<ServiceOperation> {
  const current = await latest(teamId, uuid);
  if (current?.status === 'running') {
    throw conflict('OPERATION_RUNNING', `A ${current.action} is already running for this service.`);
  }
  const service = (await serviceService.getService(teamId, uuid))!;
  const { rows } = await pool.query(
    `INSERT INTO service_operations (service_id, action) VALUES ($1, $2) RETURNING *`,
    [service.id, action]
  );
  const operation = map(rows[0]);
  void run(teamId, uuid, operation.id, action);
  return operation;
}

async function run(teamId: number, uuid: string, id: number, action: ServiceAction): Promise<void> {
  let pending = '';
  let size = 0;
  let flushing: Promise<void> = Promise.resolve();
  const flush = () => {
    if (!pending) return flushing;
    const chunk = pending;
    pending = '';
    flushing = flushing.then(async () => {
      try {
        await pool.query('UPDATE service_operations SET output = output || $2, updated_at = now() WHERE id = $1', [id, chunk]);
      } catch (err) {
        logger.warn('Could not save service operation output', { id, message: (err as Error).message });
      }
    });
    return flushing;
  };
  const write = (chunk: string) => {
    if (size >= MAX_OUTPUT) return;
    const part = chunk.slice(0, MAX_OUTPUT - size);
    size += part.length;
    pending += part;
    void realtime.serviceLog(uuid, part);
  };
  const timer = setInterval(() => void flush(), FLUSH_MS);
  let success = false;
  try {
    const result = await serviceService.lifecycle(teamId, uuid, action, write);
    success = result.success;
    if (!success) write(`\n❌ ${action} failed.\n`);
    else write(`\n✅ ${action} done.\n`);
  } catch (err) {
    write(`\n❌ ${(err as Error).message || `Failed to ${action} service`}\n`);
    logger.error(`service ${action} error`, { uuid, message: (err as Error).message });
  } finally {
    clearInterval(timer);
    await flush();
    await pool
      .query(`UPDATE service_operations SET status = $2, finished_at = now(), updated_at = now() WHERE id = $1`, [
        id,
        success ? 'succeeded' : 'failed',
      ])
      .catch((err) => logger.error('Could not close service operation', { id, message: (err as Error).message }));
  }
}

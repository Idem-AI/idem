/**
 * Scheduled tasks (cron commands run inside an application/service container).
 * Ports Coolify's ScheduledTask model + ScheduledTaskJob. CRUD + run-now +
 * executions; cron scheduling via BullMQ repeatable jobs (see jobs/scheduled-task.worker).
 */
import { randomUUID } from 'crypto';
import pool from '../config/db.config';
import * as appService from './application.service';
import * as serverService from './server.service';
import { executeRemoteCommand } from '../ssh/ssh';

export interface ScheduledTask {
  id: number;
  uuid: string;
  enabled: boolean;
  name: string;
  command: string;
  frequency: string;
  container: string | null;
  application_id: number | null;
  service_id: number | null;
}

function map(r: Record<string, unknown>): ScheduledTask {
  return {
    id: Number(r.id),
    uuid: String(r.uuid),
    enabled: Boolean(r.enabled),
    name: String(r.name),
    command: String(r.command),
    frequency: String(r.frequency),
    container: (r.container as string) ?? null,
    application_id: r.application_id ? Number(r.application_id) : null,
    service_id: r.service_id ? Number(r.service_id) : null,
  };
}

export async function listForApplication(teamId: number, appUuid: string): Promise<ScheduledTask[]> {
  const app = await appService.getApplication(teamId, appUuid);
  if (!app) throw new Error('Application not found');
  const { rows } = await pool.query(
    'SELECT * FROM scheduled_tasks WHERE application_id = $1 ORDER BY name',
    [app.id]
  );
  return rows.map(map);
}

export async function createForApplication(
  teamId: number,
  appUuid: string,
  dto: { name: string; command: string; frequency: string; container?: string }
): Promise<ScheduledTask> {
  const app = await appService.getApplication(teamId, appUuid);
  if (!app) throw new Error('Application not found');
  const uuid = randomUUID();
  const { rows } = await pool.query(
    `INSERT INTO scheduled_tasks (uuid, enabled, name, command, frequency, container, application_id, team_id, created_at, updated_at)
     VALUES ($1, true, $2, $3, $4, $5, $6, $7, now(), now()) RETURNING *`,
    [uuid, dto.name, dto.command, dto.frequency, dto.container ?? null, app.id, teamId]
  );
  return map(rows[0]);
}

export async function deleteTask(teamId: number, uuid: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    'DELETE FROM scheduled_tasks WHERE team_id = $1 AND uuid = $2',
    [teamId, uuid]
  );
  return (rowCount ?? 0) > 0;
}

export async function getTask(teamId: number, uuid: string): Promise<ScheduledTask | null> {
  const { rows } = await pool.query(
    'SELECT * FROM scheduled_tasks WHERE team_id = $1 AND uuid = $2 LIMIT 1',
    [teamId, uuid]
  );
  return rows[0] ? map(rows[0]) : null;
}

export async function listExecutions(teamId: number, uuid: string): Promise<Record<string, unknown>[]> {
  const { rows } = await pool.query(
    `SELECT ex.uuid, ex.status, ex.message, ex.created_at
     FROM scheduled_task_executions ex
     JOIN scheduled_tasks st ON st.id = ex.scheduled_task_id
     WHERE st.team_id = $1 AND st.uuid = $2 ORDER BY ex.created_at DESC LIMIT 50`,
    [teamId, uuid]
  );
  return rows;
}

/** Run a scheduled task now (docker exec the command in the target container). */
export async function runNow(teamId: number, uuid: string): Promise<{ success: boolean; output: string }> {
  const task = await getTask(teamId, uuid);
  if (!task) throw new Error('Scheduled task not found');
  if (!task.application_id) throw new Error('Only application tasks are supported in this slice');

  const serverRef = await appService.getApplicationServer(task.application_id);
  if (!serverRef) throw new Error('No server resolved for the application');
  const server = await serverService.getServerById(teamId, serverRef.serverId);
  if (!server) throw new Error('Server not found');
  const key = await serverService.getPrivateKey(teamId, server.private_key_id);
  if (!key) throw new Error('Private key not found');

  const executionUuid = randomUUID();
  await pool.query(
    `INSERT INTO scheduled_task_executions (uuid, status, scheduled_task_id, created_at, updated_at)
     VALUES ($1, 'running', $2, now(), now())`,
    [executionUuid, task.id]
  );

  // Use the explicit container if set, else resolve the app's managed container by label.
  const target = task.container
    ? task.container
    : `$(docker ps --filter label=ideploy.applicationUuid --format '{{.Names}}' | head -1)`;
  const cmd = `docker exec ${target} sh -c ${JSON.stringify(task.command)}`;

  const result = await executeRemoteCommand(server, key, cmd);
  await pool.query(
    `UPDATE scheduled_task_executions SET status = $1, message = $2, updated_at = now() WHERE uuid = $3`,
    [result.exitCode === 0 ? 'success' : 'failed', (result.stdout + result.stderr).slice(0, 4000), executionUuid]
  );
  return { success: result.exitCode === 0, output: result.stdout + result.stderr };
}

export async function listAllEnabled(): Promise<(ScheduledTask & { team_id: number })[]> {
  const { rows } = await pool.query('SELECT * FROM scheduled_tasks WHERE enabled = true');
  return rows.map((r) => ({ ...map(r), team_id: Number(r.team_id) }));
}

/**
 * CI/CD pipelines — config per application + executions/jobs. Ports Coolify's
 * PipelineConfig/PipelineExecution/PipelineJob models and the
 * PipelineOrchestratorJob entry point. Stage execution runs in the worker
 * (jobs/pipeline.worker) which streams logs and records scan results.
 */
import { randomUUID } from 'crypto';
import pool from '../config/db.config';
import * as appService from './application.service';
import { getQueue, QUEUE_NAMES } from '../queue/queues';

const DEFAULT_STAGES = ['language_detection', 'sonarqube', 'trivy', 'deploy'];

export interface PipelineConfig {
  id: number;
  application_id: number;
  enabled: boolean;
  stages: string[];
  trigger_mode: string;
  trigger_branches: string[];
}

function mapConfig(r: Record<string, unknown>): PipelineConfig {
  return {
    id: Number(r.id),
    application_id: Number(r.application_id),
    enabled: Boolean(r.enabled),
    stages: (r.stages as string[]) ?? DEFAULT_STAGES,
    trigger_mode: String(r.trigger_mode),
    trigger_branches: (r.trigger_branches as string[]) ?? [],
  };
}

async function appOr404(teamId: number, appUuid: string) {
  const app = await appService.getApplication(teamId, appUuid);
  if (!app) throw new Error('Application not found');
  return app;
}

export async function getOrCreateConfig(teamId: number, appUuid: string): Promise<PipelineConfig> {
  const app = await appOr404(teamId, appUuid);
  const existing = await pool.query('SELECT * FROM pipeline_configs WHERE application_id = $1 LIMIT 1', [
    app.id,
  ]);
  if (existing.rows[0]) return mapConfig(existing.rows[0]);
  const { rows } = await pool.query(
    `INSERT INTO pipeline_configs (application_id, stages, created_at, updated_at)
     VALUES ($1, $2, now(), now()) RETURNING *`,
    [app.id, JSON.stringify(DEFAULT_STAGES)]
  );
  return mapConfig(rows[0]);
}

export async function updateConfig(
  teamId: number,
  appUuid: string,
  dto: Partial<{ enabled: boolean; stages: string[]; trigger_mode: string; trigger_branches: string[] }>
): Promise<PipelineConfig> {
  const config = await getOrCreateConfig(teamId, appUuid);
  const sets: string[] = [];
  const params: unknown[] = [];
  if (dto.enabled !== undefined) {
    params.push(dto.enabled);
    sets.push(`enabled = $${params.length}`);
  }
  if (dto.stages) {
    params.push(JSON.stringify(dto.stages));
    sets.push(`stages = $${params.length}`);
  }
  if (dto.trigger_mode) {
    params.push(dto.trigger_mode);
    sets.push(`trigger_mode = $${params.length}`);
  }
  if (dto.trigger_branches) {
    params.push(JSON.stringify(dto.trigger_branches));
    sets.push(`trigger_branches = $${params.length}`);
  }
  if (sets.length === 0) return config;
  params.push(config.id);
  const { rows } = await pool.query(
    `UPDATE pipeline_configs SET ${sets.join(', ')}, updated_at = now() WHERE id = $${params.length} RETURNING *`,
    params
  );
  return mapConfig(rows[0]);
}

export interface PipelineJobData {
  executionUuid: string;
  executionId: number;
  applicationId: number;
  applicationUuid: string;
  teamId: number;
  stages: string[];
  branch: string;
}

/** Trigger a pipeline run: create execution + job rows, enqueue the orchestrator. */
export async function trigger(
  teamId: number,
  appUuid: string,
  opts: { branch?: string; triggerType?: string } = {}
): Promise<{ executionUuid: string }> {
  const app = await appOr404(teamId, appUuid);
  const config = await getOrCreateConfig(teamId, appUuid);
  const executionUuid = randomUUID();

  const { rows } = await pool.query(
    `INSERT INTO pipeline_executions
       (uuid, pipeline_config_id, application_id, trigger_type, branch, status, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,'pending', now(), now()) RETURNING id`,
    [executionUuid, config.id, app.id, opts.triggerType ?? 'manual', opts.branch ?? app.git_branch ?? 'main']
  );
  const executionId = Number(rows[0].id);

  // Pre-create job rows in order.
  let order = 0;
  for (const stage of config.stages) {
    await pool.query(
      `INSERT INTO pipeline_jobs (uuid, pipeline_execution_id, name, status, "order", created_at, updated_at)
       VALUES ($1,$2,$3,'pending',$4, now(), now())`,
      [randomUUID(), executionId, stage, order++]
    );
  }

  const data: PipelineJobData = {
    executionUuid,
    executionId,
    applicationId: app.id,
    applicationUuid: app.uuid,
    teamId,
    stages: config.stages,
    branch: opts.branch ?? app.git_branch ?? 'main',
  };
  await getQueue(QUEUE_NAMES.pipelines).add('pipeline', data, { jobId: `pipeline:${executionUuid}` });
  return { executionUuid };
}

export async function listExecutions(teamId: number, appUuid: string): Promise<Record<string, unknown>[]> {
  const app = await appOr404(teamId, appUuid);
  const { rows } = await pool.query(
    `SELECT uuid, trigger_type, branch, status, started_at, finished_at, duration_seconds
     FROM pipeline_executions WHERE application_id = $1 ORDER BY created_at DESC LIMIT 50`,
    [app.id]
  );
  return rows;
}

export async function getExecution(teamId: number, executionUuid: string): Promise<Record<string, unknown> | null> {
  const { rows } = await pool.query(
    `SELECT pe.* FROM pipeline_executions pe
     JOIN applications a ON a.id = pe.application_id
     JOIN environments e ON e.id = a.environment_id
     JOIN projects p ON p.id = e.project_id
     WHERE p.team_id = $1 AND pe.uuid = $2 LIMIT 1`,
    [teamId, executionUuid]
  );
  if (!rows[0]) return null;
  const execution = rows[0];
  const jobs = await pool.query(
    `SELECT uuid, name, status, "order", duration_seconds FROM pipeline_jobs WHERE pipeline_execution_id = $1 ORDER BY "order"`,
    [execution.id]
  );
  const scans = await pool.query(
    `SELECT tool, status, quality_gate_status, bugs, vulnerabilities, code_smells, coverage
     FROM pipeline_scan_results WHERE pipeline_execution_id = $1`,
    [execution.id]
  );
  return { ...execution, jobs: jobs.rows, scans: scans.rows };
}

// ── Worker-facing helpers (status updates / scan results) ─────────────────
export async function setExecutionStatus(executionId: number, status: string): Promise<void> {
  await pool.query('UPDATE pipeline_executions SET status = $1, updated_at = now() WHERE id = $2', [
    status,
    executionId,
  ]);
}

export async function setJobStatus(
  executionId: number,
  name: string,
  status: string,
  logs?: string
): Promise<void> {
  await pool.query(
    `UPDATE pipeline_jobs SET status = $1, logs = COALESCE($2, logs), updated_at = now()
     WHERE pipeline_execution_id = $3 AND name = $4`,
    [status, logs ?? null, executionId, name]
  );
}

export async function recordScanResult(
  executionId: number,
  tool: string,
  metrics: Record<string, unknown>
): Promise<void> {
  const { rows } = await pool.query(
    'SELECT id FROM pipeline_jobs WHERE pipeline_execution_id = $1 AND name = $2 LIMIT 1',
    [executionId, tool]
  );
  const jobId = rows[0]?.id ?? null;
  await pool.query(
    `INSERT INTO pipeline_scan_results
       (uuid, pipeline_job_id, pipeline_execution_id, tool, status, quality_gate_status, bugs, vulnerabilities, code_smells, security_hotspots, coverage, created_at, updated_at)
     VALUES ($1,$2,$3,$4,'success',$5,$6,$7,$8,$9,$10, now(), now())`,
    [
      randomUUID(),
      jobId,
      executionId,
      tool,
      (metrics.quality_gate_status as string) ?? null,
      metrics.bugs ?? null,
      metrics.vulnerabilities ?? null,
      metrics.code_smells ?? null,
      metrics.security_hotspots ?? null,
      metrics.coverage ?? null,
    ]
  );
}

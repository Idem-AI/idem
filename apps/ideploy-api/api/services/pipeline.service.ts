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

/** The only two the UI actually offers a control for — see `mapConfig`'s note on why a third, unselectable value can still show up here. */
const KNOWN_TRIGGER_MODES = new Set(['manual', 'on_push']);

function mapConfig(r: Record<string, unknown>): PipelineConfig {
  const triggerMode = String(r.trigger_mode);
  return {
    id: Number(r.id),
    application_id: Number(r.application_id),
    enabled: Boolean(r.enabled),
    stages: (r.stages as string[]) ?? DEFAULT_STAGES,
    // The column's own default is `'auto'` (a Laravel-schema leftover this
    // rewrite never gave a `<select>` option for) — a config row created
    // before `getOrCreateConfig` below started setting it explicitly landed
    // on a value with no matching `<option>`, which a `<select>` renders as
    // *nothing selected* rather than falling back to the first option.
    // Verified live: exactly this made the Trigger dropdown look empty on a
    // page that had otherwise loaded fine. Coerced here, at read time, so an
    // already-existing row self-heals on the next load instead of needing a
    // data migration.
    trigger_mode: KNOWN_TRIGGER_MODES.has(triggerMode) ? triggerMode : 'manual',
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
    `INSERT INTO pipeline_configs (application_id, stages, trigger_mode, created_at, updated_at)
     VALUES ($1, $2, 'manual', now(), now()) RETURNING *`,
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
  // BullMQ rejects a custom job id containing ':' outright (throws, uncaught
  // it takes the whole process down with it — this crashed every trigger).
  await getQueue(QUEUE_NAMES.pipelines).add('pipeline', data, { jobId: executionUuid });
  return { executionUuid };
}

/**
 * Executions, each with its jobs' name/status/order — enough for the run list
 * to draw the same small per-stage dots as the detail page's big pipeline
 * graph, without a caller having to open every execution just to know
 * whether stage 3 of 4 is the one that failed.
 */
export async function listExecutions(teamId: number, appUuid: string): Promise<Record<string, unknown>[]> {
  const app = await appOr404(teamId, appUuid);
  const { rows } = await pool.query(
    `SELECT pe.uuid, pe.trigger_type, pe.trigger_user, pe.branch, pe.commit_sha, pe.commit_message,
            pe.status, pe.error_message, pe.started_at, pe.finished_at, pe.duration_seconds,
            COALESCE(
              (SELECT json_agg(json_build_object('name', pj.name, 'status', pj.status) ORDER BY pj."order")
               FROM pipeline_jobs pj WHERE pj.pipeline_execution_id = pe.id),
              '[]'
            ) AS stages
     FROM pipeline_executions pe
     WHERE pe.application_id = $1 ORDER BY pe.created_at DESC LIMIT 50`,
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
    `SELECT uuid, name, status, "order", started_at, finished_at, duration_seconds, logs, error_message
     FROM pipeline_jobs WHERE pipeline_execution_id = $1 ORDER BY "order"`,
    [execution.id]
  );
  const scans = await pool.query(
    `SELECT tool, status, quality_gate_status, bugs, vulnerabilities, code_smells, coverage
     FROM pipeline_scan_results WHERE pipeline_execution_id = $1`,
    [execution.id]
  );
  return { ...execution, jobs: jobs.rows, scans: scans.rows };
}

/** Re-run: a fresh execution on the same branch — same as any other manual trigger. */
export async function rerun(teamId: number, executionUuid: string): Promise<{ executionUuid: string }> {
  const { rows } = await pool.query(
    `SELECT a.uuid AS app_uuid, pe.branch FROM pipeline_executions pe
     JOIN applications a ON a.id = pe.application_id
     JOIN environments e ON e.id = a.environment_id
     JOIN projects p ON p.id = e.project_id
     WHERE p.team_id = $1 AND pe.uuid = $2 LIMIT 1`,
    [teamId, executionUuid]
  );
  const r = rows[0];
  if (!r) throw new Error('Execution not found');
  return trigger(teamId, r.app_uuid, { branch: r.branch, triggerType: 'manual' });
}

/** Delete one execution's record and everything under it (jobs, logs, scan results — all `ON DELETE CASCADE`). */
export async function deleteExecution(teamId: number, executionUuid: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `DELETE FROM pipeline_executions pe USING applications a, environments e, projects p
     WHERE pe.application_id = a.id AND a.environment_id = e.id AND e.project_id = p.id
       AND p.team_id = $1 AND pe.uuid = $2`,
    [teamId, executionUuid]
  );
  return (rowCount ?? 0) > 0;
}

const TERMINAL_EXECUTION_STATUSES = new Set(['success', 'failed', 'cancelled']);

// ── Worker-facing helpers (status updates / scan results) ─────────────────
/** Same self-timing as `setJobStatus`, one level up: the execution as a whole. */
export async function setExecutionStatus(executionId: number, status: string): Promise<void> {
  await pool.query(
    `UPDATE pipeline_executions SET
       status = $1::text,
       started_at = CASE WHEN $1::text = 'running' AND started_at IS NULL THEN now() ELSE started_at END,
       finished_at = CASE WHEN $1::text = ANY($3::text[]) THEN now() ELSE finished_at END,
       duration_seconds = CASE WHEN $1::text = ANY($3::text[]) AND started_at IS NOT NULL
                                THEN EXTRACT(EPOCH FROM (now() - started_at))
                                ELSE duration_seconds END,
       updated_at = now()
     WHERE id = $2`,
    [status, executionId, [...TERMINAL_EXECUTION_STATUSES]]
  );
}

const TERMINAL_JOB_STATUSES = new Set(['success', 'failed', 'skipped']);

/**
 * Update a job's status and, from that alone, its timing: `started_at` the
 * first time it turns 'running', `finished_at` + `duration_seconds` the
 * moment it reaches a terminal status. The worker only ever says *what*
 * happened; deriving *when* here means every call site gets accurate timing
 * for free instead of each one having to remember to stamp it.
 */
export async function setJobStatus(
  executionId: number,
  name: string,
  status: string,
  logs?: string
): Promise<void> {
  await pool.query(
    `UPDATE pipeline_jobs SET
       status = $1::text,
       logs = COALESCE($2, logs),
       started_at = CASE WHEN $1::text = 'running' AND started_at IS NULL THEN now() ELSE started_at END,
       finished_at = CASE WHEN $1::text = ANY($5::text[]) THEN now() ELSE finished_at END,
       duration_seconds = CASE WHEN $1::text = ANY($5::text[]) AND started_at IS NOT NULL
                                THEN EXTRACT(EPOCH FROM (now() - started_at))
                                ELSE duration_seconds END,
       updated_at = now()
     WHERE pipeline_execution_id = $3 AND name = $4`,
    [status, logs ?? null, executionId, name, [...TERMINAL_JOB_STATUSES]]
  );
}

/**
 * The worker's catch-all for a stage whose command threw outright (an SSH
 * exception, not just a non-zero exit) rather than reaching its own
 * `setJobStatus` call — without this, that stage stays 'running' forever,
 * indistinguishable in the UI from one genuinely stuck mid-flight. Only
 * touches a stage still 'running': a stage that already recorded its own
 * outcome (e.g. `language_detection` always calls `setJobStatus` with the
 * real `git clone` stdout/stderr before it decides whether to throw) keeps
 * that detail — verified live against a real failure where this catch-all's
 * generic Error message ("git clone failed") was overwriting the actually
 * useful "Authentication failed… Bad credentials" the command itself had
 * already reported, the one line an operator actually needed to see.
 */
export async function markStillRunningAsFailed(
  executionId: number,
  name: string,
  message: string
): Promise<void> {
  await pool.query(
    `UPDATE pipeline_jobs SET
       status = 'failed',
       logs = COALESCE(logs, $3),
       finished_at = now(),
       duration_seconds = CASE WHEN started_at IS NOT NULL THEN EXTRACT(EPOCH FROM (now() - started_at)) ELSE duration_seconds END,
       error_message = $3,
       updated_at = now()
     WHERE pipeline_execution_id = $1 AND name = $2 AND status = 'running'`,
    [executionId, name, message]
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

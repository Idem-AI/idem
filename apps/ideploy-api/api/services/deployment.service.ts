/**
 * Deployment orchestration — creates the deployment queue record and enqueues
 * the BullMQ job. Ports the entry point of Coolify's DeployController +
 * ApplicationDeploymentJob (the heavy lifting runs in the worker).
 */
import { randomUUID } from 'crypto';
import pool from '../config/db.config';
import { deploymentQueue } from '../queue/queues';

export interface DeploymentJobData {
  deploymentUuid: string;
  applicationId: number;
  applicationUuid: string;
  teamId: number;
  commit: string;
  forceRebuild: boolean;
}

export async function createDeployment(
  application: { id: number; uuid: string },
  teamId: number,
  opts: { commit?: string; forceRebuild?: boolean; isWebhook?: boolean } = {}
): Promise<{ deploymentUuid: string }> {
  const deploymentUuid = randomUUID();
  await pool.query(
    `INSERT INTO application_deployment_queues
       (application_id, deployment_uuid, pull_request_id, force_rebuild, commit, status, is_webhook, created_at, updated_at)
     VALUES ($1,$2,0,$3,$4,'queued',$5, now(), now())`,
    [
      String(application.id),
      deploymentUuid,
      opts.forceRebuild ?? false,
      opts.commit ?? 'HEAD',
      opts.isWebhook ?? false,
    ]
  );

  const data: DeploymentJobData = {
    deploymentUuid,
    applicationId: application.id,
    applicationUuid: application.uuid,
    teamId,
    commit: opts.commit ?? 'HEAD',
    forceRebuild: opts.forceRebuild ?? false,
  };
  await deploymentQueue.add('deploy', data, { jobId: deploymentUuid });

  return { deploymentUuid };
}

export async function setDeploymentStatus(deploymentUuid: string, status: string): Promise<void> {
  await pool.query(
    'UPDATE application_deployment_queues SET status = $1, updated_at = now() WHERE deployment_uuid = $2',
    [status, deploymentUuid]
  );
}

/** Deployment history for an application (newest first) — used for rollback. */
export async function listForApplication(
  teamId: number,
  appUuid: string
): Promise<Record<string, unknown>[]> {
  const { rows } = await pool.query(
    `SELECT adq.deployment_uuid, adq.commit, adq.status, adq.is_webhook, adq.created_at
     FROM application_deployment_queues adq
     JOIN applications a ON a.id = CAST(adq.application_id AS integer)
     JOIN environments e ON e.id = a.environment_id
     JOIN projects p ON p.id = e.project_id
     WHERE p.team_id = $1 AND a.uuid = $2
     ORDER BY adq.created_at DESC LIMIT 50`,
    [teamId, appUuid]
  );
  return rows;
}

function computeAppLink(fqdn: string | null, ports_mappings: string | null): string | null {
  if (fqdn) {
    const f = fqdn.split(',')[0].trim();
    return /^https?:\/\//.test(f) ? f : `https://${f}`;
  }
  if (ports_mappings) {
    const first = ports_mappings.split(',')[0].trim(); // "hostPort:containerPort"
    const hostPort = first.split(':')[0];
    if (hostPort) return `http://localhost:${hostPort}`;
  }
  return null;
}

export async function getDeployment(
  teamId: number,
  deploymentUuid: string
): Promise<Record<string, unknown> | null> {
  // Scope through application → environment → project → team.
  const { rows } = await pool.query(
    `SELECT adq.*, a.uuid AS application_uuid, a.name AS application_name,
            a.fqdn AS application_fqdn, a.ports_mappings AS application_ports_mappings,
            a.git_branch AS application_git_branch
     FROM application_deployment_queues adq
     JOIN applications a ON a.id = CAST(adq.application_id AS integer)
     JOIN environments e ON e.id = a.environment_id
     JOIN projects p ON p.id = e.project_id
     WHERE p.team_id = $1 AND adq.deployment_uuid = $2 LIMIT 1`,
    [teamId, deploymentUuid]
  );
  if (!rows[0]) return null;

  const url = computeAppLink(
    rows[0].application_fqdn ? String(rows[0].application_fqdn) : null,
    rows[0].application_ports_mappings ? String(rows[0].application_ports_mappings) : null
  );

  return {
    ...rows[0],
    application_url: url,
  };
}

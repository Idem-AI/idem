/**
 * Deployment orchestration — creates the deployment queue record and enqueues
 * the BullMQ job. Ports the entry point of Coolify's DeployController +
 * ApplicationDeploymentJob (the heavy lifting runs in the worker).
 */
import { randomUUID } from 'crypto';
import os from 'os';
import pool from '../config/db.config';
import { deploymentQueue } from '../queue/queues';
import { notFound, unprocessable } from '../utils/errors';

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
  opts: { commit?: string; forceRebuild?: boolean; isWebhook?: boolean; rollback?: boolean } = {}
): Promise<{ deploymentUuid: string }> {
  const deploymentUuid = randomUUID();
  await pool.query(
    `INSERT INTO application_deployment_queues
       (application_id, deployment_uuid, pull_request_id, force_rebuild, commit, status, is_webhook, rollback, created_at, updated_at)
     VALUES ($1,$2,0,$3,$4,'queued',$5,$6, now(), now())`,
    [
      String(application.id),
      deploymentUuid,
      opts.forceRebuild ?? false,
      opts.commit ?? 'HEAD',
      opts.isWebhook ?? false,
      opts.rollback ?? false,
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


/**
 * Note on the joins below: `application_deployment_queues.application_id` is a
 * `varchar` in this schema while `applications.id` is a `bigint`, so the join
 * needs an explicit cast. The insert path already worked around it by writing
 * `String(application.id)`.
 */

/** A past deployment that can be redeployed. */
export interface RollbackTarget {
  deploymentUuid: string;
  commit: string;
  status: string;
  finishedAt: string | null;
}

/**
 * Deployments this application can be rolled back to.
 *
 * Only successful ones: rolling back to a deployment that failed would reproduce
 * the failure, which is the opposite of what someone reaching for rollback wants.
 * The current deployment is excluded — it is what they are rolling back *from*.
 */
export async function listRollbackTargets(
  teamId: number,
  applicationUuid: string,
  limit = 20
): Promise<RollbackTarget[]> {
  const { rows } = await pool.query(
    `SELECT q.deployment_uuid, q.commit, q.status, q.finished_at
     FROM application_deployment_queues q
     JOIN applications a  ON a.id::text = q.application_id
     JOIN environments e  ON e.id = a.environment_id
     JOIN projects p      ON p.id = e.project_id
     WHERE p.team_id = $1 AND a.uuid = $2 AND q.status = 'finished'
     ORDER BY q.created_at DESC
     OFFSET 1
     LIMIT $3`,
    [teamId, applicationUuid, limit]
  );

  return rows.map((r) => ({
    deploymentUuid: String(r.deployment_uuid),
    commit: String(r.commit ?? 'HEAD'),
    status: String(r.status),
    finishedAt: r.finished_at ? String(r.finished_at) : null,
  }));
}

/**
 * Redeploy the commit a past deployment used.
 *
 * Implemented as a fresh deployment of that commit rather than by restarting the
 * old container: the previous image may have been pruned, and rebuilding from a
 * known commit is reproducible where reusing a possibly-absent image is not.
 *
 * @throws DomainError NOT_FOUND when the deployment is not this team's.
 * @throws DomainError NOT_ROLLBACKABLE when it never succeeded.
 */
export async function rollbackTo(
  teamId: number,
  applicationUuid: string,
  deploymentUuid: string
): Promise<{ deploymentUuid: string; commit: string }> {
  const { rows } = await pool.query(
    `SELECT q.commit, q.status, a.id AS application_id, a.uuid AS application_uuid
     FROM application_deployment_queues q
     JOIN applications a  ON a.id::text = q.application_id
     JOIN environments e  ON e.id = a.environment_id
     JOIN projects p      ON p.id = e.project_id
     WHERE p.team_id = $1 AND a.uuid = $2 AND q.deployment_uuid = $3
     LIMIT 1`,
    [teamId, applicationUuid, deploymentUuid]
  );

  const target = rows[0];
  if (!target) throw notFound('Deployment');

  if (target.status !== 'finished') {
    throw unprocessable(
      'NOT_ROLLBACKABLE',
      `That deployment ended as "${target.status}". Roll back to one that succeeded.`
    );
  }

  const commit = String(target.commit ?? 'HEAD');
  if (commit === 'HEAD') {
    // HEAD is whatever the branch points at now, so redeploying it would not
    // reproduce the old state — that is a redeploy, not a rollback.
    throw unprocessable(
      'NOT_ROLLBACKABLE',
      'That deployment did not record a specific commit, so it cannot be reproduced. Redeploy instead.'
    );
  }

  const created = await createDeployment(
    { id: Number(target.application_id), uuid: String(target.application_uuid) },
    teamId,
    { commit, forceRebuild: true, rollback: true }
  );

  return { deploymentUuid: created.deploymentUuid, commit };
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

function getLocalIpAddress(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return '127.0.0.1';
}

function computeAppLink(fqdn: string | null, ports_mappings: string | null): string | null {
  if (fqdn) {
    const f = fqdn.split(',')[0].trim();
    return /^https?:\/\//.test(f) ? f : `https://${f}`;
  }
  if (ports_mappings) {
    const first = ports_mappings.split(',')[0].trim(); // "hostPort:containerPort"
    const hostPort = first.split(':')[0];
    if (hostPort) {
      const ip = getLocalIpAddress();
      return `http://${ip}:${hostPort}`;
    }
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

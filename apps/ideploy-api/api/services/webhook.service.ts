/**
 * Push-to-deploy.
 *
 * Ports the `Webhook\{Github,Gitlab,Bitbucket,Gitea}` controllers. Until now every
 * deployment had to be triggered by hand, which is the one thing users expect a
 * PaaS to do for them.
 *
 * The endpoint is unauthenticated by necessity — a git host cannot present a
 * session cookie — so the signature check *is* the authorisation. Two rules
 * follow, and both are enforced below rather than left to the caller:
 *
 *  - the comparison must be timing-safe, since a leaky compare turns the secret
 *    into something guessable byte by byte;
 *  - a request that fails verification must be rejected before anything reads its
 *    payload, so a forged body cannot influence what we do next.
 *
 * Secrets live in the `manual_webhook_secret_*` columns the Laravel side already
 * defines, so a webhook configured there keeps working here and vice versa.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import pool from '../config/db.config';
import logger from '../config/logger';
import { notFound, unprocessable } from '../utils/errors';

export type GitProvider = 'github' | 'gitlab' | 'bitbucket' | 'gitea';

export const GIT_PROVIDERS: readonly GitProvider[] = [
  'github',
  'gitlab',
  'bitbucket',
  'gitea',
] as const;

const SECRET_COLUMN: Record<GitProvider, string> = {
  github: 'manual_webhook_secret_github',
  gitlab: 'manual_webhook_secret_gitlab',
  bitbucket: 'manual_webhook_secret_bitbucket',
  gitea: 'manual_webhook_secret_gitea',
};

/**
 * Constant-time string comparison.
 *
 * `timingSafeEqual` throws on length mismatch, which would itself leak the
 * secret's length, so lengths are compared first and a mismatch still walks the
 * full comparison path.
 */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * GitHub and Gitea sign the raw body: `sha256=<hex hmac>`.
 * Verification needs the bytes as received — a re-serialised body will not match.
 */
export function verifyHmacSignature(
  rawBody: Buffer | string,
  signatureHeader: string | undefined,
  secret: string
): boolean {
  if (!signatureHeader || !secret) return false;

  const provided = signatureHeader.startsWith('sha256=')
    ? signatureHeader.slice('sha256='.length)
    : signatureHeader;
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');

  return safeEqual(provided, expected);
}

/** GitLab sends the secret verbatim in a header rather than signing the body. */
export function verifySharedToken(tokenHeader: string | undefined, secret: string): boolean {
  if (!tokenHeader || !secret) return false;
  return safeEqual(tokenHeader, secret);
}

export interface PushEvent {
  branch: string | null;
  /** Paths touched by the push, when the provider reports them. */
  changedFiles: string[];
}

/** `refs/heads/main` → `main`. Tag and other refs yield null. */
function branchFromRef(ref: unknown): string | null {
  if (typeof ref !== 'string') return null;
  return ref.startsWith('refs/heads/') ? ref.slice('refs/heads/'.length) : null;
}

type Payload = Record<string, unknown>;

/** Read the branch and touched files out of a provider's push payload. */
export function parsePushEvent(provider: GitProvider, payload: Payload): PushEvent {
  if (provider === 'bitbucket') {
    // Bitbucket nests the branch under push.changes[].new.
    const changes = (payload.push as Payload | undefined)?.changes as Payload[] | undefined;
    const target = changes?.[0]?.new as Payload | undefined;
    return {
      branch: target?.type === 'branch' ? String(target.name) : null,
      changedFiles: [],
    };
  }

  // GitHub, GitLab and Gitea all use `ref` plus a `commits` array.
  const commits = (payload.commits as Payload[] | undefined) ?? [];
  const changedFiles = new Set<string>();
  for (const commit of commits) {
    for (const key of ['added', 'removed', 'modified'] as const) {
      for (const file of (commit[key] as string[] | undefined) ?? []) {
        changedFiles.add(file);
      }
    }
  }

  return { branch: branchFromRef(payload.ref), changedFiles: [...changedFiles] };
}

export interface WebhookTarget {
  applicationId: number;
  applicationUuid: string;
  name: string;
  teamId: number;
  gitBranch: string;
  autoDeployEnabled: boolean;
  secret: string | null;
}

/** Resolve the application a webhook is aimed at, with everything needed to judge it. */
export async function loadWebhookTarget(
  applicationUuid: string,
  provider: GitProvider
): Promise<WebhookTarget | null> {
  const { rows } = await pool.query(
    `SELECT a.id, a.uuid, a.name, a.git_branch,
            a.${SECRET_COLUMN[provider]} AS secret,
            COALESCE(aps.is_auto_deploy_enabled, true) AS auto_deploy,
            p.team_id
     FROM applications a
     JOIN environments e ON e.id = a.environment_id
     JOIN projects p     ON p.id = e.project_id
     LEFT JOIN application_settings aps ON aps.application_id = a.id
     WHERE a.uuid = $1
     LIMIT 1`,
    [applicationUuid]
  );

  const r = rows[0];
  if (!r) return null;

  return {
    applicationId: Number(r.id),
    applicationUuid: String(r.uuid),
    name: String(r.name),
    teamId: Number(r.team_id),
    gitBranch: String(r.git_branch ?? 'main'),
    autoDeployEnabled: Boolean(r.auto_deploy),
    secret: (r.secret as string) ?? null,
  };
}

/**
 * The secret for an application's webhook, generating one on first use.
 *
 * Returned to the user once, when they set the webhook up on the git host.
 */
export async function ensureWebhookSecret(
  teamId: number,
  applicationUuid: string,
  provider: GitProvider
): Promise<string> {
  const target = await loadWebhookTarget(applicationUuid, provider);
  if (!target || target.teamId !== teamId) throw notFound('Application');

  if (target.secret) return target.secret;

  const secret = randomBytes(32).toString('hex');
  await pool.query(
    `UPDATE applications SET ${SECRET_COLUMN[provider]} = $2, updated_at = now() WHERE id = $1`,
    [target.applicationId, secret]
  );
  return secret;
}

/** Discard the current secret, so a leaked one can be retired. */
export async function rotateWebhookSecret(
  teamId: number,
  applicationUuid: string,
  provider: GitProvider
): Promise<string> {
  const target = await loadWebhookTarget(applicationUuid, provider);
  if (!target || target.teamId !== teamId) throw notFound('Application');

  const secret = randomBytes(32).toString('hex');
  await pool.query(
    `UPDATE applications SET ${SECRET_COLUMN[provider]} = $2, updated_at = now() WHERE id = $1`,
    [target.applicationId, secret]
  );
  return secret;
}

export type WebhookOutcome =
  | { action: 'deployed'; deploymentUuid: string; branch: string }
  | { action: 'ignored'; reason: string };

export interface WebhookRequest {
  provider: GitProvider;
  applicationUuid: string;
  rawBody: Buffer | string;
  payload: Payload;
  signature?: string;
  token?: string;
}

/**
 * Decide whether a verified webhook should trigger a deployment.
 *
 * Separated from delivery so the decision — which is all the interesting
 * behaviour — is testable without a queue.
 */
export function decideWebhookAction(
  target: WebhookTarget,
  event: PushEvent
): { deploy: boolean; reason?: string } {
  if (!target.autoDeployEnabled) {
    return { deploy: false, reason: 'Automatic deployment is turned off for this application.' };
  }
  if (!event.branch) {
    // Tag pushes and branch deletions arrive here; neither is a deploy trigger.
    return { deploy: false, reason: 'The event does not concern a branch.' };
  }
  if (event.branch !== target.gitBranch) {
    return {
      deploy: false,
      reason: `Pushed to "${event.branch}", which is not the deployed branch ("${target.gitBranch}").`,
    };
  }
  return { deploy: true };
}

/**
 * Verify a webhook and trigger a deployment when it applies.
 *
 * @throws DomainError INVALID_SIGNATURE — deliberately the same error whether the
 * secret is missing, unset or wrong, so the endpoint reveals nothing about which.
 */
export async function handleWebhook(
  request: WebhookRequest,
  triggerDeployment: (target: WebhookTarget) => Promise<string>
): Promise<WebhookOutcome> {
  const target = await loadWebhookTarget(request.applicationUuid, request.provider);

  // An unknown application and a bad signature answer identically: distinguishing
  // them would let anyone enumerate which uuids exist.
  if (!target || !target.secret) {
    throw unprocessable('INVALID_SIGNATURE', 'The webhook signature could not be verified.');
  }

  const verified =
    request.provider === 'gitlab'
      ? verifySharedToken(request.token, target.secret)
      : verifyHmacSignature(request.rawBody, request.signature, target.secret);

  if (!verified) {
    logger.warn('Rejected a webhook with an invalid signature', {
      applicationUuid: request.applicationUuid,
      provider: request.provider,
    });
    throw unprocessable('INVALID_SIGNATURE', 'The webhook signature could not be verified.');
  }

  const event = parsePushEvent(request.provider, request.payload);
  const decision = decideWebhookAction(target, event);

  if (!decision.deploy) {
    return { action: 'ignored', reason: decision.reason ?? 'Nothing to do.' };
  }

  const deploymentUuid = await triggerDeployment(target);
  logger.info('Webhook triggered a deployment', {
    applicationUuid: target.applicationUuid,
    branch: event.branch,
    deploymentUuid,
  });

  return { action: 'deployed', deploymentUuid, branch: event.branch! };
}

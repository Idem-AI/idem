/**
 * Realtime event emitter — broadcasts to Soketi (Pusher protocol), the same
 * websocket server the Laravel app and Angular frontend already use
 * (laravel-echo + pusher-js). Keeping the Pusher protocol means the client
 * side does not need to change.
 *
 * Channel/event names MUST match what the Angular client subscribes to. We
 * mirror Coolify's conventions:
 *   - team channel:        `team.{teamId}`
 *   - deployment channel:  `deployment.{deploymentUuid}`  (live build logs)
 */
import Pusher from 'pusher';
import logger from '../config/logger';

/**
 * Why live events cannot be sent, or null when the settings look usable.
 *
 * A scheme typed `http0s` silently sent everything over plain HTTP to the
 * wrong place: every live log was lost and nothing said why. Said once, at
 * startup, in terms of the variable to fix.
 */
export function realtimeConfigProblem(env: NodeJS.ProcessEnv = process.env): string | null {
  const scheme = (env.PUSHER_SCHEME || 'http').trim().toLowerCase();
  if (scheme !== 'http' && scheme !== 'https') {
    return `PUSHER_SCHEME must be "http" or "https" (got "${env.PUSHER_SCHEME}")`;
  }
  if (env.NODE_ENV === 'production' && !env.PUSHER_HOST) return 'PUSHER_HOST is not set';
  if (env.NODE_ENV === 'production' && !env.PUSHER_APP_SECRET) return 'PUSHER_APP_SECRET is not set';
  return null;
}

const configProblem = realtimeConfigProblem();
if (configProblem) {
  logger.error(`Realtime disabled: ${configProblem}. Live logs and status updates will not reach the browser.`, {
    event: 'realtime.misconfigured',
  });
}

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID || 'ideploy',
  key: process.env.PUSHER_APP_KEY || 'ideploy',
  // Repli de développement uniquement (valeur par défaut de Soketi en local).
  secret:
    process.env.PUSHER_APP_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'ideploy-secret'),
  host: process.env.PUSHER_HOST || 'localhost',
  port: process.env.PUSHER_PORT || '6001',
  useTLS: (process.env.PUSHER_SCHEME || 'http').trim().toLowerCase() === 'https',
});

/**
 * After a failure, sending pauses briefly: a deployment emits one event per
 * log line, and each one waiting on an unreachable server slowed the
 * deployment itself. The kept log is still complete.
 */
const PAUSE_AFTER_FAILURE_MS = 30_000;
let pausedUntil = 0;

export async function emit(channel: string, event: string, payload: unknown): Promise<void> {
  if (configProblem || Date.now() < pausedUntil) return;
  try {
    await pusher.trigger(channel, event, payload);
  } catch (err) {
    // Never let a broadcast failure break the request/job.
    pausedUntil = Date.now() + PAUSE_AFTER_FAILURE_MS;
    logger.warn('Realtime emit failed', {
      channel,
      event,
      message: (err as Error).message,
    });
  }
}

export const realtime = {
  emit,
  teamChannel: (teamId: number): string => `team.${teamId}`,
  deploymentChannel: (deploymentUuid: string): string => `deployment.${deploymentUuid}`,
  /** Append a chunk of live build/runtime log to a deployment stream. */
  deploymentLog: (deploymentUuid: string, line: string): Promise<void> =>
    emit(`deployment.${deploymentUuid}`, 'log', { line, at: Date.now() }),
  /** Notify a status change for a resource within a team. */
  statusChanged: (teamId: number, payload: unknown): Promise<void> =>
    emit(`team.${teamId}`, 'status-changed', payload),
  provisionChannel: (serverUuid: string): string => `server-provision.${serverUuid}`,
  /** Append a chunk of live server-setup script output. */
  provisionLog: (serverUuid: string, line: string): Promise<void> =>
    emit(`server-provision.${serverUuid}`, 'log', { line, at: Date.now() }),
  serviceChannel: (serviceUuid: string): string => `service.${serviceUuid}`,
  /** Append a chunk of live output from a service start/stop/restart. */
  serviceLog: (serviceUuid: string, line: string): Promise<void> =>
    emit(`service.${serviceUuid}`, 'log', { line, at: Date.now() }),
  databaseChannel: (databaseUuid: string): string => `database.${databaseUuid}`,
  /** Append a chunk of live output from a database start/stop/restart. */
  databaseLog: (databaseUuid: string, line: string): Promise<void> =>
    emit(`database.${databaseUuid}`, 'log', { line, at: Date.now() }),
};

export default realtime;

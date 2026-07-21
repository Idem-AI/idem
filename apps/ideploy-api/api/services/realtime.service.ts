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

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID || 'ideploy',
  key: process.env.PUSHER_APP_KEY || 'ideploy',
  secret: process.env.PUSHER_APP_SECRET || 'ideploy-secret',
  host: process.env.PUSHER_HOST || 'localhost',
  port: process.env.PUSHER_PORT || '6001',
  useTLS: (process.env.PUSHER_SCHEME || 'http') === 'https',
});

export async function emit(channel: string, event: string, payload: unknown): Promise<void> {
  try {
    await pusher.trigger(channel, event, payload);
  } catch (err) {
    // Never let a broadcast failure break the request/job.
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
};

export default realtime;

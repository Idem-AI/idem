/**
 * Stop cleanly on SIGTERM/SIGINT (`docker stop`, a redeploy of iDeploy).
 *
 * Without this, a redeploy of iDeploy killed the deployments in flight halfway
 * through. Now the process stops accepting requests and jobs, lets the
 * running jobs finish (up to SHUTDOWN_TIMEOUT_MS), then closes its
 * connections. A job still running at the deadline is abandoned: BullMQ hands
 * it to another worker once its lock expires.
 *
 * The container must be given the time: `stop_grace_period` in Compose
 * (Docker's default is 10 seconds).
 */
import type http from 'http';
import logger from './logger';

type Step = { name: string; run: () => Promise<unknown> };

const steps: Step[] = [];
let stopping = false;

/** Something to close on the way out, in registration order. */
export function onShutdown(name: string, run: () => Promise<unknown>): void {
  steps.push({ name, run });
}

export function isShuttingDown(): boolean {
  return stopping;
}

export function closeHttpServer(server: http.Server): Promise<void> {
  return new Promise((resolve) => {
    server.close(() => resolve());
    // Idle keep-alive sockets would hold close() open until they time out.
    server.closeIdleConnections?.();
  });
}

export function installShutdown(timeoutMs = Number(process.env.SHUTDOWN_TIMEOUT_MS) || 10 * 60_000): void {
  const stop = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    logger.info('process.stopping', { event: 'process.stopping', signal, timeoutMs });
    const deadline = setTimeout(() => {
      logger.error('process.stop_timeout', { event: 'process.stop_timeout', timeoutMs });
      process.exit(1);
    }, timeoutMs);
    deadline.unref();
    for (const step of steps) {
      const started = Date.now();
      try {
        await step.run();
        logger.info('process.closed', { event: 'process.closed', step: step.name, durationMs: Date.now() - started });
      } catch (err) {
        logger.warn('process.close_failed', { event: 'process.close_failed', step: step.name, error: err });
      }
    }
    logger.info('process.stopped', { event: 'process.stopped', signal });
    process.exit(0);
  };
  process.on('SIGTERM', () => void stop('SIGTERM'));
  process.on('SIGINT', () => void stop('SIGINT'));
}

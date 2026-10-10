/**
 * Worker autoscaling: start more worker containers when deployments and
 * pipelines wait, stop them again once the queues have been calm a while.
 *
 * The workers are declared in Compose: one or more `fixed` ones (label
 * `ideploy.worker=fixed`, always on) and a few `elastic` ones
 * (`ideploy.worker=elastic`) that this loop starts and stops through the
 * Docker socket. It runs in the API process, one leader at a time (a Redis
 * lock), every AUTOSCALE_INTERVAL_MS.
 *
 * Demand is what more workers can actually run now: jobs waiting or running
 * on the deployment and pipeline queues. Jobs sent back to the queue because
 * their team or server is at its limit (delayed) are not counted: another
 * worker would not run them sooner.
 *
 * Stopping is gentle: one container at a time, after AUTOSCALE_COOLDOWN_MS
 * without needing it, with the graceful-shutdown grace period so its jobs
 * finish. Starting is refused when the host is short of memory.
 */
import { readFileSync } from 'fs';
import logger from '../config/logger';
import redis from '../config/redis.config';
import { getQueue, QUEUE_NAMES } from '../queue/queues';
import { workerConcurrency } from '../queue/worker';
import { listWorkers, startContainer, stopContainer, WorkerContainer } from './docker-engine';

export interface AutoscaleSettings {
  enabled: boolean;
  min: number;
  max: number;
  intervalMs: number;
  cooldownMs: number;
  minFreeMemoryMb: number;
  graceSeconds: number;
}

export function autoscaleSettings(env: NodeJS.ProcessEnv = process.env): AutoscaleSettings {
  const n = (v: string | undefined, d: number) => (Number(v) > 0 ? Number(v) : d);
  return {
    enabled: env.AUTOSCALE_ENABLED === 'true',
    min: n(env.AUTOSCALE_MIN, 1),
    max: n(env.AUTOSCALE_MAX, 3),
    intervalMs: n(env.AUTOSCALE_INTERVAL_MS, 30_000),
    cooldownMs: n(env.AUTOSCALE_COOLDOWN_MS, 10 * 60_000),
    minFreeMemoryMb: n(env.AUTOSCALE_MIN_FREE_MEMORY_MB, 768),
    graceSeconds: Math.round(n(env.SHUTDOWN_TIMEOUT_MS, 10 * 60_000) / 1000),
  };
}

export interface ScaleInput {
  /** Jobs waiting or running on the deployment and pipeline queues. */
  demand: number;
  /** Jobs one worker runs at once. */
  perWorker: number;
  running: number;
  /** Elastic containers that could be started. */
  stoppedElastic: number;
  /** Elastic containers running (the only ones that may be stopped). */
  runningElastic: number;
  freeMemoryMb: number | null;
  /** Last time the demand needed every running worker. */
  lastBusyAt: number;
  now: number;
  settings: AutoscaleSettings;
}

export type ScaleDecision =
  | { action: 'up'; wanted: number; reason: string }
  | { action: 'down'; wanted: number; reason: string }
  | { action: 'hold'; wanted: number; reason: string };

/** How many workers the demand needs, and what to do about it. One step at a time. */
export function decide(i: ScaleInput): ScaleDecision {
  const { min, max } = i.settings;
  const wanted = Math.min(max, Math.max(min, Math.ceil(i.demand / Math.max(1, i.perWorker))));
  if (wanted > i.running) {
    if (i.stoppedElastic === 0) return { action: 'hold', wanted, reason: 'no elastic worker left to start' };
    if (i.freeMemoryMb !== null && i.freeMemoryMb < i.settings.minFreeMemoryMb) {
      return { action: 'hold', wanted, reason: `host memory low (${i.freeMemoryMb} MB free)` };
    }
    return { action: 'up', wanted, reason: `${i.demand} job(s) for ${i.running} worker(s) of ${i.perWorker}` };
  }
  if (wanted < i.running && i.runningElastic > 0) {
    if (i.now - i.lastBusyAt < i.settings.cooldownMs) return { action: 'hold', wanted, reason: 'cooling down' };
    return { action: 'down', wanted, reason: `${i.demand} job(s) need ${wanted} worker(s)` };
  }
  return { action: 'hold', wanted, reason: 'balanced' };
}

/** Host memory available, from /proc/meminfo (the host's, inside a container too). */
export function freeMemoryMb(meminfo?: string): number | null {
  try {
    const text = meminfo ?? readFileSync('/proc/meminfo', 'utf8');
    const kb = Number(/MemAvailable:\s+(\d+)/.exec(text)?.[1]);
    return Number.isFinite(kb) && kb > 0 ? Math.round(kb / 1024) : null;
  } catch {
    return null;
  }
}

async function demandNow(): Promise<number> {
  let total = 0;
  for (const name of [QUEUE_NAMES.deployments, QUEUE_NAMES.pipelines]) {
    const c = await getQueue(name).getJobCounts('wait', 'active', 'prioritized');
    total += (c.wait ?? 0) + (c.active ?? 0) + (c.prioritized ?? 0);
  }
  return total;
}

const LEADER_KEY = 'ideploy:autoscaler:leader';
const me = `${process.pid}-${Math.random().toString(36).slice(2)}`;
let lastBusyAt = Date.now();
const stopping = new Set<string>();

async function isLeader(ttlMs: number): Promise<boolean> {
  if (await redis.set(LEADER_KEY, me, 'PX', ttlMs, 'NX')) return true;
  if ((await redis.get(LEADER_KEY)) === me) {
    await redis.pexpire(LEADER_KEY, ttlMs);
    return true;
  }
  return false;
}

export async function tick(settings = autoscaleSettings()): Promise<ScaleDecision | null> {
  if (!(await isLeader(settings.intervalMs * 3))) return null;
  const workers = (await listWorkers()).filter((w) => !stopping.has(w.id));
  const running = workers.filter((w) => w.running);
  const elastic = (w: WorkerContainer) => w.kind === 'elastic';
  const demand = await demandNow();
  const perWorker = workerConcurrency(QUEUE_NAMES.deployments, 3);
  const now = Date.now();
  if (demand > Math.max(0, running.length - 1) * perWorker) lastBusyAt = now;

  const decision = decide({
    demand,
    perWorker,
    running: running.length,
    stoppedElastic: workers.filter((w) => !w.running && elastic(w)).length,
    runningElastic: running.filter(elastic).length,
    freeMemoryMb: freeMemoryMb(),
    lastBusyAt,
    now,
    settings,
  });

  if (decision.action === 'up') {
    const next = workers.find((w) => !w.running && elastic(w))!;
    await startContainer(next.id);
    logger.info('autoscale.scale_up', { event: 'autoscale.scale_up', container: next.name, demand, running: running.length + 1, reason: decision.reason });
  } else if (decision.action === 'down') {
    // The most recently numbered elastic worker goes first.
    const last = running.filter(elastic).sort((a, b) => b.name.localeCompare(a.name))[0];
    stopping.add(last.id);
    logger.info('autoscale.scale_down', { event: 'autoscale.scale_down', container: last.name, demand, running: running.length - 1, reason: decision.reason });
    // Waits for the worker's running jobs: not awaited here.
    stopContainer(last.id, settings.graceSeconds)
      .catch((err) => logger.warn('autoscale.stop_failed', { event: 'autoscale.stop_failed', container: last.name, error: err }))
      .finally(() => stopping.delete(last.id));
    lastBusyAt = now;
  }
  return decision;
}

/** Starts the loop when AUTOSCALE_ENABLED=true; returns the function that stops it. */
export function startAutoscaler(settings = autoscaleSettings()): () => void {
  if (!settings.enabled) return () => undefined;
  logger.info('autoscale.started', { event: 'autoscale.started', ...settings });
  const timer = setInterval(() => {
    tick(settings).catch((err) => logger.warn('autoscale.tick_failed', { event: 'autoscale.tick_failed', error: err }));
  }, settings.intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}

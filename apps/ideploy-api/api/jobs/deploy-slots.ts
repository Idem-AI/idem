/**
 * Fair use of the deployment workers.
 *
 * A worker slot is precious: there are only a few per process. Two rules keep
 * one team, or one server, from taking them all:
 *
 *   - a team runs at most DEPLOY_MAX_PER_TEAM deployments at once;
 *   - a server builds at most DEPLOY_MAX_PER_SERVER deployments at once (a
 *     build competes with the applications already running there).
 *
 * A deployment that cannot start is put back in the queue for a few seconds
 * (BullMQ `moveToDelayed`), freeing its worker for another team, instead of
 * holding it while it waits — as it did, for up to 30 minutes, behind the
 * previous deployment of the same application.
 *
 * Slots are members of a Redis sorted set scored by their expiry: a worker
 * that dies frees its slots within SLOT_TTL_MS.
 */
import { DelayedError, Job } from 'bullmq';
import redis from '../config/redis.config';

export const SLOT_TTL_MS = 60_000;
const SLOT_RENEW_MS = 20_000;
/** How long a deployment that could not start waits before trying again. */
export const RETRY_DELAY_MS = 15_000;

export const limits = () => ({
  perTeam: Math.max(1, Number(process.env.DEPLOY_MAX_PER_TEAM) || 2),
  perServer: Math.max(1, Number(process.env.DEPLOY_MAX_PER_SERVER) || 2),
});

// Atomically: drop expired members; keep (and extend) a member already in;
// otherwise add it only below the limit. 1 = held, 0 = full.
const ACQUIRE = `
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[1])
if redis.call('ZSCORE', KEYS[1], ARGV[3]) then
  redis.call('ZADD', KEYS[1], ARGV[2], ARGV[3])
  return 1
end
if redis.call('ZCARD', KEYS[1]) < tonumber(ARGV[4]) then
  redis.call('ZADD', KEYS[1], ARGV[2], ARGV[3])
  redis.call('PEXPIRE', KEYS[1], ARGV[5])
  return 1
end
return 0
`;

export async function tryAcquire(key: string, member: string, limit: number): Promise<boolean> {
  const now = Date.now();
  const held = await redis.eval(ACQUIRE, 1, key, now, now + SLOT_TTL_MS, member, limit, SLOT_TTL_MS * 2);
  return held === 1;
}

export async function release(key: string, member: string): Promise<void> {
  await redis.zrem(key, member);
}

export const teamKey = (teamId: number) => `ideploy:slots:team:${teamId}`;
export const serverKey = (serverId: number) => `ideploy:slots:server:${serverId}`;

export interface HeldSlots {
  /** Keeps the slots alive while the deployment runs; frees them after. */
  release(): Promise<void>;
}

/**
 * Take the team's and the server's slot for this deployment, or say which one
 * is full. Both or neither: a slot taken for the team is given back when the
 * server is full.
 */
export async function acquireSlots(
  member: string,
  teamId: number,
  serverId: number | null
): Promise<{ held: HeldSlots } | { full: 'team' | 'server'; limit: number }> {
  const { perTeam, perServer } = limits();
  const keys: string[] = [];
  if (!(await tryAcquire(teamKey(teamId), member, perTeam))) return { full: 'team', limit: perTeam };
  keys.push(teamKey(teamId));
  if (serverId !== null) {
    if (!(await tryAcquire(serverKey(serverId), member, perServer))) {
      await release(teamKey(teamId), member);
      return { full: 'server', limit: perServer };
    }
    keys.push(serverKey(serverId));
  }
  const renew = setInterval(() => {
    const expiry = Date.now() + SLOT_TTL_MS;
    for (const key of keys) redis.zadd(key, 'XX', expiry, member).catch(() => undefined);
  }, SLOT_RENEW_MS);
  renew.unref?.();
  return {
    held: {
      async release() {
        clearInterval(renew);
        await Promise.all(keys.map((key) => release(key, member).catch(() => undefined)));
      },
    },
  };
}

/**
 * Put the job back in the queue for a little while. Only possible with the
 * worker's token; without one (a direct call, in tests) the caller waits.
 */
export async function retryLater(job: Job, token: string | undefined, delayMs = RETRY_DELAY_MS): Promise<never | void> {
  if (!token) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    return;
  }
  await job.moveToDelayed(Date.now() + delayMs, token);
  throw new DelayedError();
}

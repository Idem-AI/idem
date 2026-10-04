/**
 * The per-application deployment lock, against Redis.
 *
 * An API redeploy mid-build killed the worker holding it; BullMQ re-ran the
 * deployment on the new instance, which then waited — "in progress" — on a
 * lock that lasted an hour and belonged to nobody.
 */
import { afterAll, describe, expect, it } from 'vitest';
import redis from '../../api/config/redis.config';
import { LOCK_TTL_MS, withApplicationLock } from '../../api/jobs/deployment.worker';
import { closeInfrastructure } from '../helpers/teardown';

const silent = async (): Promise<void> => undefined;
const key = (id: number) => `ideploy:deploy-lock:${id}`;

afterAll(async () => {
  await closeInfrastructure();
});

describe('withApplicationLock', () => {
  it('lets the same deployment, run again after its worker died, take its own lock back', async () => {
    const id = 900001;
    await redis.set(key(id), 'deployment-a', 'PX', LOCK_TTL_MS);

    const started = Date.now();
    const result = await withApplicationLock(id, 'deployment-a', silent, async () => 'ran');

    expect(result).toBe('ran');
    expect(Date.now() - started).toBeLessThan(2000);
    expect(await redis.get(key(id))).toBeNull();
  });

  it('expires within a minute, so a dead worker cannot block an application for an hour', async () => {
    const id = 900002;
    await withApplicationLock(id, 'deployment-b', silent, async () => {
      const ttl = await redis.pttl(key(id));
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(LOCK_TTL_MS);
    });
  });

  it('makes another deployment wait while one runs', async () => {
    const id = 900003;
    await redis.set(key(id), 'deployment-c', 'PX', 1500);
    const started = Date.now();
    const lines: string[] = [];

    await withApplicationLock(id, 'deployment-d', async (l) => void lines.push(l), async () => undefined);

    expect(Date.now() - started).toBeGreaterThanOrEqual(1000);
    expect(lines.join('\n')).toMatch(/Waiting for the previous deployment/);
  }, 20_000);
});

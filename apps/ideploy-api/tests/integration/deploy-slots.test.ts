/**
 * Fair share of the deployment workers (Redis).
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import redis from '../../api/config/redis.config';
import { acquireSlots, serverKey, teamKey, tryAcquire } from '../../api/jobs/deploy-slots';
import { closeInfrastructure } from '../helpers/teardown';

const TEAM = 990001;
const SERVER = 990002;

beforeEach(async () => {
  await redis.del(teamKey(TEAM), serverKey(SERVER), 'ideploy:slots:test');
  delete process.env.DEPLOY_MAX_PER_TEAM;
  delete process.env.DEPLOY_MAX_PER_SERVER;
});
afterAll(async () => {
  await redis.del(teamKey(TEAM), serverKey(SERVER), 'ideploy:slots:test');
  await closeInfrastructure();
});

describe('deployment slots', () => {
  it('admits up to the limit, keeps a member that already holds one, and frees on release', async () => {
    expect(await tryAcquire('ideploy:slots:test', 'a', 2)).toBe(true);
    expect(await tryAcquire('ideploy:slots:test', 'b', 2)).toBe(true);
    expect(await tryAcquire('ideploy:slots:test', 'c', 2)).toBe(false);
    // The same deployment run again (worker restart) gets its own slot back.
    expect(await tryAcquire('ideploy:slots:test', 'a', 2)).toBe(true);
  });

  it('caps a team, and gives the team slot back when the server is full', async () => {
    process.env.DEPLOY_MAX_PER_TEAM = '2';
    process.env.DEPLOY_MAX_PER_SERVER = '1';
    const first = await acquireSlots('d1', TEAM, SERVER);
    expect('held' in first).toBe(true);
    const second = await acquireSlots('d2', TEAM, SERVER);
    expect(second).toEqual({ full: 'server', limit: 1 });
    // d2 did not keep a team slot while waiting for the server.
    expect(await redis.zscore(teamKey(TEAM), 'd2')).toBeNull();

    const other = await acquireSlots('d3', TEAM, null);
    expect('held' in other).toBe(true);
    expect(await acquireSlots('d4', TEAM, null)).toEqual({ full: 'team', limit: 2 });

    if ('held' in first) await first.held.release();
    if ('held' in other) await other.held.release();
    expect(await redis.zcard(teamKey(TEAM))).toBe(0);
  });
});

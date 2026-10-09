/**
 * Renewing an expiring OAuth token, against Redis.
 */
import { afterAll, describe, expect, it, vi } from 'vitest';
import redis from '../../api/config/redis.config';
import { freshToken, readToken, saveToken } from '../../api/services/oauth-token-store.service';
import { closeInfrastructure } from '../helpers/teardown';

afterAll(async () => closeInfrastructure());

describe('freshToken', () => {
  it('renews a token about to expire and keeps the rotated refresh token', async () => {
    const key = `ideploy:test:oauth:${Date.now()}`;
    await saveToken(key, { access: 'old', refresh: 'r1', expiresAt: Date.now() + 1000 });
    const refresh = vi.fn(async () => ({ access_token: 'new', refresh_token: 'r2', expires_in: 7200 }));

    expect(await freshToken(key, refresh)).toBe('new');
    expect(refresh).toHaveBeenCalledWith('r1');
    expect(await readToken(key)).toMatchObject({ access: 'new', refresh: 'r2' });
    await redis.del(key);
  });

  it('renews only once when two callers need it at the same time (refresh tokens are single-use)', async () => {
    const key = `ideploy:test:oauth:${Date.now()}:b`;
    await saveToken(key, { access: 'old', refresh: 'r1', expiresAt: Date.now() + 1000 });
    const refresh = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
      return { access_token: 'new', refresh_token: 'r2', expires_in: 7200 };
    });

    const [a, b] = await Promise.all([freshToken(key, refresh), freshToken(key, refresh)]);

    expect(refresh).toHaveBeenCalledTimes(1);
    expect([a, b]).toEqual(['new', 'new']);
    await redis.del(key);
  });

  it('leaves a token with a long life alone', async () => {
    const key = `ideploy:test:oauth:${Date.now()}:c`;
    await saveToken(key, { access: 'fine', refresh: 'r1', expiresAt: Date.now() + 3_600_000 });
    const refresh = vi.fn();

    expect(await freshToken(key, refresh)).toBe('fine');
    expect(refresh).not.toHaveBeenCalled();
    await redis.del(key);
  });
});

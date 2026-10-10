import { describe, expect, it } from 'vitest';
import type { Request } from 'express';
import { rateKey, rateLimits } from '../../../api/middleware/rate-limit.middleware';

const req = (over: Partial<Request> & { cookies?: Record<string, string> }) =>
  ({ method: 'GET', path: '/api/v1/applications', headers: {}, ip: '10.0.0.1', cookies: {}, ...over }) as unknown as Request;

describe('rate limiting', () => {
  it('counts a session, a token or an IP, and reads apart from writes', () => {
    expect(rateKey(req({ cookies: { session: 'abc' } }))).toMatchObject({ bucket: 'read' });
    expect(rateKey(req({ cookies: { session: 'abc' } })).who).toMatch(/^s:/);
    expect(rateKey(req({ headers: { authorization: 'Bearer tok' } } as never)).who).toMatch(/^t:/);
    expect(rateKey(req({ method: 'POST' })).who).toBe('ip:10.0.0.1');
    expect(rateKey(req({ method: 'POST' })).bucket).toBe('write');
  });

  it('gives each application its own webhook budget', () => {
    expect(rateKey(req({ method: 'POST', path: '/api/v1/webhooks/github/app-uuid' }))).toEqual({
      bucket: 'webhook',
      who: 'app:app-uuid',
    });
  });

  it('reads its limits from the environment', () => {
    expect(rateLimits({})).toEqual({ read: 600, write: 120, webhook: 60 });
    expect(rateLimits({ RATE_LIMIT_WRITE_PER_MIN: '30' }).write).toBe(30);
  });
});

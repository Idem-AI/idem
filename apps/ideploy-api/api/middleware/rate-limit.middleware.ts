/**
 * Request limits on the iDeploy API, per caller and per minute.
 *
 * The caller is its session (cookie `session`), its API token, or — signed
 * out — its IP. Reads and writes have separate budgets: polling a deployment
 * page must not use up the right to deploy. Webhooks are counted per
 * application, so a noisy repository cannot slow the others down.
 *
 * Counters live in Redis (shared by every API process), in fixed one-minute
 * windows. If Redis is unreachable the request goes through: the limiter
 * protects the platform, it must not become the reason it is down.
 */
import { createHash } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import redis from '../config/redis.config';
import logger from '../config/logger';

export interface RateLimits {
  read: number;
  write: number;
  webhook: number;
}

export function rateLimits(env: NodeJS.ProcessEnv = process.env): RateLimits {
  const n = (v: string | undefined, d: number) => (Number(v) > 0 ? Number(v) : d);
  return {
    read: n(env.RATE_LIMIT_READ_PER_MIN, 600),
    write: n(env.RATE_LIMIT_WRITE_PER_MIN, 120),
    webhook: n(env.RATE_LIMIT_WEBHOOK_PER_MIN, 60),
  };
}

const STORE_TIMEOUT_MS = 250;

const hash = (value: string) => createHash('sha256').update(value).digest('hex').slice(0, 24);

/** Who is asking, and which budget the request draws from. */
export function rateKey(req: Request): { bucket: keyof RateLimits; who: string } {
  if (req.path.startsWith('/api/v1/webhooks/')) {
    // /api/v1/webhooks/:provider/:uuid → one budget per application.
    return { bucket: 'webhook', who: `app:${req.path.split('/')[5] ?? 'unknown'}` };
  }
  const session = req.cookies?.session as string | undefined;
  const bearer = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : undefined;
  const who = session ? `s:${hash(session)}` : bearer ? `t:${hash(bearer)}` : `ip:${req.ip}`;
  const write = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
  return { bucket: write ? 'write' : 'read', who };
}

export function rateLimit(limits: RateLimits = rateLimits()) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.path.startsWith('/api/')) return next();
    const { bucket, who } = rateKey(req);
    const window = Math.floor(Date.now() / 60_000);
    const key = `ideploy:rl:${bucket}:${who}:${window}`;
    try {
      // Redis queues commands while it reconnects: never hold a request for it.
      const results = await Promise.race([
        redis.multi().incr(key).pexpire(key, 61_000).exec(),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('rate limit store timeout')), STORE_TIMEOUT_MS).unref()),
      ]);
      const count = Number(results?.[0]?.[1] ?? 0);
      const limit = limits[bucket];
      res.setHeader('RateLimit-Limit', String(limit));
      res.setHeader('RateLimit-Remaining', String(Math.max(0, limit - count)));
      if (count > limit) {
        const retryAfter = 60 - Math.floor((Date.now() / 1000) % 60);
        res.setHeader('Retry-After', String(retryAfter));
        if (count === limit + 1) {
          logger.warn('http.rate_limited', { event: 'http.rate_limited', bucket, limit, path: req.path });
        }
        res.status(429).json({
          success: false,
          error: { code: 'RATE_LIMITED', message: `Too many requests; try again in ${retryAfter} s.` },
        });
        return;
      }
    } catch (err) {
      logger.warn('http.rate_limit_unavailable', { event: 'http.rate_limit_unavailable', error: err });
    }
    next();
  };
}

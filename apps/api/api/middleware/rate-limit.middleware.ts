import { Request, Response, NextFunction } from 'express';
import { createClient, RedisClientType } from 'redis';
import logger from '../config/logger';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyPrefix: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
  retryAfter?: number;
}

class RateLimiter {
  private redisClient: RedisClientType | null = null;
  private fallbackStore: Map<string, { count: number; resetTime: number }> = new Map();
  private isRedisAvailable = false;

  constructor() {
    this.initializeRedis();
  }

  private async initializeRedis() {
    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      this.redisClient = createClient({ url: redisUrl });

      this.redisClient.on('error', (err) => {
        logger.error('Redis Client Error:', err);
        this.isRedisAvailable = false;
      });

      this.redisClient.on('connect', () => {
        logger.info('Redis connected for rate limiting');
        this.isRedisAvailable = true;
      });

      await this.redisClient.connect();
    } catch (error) {
      logger.warn('Redis not available, using in-memory fallback for rate limiting');
      this.isRedisAvailable = false;
    }
  }

  /**
   * Check and increment rate limit
   */
  async checkLimit(key: string, config: RateLimitConfig): Promise<RateLimitInfo> {
    const now = Date.now();
    const windowStart = now - config.windowMs;
    const resetTime = now + config.windowMs;

    if (this.isRedisAvailable && this.redisClient) {
      return this.checkLimitRedis(key, config, now, resetTime);
    } else {
      return this.checkLimitMemory(key, config, now, resetTime);
    }
  }

  /**
   * Redis-based rate limiting (production)
   */
  private async checkLimitRedis(
    key: string,
    config: RateLimitConfig,
    now: number,
    resetTime: number
  ): Promise<RateLimitInfo> {
    try {
      const redisKey = `${config.keyPrefix}:${key}`;

      // Get current count
      const currentCount = await this.redisClient!.get(redisKey);
      const count = currentCount ? parseInt(currentCount, 10) : 0;

      if (count >= config.maxRequests) {
        const ttl = await this.redisClient!.ttl(redisKey);
        return {
          limit: config.maxRequests,
          remaining: 0,
          reset: now + ttl * 1000,
          retryAfter: ttl,
        };
      }

      // Increment counter
      const newCount = await this.redisClient!.incr(redisKey);

      // Set expiration on first request
      if (newCount === 1) {
        await this.redisClient!.expire(redisKey, Math.ceil(config.windowMs / 1000));
      }

      return {
        limit: config.maxRequests,
        remaining: Math.max(0, config.maxRequests - newCount),
        reset: resetTime,
      };
    } catch (error) {
      logger.error('Redis rate limit check failed, falling back to memory:', error);
      return this.checkLimitMemory(key, config, now, resetTime);
    }
  }

  /**
   * Memory-based rate limiting (fallback)
   */
  private checkLimitMemory(
    key: string,
    config: RateLimitConfig,
    now: number,
    resetTime: number
  ): RateLimitInfo {
    const memKey = `${config.keyPrefix}:${key}`;
    const stored = this.fallbackStore.get(memKey);

    // Clean expired entries
    if (stored && stored.resetTime < now) {
      this.fallbackStore.delete(memKey);
    }

    const current = this.fallbackStore.get(memKey);

    if (!current) {
      this.fallbackStore.set(memKey, { count: 1, resetTime });
      return {
        limit: config.maxRequests,
        remaining: config.maxRequests - 1,
        reset: resetTime,
      };
    }

    if (current.count >= config.maxRequests) {
      return {
        limit: config.maxRequests,
        remaining: 0,
        reset: current.resetTime,
        retryAfter: Math.ceil((current.resetTime - now) / 1000),
      };
    }

    current.count++;
    return {
      limit: config.maxRequests,
      remaining: Math.max(0, config.maxRequests - current.count),
      reset: current.resetTime,
    };
  }

  /**
   * Reset rate limit for a key
   */
  async resetLimit(key: string, prefix: string): Promise<void> {
    if (this.isRedisAvailable && this.redisClient) {
      await this.redisClient.del(`${prefix}:${key}`);
    } else {
      this.fallbackStore.delete(`${prefix}:${key}`);
    }
  }

  /**
   * Cleanup expired entries (for memory fallback)
   */
  startCleanupInterval() {
    setInterval(() => {
      const now = Date.now();
      for (const [key, value] of this.fallbackStore.entries()) {
        if (value.resetTime < now) {
          this.fallbackStore.delete(key);
        }
      }
    }, 60000); // Clean every minute
  }
}

// Singleton instance
const rateLimiter = new RateLimiter();
rateLimiter.startCleanupInterval();

/**
 * Rate limiting by IP address
 */
export const rateLimitByIP = (config: Partial<RateLimitConfig> = {}) => {
  const defaultConfig: RateLimitConfig = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
    keyPrefix: 'ratelimit:ip',
    ...config,
  };

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      const limitInfo = await rateLimiter.checkLimit(ip, defaultConfig);

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', limitInfo.limit);
      res.setHeader('X-RateLimit-Remaining', limitInfo.remaining);
      res.setHeader('X-RateLimit-Reset', new Date(limitInfo.reset).toISOString());

      if (limitInfo.remaining === 0) {
        if (limitInfo.retryAfter) {
          res.setHeader('Retry-After', limitInfo.retryAfter);
        }

        logger.warn(`Rate limit exceeded for IP: ${ip}`);
        res.status(429).json({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter: limitInfo.retryAfter,
          limit: limitInfo.limit,
          reset: new Date(limitInfo.reset).toISOString(),
        });
        return;
      }

      next();
    } catch (error) {
      logger.error('Rate limit middleware error:', error);
      // Don't block requests if rate limiting fails
      next();
    }
  };
};

/**
 * Rate limiting by user ID
 */
export const rateLimitByUser = (config: Partial<RateLimitConfig> = {}) => {
  const defaultConfig: RateLimitConfig = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 200,
    keyPrefix: 'ratelimit:user',
    ...config,
  };

  return async (
    req: Request & { user?: { uid: string } },
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user?.uid;

      if (!userId) {
        // If no user, skip user-based rate limiting
        next();
        return;
      }

      // Check if user is admin (unlimited)
      const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim());
      const user = req.user as any;
      if (user.email && adminEmails.includes(user.email.toLowerCase())) {
        logger.info(`Admin user ${userId} bypassing rate limit`);
        next();
        return;
      }

      const limitInfo = await rateLimiter.checkLimit(userId, defaultConfig);

      // Set rate limit headers
      res.setHeader('X-RateLimit-User-Limit', limitInfo.limit);
      res.setHeader('X-RateLimit-User-Remaining', limitInfo.remaining);
      res.setHeader('X-RateLimit-User-Reset', new Date(limitInfo.reset).toISOString());

      if (limitInfo.remaining === 0) {
        if (limitInfo.retryAfter) {
          res.setHeader('Retry-After', limitInfo.retryAfter);
        }

        logger.warn(`Rate limit exceeded for user: ${userId}`);
        res.status(429).json({
          error: 'Too Many Requests',
          message: 'User rate limit exceeded. Please try again later.',
          retryAfter: limitInfo.retryAfter,
          limit: limitInfo.limit,
          reset: new Date(limitInfo.reset).toISOString(),
        });
        return;
      }

      next();
    } catch (error) {
      logger.error('User rate limit middleware error:', error);
      // Don't block requests if rate limiting fails
      next();
    }
  };
};

/**
 * Rate limiting by endpoint (for expensive operations)
 */
export const rateLimitByEndpoint = (endpoint: string, config: Partial<RateLimitConfig> = {}) => {
  const defaultConfig: RateLimitConfig = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 50,
    keyPrefix: `ratelimit:endpoint:${endpoint}`,
    ...config,
  };

  return async (
    req: Request & { user?: { uid: string } },
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user?.uid || req.ip || 'anonymous';
      const key = `${userId}:${endpoint}`;

      const limitInfo = await rateLimiter.checkLimit(key, defaultConfig);

      // Set rate limit headers
      res.setHeader('X-RateLimit-Endpoint-Limit', limitInfo.limit);
      res.setHeader('X-RateLimit-Endpoint-Remaining', limitInfo.remaining);
      res.setHeader('X-RateLimit-Endpoint-Reset', new Date(limitInfo.reset).toISOString());

      if (limitInfo.remaining === 0) {
        if (limitInfo.retryAfter) {
          res.setHeader('Retry-After', limitInfo.retryAfter);
        }

        logger.warn(`Endpoint rate limit exceeded for ${endpoint} by ${userId}`);
        res.status(429).json({
          error: 'Too Many Requests',
          message: `Rate limit exceeded for ${endpoint}. Please try again later.`,
          retryAfter: limitInfo.retryAfter,
          limit: limitInfo.limit,
          reset: new Date(limitInfo.reset).toISOString(),
        });
        return;
      }

      next();
    } catch (error) {
      logger.error('Endpoint rate limit middleware error:', error);
      // Don't block requests if rate limiting fails
      next();
    }
  };
};

/**
 * Burst protection - detect and block rapid requests
 */
export const burstProtection = (config: { maxBurst: number; burstWindowMs: number } = { maxBurst: 10, burstWindowMs: 1000 }) => {
  return async (
    req: Request & { user?: { uid: string } },
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const identifier = req.user?.uid || req.ip || 'unknown';
      const burstConfig: RateLimitConfig = {
        windowMs: config.burstWindowMs,
        maxRequests: config.maxBurst,
        keyPrefix: 'burst',
      };

      const limitInfo = await rateLimiter.checkLimit(identifier, burstConfig);

      if (limitInfo.remaining === 0) {
        logger.warn(`Burst attack detected from ${identifier}`);
        res.status(429).json({
          error: 'Too Many Requests',
          message: 'Burst limit exceeded. Slow down your requests.',
          retryAfter: Math.ceil(config.burstWindowMs / 1000),
        });
        return;
      }

      next();
    } catch (error) {
      logger.error('Burst protection error:', error);
      next();
    }
  };
};

export { rateLimiter };

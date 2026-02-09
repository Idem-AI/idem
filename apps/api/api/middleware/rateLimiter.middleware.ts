import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

/**
 * General API rate limiter
 * Allows 100 requests per 15 minutes
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: {
    success: false,
    message: 'Too many requests, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request): string => {
    return req.ip || req.headers['x-forwarded-for']?.toString() || 'unknown';
  },
});

/**
 * Stricter rate limiter for authentication endpoints
 * Allows 5 attempts per hour to prevent brute force attacks
 */
export const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again in an hour.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
  keyGenerator: (req: Request): string => {
    return req.ip || req.headers['x-forwarded-for']?.toString() || 'unknown';
  },
});

/**
 * Rate limiter for AI/prompt endpoints (expensive operations)
 * Allows 20 requests per hour
 */
export const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  message: {
    success: false,
    message: 'AI request limit reached, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request): string => {
    return req.ip || req.headers['x-forwarded-for']?.toString() || 'unknown';
  },
});

/**
 * Stricter rate limiter for sensitive operations
 * Allows 10 requests per 15 minutes
 */
export const sensitiveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: {
    success: false,
    message: 'Rate limit exceeded for sensitive operation.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request): string => {
    return req.ip || req.headers['x-forwarded-for']?.toString() || 'unknown';
  },
});

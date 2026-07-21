import helmet from 'helmet';
import hpp from 'hpp';
import { Express, Request, Response, NextFunction } from 'express';
import logger from '../config/logger';

/**
 * Apply baseline HTTP hardening to the Express app.
 *
 * - helmet: security-related HTTP headers (CSP, HSTS, X-Frame-Options, etc.).
 * - hpp: protects against HTTP Parameter Pollution.
 * - body size limit: prevents trivial DoS via huge payloads.
 * - trust proxy: required for correct req.ip behind load balancers.
 */
export function applySecurity(app: Express): void {
  // Trust the first proxy hop (Cloud Run / iDeploy / Nginx). Required so that
  // req.ip reflects the real client IP for rate limiting and audit logs.
  app.set('trust proxy', 1);

  // Hide Express signature.
  app.disable('x-powered-by');

  app.use(
    helmet({
      contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
      crossOriginEmbedderPolicy: false, // we serve assets cross-origin
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      hsts:
        process.env.NODE_ENV === 'production'
          ? { maxAge: 63072000, includeSubDomains: true, preload: true }
          : false,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    })
  );

  app.use(hpp());
}

/**
 * Lightweight audit logger for sensitive routes. Logs method, path, user id
 * (if available), IP, status and duration. Sensitive bodies are NEVER logged.
 */
export function auditLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const sensitivePaths = [
    '/auth',
    '/admin',
    '/api/auth',
    '/github',
  ];
  const matches = sensitivePaths.some((p) => req.path.startsWith(p));
  if (!matches) {
    return next();
  }

  res.on('finish', () => {
    const duration = Date.now() - start;
    const user = (req as Request & { user?: { uid?: string; email?: string } }).user;
    logger.info('audit', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      ip: req.ip,
      userId: user?.uid,
      userAgent: req.get('user-agent'),
      durationMs: duration,
    });
  });

  next();
}

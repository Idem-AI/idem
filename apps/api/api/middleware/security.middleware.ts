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
      event: 'http.audit',
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

/** Un code applicatif (`billing_unavailable`) est gardé ; un message interne, non. */
const APPLICATION_CODE = /^[a-z0-9_]{1,64}$/;
const INTERNAL_FIELDS = ['error', 'details', 'stack', 'errorMessage', 'errorStack'] as const;

/**
 * Masque les détails d'erreur internes des réponses 5xx en production.
 *
 * De nombreux contrôleurs renvoient `error: error.message` : messages de Mongo,
 * de Redis, chemins de fichiers, réponses brutes des fournisseurs… autant
 * d'indications sur l'infrastructure. En production, sur une réponse 5xx, ces
 * champs sont retirés s'ils ne sont pas un simple code applicatif ; le détail
 * reste dans les journaux serveur. Les réponses 4xx (validation) sont intactes.
 */
export function redactServerErrors(req: Request, res: Response, next: NextFunction): void {
  if (process.env.NODE_ENV !== 'production') return next();

  const json = res.json.bind(res);
  res.json = (body?: unknown) => {
    if (res.statusCode >= 500 && body && typeof body === 'object' && !Array.isArray(body)) {
      const clean: Record<string, unknown> = { ...(body as Record<string, unknown>) };
      for (const field of INTERNAL_FIELDS) {
        const value = clean[field];
        if (value !== undefined && !(typeof value === 'string' && APPLICATION_CODE.test(value))) {
          delete clean[field];
        }
      }
      return json(clean);
    }
    return json(body);
  };
  next();
}

/**
 * Refuse une requête déclenchée depuis un autre site.
 *
 * Pour les rares routes GET qui ont un effet (flux SSE qui lance un
 * déploiement : `EventSource` ne sait faire que du GET). `SameSite=Lax` laisse
 * passer le cookie sur une navigation de premier niveau venue d'ailleurs ; le
 * navigateur indique cependant l'origine de la requête dans `Sec-Fetch-Site`.
 * Absent (client non navigateur, authentifié autrement), on laisse passer.
 */
export function rejectCrossSiteRequests(req: Request, res: Response, next: NextFunction): void {
  if (req.get('sec-fetch-site') === 'cross-site') {
    res.status(403).json({ error: 'cross_site_request_refused' });
    return;
  }
  next();
}

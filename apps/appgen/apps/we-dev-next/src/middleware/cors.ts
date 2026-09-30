import { Request, Response, NextFunction } from 'express';

/**
 * CORS du serveur AppGen.
 *
 * Les requêtes portent le cookie de session IDEM : `Access-Control-Allow-Origin: *`
 * avec `Allow-Credentials` est à la fois refusé par les navigateurs et dangereux
 * dans l'esprit. On ne renvoie donc que les origines connues
 * (`CORS_ALLOWED_ORIGINS`, liste séparée par des virgules), plus localhost hors
 * production.
 */
const isProduction = process.env.NODE_ENV === 'production';

function allowedOrigins(): string[] {
  return (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

function isAllowed(origin: string): boolean {
  if (allowedOrigins().includes(origin)) return true;
  if (!isProduction && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
  return false;
}

export function corsMiddleware(req: Request, res: Response, next: NextFunction) {
  const origin = req.headers.origin;

  if (typeof origin === 'string' && isAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, userId, X-Appgen-Project-Id'
    );
  }

  if (req.method === 'OPTIONS') {
    return res.status(typeof origin === 'string' && isAllowed(origin) ? 204 : 403).end();
  }

  next();
}

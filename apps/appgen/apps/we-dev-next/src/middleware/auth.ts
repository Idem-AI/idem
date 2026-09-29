import { createHash } from 'crypto';
import { NextFunction, Request, Response } from 'express';

/**
 * Authentification des routes coûteuses du serveur AppGen.
 *
 * AppGen n'a pas de comptes à lui : l'identité est celle de l'API IDEM, prouvée
 * par le cookie de session partagé (`.idem.africa`) ou par un Bearer.
 * On transmet ces preuves à `GET /auth/me` ; sans réponse positive, la requête
 * est refusée. Avant ce contrôle, n'importe qui pouvait générer du code avec les
 * clés LLM d'IDEM, déployer sur son compte Netlify, sans compte ni paiement.
 */

const IDEM_API_URL = process.env.IDEM_API_URL || 'http://localhost:3001';
const CACHE_TTL_MS = 60_000;
const TIMEOUT_MS = 8_000;

export interface IdemUser {
  uid: string;
  email: string | null;
}

declare module 'express-serve-static-core' {
  interface Request {
    idemUser?: IdemUser;
  }
}

const cache = new Map<string, { user: IdemUser; at: number }>();

/** En-têtes à transmettre à l'API IDEM pour prouver l'identité de l'appelant. */
export function forwardedCredentials(req: Request): Record<string, string> {
  const headers: Record<string, string> = {};
  if (typeof req.headers.authorization === 'string') headers.Authorization = req.headers.authorization;
  if (typeof req.headers.cookie === 'string') headers.Cookie = req.headers.cookie;
  return headers;
}

async function resolveUser(req: Request): Promise<IdemUser | null> {
  const credentials = forwardedCredentials(req);
  if (!credentials.Authorization && !credentials.Cookie) return null;

  const key = createHash('sha256')
    .update(`${credentials.Authorization ?? ''}|${credentials.Cookie ?? ''}`)
    .digest('hex');
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.user;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${IDEM_API_URL}/auth/me`, {
      headers: credentials,
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const data = (await response.json()) as Partial<IdemUser>;
    if (!data.uid) return null;
    const user = { uid: String(data.uid), email: data.email ?? null };
    cache.set(key, { user, at: Date.now() });
    if (cache.size > 5_000) cache.clear();
    return user;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function requireIdemUser(req: Request, res: Response, next: NextFunction) {
  const user = await resolveUser(req);
  if (!user) {
    return res.status(401).json({
      error: 'authentication_required',
      message: 'Connectez-vous à IDEM pour utiliser AppGen.',
    });
  }
  req.idemUser = user;
  next();
}

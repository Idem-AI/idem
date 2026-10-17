/**
 * Authentification DÉLÉGUÉE : iDomain n'a pas d'écran de connexion. Le cookie httpOnly `session`
 * posé par l'API IDEM sur `.idem.africa` est vérifié auprès d'elle (`/auth/profile`). C'est le
 * mécanisme de tout le monorepo (iDeploy, iVision, AppGen, simulateur).
 *
 * Les autres appelants sont des SERVICES, chacun avec sa clé (`x-idomain-key`) :
 *   - l'API IDEM (pack Lancement + domaine, anciennes routes `/billing/domains`) → `IDOMAIN_SERVICE_KEY` ;
 *   - la console d'administration (idem-admin) → `IDOMAIN_ADMIN_KEY`.
 * Une clé n'ouvre que ses propres routes.
 */
import { NextFunction, Request, Response } from 'express';
import { timingSafeEqual } from 'crypto';
import { env } from '../config/env';
import logger from '../config/logger';
import { IdemProfile, verifySession } from '../integrations/idem.client';
import { setTraceUser } from '../utils/trace.util';

export interface AuthedRequest extends Request {
  user: IdemProfile;
}

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const cookie = req.cookies?.session as string | undefined;
    const profile = cookie ? await verifySession(cookie) : null;
    if (!profile) {
      res.status(401).json({ error: 'unauthenticated', message: 'Connectez-vous à IDEM pour gérer vos domaines.' });
      return;
    }
    (req as AuthedRequest).user = profile;
    setTraceUser(profile.uid);
    next();
  } catch (error) {
    logger.error('auth.failed', { event: 'auth.failed', error });
    res.status(503).json({ error: 'identity_unavailable', message: 'Le service d’identité IDEM ne répond pas. Réessayez dans un instant.' });
  }
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Garde d'une route de service : la clé attendue, comparée en temps constant. */
export function requireKey(kind: 'service' | 'admin') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const expected = kind === 'admin' ? env.adminKey : env.serviceKey;
    const provided = req.headers['x-idomain-key'];
    if (!expected) {
      logger.error('gateway.unconfigured', { event: 'gateway.unconfigured', kind });
      res.status(503).json({ error: 'gateway_unconfigured' });
      return;
    }
    if (typeof provided !== 'string' || !safeEqual(provided, expected)) {
      logger.warn('gateway.denied', { event: 'gateway.denied', kind, path: req.path, ip: req.ip });
      res.status(403).json({ error: 'forbidden' });
      return;
    }
    next();
  };
}

/**
 * Authentification DÉLÉGUÉE : iVision n'a pas d'écran de connexion. Le cookie httpOnly
 * `session` posé par l'API IDEM sur `.idem.africa` est vérifié auprès d'elle
 * (`/auth/profile`). C'est le mécanisme de tout le monorepo (iDeploy, AppGen, simulateur).
 */
import { NextFunction, Request, Response } from 'express';
import logger from '../config/logger';
import { IdemProfile, verifySession } from '../services/idem.client';
import { setTraceUser } from '../utils/trace.util';

export interface AuthedRequest extends Request {
  user?: IdemProfile;
}

export async function authenticate(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const cookie = req.cookies?.session as string | undefined;
    const profile = cookie ? await verifySession(cookie) : null;
    if (!profile) {
      res.status(401).json({ error: 'unauthenticated', message: 'Connectez-vous à IDEM pour utiliser iVision.' });
      return;
    }
    req.user = profile;
    setTraceUser(profile.uid);
    next();
  } catch (error) {
    logger.error('auth.failed', { event: 'auth.failed', error });
    res.status(503).json({ error: 'identity_unavailable', message: 'Le service d’identité IDEM ne répond pas. Réessayez dans un instant.' });
  }
}

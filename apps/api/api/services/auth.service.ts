import { Response, NextFunction } from 'express';
import { CustomRequest } from '../interfaces/express.interface';
import logger from '../config/logger';
import {
  isIssuedBeforeRevocation,
  restoreSessionFromRefreshToken,
  verifySessionCookie,
} from './sessionCookie.service';
import { setTraceUserId } from '../utils/trace.util';
import { IdemAuthUser, identityService } from './identity/identity.service';
import { verifySupabaseAccessToken } from './identity/supabaseAuth.client';

/**
 * Identité d'un Bearer : soit une session IDEM (serveur à serveur, tests),
 * soit un jeton d'accès Supabase d'un compte déjà rattaché (fronts).
 */
async function authenticateBearer(token: string): Promise<IdemAuthUser> {
  try {
    return await verifySessionCookie(token, true);
  } catch {
    // Pas une session IDEM : on essaie un jeton Supabase.
  }

  const claims = verifySupabaseAccessToken(token);
  const user = await identityService.authUserForAuthId(claims.sub);
  if (!user) {
    // Compte jamais passé par `/auth/sessionLogin` : le rattachement se fait
    // là, pas sur une requête quelconque.
    throw new Error('Auth account not linked to an IDEM user yet');
  }
  // « Déconnecter partout » vaut aussi pour les jetons Supabase déjà émis.
  if (await isIssuedBeforeRevocation(user.uid, (claims.iat ?? 0) * 1000)) {
    throw new Error('Token issued before sessions were revoked');
  }
  return user;
}

/**
 * Middleware d'authentification.
 *
 * 1. cookie `session` (émis par l'API, vérifié et contrôlé contre la révocation) ;
 * 2. s'il manque ou a expiré, restauration depuis le cookie `refreshToken` ;
 * 3. sinon, `Authorization: Bearer …` (session IDEM ou jeton Supabase) ;
 * 4. sinon `401`/`403`.
 *
 * L'identité vérifiée est posée sur `req.user`.
 */
export async function authenticate(
  req: CustomRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const sessionCookie = req.cookies.session;
  const authHeader = req.headers.authorization;

  // 1. Cookie de session prioritaire.
  if (sessionCookie) {
    try {
      req.user = await verifySessionCookie(sessionCookie, true);
      setTraceUserId(req.user.uid);
      return next();
    } catch (error: any) {
      logger.info(`Session cookie rejected: ${error.message}`);
    }
  }

  // 2. Session absente ou périmée : le refresh token la rétablit sans
  // renvoyer l'utilisateur au login.
  if (req.cookies.refreshToken) {
    const newSessionCookie = await restoreSessionFromRefreshToken(req, res);
    if (newSessionCookie) {
      try {
        req.user = await verifySessionCookie(newSessionCookie, true);
        setTraceUserId(req.user.uid);
        return next();
      } catch (refreshError: any) {
        logger.error(`Error during auto-refresh: ${refreshError.message}`);
      }
    }
  }

  // 3. Bearer : une session périmée ne doit pas bloquer une requête autrement authentifiée.
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice('Bearer '.length).trim();
    try {
      req.user = await authenticateBearer(token);
      setTraceUserId(req.user.uid);
      return next();
    } catch (error: any) {
      logger.warn(`Bearer token rejected: ${error.message}`, {
        tokenUsed: token ? token.substring(0, 10) + '...' : 'N/A',
      });
      res.status(403).json({ message: 'Forbidden: Invalid or expired token' });
      return;
    }
  }

  if (sessionCookie) {
    res.status(403).json({ message: 'Forbidden: Invalid or expired session cookie' });
    return;
  }

  logger.warn('Authentication attempt failed: No session cookie or Bearer token provided.');
  res.status(401).json({ message: 'Unauthorized: No authentication credentials provided' });
}

import { Request, Response, NextFunction } from 'express';
import { CustomRequest } from '../interfaces/express.interface';
import logger from '../config/logger';
import {
  isIssuedBeforeRevocation,
  restoreSessionFromRefreshToken,
  verifySessionForRequest,
} from './sessionCookie.service';
import { setTraceUserId } from '../utils/trace.util';
import { IdemAuthUser, identityService } from './identity/identity.service';
import { verifySupabaseAccessToken } from './identity/supabaseAuth.client';
import {
  reportSuspiciousDevice,
  SUSPICIOUS_DEVICE_BODY,
  SuspiciousDeviceError,
} from './identity/deviceCheck.service';
import { isKnownDevice, refreshTokenService } from './refreshToken.service';
import { clientUserAgent, deviceFingerprint } from '../utils/device-fingerprint.util';

/**
 * Identité d'un Bearer : soit une session IDEM (serveur à serveur, tests),
 * soit un jeton d'accès Supabase d'un compte déjà rattaché (fronts).
 */
async function authenticateBearer(req: Request, token: string): Promise<IdemAuthUser> {
  try {
    return await verifySessionForRequest(req, token);
  } catch (error) {
    if (error instanceof SuspiciousDeviceError) throw error;
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
  // Le jeton appartient à une session Supabase ouverte par `/auth/sessionLogin`
  // sur un appareil donné : il ne vaut que sur celui-là.
  if (claims.session_id) {
    const session = await refreshTokenService.findSessionByAuthSession(user.uid, claims.session_id);
    const fingerprint = deviceFingerprint(clientUserAgent(req));
    if (session && !isKnownDevice(session, fingerprint)) {
      reportSuspiciousDevice(req, user.uid, session.sessionId!, fingerprint, session.deviceFingerprint);
      throw new SuspiciousDeviceError();
    }
  }
  return user;
}

function refuseSuspiciousDevice(res: Response): void {
  res.status(401).json(SUSPICIOUS_DEVICE_BODY);
}

/**
 * Middleware d'authentification.
 *
 * 1. cookie `session` (émis par l'API, vérifié et contrôlé contre la révocation) ;
 * 2. s'il manque ou a expiré, restauration depuis le cookie `refreshToken` ;
 * 3. sinon, `Authorization: Bearer …` (session IDEM ou jeton Supabase) ;
 * 4. sinon `401`/`403`.
 *
 * Chaque chemin contrôle aussi l'appareil : une session présentée depuis un
 * autre appareil que le sien est refusée (`401 suspicious_device`) et son
 * titulaire reçoit un e-mail de vérification (`identity/deviceCheck.service`).
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
      req.user = await verifySessionForRequest(req, sessionCookie);
      setTraceUserId(req.user.uid);
      return next();
    } catch (error: any) {
      if (error instanceof SuspiciousDeviceError) return refuseSuspiciousDevice(res);
      logger.info(`Session cookie rejected: ${error.message}`);
    }
  }

  // 2. Session absente ou périmée : le refresh token la rétablit sans
  // renvoyer l'utilisateur au login.
  if (req.cookies.refreshToken) {
    let newSessionCookie: string | null;
    try {
      newSessionCookie = await restoreSessionFromRefreshToken(req, res);
    } catch (error) {
      if (error instanceof SuspiciousDeviceError) return refuseSuspiciousDevice(res);
      throw error;
    }
    if (newSessionCookie) {
      try {
        req.user = await verifySessionForRequest(req, newSessionCookie);
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
      req.user = await authenticateBearer(req, token);
      setTraceUserId(req.user.uid);
      return next();
    } catch (error: any) {
      if (error instanceof SuspiciousDeviceError) return refuseSuspiciousDevice(res);
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

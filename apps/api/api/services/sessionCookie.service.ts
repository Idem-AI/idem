import { Request, Response, CookieOptions } from 'express';
import admin from 'firebase-admin';
import axios from 'axios';
import logger from '../config/logger';
import { refreshTokenService } from './refreshToken.service';

/** Durée de vie du cookie `session` partagé par toutes les applications IDEM. */
export const SESSION_EXPIRES_IN = 14 * 24 * 60 * 60 * 1000; // 14 jours

/**
 * Options du cookie `session`. En production, il est posé sur `.idem.africa`
 * pour être lu par le dashboard, AppGen, iDeploy et le simulateur.
 */
export function sessionCookieOptions(): CookieOptions {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    maxAge: SESSION_EXPIRES_IN,
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/',
    ...(isProduction && { domain: '.idem.africa' }),
  };
}

/**
 * Émet un nouveau cookie de session pour un utilisateur, sans son navigateur.
 *
 * `createSessionCookie` n'accepte qu'un ID token : un custom token doit d'abord
 * être échangé contre un ID token auprès de l'Identity Toolkit, ce qui exige la
 * clé web du projet Firebase (`FIREBASE_API_KEY`).
 */
export async function mintSessionCookie(uid: string): Promise<string> {
  const apiKey = process.env.FIREBASE_API_KEY;
  if (!apiKey) {
    throw new Error('FIREBASE_API_KEY is required to renew a session from a refresh token.');
  }

  const customToken = await admin.auth().createCustomToken(uid);
  const { data } = await axios.post<{ idToken: string }>(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`,
    { token: customToken, returnSecureToken: true }
  );

  return admin.auth().createSessionCookie(data.idToken, { expiresIn: SESSION_EXPIRES_IN });
}

/**
 * Rétablit le cookie `session` à partir du cookie `refreshToken` (30 jours),
 * quand la session a expiré ou manque. Renvoie le nouveau cookie, ou `null`
 * si aucun refresh token valide n'est disponible.
 */
export async function restoreSessionFromRefreshToken(
  req: Request,
  res: Response
): Promise<string | null> {
  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken) return null;

  try {
    const validation = await refreshTokenService.validateRefreshToken(refreshToken);
    if (!validation.isValid || !validation.userId) return null;

    const sessionCookie = await mintSessionCookie(validation.userId);
    res.cookie('session', sessionCookie, sessionCookieOptions());
    logger.info(`Session cookie restored from refresh token for user: ${validation.userId}`);
    return sessionCookie;
  } catch (error: any) {
    logger.error(`Error restoring session from refresh token: ${error.message}`);
    return null;
  }
}

import crypto from 'crypto';
import mongoose from 'mongoose';
import { Request, Response, CookieOptions } from 'express';
import logger from '../config/logger';
import { refreshTokenService } from './refreshToken.service';
import { IdemAuthUser } from './identity/identity.service';
import { UserModel } from '../models/userModel';
import { JwtPayload, signHs256, verifyHs256 } from '../utils/jwt-hs256.util';

/** Durée de vie du cookie `session` partagé par toutes les applications IDEM. */
export const SESSION_EXPIRES_IN = 14 * 24 * 60 * 60 * 1000; // 14 jours

const SESSION_ISSUER = 'idem-api';
const SESSION_TYPE = 'idem_session';

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
    // `lax` : toutes les applications IDEM sont des sous-domaines de
    // `idem.africa`, donc « même site » — le cookie les accompagne toutes. Un
    // site tiers, lui, ne peut plus déclencher de requête authentifiée (CSRF),
    // ce que `none` permettait.
    sameSite: 'lax',
    path: '/',
    ...(isProduction && { domain: '.idem.africa' }),
  };
}

/** Durée de vie du refresh token (30 jours). */
export const REFRESH_EXPIRES_IN = 30 * 24 * 60 * 60 * 1000;

/** Options du cookie `refreshToken` : mêmes règles que `session`. */
export function refreshCookieOptions(): CookieOptions {
  return { ...sessionCookieOptions(), maxAge: REFRESH_EXPIRES_IN };
}

/** Options d'effacement des deux cookies (même domaine et même chemin qu'à l'écriture). */
export function clearCookieOptions(): CookieOptions {
  const isProduction = process.env.NODE_ENV === 'production';
  return { path: '/', ...(isProduction && { domain: '.idem.africa' }) };
}

let derivedSecretWarned = false;

/**
 * Secret de signature du cookie `session` (`SESSION_SECRET`).
 *
 * Distinct du secret Supabase : un jeton d'accès Supabase ne doit jamais
 * pouvoir passer pour une session IDEM, ni l'inverse. En développement, faute
 * de valeur, il est dérivé du secret Supabase pour ne pas bloquer le démarrage.
 */
function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret) {
    if (secret.length < 32) throw new Error('SESSION_SECRET must be at least 32 characters');
    return secret;
  }
  const base = process.env.SUPABASE_JWT_SECRET;
  if (process.env.NODE_ENV === 'production' || !base) {
    throw new Error('SESSION_SECRET is not configured');
  }
  if (!derivedSecretWarned) {
    logger.warn('SESSION_SECRET not set: deriving a development secret from SUPABASE_JWT_SECRET');
    derivedSecretWarned = true;
  }
  return crypto.createHmac('sha256', base).update('idem-session').digest('hex');
}

interface SessionClaims extends JwtPayload {
  sub: string;
  typ: typeof SESSION_TYPE;
  /** Émission en millisecondes : `iat` (secondes) est trop grossier pour la révocation. */
  iatMs: number;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  aid?: string;
}

/** Émet le cookie `session` d'un utilisateur IDEM. */
export function createSessionToken(user: UserModel): string {
  const now = Date.now();
  const claims: SessionClaims = {
    iss: SESSION_ISSUER,
    sub: user.uid,
    typ: SESSION_TYPE,
    iat: Math.floor(now / 1000),
    iatMs: now,
    exp: Math.floor((now + SESSION_EXPIRES_IN) / 1000),
    email: user.email,
    email_verified: user.emailVerified === true,
    ...(user.displayName && { name: user.displayName }),
    ...(user.photoURL && { picture: user.photoURL }),
    ...(user.authId && { aid: user.authId }),
  };
  return signHs256(claims, sessionSecret());
}

/** Date de révocation des sessions par utilisateur, gardée 30 s en mémoire. */
const revocationCache = new Map<string, { revokedAt: number; at: number }>();
const REVOCATION_CACHE_TTL = 30_000;

async function sessionsRevokedAt(uid: string): Promise<number> {
  const cached = revocationCache.get(uid);
  if (cached && Date.now() - cached.at < REVOCATION_CACHE_TTL) return cached.revokedAt;

  const doc = await mongoose.connection
    .collection('users')
    .findOne({ _id: uid as any }, { projection: { sessionsRevokedAt: 1 } });
  if (!doc) {
    // Compte supprimé : toutes ses sessions tombent.
    return Number.MAX_SAFE_INTEGER;
  }
  const revokedAt = doc.sessionsRevokedAt ? new Date(doc.sessionsRevokedAt).getTime() : 0;
  if (revocationCache.size > 10_000) revocationCache.clear();
  revocationCache.set(uid, { revokedAt, at: Date.now() });
  return revokedAt;
}

/** Vrai si un jeton émis à `issuedAtMs` est antérieur à « déconnecter partout ». */
export async function isIssuedBeforeRevocation(uid: string, issuedAtMs: number): Promise<boolean> {
  return issuedAtMs < (await sessionsRevokedAt(uid));
}

/** Oublie la date de révocation mise en cache (après « déconnecter partout »). */
export function forgetRevocation(uid: string): void {
  revocationCache.delete(uid);
}

/**
 * Vérifie un cookie `session` et rend l'identité qu'il porte.
 * Lève une erreur si le jeton est invalide, expiré ou révoqué.
 */
export async function verifySessionCookie(
  token: string,
  checkRevoked = true
): Promise<IdemAuthUser> {
  const claims = verifyHs256<SessionClaims>(token, sessionSecret(), {
    issuer: SESSION_ISSUER,
    clockTolerance: 0,
  });
  if (claims.typ !== SESSION_TYPE || typeof claims.sub !== 'string' || !claims.sub) {
    throw new Error('Not an IDEM session');
  }
  if (checkRevoked && (await isIssuedBeforeRevocation(claims.sub, claims.iatMs ?? 0))) {
    throw new Error('Session revoked');
  }
  return {
    uid: claims.sub,
    email: claims.email,
    email_verified: claims.email_verified === true,
    name: claims.name,
    picture: claims.picture,
    authId: claims.aid,
  };
}

/**
 * Émet un nouveau cookie de session pour un utilisateur, sans son navigateur
 * (renouvellement à partir du refresh token).
 */
export async function mintSessionCookie(uid: string): Promise<string> {
  const doc = await mongoose.connection.collection('users').findOne({ _id: uid as any });
  if (!doc) throw new Error(`User ${uid} not found`);
  return createSessionToken({ ...(doc as any), uid });
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


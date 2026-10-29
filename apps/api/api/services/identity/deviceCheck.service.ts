import crypto from 'crypto';
import mongoose from 'mongoose';
import { Request } from 'express';
import logger from '../../config/logger';
import RedisConnection from '../../config/redis.config';
import { isKnownDevice, refreshTokenService } from '../refreshToken.service';
import { transactionalEmailService } from '../email/email.service';
import { firstNameOf } from '../email/email-layout';
import { suspiciousDevice } from '../email/templates';
import { supabaseAdmin } from './supabaseAuth.client';
import {
  clientUserAgent,
  describeDevice,
  deviceFingerprint,
} from '../../utils/device-fingerprint.util';

/**
 * Liaison des sessions à leur appareil.
 *
 * Une session (cookie `session`, cookie `refreshToken`, jeton Supabase) est
 * liée à l'empreinte de l'appareil qui l'a ouverte. Présentée depuis un autre
 * appareil, elle est refusée, et le titulaire reçoit un e-mail : « C'est moi »
 * ajoute l'appareil à la session, « Ce n'est pas moi » ferme toutes ses
 * sessions, sur IDEM comme sur le serveur d'authentification.
 */

export class SuspiciousDeviceError extends Error {
  readonly code = 'suspicious_device';
  constructor() {
    super('Session presented from another device');
  }
}

/** Réponse JSON commune aux refus pour appareil inconnu. */
export const SUSPICIOUS_DEVICE_BODY = {
  success: false,
  code: 'suspicious_device',
  message:
    "Connexion refusée : cette session a été ouverte sur un autre appareil. Un e-mail de vérification a été envoyé au titulaire du compte. Reconnectez-vous sur cet appareil.",
} as const;

/** Un e-mail par heure au plus pour une même session et un même appareil. */
const ALERT_THROTTLE_SECONDS = 60 * 60;
/** Durée de validité du lien de l'e-mail. */
export const DEVICE_CHECK_TTL_SECONDS = 48 * 60 * 60;

const THROTTLE_PREFIX = 'auth:device-alert:';
const CHECK_PREFIX = 'auth:device-check:';

export interface DeviceCheck {
  uid: string;
  sessionId: string;
  fingerprint: string;
  ipAddress: string;
  at: string;
}

export type DeviceDecision = 'approve' | 'deny';

function checkKey(token: string): string {
  // Le lien est un secret : seule son empreinte sert de clé Redis.
  return `${CHECK_PREFIX}${crypto.createHash('sha256').update(token).digest('hex')}`;
}

function apiBaseUrl(): string {
  return (process.env.API_URL || 'http://localhost:3001').replace(/\/+$/, '');
}

/**
 * Contrôle l'appareil d'une requête contre la session `sessionId` de `uid`.
 * `expected` est l'empreinte portée par le jeton, quand il en porte une : si
 * elle correspond, la base n'est pas lue.
 */
export async function assertSessionDevice(
  req: Request,
  uid: string,
  sessionId: string,
  expected?: string
): Promise<void> {
  const fingerprint = deviceFingerprint(clientUserAgent(req));
  if (expected && expected === fingerprint) return;

  const session = await refreshTokenService.findSession(uid, sessionId);
  if (!session) throw new Error('Session no longer exists');
  if (isKnownDevice(session, fingerprint)) return;

  reportSuspiciousDevice(req, uid, sessionId, fingerprint, expected ?? session.deviceFingerprint);
  throw new SuspiciousDeviceError();
}

/**
 * Journalise le refus et prévient le titulaire. Ne bloque jamais la réponse :
 * l'e-mail part en arrière-plan.
 */
export function reportSuspiciousDevice(
  req: Request,
  uid: string,
  sessionId: string,
  fingerprint: string,
  expected?: string
): void {
  const ipAddress = req.ip || req.socket.remoteAddress || 'inconnue';
  logger.warn('auth.suspicious_device', {
    event: 'auth.suspicious_device',
    uid,
    sessionId,
    expected,
    presented: fingerprint,
    ip: ipAddress,
    path: req.path,
  });
  sendAlert({ uid, sessionId, fingerprint, ipAddress, at: new Date().toISOString() }).catch(
    (error) =>
      logger.error(`auth.suspicious_device_alert_failed: ${error.message}`, {
        event: 'auth.suspicious_device_alert_failed',
        uid,
      })
  );
}

async function sendAlert(check: DeviceCheck): Promise<void> {
  const redis = RedisConnection.getInstance();
  const throttled = await redis.set(
    `${THROTTLE_PREFIX}${check.uid}:${check.sessionId}:${check.fingerprint}`,
    '1',
    'EX',
    ALERT_THROTTLE_SECONDS,
    'NX'
  );
  if (throttled !== 'OK') return;

  const user = await mongoose.connection
    .collection('users')
    .findOne({ _id: check.uid as any }, { projection: { email: 1, displayName: 1 } });
  if (!user?.email) {
    logger.warn('auth.suspicious_device_no_email', { uid: check.uid });
    return;
  }

  const token = await issueDeviceCheck(check);
  const pageUrl = `${apiBaseUrl()}/auth/device-check/${token}`;
  const email = suspiciousDevice({
    firstName: firstNameOf(user.displayName, user.email),
    device: describeDevice(check.fingerprint),
    ipAddress: check.ipAddress,
    at: new Date(check.at),
    approveUrl: `${pageUrl}?d=approve`,
    denyUrl: `${pageUrl}?d=deny`,
  });
  await transactionalEmailService.send({
    to: user.email,
    ...email,
    template: 'suspicious_device',
    userId: check.uid,
    relatedType: 'session',
    relatedId: check.sessionId,
  });
}

/** Enregistre une vérification en attente et rend le secret du lien de l'e-mail. */
export async function issueDeviceCheck(check: DeviceCheck): Promise<string> {
  const token = crypto.randomBytes(32).toString('base64url');
  await RedisConnection.getInstance().set(
    checkKey(token),
    JSON.stringify(check),
    'EX',
    DEVICE_CHECK_TTL_SECONDS
  );
  return token;
}

/** Lit une vérification en attente, sans la consommer (page de l'e-mail). */
export async function peekDeviceCheck(token: string): Promise<DeviceCheck | null> {
  if (!/^[\w-]{20,100}$/.test(token)) return null;
  const raw = await RedisConnection.getInstance().get(checkKey(token));
  return raw ? (JSON.parse(raw) as DeviceCheck) : null;
}

export type DeviceDecisionOutcome = 'approved' | 'denied' | 'session_gone' | 'expired';

/**
 * Applique la réponse du titulaire. Le lien ne sert qu'une fois : il est
 * supprimé avant d'agir.
 */
export async function resolveDeviceCheck(
  token: string,
  decision: DeviceDecision
): Promise<DeviceDecisionOutcome> {
  if (!/^[\w-]{20,100}$/.test(token)) return 'expired';
  const redis = RedisConnection.getInstance();
  const key = checkKey(token);
  const [[, raw]] = (await redis.multi().get(key).del(key).exec()) as [[unknown, string | null], unknown];
  if (!raw) return 'expired';
  const check = JSON.parse(raw) as DeviceCheck;

  if (decision === 'approve') {
    const trusted = await refreshTokenService.trustDevice(
      check.uid,
      check.sessionId,
      check.fingerprint
    );
    logger.info('auth.device_approved', { event: 'auth.device_approved', uid: check.uid, trusted });
    return trusted ? 'approved' : 'session_gone';
  }

  await signOutEverywhere(check.uid);
  logger.warn('auth.device_denied', { event: 'auth.device_denied', uid: check.uid });
  return 'denied';
}

/**
 * Ferme toutes les sessions d'un compte : refresh tokens, cookies `session` et
 * jetons Supabase déjà émis, sessions du serveur d'authentification.
 */
export async function signOutEverywhere(uid: string): Promise<void> {
  // Import différé : sessionCookie.service importe ce module.
  const { forgetRevocation } = await import('../sessionCookie.service');
  await refreshTokenService.revokeAllRefreshTokens(uid);
  const users = mongoose.connection.collection('users');
  await users.updateOne({ _id: uid as any }, { $set: { sessionsRevokedAt: new Date() } });
  forgetRevocation(uid);

  const user = await users.findOne({ _id: uid as any }, { projection: { authId: 1 } });
  if (user?.authId) {
    try {
      await supabaseAdmin.signOutEverywhere(String(user.authId));
    } catch (error: any) {
      // Les jetons Supabase déjà émis restent refusés par `sessionsRevokedAt`.
      logger.error(`auth.supabase_global_logout_failed: ${error.message}`, {
        event: 'auth.supabase_global_logout_failed',
        uid,
      });
    }
  }
}

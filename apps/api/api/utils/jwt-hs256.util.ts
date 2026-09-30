import crypto from 'crypto';

/**
 * JWT HS256 minimal, sans dépendance.
 *
 * Deux usages seulement : vérifier les jetons d'accès émis par le serveur
 * d'authentification Supabase (secret partagé), et signer/vérifier le cookie
 * `session` d'IDEM. Tout autre algorithme est refusé — en particulier `none`,
 * qui ferait accepter un jeton non signé.
 */

export interface JwtPayload {
  [claim: string]: unknown;
  sub?: string;
  exp?: number;
  iat?: number;
  aud?: string | string[];
  iss?: string;
}

export class JwtError extends Error {
  constructor(
    message: string,
    readonly code: 'malformed' | 'signature' | 'expired' | 'claims'
  ) {
    super(message);
  }
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function hmac(secret: string, data: string): Buffer {
  return crypto.createHmac('sha256', secret).update(data).digest();
}

export function signHs256(payload: JwtPayload, secret: string): string {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64url(JSON.stringify(payload));
  const signature = hmac(secret, `${header}.${body}`).toString('base64url');
  return `${header}.${body}.${signature}`;
}

export interface VerifyOptions {
  audience?: string;
  issuer?: string;
  /** Tolérance d'horloge, en secondes. */
  clockTolerance?: number;
}

export function verifyHs256<T extends JwtPayload = JwtPayload>(
  token: string,
  secret: string,
  options: VerifyOptions = {}
): T {
  if (typeof token !== 'string' || token.length > 8192) {
    throw new JwtError('Invalid token', 'malformed');
  }
  const parts = token.split('.');
  if (parts.length !== 3) throw new JwtError('Invalid token', 'malformed');
  const [headerPart, bodyPart, signaturePart] = parts;

  let header: { alg?: string };
  let payload: T;
  try {
    header = JSON.parse(Buffer.from(headerPart, 'base64url').toString('utf8'));
    payload = JSON.parse(Buffer.from(bodyPart, 'base64url').toString('utf8'));
  } catch {
    throw new JwtError('Invalid token', 'malformed');
  }
  if (header.alg !== 'HS256') throw new JwtError('Unsupported algorithm', 'malformed');

  const expected = hmac(secret, `${headerPart}.${bodyPart}`);
  const provided = Buffer.from(signaturePart, 'base64url');
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
    throw new JwtError('Invalid signature', 'signature');
  }

  const now = Math.floor(Date.now() / 1000);
  const tolerance = options.clockTolerance ?? 30;
  if (typeof payload.exp !== 'number' || payload.exp + tolerance < now) {
    throw new JwtError('Token expired', 'expired');
  }
  if (options.audience) {
    const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!aud.includes(options.audience)) throw new JwtError('Invalid audience', 'claims');
  }
  if (options.issuer && payload.iss !== options.issuer) {
    throw new JwtError('Invalid issuer', 'claims');
  }
  return payload;
}

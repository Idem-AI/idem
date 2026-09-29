#!/usr/bin/env node
/**
 * Génère le secret client « Sign in with Apple » attendu par GoTrue
 * (AUTH_APPLE_SECRET).
 *
 * Apple n'émet pas de secret fixe : c'est un JWT ES256 signé avec la clé
 * privée `.p8` du compte développeur, valable **6 mois au plus**. À relancer
 * avant l'échéance (la date est affichée), puis redémarrer le service `auth`.
 *
 *   node scripts/apple-client-secret.mjs \
 *     --team-id ABCDE12345 \
 *     --key-id  XYZ9876543 \
 *     --client-id africa.idem.signin \
 *     --key ./AuthKey_XYZ9876543.p8
 *
 * `--client-id` est l'identifiant du « Services ID » (pas celui de l'app iOS).
 */
import { createPrivateKey, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const option = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const teamId = option('team-id');
const keyId = option('key-id');
const clientId = option('client-id');
const keyPath = option('key');
const days = Number(option('days') ?? 180);

if (!teamId || !keyId || !clientId || !keyPath) {
  console.error('Usage : --team-id <TEAM> --key-id <KEY> --client-id <SERVICES_ID> --key <AuthKey.p8> [--days 180]');
  process.exit(1);
}
if (!(days > 0 && days <= 180)) {
  console.error('--days doit être compris entre 1 et 180 (limite imposée par Apple).');
  process.exit(1);
}

const b64url = (value) => Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const exp = now + days * 24 * 60 * 60;

const header = b64url({ alg: 'ES256', kid: keyId, typ: 'JWT' });
const payload = b64url({ iss: teamId, iat: now, exp, aud: 'https://appleid.apple.com', sub: clientId });
const key = createPrivateKey(readFileSync(keyPath));
const signature = sign('sha256', Buffer.from(`${header}.${payload}`), { key, dsaEncoding: 'ieee-p1363' });

console.log(`${header}.${payload}.${signature.toString('base64url')}`);
console.error(`\nValable jusqu'au ${new Date(exp * 1000).toISOString().slice(0, 10)} — à renouveler avant cette date.`);

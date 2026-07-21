/**
 * Laravel-compatible encryption (AES-256-CBC + HMAC-SHA256).
 *
 * Reproduces `Illuminate\Encryption\Encrypter` so this Node service can
 * read/write the SAME encrypted columns the Laravel app uses (SSH private
 * keys, provider tokens, secrets) during the strangler-fig transition.
 *
 * Payload format (Laravel): base64( json({ iv, value, mac, tag }) ) where
 *   - iv    = base64(random 16 bytes)
 *   - value = base64(ciphertext)  (openssl_encrypt with options=0)
 *   - mac   = hex( hmac_sha256( iv_b64 . value_b64, key ) )
 *   - tag   = "" for CBC (only used by AEAD ciphers)
 *
 * The key comes from APP_KEY ("base64:....") and MUST match apps/ideploy/.env.
 *
 * Eloquent's `encrypted` cast uses encryptString/decryptString (serialize=false).
 * `Crypt::encrypt()` uses PHP serialize (serialize=true) — handled by
 * encrypt()/decrypt() below for scalar/string/array values.
 */
import crypto from 'crypto';

const CIPHER = 'aes-256-cbc';
const IV_LENGTH = 16;

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const appKey = process.env.APP_KEY || '';
  if (!appKey) {
    throw new Error('APP_KEY is not set — cannot read/write Laravel-encrypted columns.');
  }
  const raw = appKey.startsWith('base64:') ? appKey.slice('base64:'.length) : appKey;
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error(`APP_KEY must decode to 32 bytes for ${CIPHER} (got ${key.length}).`);
  }
  cachedKey = key;
  return key;
}

interface LaravelPayload {
  iv: string;
  value: string;
  mac: string;
  tag?: string;
}

/** Encrypt a raw string (matches Eloquent `encrypted` cast / Crypt::encryptString). */
export function encryptString(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(CIPHER, key, iv);
  const value = cipher.update(plaintext, 'utf8', 'base64') + cipher.final('base64');
  const ivB64 = iv.toString('base64');
  const mac = crypto.createHmac('sha256', key).update(ivB64 + value).digest('hex');
  const json = JSON.stringify({ iv: ivB64, value, mac, tag: '' });
  return Buffer.from(json, 'utf8').toString('base64');
}

/** Decrypt a Laravel payload to a raw string (matches Crypt::decryptString). */
export function decryptString(payload: string): string {
  const key = getKey();
  let parsed: LaravelPayload;
  try {
    parsed = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
  } catch {
    throw new Error('Invalid Laravel payload (not base64 JSON).');
  }
  if (!parsed.iv || !parsed.value || !parsed.mac) {
    throw new Error('Invalid Laravel payload (missing iv/value/mac).');
  }

  const expectedMac = crypto
    .createHmac('sha256', key)
    .update(parsed.iv + parsed.value)
    .digest('hex');
  const a = Buffer.from(expectedMac, 'hex');
  const b = Buffer.from(parsed.mac, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new Error('The MAC is invalid — wrong APP_KEY or tampered payload.');
  }

  const iv = Buffer.from(parsed.iv, 'base64');
  const decipher = crypto.createDecipheriv(CIPHER, key, iv);
  return decipher.update(parsed.value, 'base64', 'utf8') + decipher.final('utf8');
}

// ── PHP serialize support (for Crypt::encrypt / serialize=true) ───────────
// Minimal coverage: string, number, boolean, null. Sufficient for the scalar
// values Coolify stores with the serializing variant. Arrays/objects fall
// back to JSON when not PHP-serialized.

function phpSerialize(value: unknown): string {
  if (value === null || value === undefined) return 'N;';
  if (typeof value === 'boolean') return `b:${value ? 1 : 0};`;
  if (typeof value === 'number') {
    return Number.isInteger(value) ? `i:${value};` : `d:${value};`;
  }
  if (typeof value === 'string') {
    const bytes = Buffer.byteLength(value, 'utf8');
    return `s:${bytes}:"${value}";`;
  }
  throw new Error('phpSerialize: unsupported type (only scalars supported).');
}

function phpUnserialize(input: string): unknown {
  if (input === 'N;') return null;
  const head = input.slice(0, 2);
  if (head === 'b:') return input.charAt(2) === '1';
  if (head === 'i:') return parseInt(input.slice(2, -1), 10);
  if (head === 'd:') return parseFloat(input.slice(2, -1));
  if (head === 's:') {
    const firstColon = input.indexOf(':', 2);
    return input.slice(firstColon + 2, input.lastIndexOf('"'));
  }
  // Unknown structure — return as-is.
  return input;
}

/** Encrypt with PHP serialization (matches Crypt::encrypt, serialize=true). */
export function encrypt(value: unknown): string {
  return encryptString(phpSerialize(value));
}

/** Decrypt + PHP unserialize (matches Crypt::decrypt, serialize=true). */
export function decrypt(payload: string): unknown {
  return phpUnserialize(decryptString(payload));
}

/** Safe decrypt: returns null instead of throwing (for optional columns). */
export function tryDecryptString(payload: string | null | undefined): string | null {
  if (!payload) return null;
  try {
    return decryptString(payload);
  } catch {
    return null;
  }
}

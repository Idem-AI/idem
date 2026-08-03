/**
 * Key generation is verified against the real `ssh-keygen`, not a mock.
 *
 * The whole reason this module shells out to the binary is that hand-rolled key
 * encoding fails in ways that only surface when a customer cannot reach their
 * server. A test using a stubbed generator would reproduce exactly none of that
 * risk, so these run the real thing and assert on the formats the Laravel side
 * and OpenSSH both expect.
 */
import { describe, expect, it } from 'vitest';
import {
  computeFingerprint,
  derivePublicKey,
  ensureTrailingNewline,
  generateKeyPair,
  isUsablePrivateKey,
} from '../../api/ssh/keygen';

describe('generateKeyPair (ed25519)', () => {
  it('produces an OpenSSH-format private key', async () => {
    const pair = await generateKeyPair('ed25519');

    expect(pair.privateKey).toMatch(/^-----BEGIN OPENSSH PRIVATE KEY-----/);
    expect(pair.privateKey).toMatch(/-----END OPENSSH PRIVATE KEY-----\n$/);
  });

  it('produces an authorized_keys line the user can paste', async () => {
    const pair = await generateKeyPair('ed25519');

    expect(pair.publicKey).toMatch(/^ssh-ed25519 AAAA[A-Za-z0-9+/=]+ ideploy-generated-ssh-key$/);
  });

  it('produces a Laravel-compatible fingerprint: bare base64 SHA-256', async () => {
    const pair = await generateKeyPair('ed25519');

    // Laravel stores phpseclib's getFingerprint('sha256'): no algorithm prefix,
    // no padding. Diverging would break its duplicate-key detection.
    expect(pair.fingerprint).not.toMatch(/^SHA256:/);
    expect(pair.fingerprint).not.toMatch(/=/);
    expect(pair.fingerprint).toMatch(/^[A-Za-z0-9+/]{43}$/);
  });

  it('generates a distinct key every time', async () => {
    const [a, b] = await Promise.all([generateKeyPair('ed25519'), generateKeyPair('ed25519')]);

    expect(a.privateKey).not.toBe(b.privateKey);
    expect(a.fingerprint).not.toBe(b.fingerprint);
  });

  it('accepts a custom comment', async () => {
    const pair = await generateKeyPair('ed25519', 'romuald@workstation');
    expect(pair.publicKey).toMatch(/ romuald@workstation$/);
  });
});

describe('generateKeyPair (rsa)', () => {
  it('produces a PKCS#1 PEM private key, as the Laravel side writes', async () => {
    const pair = await generateKeyPair('rsa');

    expect(pair.privateKey).toMatch(/^-----BEGIN RSA PRIVATE KEY-----/);
    expect(pair.publicKey).toMatch(/^ssh-rsa AAAA/);
  });
});

describe('derivePublicKey', () => {
  it('recovers exactly the public half of a generated key, without the comment', async () => {
    const pair = await generateKeyPair('ed25519');

    const derived = await derivePublicKey(pair.privateKey);

    // Comment dropped on purpose so both stacks render the same string for the
    // same key — Laravel's extractPublicKeyFromPrivate() emits none either.
    const [type, material] = pair.publicKey.split(' ');
    expect(derived).toBe(`${type} ${material}`);
    expect(derived).not.toMatch(/ideploy-generated-ssh-key/);
  });

  it('works for rsa keys too', async () => {
    const pair = await generateKeyPair('rsa');
    const derived = await derivePublicKey(pair.privateKey);

    expect(derived.startsWith('ssh-rsa ')).toBe(true);
  });

  it('tolerates a key stored without a trailing newline', async () => {
    const pair = await generateKeyPair('ed25519');

    const derived = await derivePublicKey(pair.privateKey.trimEnd());

    expect(derived).toMatch(/^ssh-ed25519 /);
  });
});

describe('computeFingerprint', () => {
  it('matches the fingerprint reported at generation time', async () => {
    const pair = await generateKeyPair('ed25519');

    expect(await computeFingerprint(pair.privateKey)).toBe(pair.fingerprint);
  });

  it('returns null rather than throwing on unusable input', async () => {
    expect(await computeFingerprint('not a key at all')).toBeNull();
    expect(await computeFingerprint('')).toBeNull();
  });
});

describe('isUsablePrivateKey', () => {
  it('accepts a real private key', async () => {
    const pair = await generateKeyPair('ed25519');
    expect(await isUsablePrivateKey(pair.privateKey)).toBe(true);
  });

  it('rejects a public key pasted where the private one belongs', async () => {
    // The single most common user mistake on this form.
    const pair = await generateKeyPair('ed25519');
    expect(await isUsablePrivateKey(pair.publicKey)).toBe(false);
  });

  it('rejects a truncated paste', async () => {
    const pair = await generateKeyPair('ed25519');
    const truncated = pair.privateKey.slice(0, pair.privateKey.length / 2);

    expect(await isUsablePrivateKey(truncated)).toBe(false);
  });
});

describe('ensureTrailingNewline', () => {
  it('adds the newline OpenSSH requires', () => {
    expect(ensureTrailingNewline('abc')).toBe('abc\n');
  });

  it('collapses surrounding whitespace to exactly one trailing newline', () => {
    expect(ensureTrailingNewline('\n  abc \n\n\n')).toBe('abc\n');
  });
});

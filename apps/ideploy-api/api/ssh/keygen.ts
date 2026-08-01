/**
 * SSH key pair generation and inspection.
 *
 * Ports Laravel's `generateSSHKey()` + `PrivateKey::extractPublicKeyFromPrivate()`
 * / `generateFingerprint()`. Without this, a user could only ever paste a key
 * they had already created elsewhere — which is not a usable first-run path for
 * adding a server.
 *
 * We shell out to `ssh-keygen` rather than assembling key material with
 * `node:crypto`. Producing the OpenSSH private-key container and the
 * `authorized_keys` wire format by hand is easy to get subtly wrong, and a
 * subtly wrong key means the customer cannot reach their own server. The binary
 * is the reference implementation; it ships in the image (`openssh-client`).
 *
 * Formats deliberately match the Laravel side, so keys created by either stack
 * are interchangeable while both run:
 *   • rsa      → PKCS#1 PEM  (`-----BEGIN RSA PRIVATE KEY-----`)
 *   • ed25519  → OpenSSH      (`-----BEGIN OPENSSH PRIVATE KEY-----`)
 *   • public   → `ssh-… AAAA…` authorized_keys line
 *   • finger.  → base64 SHA-256, no `SHA256:` prefix, no `=` padding
 */
import { execFile } from 'child_process';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { promisify } from 'util';

const exec = promisify(execFile);

/** RSA size matching OpenSSH's own default for new keys. */
const RSA_BITS = 4096;

export type SshKeyType = 'ed25519' | 'rsa';

export const SSH_KEY_TYPES: readonly SshKeyType[] = ['ed25519', 'rsa'] as const;

export interface GeneratedKeyPair {
  type: SshKeyType;
  /** PEM — encrypt before storing, never return over the API. */
  privateKey: string;
  /** `authorized_keys` line the user installs on the server. */
  publicKey: string;
  /** base64 SHA-256 of the public key blob, Laravel-compatible. */
  fingerprint: string;
}

/** Run something in a private 0700 directory, then remove it whatever happens. */
async function inTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ideploy-keygen-'));
  try {
    await fs.chmod(dir, 0o700);
    return await fn(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

/**
 * `ssh-keygen -l` prints e.g. `256 SHA256:WDF1BE… no comment (ED25519)`.
 * Laravel stores the digest alone, so strip the algorithm prefix.
 */
function parseFingerprint(sshKeygenListOutput: string): string {
  const match = /SHA256:([A-Za-z0-9+/=]+)/.exec(sshKeygenListOutput);
  if (!match) {
    throw new Error('Could not read the key fingerprint from ssh-keygen output.');
  }
  return match[1].replace(/=+$/, '');
}

/** Generate a fresh key pair. The private key is returned, never persisted here. */
export async function generateKeyPair(
  type: SshKeyType = 'ed25519',
  comment = 'ideploy-generated-ssh-key'
): Promise<GeneratedKeyPair> {
  return inTempDir(async (dir) => {
    const keyPath = path.join(dir, 'key');

    const args = ['-t', type, '-N', '', '-C', comment, '-f', keyPath, '-q'];
    if (type === 'rsa') {
      // -m PEM yields PKCS#1, the format the Laravel side writes for RSA.
      args.push('-b', String(RSA_BITS), '-m', 'PEM');
    }
    await exec('ssh-keygen', args);

    const [privateKey, publicKey, listing] = await Promise.all([
      fs.readFile(keyPath, 'utf8'),
      fs.readFile(`${keyPath}.pub`, 'utf8'),
      exec('ssh-keygen', ['-lf', keyPath]).then((r) => r.stdout),
    ]);

    return {
      type,
      privateKey: privateKey.trim() + '\n',
      publicKey: publicKey.trim(),
      fingerprint: parseFingerprint(listing),
    };
  });
}

/**
 * Derive the `authorized_keys` line from a private key.
 *
 * Public keys are not stored: the private key is the single source of truth, so
 * there is no second copy to drift. Matches Laravel, which derives on demand too.
 *
 * The trailing comment is dropped. `ssh-keygen -y` echoes whatever comment the
 * key file embeds, while Laravel's `extractPublicKeyFromPrivate()` emits none —
 * so both stacks would otherwise display a different string for the same key.
 * The comment carries no cryptographic meaning.
 */
export async function derivePublicKey(privateKeyPem: string): Promise<string> {
  return inTempDir(async (dir) => {
    const keyPath = path.join(dir, 'key');
    await fs.writeFile(keyPath, ensureTrailingNewline(privateKeyPem), { mode: 0o600 });

    const { stdout } = await exec('ssh-keygen', ['-y', '-f', keyPath]);
    const [algorithm, material] = stdout.trim().split(/\s+/);
    return `${algorithm} ${material}`;
  });
}

/** Fingerprint of a private key's public half, or null when it cannot be parsed. */
export async function computeFingerprint(privateKeyPem: string): Promise<string | null> {
  try {
    return await inTempDir(async (dir) => {
      const keyPath = path.join(dir, 'key');
      await fs.writeFile(keyPath, ensureTrailingNewline(privateKeyPem), { mode: 0o600 });
      const { stdout } = await exec('ssh-keygen', ['-lf', keyPath]);
      return parseFingerprint(stdout);
    });
  } catch {
    return null;
  }
}

/**
 * Is this usable as an SSH *private* key?
 *
 * Rejects a pasted public key or a truncated paste at the API boundary, rather
 * than storing it and failing later at deploy time with an opaque SSH error.
 *
 * Note this cannot be implemented with `ssh-keygen -l`: that command happily
 * fingerprints a *public* key file, so it would accept the single most common
 * user mistake on this form. `-y` is the discriminating check — deriving a
 * public key is only possible from a private one.
 */
export async function isUsablePrivateKey(privateKeyPem: string): Promise<boolean> {
  try {
    await derivePublicKey(privateKeyPem);
    return true;
  } catch {
    return false;
  }
}

/** OpenSSH refuses key files that do not end with a newline. */
export function ensureTrailingNewline(pem: string): string {
  const trimmed = pem.trim();
  return trimmed.endsWith('\n') ? trimmed : `${trimmed}\n`;
}

/**
 * Integration coverage for the private-key service.
 *
 * Properties that matter here, none of which a mock could prove:
 *  - **Secrets stay secret.** The column is Laravel-encrypted; the ciphertext
 *    must round-trip through our crypto and never surface in an API view.
 *  - **Teams are isolated.** A leak here hands one customer another customer's
 *    SSH keys — the worst failure this codebase can have.
 *  - **Unusable keys are refused at the boundary**, not stored to fail later
 *    mid-deployment with an opaque SSH error.
 *
 * Keys are generated once for the suite: real material (so validation and
 * fingerprinting are genuinely exercised) without paying key generation per test.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import * as privateKeys from '../../api/services/private-key.service';
import { GeneratedKeyPair, generateKeyPair } from '../../api/ssh/keygen';
import { decryptString } from '../../api/utils/laravel-crypto';
import { isDomainError } from '../../api/utils/errors';
import { isTestDatabaseAvailable, testPool, truncateAll } from '../helpers/db';
import { makePrivateKey, makeTeam } from '../helpers/factories';
import { closeInfrastructure } from '../helpers/teardown';

let keyA: GeneratedKeyPair;
let keyB: GeneratedKeyPair;

beforeAll(async () => {
  if (!(await isTestDatabaseAvailable())) {
    throw new Error(
      'Integration tests need the test database. Run scripts/prepare-test-db.sh from the repo root.'
    );
  }
  [keyA, keyB] = await Promise.all([generateKeyPair('ed25519'), generateKeyPair('ed25519')]);
});

beforeEach(async () => {
  await truncateAll();
});

afterAll(async () => {
  await closeInfrastructure();
});

/** Assert a rejection is a DomainError carrying the expected machine code. */
async function expectDomainError(promise: Promise<unknown>, code: string): Promise<void> {
  await expect(promise).rejects.toThrow();
  await promise.catch((err) => {
    expect(isDomainError(err)).toBe(true);
    expect(isDomainError(err) && err.code).toBe(code);
  });
}

describe('createPrivateKey', () => {
  it('stores the key encrypted, never as plaintext', async () => {
    const team = await makeTeam();

    const created = await privateKeys.createPrivateKey(team.id, {
      name: 'deploy key',
      private_key: keyA.privateKey,
    });

    const { rows } = await testPool().query<{ private_key: string }>(
      'SELECT private_key FROM private_keys WHERE id = $1',
      [created.id]
    );
    const stored = rows[0].private_key;

    expect(stored).not.toContain('BEGIN OPENSSH PRIVATE KEY');
    expect(decryptString(stored)).toBe(keyA.privateKey.trim());
  });

  it('records the fingerprint so duplicates can be detected', async () => {
    const team = await makeTeam();

    const created = await privateKeys.createPrivateKey(team.id, {
      name: 'deploy key',
      private_key: keyA.privateKey,
    });

    expect(created.fingerprint).toBe(keyA.fingerprint);
  });

  it('does not return the key material in the created view', async () => {
    const team = await makeTeam();

    const created = await privateKeys.createPrivateKey(team.id, {
      name: 'deploy key',
      private_key: keyA.privateKey,
    });

    expect(JSON.stringify(created)).not.toContain('PRIVATE KEY');
    expect(created).not.toHaveProperty('private_key');
  });

  it('rejects a public key pasted into the private key field', async () => {
    const team = await makeTeam();

    await expectDomainError(
      privateKeys.createPrivateKey(team.id, { name: 'oops', private_key: keyA.publicKey }),
      'INVALID_PRIVATE_KEY'
    );
  });

  it('rejects a truncated key', async () => {
    const team = await makeTeam();

    await expectDomainError(
      privateKeys.createPrivateKey(team.id, {
        name: 'oops',
        private_key: keyA.privateKey.slice(0, 80),
      }),
      'INVALID_PRIVATE_KEY'
    );
  });

  it('refuses the same key twice for one team', async () => {
    const team = await makeTeam();
    await privateKeys.createPrivateKey(team.id, { name: 'first', private_key: keyA.privateKey });

    await expectDomainError(
      privateKeys.createPrivateKey(team.id, { name: 'second', private_key: keyA.privateKey }),
      'DUPLICATE_PRIVATE_KEY'
    );
  });

  it('allows two different teams to register the same key', async () => {
    // Two customers may legitimately use the same key; dedup is per team.
    const [one, two] = [await makeTeam(), await makeTeam()];

    await privateKeys.createPrivateKey(one.id, { name: 'shared', private_key: keyA.privateKey });
    const second = await privateKeys.createPrivateKey(two.id, {
      name: 'shared',
      private_key: keyA.privateKey,
    });

    expect(second.fingerprint).toBe(keyA.fingerprint);
  });
});

describe('generatePrivateKey', () => {
  it('stores the private half and hands back the public half to install', async () => {
    const team = await makeTeam();

    const created = await privateKeys.generatePrivateKey(team.id, { name: 'generated' });

    expect(created.public_key).toMatch(/^ssh-ed25519 AAAA/);
    expect(created.type).toBe('ed25519');
    expect(created.fingerprint).toMatch(/^[A-Za-z0-9+/]{43}$/);

    const row = await privateKeys.getPrivateKeyByUuid(team.id, created.uuid);
    expect(decryptString(row!.private_key)).toMatch(/BEGIN OPENSSH PRIVATE KEY/);
  });

  it('never exposes the private key in the response', async () => {
    const team = await makeTeam();

    const created = await privateKeys.generatePrivateKey(team.id, { name: 'generated' });

    expect(JSON.stringify(created)).not.toContain('PRIVATE KEY');
  });

  it('produces a distinct key each time', async () => {
    const team = await makeTeam();

    const first = await privateKeys.generatePrivateKey(team.id, { name: 'one' });
    const second = await privateKeys.generatePrivateKey(team.id, { name: 'two' });

    expect(first.fingerprint).not.toBe(second.fingerprint);
    expect(first.public_key).not.toBe(second.public_key);
  });

  it('can generate an rsa key when asked', async () => {
    const team = await makeTeam();

    const created = await privateKeys.generatePrivateKey(team.id, { name: 'rsa key', type: 'rsa' });

    expect(created.public_key).toMatch(/^ssh-rsa AAAA/);
    const row = await privateKeys.getPrivateKeyByUuid(team.id, created.uuid);
    expect(decryptString(row!.private_key)).toMatch(/BEGIN RSA PRIVATE KEY/);
  });
});

describe('getPublicKeyFor', () => {
  it('derives the public key of a stored private key', async () => {
    const team = await makeTeam();
    const created = await privateKeys.createPrivateKey(team.id, {
      name: 'deploy key',
      private_key: keyA.privateKey,
    });

    const derived = await privateKeys.getPublicKeyFor(team.id, created.uuid);

    const [algorithm, material] = keyA.publicKey.split(' ');
    expect(derived).toBe(`${algorithm} ${material}`);
  });

  it('reports not found for another team’s key', async () => {
    const [mine, theirs] = [await makeTeam(), await makeTeam()];
    const foreign = await privateKeys.createPrivateKey(theirs.id, {
      name: 'theirs',
      private_key: keyA.privateKey,
    });

    await expectDomainError(privateKeys.getPublicKeyFor(mine.id, foreign.uuid), 'NOT_FOUND');
  });

  it('reports a clear error when the stored material cannot be read', async () => {
    // Simulates a key written under a different APP_KEY, or corrupted at rest.
    const team = await makeTeam();
    const key = await makePrivateKey(team.id, { plaintext: 'this is not a key' });

    await expectDomainError(
      privateKeys.getPublicKeyFor(team.id, key.uuid),
      'UNREADABLE_PRIVATE_KEY'
    );
  });
});

describe('team isolation', () => {
  it('lists only the calling team’s keys', async () => {
    const [mine, theirs] = [await makeTeam(), await makeTeam()];
    await makePrivateKey(mine.id, { name: 'mine' });
    await makePrivateKey(theirs.id, { name: 'theirs' });

    const listed = await privateKeys.listPrivateKeys(mine.id);

    expect(listed.map((k) => k.name)).toEqual(['mine']);
  });

  it('refuses to read another team’s key by uuid', async () => {
    const [mine, theirs] = [await makeTeam(), await makeTeam()];
    const foreign = await makePrivateKey(theirs.id);

    expect(await privateKeys.getPrivateKeyView(mine.id, foreign.uuid)).toBeNull();
    expect(await privateKeys.getPrivateKeyByUuid(mine.id, foreign.uuid)).toBeNull();
  });

  it('refuses to delete another team’s key, and leaves it intact', async () => {
    const [mine, theirs] = [await makeTeam(), await makeTeam()];
    const foreign = await makePrivateKey(theirs.id);

    expect(await privateKeys.deletePrivateKey(mine.id, foreign.uuid)).toBe(false);
    expect(await privateKeys.getPrivateKeyView(theirs.id, foreign.uuid)).not.toBeNull();
  });
});

describe('deletePrivateKey', () => {
  it('removes the key and reports success', async () => {
    const team = await makeTeam();
    const key = await makePrivateKey(team.id);

    expect(await privateKeys.deletePrivateKey(team.id, key.uuid)).toBe(true);
    expect(await privateKeys.getPrivateKeyView(team.id, key.uuid)).toBeNull();
  });

  it('reports failure for a uuid that does not exist', async () => {
    const team = await makeTeam();
    expect(await privateKeys.deletePrivateKey(team.id, 'ffffffff-0000-0000-0000-000000000000')).toBe(
      false
    );
  });
});

describe('listPrivateKeys', () => {
  it('orders keys by name so the UI is stable between calls', async () => {
    const team = await makeTeam();
    for (const name of ['zulu', 'alpha', 'mike']) {
      await makePrivateKey(team.id, { name });
    }

    const listed = await privateKeys.listPrivateKeys(team.id);
    expect(listed.map((k) => k.name)).toEqual(['alpha', 'mike', 'zulu']);
  });

  it('exposes the fingerprint so the UI can show which key is which', async () => {
    const team = await makeTeam();
    await privateKeys.createPrivateKey(team.id, { name: 'a', private_key: keyA.privateKey });
    await privateKeys.createPrivateKey(team.id, { name: 'b', private_key: keyB.privateKey });

    const listed = await privateKeys.listPrivateKeys(team.id);

    expect(listed.map((k) => k.fingerprint)).toEqual([keyA.fingerprint, keyB.fingerprint]);
  });
});

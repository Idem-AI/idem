/**
 * Chargement des secrets indexés (`<app>--<VARIABLE>`), Secret Manager simulé.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();

vi.mock('@google-cloud/secret-manager', () => ({
  SecretManagerServiceClient: class {
    async accessSecretVersion({ name }: { name: string }) {
      const id = name.split('/secrets/')[1].split('/versions/')[0];
      if (!store.has(id)) throw Object.assign(new Error('NOT_FOUND'), { code: 5 });
      return [{ payload: { data: Buffer.from(store.get(id)!) } }];
    }
  },
}));

import { loadSecretsFromManager, secretIdFor } from '../../../api/config/secret-loader';

const silent = { log: () => undefined, warn: () => undefined, error: () => undefined };
const saved = { ...process.env };

beforeEach(() => {
  store.clear();
  process.env = { ...saved, NODE_ENV: 'production', USE_SECRET_MANAGER: 'true', GCP_PROJECT_ID: 'p' };
  delete process.env.SECRET_ENV_PREFIX;
  delete process.env.DEMO_REQUIRED;
  delete process.env.DEMO_OPTIONAL;
});

afterEach(() => {
  process.env = { ...saved };
});

describe('secretIdFor', () => {
  it('indexes by application, with an optional environment prefix', () => {
    expect(secretIdFor('appgen', 'GLM_API_KEY', '')).toBe('appgen--GLM_API_KEY');
    expect(secretIdFor('api', 'SMTP_PASS', 'staging-')).toBe('staging-api--SMTP_PASS');
  });
});

describe('loadSecretsFromManager', () => {
  const manifest = { app: 'demo', required: ['DEMO_REQUIRED'], optional: ['DEMO_OPTIONAL'] } as const;

  it('reads the indexed name', async () => {
    store.set('demo--DEMO_REQUIRED', 'r1');
    const result = await loadSecretsFromManager(manifest, silent);
    expect(process.env.DEMO_REQUIRED).toBe('r1');
    expect(result.missingOptional).toEqual(['DEMO_OPTIONAL']);
  });

  it('does not read the legacy un-indexed name unless the manifest allows it', async () => {
    store.set('DEMO_REQUIRED', 'legacy');
    await expect(loadSecretsFromManager(manifest, silent)).rejects.toThrow(/DEMO_REQUIRED/);

    await loadSecretsFromManager({ ...manifest, legacyUnprefixedFallback: true }, silent);
    expect(process.env.DEMO_REQUIRED).toBe('legacy');
  });

  it('never overwrites a value already set by the host', async () => {
    store.set('demo--DEMO_REQUIRED', 'from-manager');
    process.env.DEMO_REQUIRED = 'from-host';
    await loadSecretsFromManager(manifest, silent);
    expect(process.env.DEMO_REQUIRED).toBe('from-host');
  });

  it('stays on the local environment when Secret Manager is disabled', async () => {
    process.env.USE_SECRET_MANAGER = 'false';
    store.set('demo--DEMO_REQUIRED', 'unused');
    const result = await loadSecretsFromManager(manifest, silent);
    expect(result.source).toBe('env');
    expect(process.env.DEMO_REQUIRED).toBeUndefined();
  });
});

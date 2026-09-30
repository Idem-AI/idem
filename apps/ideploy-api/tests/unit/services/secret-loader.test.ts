/**
 * Chargement des secrets depuis Infisical, SDK simulé.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Secrets du projet simulé, par environnement : `${env}:${nom}` -> valeur.
const store = new Map<string, string>();
const calls = { login: [] as unknown[], list: [] as Record<string, unknown>[] };
let failure: Error | null = null;

vi.mock('@infisical/sdk', () => ({
  InfisicalSDK: class {
    constructor(public options: { siteUrl?: string }) {}
    auth() {
      return {
        universalAuth: {
          login: async (credentials: unknown) => {
            calls.login.push(credentials);
            if (failure) throw failure;
            return this;
          },
        },
      };
    }
    secrets() {
      return {
        listSecrets: async (options: { environment: string } & Record<string, unknown>) => {
          calls.list.push(options);
          const prefix = `${options.environment}:`;
          const secrets = [...store]
            .filter(([key]) => key.startsWith(prefix))
            .map(([key, secretValue]) => ({ secretKey: key.slice(prefix.length), secretValue }));
          return { secrets };
        },
      };
    }
  },
}));

import { loadSecretsFromManager } from '../../../api/config/secret-loader';

const silent = { log: () => undefined, warn: () => undefined, error: () => undefined };
const saved = { ...process.env };

beforeEach(() => {
  store.clear();
  calls.login = [];
  calls.list = [];
  failure = null;
  process.env = {
    ...saved,
    NODE_ENV: 'production',
    USE_SECRET_MANAGER: 'true',
    INFISICAL_SITE_URL: 'https://secrets.example.test',
    INFISICAL_PROJECT_ID: 'project-demo',
    INFISICAL_CLIENT_ID: 'client-id',
    INFISICAL_CLIENT_SECRET: 'client-secret',
  };
  delete process.env.INFISICAL_ENVIRONMENT;
  delete process.env.DEMO_REQUIRED;
  delete process.env.DEMO_OPTIONAL;
});

afterEach(() => {
  process.env = { ...saved };
});

describe('loadSecretsFromManager', () => {
  const manifest = { app: 'demo', required: ['DEMO_REQUIRED'], optional: ['DEMO_OPTIONAL'] } as const;

  it('reads the project secrets from the `prod` environment by default', async () => {
    store.set('prod:DEMO_REQUIRED', 'r1');
    const result = await loadSecretsFromManager(manifest, silent);

    expect(process.env.DEMO_REQUIRED).toBe('r1');
    expect(result).toEqual({ source: 'secret-manager', loaded: ['DEMO_REQUIRED'], missingOptional: ['DEMO_OPTIONAL'] });
    expect(calls.login).toEqual([{ clientId: 'client-id', clientSecret: 'client-secret' }]);
    expect(calls.list).toEqual([
      { projectId: 'project-demo', environment: 'prod', secretPath: '/', viewSecretValue: true },
    ]);
  });

  it('honours INFISICAL_ENVIRONMENT', async () => {
    process.env.INFISICAL_ENVIRONMENT = 'dev';
    store.set('prod:DEMO_REQUIRED', 'from-prod');
    store.set('dev:DEMO_REQUIRED', 'from-dev');
    await loadSecretsFromManager(manifest, silent);
    expect(process.env.DEMO_REQUIRED).toBe('from-dev');
  });

  it('ignores project secrets the manifest does not declare', async () => {
    store.set('prod:DEMO_REQUIRED', 'r1');
    store.set('prod:NOT_IN_MANIFEST', 'x');
    await loadSecretsFromManager(manifest, silent);
    expect(process.env.NOT_IN_MANIFEST).toBeUndefined();
  });

  it('fails when a required secret is missing', async () => {
    store.set('prod:DEMO_OPTIONAL', 'o1');
    await expect(loadSecretsFromManager(manifest, silent)).rejects.toThrow(/missing required secrets: DEMO_REQUIRED/);
  });

  it('reports an Infisical failure instead of hiding it behind missing secrets', async () => {
    failure = new Error('[StatusCode=401] invalid credentials');
    const errors: string[] = [];
    const log = { ...silent, error: (message: string) => errors.push(message) };

    await expect(loadSecretsFromManager(manifest, log)).rejects.toThrow(/DEMO_REQUIRED/);
    expect(errors.join('\n')).toMatch(/could not read Infisical.*\[StatusCode=401\] invalid credentials/);
  });

  it('starts without Infisical when nothing is required', async () => {
    failure = new Error('connect ECONNREFUSED');
    const result = await loadSecretsFromManager({ app: 'demo', required: [], optional: ['DEMO_OPTIONAL'] }, silent);
    expect(result.loaded).toEqual([]);
  });

  it('requires the Infisical connection settings', async () => {
    delete process.env.INFISICAL_CLIENT_SECRET;
    await expect(loadSecretsFromManager(manifest, silent)).rejects.toThrow(/INFISICAL_CLIENT_SECRET/);
  });

  it('never overwrites a value already set by the host', async () => {
    store.set('prod:DEMO_REQUIRED', 'from-manager');
    process.env.DEMO_REQUIRED = 'from-host';
    await loadSecretsFromManager(manifest, silent);
    expect(process.env.DEMO_REQUIRED).toBe('from-host');
  });

  it('stays on the local environment when the secret manager is disabled', async () => {
    process.env.USE_SECRET_MANAGER = 'false';
    store.set('prod:DEMO_REQUIRED', 'unused');
    const result = await loadSecretsFromManager(manifest, silent);
    expect(result.source).toBe('env');
    expect(calls.login).toEqual([]);
    expect(process.env.DEMO_REQUIRED).toBeUndefined();
  });
});

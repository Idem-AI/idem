/**
 * Centralised secret loading.
 *
 * Strategy:
 *   - In production (NODE_ENV=production or USE_SECRET_MANAGER=true), secrets
 *     are pulled from Google Secret Manager and injected into process.env
 *     BEFORE any other module reads them.
 *   - Otherwise (development), values are loaded from the local .env file
 *     via dotenv. The local .env MUST NEVER be committed.
 *
 * Once loadSecrets() resolves, the rest of the codebase can keep using
 * process.env.VAR_NAME transparently. This avoids touching the 80+ files
 * that already read process.env.
 *
 * Required GCP setup (one-time):
 *   1. Enable Secret Manager API on your GCP project.
 *   2. Create the secrets listed in REQUIRED_SECRETS / OPTIONAL_SECRETS.
 *   3. Grant the runtime service account the role
 *      `roles/secretmanager.secretAccessor`.
 *   4. Set env var GCP_PROJECT_ID (or GOOGLE_CLOUD_PROJECT) on the host.
 *   5. (Optional) Set SECRET_PREFIX, e.g. `idem-api-prod-` to namespace secrets.
 */

import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

const SECRET_PREFIX = process.env.SECRET_PREFIX || '';

/**
 * Secrets that MUST be present at boot. Missing values abort the process.
 */
const REQUIRED_SECRETS = [
  'FIREBASE_PROJECT_ID',
  'FIREBASE_PRIVATE_KEY',
  'FIREBASE_CLIENT_EMAIL',
  'MONGODB_PASSWORD',
  'MINIO_ACCESS_KEY',
  'MINIO_SECRET_KEY',
  'INTERNAL_API_KEY',
  'SENSITIVE_VARS_ENCRYPTION_KEY',
] as const;

/**
 * Secrets that are only required for certain features. Missing values log
 * a warning but do not abort.
 */
const OPTIONAL_SECRETS = [
  'FIREBASE_PRIVATE_KEY_ID',
  'FIREBASE_CLIENT_ID',
  'FIREBASE_APP_ID',
  'FIREBASE_AUTH_DOMAIN',
  'FIREBASE_MEASUREMENT_ID',
  'REDIS_PASSWORD',
  'GEMINI_API_KEY',
  'DEEPSEEK_API_KEY',
  'OPENAI_API_KEY',
  'GITHUB_CLIENT_ID',
  'GITHUB_CLIENT_SECRET',
  'PEXELS_API_KEY',
  'SMTP_PASS',
  'IDEPLOY_SHARED_SECRET',
] as const;

let loaded = false;

/**
 * Load secrets into process.env. Idempotent.
 */
export async function loadSecrets(): Promise<void> {
  if (loaded) return;
  loaded = true;

  // Always load local env first to populate host configuration.
  loadFromDotenv();

  const useSecretManager =
    process.env.NODE_ENV !== 'development' &&
    (process.env.USE_SECRET_MANAGER === 'true' ||
      (process.env.NODE_ENV === 'production' && process.env.USE_SECRET_MANAGER !== 'false'));

  if (useSecretManager) {
    await loadFromSecretManager();
  }

  expandEnvVars();
  validateRequired();
  normalize();
}

function expandEnvVars(): void {
  for (const key in process.env) {
    let value = process.env[key];
    if (value && value.includes('${')) {
      value = value.replace(/\${([^}]+)}/g, (_, name) => process.env[name] || '');
      process.env[key] = value;
    }
  }
}

function loadFromDotenv(): void {
  // Look for .env in cwd then in apps/api root.
  const candidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(__dirname, '../../.env'),
  ];
  const envPath = candidates.find((p) => fs.existsSync(p));
  if (envPath) {
    dotenv.config({ path: envPath });
    // Do NOT log the path in production-shaped logs.
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[secrets] Loaded local .env from ${envPath}`);
    }

    // Load local secrets if .env.secret exists alongside the .env file
    const envDirectory = path.dirname(envPath);
    const secretPath = path.resolve(envDirectory, '.env.secret');
    if (fs.existsSync(secretPath)) {
      dotenv.config({ path: secretPath });
      if (process.env.NODE_ENV !== 'test') {
        console.log(`[secrets] Loaded local secrets from ${secretPath}`);
      }
    }
  } else {
    console.warn('[secrets] No local .env file found; relying on shell env vars only.');
  }
}

async function loadFromSecretManager(): Promise<void> {
  // Lazy import so dev installs do not require the GCP SDK

  const { SecretManagerServiceClient } = await import('@google-cloud/secret-manager');
  const projectId =
    process.env.GCP_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.FIREBASE_PROJECT_ID;

  if (!projectId) {
    throw new Error(
      '[secrets] GCP_PROJECT_ID (or GOOGLE_CLOUD_PROJECT) is required when USE_SECRET_MANAGER=true'
    );
  }

  const client = new SecretManagerServiceClient();
  const allNames = [...REQUIRED_SECRETS, ...OPTIONAL_SECRETS];

  console.log(`[secrets] Fetching ${allNames.length} secrets from Google Secret Manager (project=${projectId})...`);

  const results = await Promise.allSettled(
    allNames.map(async (name) => {
      const secretId = `${SECRET_PREFIX}${name}`;
      try {
        const resourceName = `projects/${projectId}/secrets/${secretId}/versions/latest`;
        const [version] = await client.accessSecretVersion({ name: resourceName });
        const payload = version.payload?.data?.toString();
        return { name, payload, secretId };
      } catch (error: any) {
        throw { name, secretId, error };
      }
    })
  );

  let loadedCount = 0;
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value.payload !== undefined) {
      // Do not overwrite values already provided by the host environment
      // (allows ad-hoc overrides without rotating secrets).
      if (process.env[r.value.name] === undefined || process.env[r.value.name] === '') {
        process.env[r.value.name] = r.value.payload;
      }
      loadedCount++;
    } else if (r.status === 'rejected') {
      const { name, secretId, error } = r.reason as { name: string; secretId: string; error: any };
      console.warn(`[secrets] Failed to fetch secret "${secretId}" (${name}) from Secret Manager:`, error?.message || error);
    }
  }

  console.log(`[secrets] Loaded ${loadedCount}/${allNames.length} secrets from Secret Manager.`);
}

function validateRequired(): void {
  const missing = REQUIRED_SECRETS.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.error(`[secrets] Missing required secrets: ${missing.join(', ')}`);
    throw new Error(`Missing required secrets: ${missing.join(', ')}`);
  }
  const missingOptional = OPTIONAL_SECRETS.filter((k) => !process.env[k]);
  if (missingOptional.length > 0) {
    console.warn(`[secrets] Optional secrets not set: ${missingOptional.join(', ')}`);
  }
}

function normalize(): void {
  // Firebase private key stored as a single line with \n escapes -> real newlines.
  if (process.env.FIREBASE_PRIVATE_KEY) {
    process.env.FIREBASE_PRIVATE_KEY = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
  }
}

/**
 * Returns a redacted snapshot of loaded secrets (for diagnostics).
 */
export function getSecretsStatus(): Record<string, boolean> {
  const status: Record<string, boolean> = {};
  for (const k of [...REQUIRED_SECRETS, ...OPTIONAL_SECRETS]) {
    status[k] = Boolean(process.env[k]);
  }
  return status;
}

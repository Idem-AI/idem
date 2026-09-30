/**
 * Centralised secret loading.
 *
 *   - Local development: `.env` then `.env.secret` (never committed).
 *   - Production (NODE_ENV=production, or USE_SECRET_MANAGER=true): the
 *     secrets listed in `secrets.manifest.ts` are read from Infisical
 *     (project `api`) and injected into process.env BEFORE any other module
 *     reads them.
 *
 * Only real secrets live in Infisical. Non-secret configuration (project
 * id, public client ids, URLs, ports, limits, ADMIN_EMAILS) stays in
 * `.env.production`. See secret-loader.ts and scripts/secrets/idem-secrets.mjs.
 */

import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { loadSecretsFromManager } from './secret-loader';
import { SECRET_MANIFEST } from './secrets.manifest';

/**
 * Configuration indispensable qui N'EST PAS un secret : elle vient du `.env`
 * (ou de l'environnement du conteneur), jamais d'Infisical.
 */
const REQUIRED_CONFIG = ['GCP_PROJECT_ID', 'SUPABASE_AUTH_URL'] as const;

let loaded = false;

/**
 * Load secrets into process.env. Idempotent.
 */
export async function loadSecrets(): Promise<void> {
  if (loaded) return;
  loaded = true;

  // Always load local env first to populate host configuration.
  loadFromDotenv();

  // Secrets du projet Infisical `api` (voir secrets.manifest.ts et
  // secret-loader.ts). Hors production, le `.env` / `.env.secret` suffit.
  await loadSecretsFromManager(SECRET_MANIFEST);

  expandEnvVars();
  validateRequired();
  normalize();
  await invalidateEnvDerivedCaches();
}

/**
 * Drop every configuration that was resolved from process.env BEFORE this
 * point.
 *
 * Modules are imported before bootstrap() awaits loadSecrets(), so any of them
 * that resolves configuration at import time reads a half-loaded environment:
 * .env is already there, .env.secret is not. The Gemini backend memoises its
 * resolution, so a single import-time lookup froze it with a missing API key
 * and every generation failed afterwards with "GEMINI_API_KEY est absente" —
 * while the key was in fact loaded a few milliseconds later.
 *
 * Invalidating here costs one object rebuild and removes the whole class of
 * bug: whatever was resolved too early is simply resolved again, now that the
 * environment is complete. Imported dynamically so this module keeps no static
 * dependency on the AI registry.
 */
async function invalidateEnvDerivedCaches(): Promise<void> {
  const { resetGeminiBackend } = await import('./ai-providers.config');
  resetGeminiBackend();
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

function validateRequired(): void {
  const missing = [...REQUIRED_CONFIG, ...SECRET_MANIFEST.required].filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.error(`[secrets] Missing required configuration/secrets: ${missing.join(', ')}`);
    throw new Error(`Missing required configuration/secrets: ${missing.join(', ')}`);
  }
}

function normalize(): void {
  // Service account private key stored as a single line with \n escapes -> real newlines.
  if (process.env.GCP_SA_PRIVATE_KEY) {
    process.env.GCP_SA_PRIVATE_KEY = process.env.GCP_SA_PRIVATE_KEY.replace(/\\n/g, '\n');
  }
}

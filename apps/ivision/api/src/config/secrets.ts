/**
 * Chargement centralisé de la configuration et des secrets — la même logique que l'API IDEM
 * (`apps/api/api/config/secrets.ts`) :
 *
 *   - en local : `.env` (configuration) puis `.env.secret` posé à côté (secrets, jamais commité) ;
 *   - en production (`NODE_ENV=production`, ou `USE_SECRET_MANAGER=true`) : toutes les variables
 *     du projet Infisical `ivision-api` sont injectées dans `process.env` (cf. secret-loader.ts),
 *     AVANT qu'un module ne les lise.
 *
 * Seuls les vrais secrets vivent dans Infisical (cf. secrets.manifest.ts) ; la configuration non
 * sensible (adresses, ports, bucket, origines) reste dans le `.env`.
 */
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { loadSecretsFromManager } from './secret-loader';
import { SECRET_MANIFEST } from './secrets.manifest';

/** Configuration indispensable qui N'EST PAS un secret : elle vient du `.env`, jamais d'Infisical. */
const REQUIRED_CONFIG = ['IDEM_API_URL'] as const;

let loaded = false;

/** Charge `.env`, `.env.secret`, puis Infisical si activé. Idempotent. */
export async function loadSecrets(): Promise<void> {
  if (loaded) return;
  loaded = true;
  loadFromDotenv();
  await loadSecretsFromManager(SECRET_MANIFEST);
  expandEnvVars();
  validateRequired();
}

/** `.env` du dossier courant, sinon de la racine de l'app ; puis `.env.secret` à côté. */
function loadFromDotenv(): void {
  const candidates = [path.resolve(process.cwd(), '.env'), path.resolve(__dirname, '../../.env'), path.resolve(__dirname, '../../../../../../.env')];
  const envPath = candidates.find((p) => fs.existsSync(p));
  if (!envPath) {
    console.warn('[secrets] Aucun .env local : seules les variables du shell sont utilisées.');
    return;
  }
  dotenv.config({ path: envPath });
  if (process.env.NODE_ENV !== 'test') console.log(`[secrets] Loaded local .env from ${envPath}`);
  const secretPath = path.resolve(path.dirname(envPath), '.env.secret');
  if (fs.existsSync(secretPath)) {
    dotenv.config({ path: secretPath });
    if (process.env.NODE_ENV !== 'test') console.log(`[secrets] Loaded local secrets from ${secretPath}`);
  }
}

/** `MONGODB_URI=mongodb://admin:${MONGODB_PASSWORD}@…` : les références sont résolues une fois tout chargé. */
function expandEnvVars(): void {
  for (const key in process.env) {
    const value = process.env[key];
    if (value && value.includes('${')) process.env[key] = value.replace(/\${([^}]+)}/g, (_, name) => process.env[name] || '');
  }
}

function validateRequired(): void {
  const missing = [...REQUIRED_CONFIG, ...SECRET_MANIFEST.required].filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(`[secrets] Missing required configuration/secrets: ${missing.join(', ')}`);
    throw new Error(`Missing required configuration/secrets: ${missing.join(', ')}`);
  }
}

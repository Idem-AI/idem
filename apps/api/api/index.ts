/**
 * Process entry point: load the secrets, THEN load the server.
 *
 * `server.ts` statically imports the whole application, and several of its
 * modules read a secret when they are first imported: the Redis client
 * (REDIS_PASSWORD), the iDeploy pool (IDEPLOY_DB_PASSWORD), the mail transport
 * (SMTP_PASS), the deployment service (SENSITIVE_VARS_ENCRYPTION_KEY, which
 * silently falls back to a default key), the signed URLs (JWT_SECRET) and the
 * GitHub service (GITHUB_CLIENT_SECRET, GITHUB_STATE_SECRET).
 *
 * Static imports are hoisted above any `await`, so a `loadSecrets()` call
 * inside `server.ts` always runs after them: with the secrets in Infisical
 * rather than in the container environment, those modules would freeze an
 * empty value. Importing `server.ts` dynamically, once the secrets are in
 * `process.env`, removes the whole class of problem. (In development the
 * environment already holds them before the process starts, which hides it.)
 *
 * Keep this file free of imports that read the environment.
 */
import { loadSecrets } from './config/secrets';

loadSecrets()
  .then(() => import('./server'))
  .catch((err) => {
    console.error('Fatal bootstrap error:', err);
    setTimeout(() => process.exit(1), 500);
  });

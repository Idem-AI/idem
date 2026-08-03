/**
 * Global test bootstrap. Runs before every test file, so anything it puts in
 * `process.env` is visible to modules that read config at import time
 * (`config/db.config.ts`, `config/redis.config.ts`, …).
 *
 * Two jobs:
 *  1. point the process at the *test* database, never the dev one;
 *  2. guarantee no test leaves a fake SSH executor registered behind it.
 */
import path from 'path';
import dotenv from 'dotenv';
import { afterEach } from 'vitest';
import { resetRemoteExecutor } from '../api/ssh/ssh';

process.env.NODE_ENV = 'test';

// Optional per-developer overrides (host, credentials, …).
dotenv.config({ path: path.resolve(__dirname, '../.env.test'), quiet: true });

// Defaults target the dev Docker network; `.env.test` can override any of them.
process.env.IDEPLOY_DB_HOST ??= 'postgres';
process.env.IDEPLOY_DB_PORT ??= '5432';
process.env.IDEPLOY_DB_USERNAME ??= 'coolify';
process.env.IDEPLOY_DB_PASSWORD ??= 'password';

// The database name is forced, not defaulted: pointing the suite at a
// non-test database would let `truncateAll()` wipe real data.
process.env.IDEPLOY_DB_DATABASE = process.env.TEST_DB_DATABASE ?? 'coolify_test';

// Laravel-compatible crypto needs a key that decodes to exactly 32 bytes
// (aes-256-cbc). Fixed value so encrypted fixtures stay reproducible; it is a
// test key and intentionally not a secret. Decodes to
// "ideploy-test-key-32-bytes-long!!".
process.env.APP_KEY ??= 'base64:aWRlcGxveS10ZXN0LWtleS0zMi1ieXRlcy1sb25nISE=';

// Never reach the real Idem API from a test.
process.env.IDEM_API_URL ??= 'http://idem-api.invalid';

afterEach(() => {
  resetRemoteExecutor();
});

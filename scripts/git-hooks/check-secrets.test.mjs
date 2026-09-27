/**
 * Secret scanner rules. Run: npm run test:git-hooks
 *
 * Fake secrets are assembled at run time (`'AIza' + …`) so that this file does
 * not trip the very scanner it tests when it is committed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FORBIDDEN_FILES, scanLines, stagedAddedLines } from './check-secrets.mjs';

const rand = (n, alphabet = 'aZ3kQ9mX7pL2vB8nR4tY6wE1uI5oP0sD') =>
  Array.from({ length: n }, (_, i) => alphabet[(i * 7 + 3) % alphabet.length]).join('');

const hits = (text) => scanLines('f.ts', [{ line: 1, text }]).map((f) => f.rule);

test('detects real-looking credentials', () => {
  assert.deepEqual(hits(`const k = '${'AIza' + rand(35)}';`), ['google-api-key']);
  assert.deepEqual(hits(`AWS_KEY=${'AKIA' + 'ABCDEFGHIJKLMNOP'}`), ['aws-access-key']);
  assert.deepEqual(hits(`token: '${'ghp_' + rand(36)}'`), ['github-token']);
  assert.deepEqual(hits(`NETLIFY_TOKEN=${'nfp_' + rand(36)}`), ['netlify-token']);
  assert.deepEqual(hits(`APP_KEY=${'base64:' + rand(43)}=`), ['laravel-app-key']);
  assert.deepEqual(hits(`apiToken: '${'4|' + rand(40)}',`), ['sanctum-token']);
  const pk = '"private' + '_key": "' + '-----BEGIN ' + 'PRIVATE KEY-----';
  assert.deepEqual(hits(`${pk}\\n${rand(64)}"`), ['private-key']);
  assert.deepEqual(hits(`MONGODB_URI=mongodb://admin:${rand(16)}@db.prod.internal:27017/idem`), ['url-credentials']);
  assert.deepEqual(hits(`const password = "${rand(20)}";`), ['generic-secret']);
});

test('ignores placeholders, references and local development values', () => {
  assert.deepEqual(hits('GEMINI_API_KEY=your-gemini-api-key'), []);
  assert.deepEqual(hits('INTERNAL_API_KEY=your-secure-api-key-here-change-in-production'), []);
  assert.deepEqual(hits('const apiKey = process.env.GLM_API_KEY;'), []);
  assert.deepEqual(hits("password: config.database.password,"), []);
  assert.deepEqual(hits("MONGODB_URI: 'mongodb://${MONGODB_USERNAME}:${MONGODB_PASSWORD}@mongodb:27017/idem'"), []);
  assert.deepEqual(hits('DATABASE_URL=postgresql://coolify:password@localhost:5432/coolify'), []);
  assert.deepEqual(hits(' * rsa → PKCS#1 PEM (`-----BEGIN RSA PRIVATE KEY-----`)'), []);
  assert.deepEqual(hits(`const state = 'base64:${rand(60)}';`), []);
  assert.deepEqual(hits('const passwordField = document.querySelector(input);'), []);
});

test('honours the allow pragma', () => {
  assert.deepEqual(hits(`const k = '${'AIza' + rand(35)}'; // idem-secrets:allow public web key`), []);
});

test('blocks sensitive files by name, not examples', () => {
  const blocked = (p) => FORBIDDEN_FILES.some((r) => r.test(p));
  for (const p of ['.env', 'apps/api/.env.production', 'apps/api/.env.secret', 'certs/privkey1.pem',
    'service-accounts/idem-api-secrets.json', 'lexis-ia-service-account.json', 'home/id_rsa']) {
    assert.equal(blocked(p), true, p);
  }
  for (const p of ['.env.example', 'apps/api/.env.production.example', 'home/id_rsa.pub',
    'scripts/secrets/idem-secrets.mjs', 'apps/api/api/config/secrets.manifest.ts']) {
    assert.equal(blocked(p), false, p);
  }
});

test('reads only added lines with their line numbers', () => {
  const diff = [
    'diff --git a/x.ts b/x.ts',
    '--- a/x.ts',
    '+++ b/x.ts',
    '@@ -10,2 +10,3 @@',
    ' kept',
    '-removed',
    '+added one',
    '+added two',
  ].join('\n');
  assert.deepEqual(stagedAddedLines(diff).get('x.ts'), [
    { line: 11, text: 'added one' },
    { line: 12, text: 'added two' },
  ]);
});

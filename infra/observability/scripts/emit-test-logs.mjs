#!/usr/bin/env node
/**
 * Écrit des journaux de démonstration au format IDEM pour tester Grafana sans
 * lancer les services : trafic HTTP normal, quelques 4xx/5xx, une génération
 * IA, un déploiement raté — et, avec --critical, un incident qui déclenche
 * l'e-mail d'alerte (visible dans Mailpit, http://localhost:8025).
 *
 *   node scripts/emit-test-logs.mjs              # 2 minutes de trafic
 *   node scripts/emit-test-logs.mjs --critical   # + un paiement non livré
 *   node scripts/emit-test-logs.mjs --burst-5xx  # + 10 erreurs 5xx (alerte 5xx)
 *   node scripts/emit-test-logs.mjs --seconds 30
 *
 * Les lignes vont dans infra/observability/test-logs/<service>/combined.log,
 * que Alloy collecte comme les vrais fichiers. Le format est celui de
 * apps/api/api/config/log-format.ts.
 */
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import os from 'node:os';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const secondsArg = args.indexOf('--seconds');
const seconds = secondsArg >= 0 ? Number(args[secondsArg + 1]) : 120;

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'test-logs');

function write(service, level, message, fields = {}) {
  const line = {
    level,
    message,
    service,
    environment: 'development',
    version: 'demo',
    host: os.hostname(),
    pid: process.pid,
    timestamp: new Date().toISOString(),
    ...fields,
  };
  const file = join(root, service, 'combined.log');
  mkdirSync(dirname(file), { recursive: true });
  appendFileSync(file, `${JSON.stringify(line)}\n`);
}

const pick = (list) => list[Math.floor(Math.random() * list.length)];

const ROUTES = {
  'idem-api': [
    ['GET', '/projects', '/projects/'],
    ['GET', '/project/p_42/branding', '/project/:projectId/branding'],
    ['POST', '/project/advisor/p_42/messages', '/project/advisor/:projectId/messages'],
    ['POST', '/billing/consume', '/billing/consume'],
    ['GET', '/auth/me', '/auth/me'],
  ],
  'ideploy-api': [
    ['GET', '/api/v1/applications', '/api/v1/applications/'],
    ['POST', '/api/v1/deploy', '/api/v1/deploy/'],
    ['GET', '/api/v1/servers/s_1/resources', '/api/v1/servers/:uuid/resources'],
  ],
  appgen: [
    ['POST', '/api/chat', '/api/chat/'],
    ['GET', '/api/model', '/api/model/'],
  ],
};

function request(service, { status, durationMs, error } = {}) {
  const [method, path, route] = pick(ROUTES[service]);
  const requestId = randomUUID();
  const userId = pick(['u_amina', 'u_kofi', 'u_ndeye', 'u_tunde']);
  const statusCode = status ?? pick([200, 200, 200, 200, 201, 204, 304, 400, 401, 404]);
  const duration = durationMs ?? Math.round(20 + Math.random() * (route.includes('chat') || route.includes('advisor') ? 9000 : 400));
  const base = { requestId, userId };
  write(service, 'info', 'http.request_start', { ...base, event: 'http.request_start', method, path, ip: '41.202.1.7' });
  if (error) {
    write(service, 'error', error.message, { ...base, event: error.event, error });
  }
  const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
  write(service, level, 'http.request_end', {
    ...base,
    event: 'http.request_end',
    method,
    path,
    route,
    statusCode,
    statusClass: `${Math.floor(statusCode / 100)}xx`,
    durationMs: duration,
    ip: '41.202.1.7',
  });
  return requestId;
}

function upstreamError() {
  return {
    event: 'ai.model_call_failed',
    type: 'AxiosError',
    message: 'Request failed with status code 503',
    stack: 'AxiosError: Request failed with status code 503\n    at settle (node_modules/axios/lib/core/settle.js:19:12)',
    upstream: { status: 503, method: 'POST', url: 'https://api.z.ai/api/paas/v4/chat/completions' },
  };
}

function tick() {
  for (const service of Object.keys(ROUTES)) {
    for (let i = 0; i < 3; i++) request(service);
  }
  if (Math.random() < 0.3) {
    request('appgen', { status: 502, error: { ...upstreamError() } });
  }
  if (Math.random() < 0.2) {
    const jobId = `dep_${Math.floor(Math.random() * 1000)}`;
    write('ideploy-api', 'info', 'job.started', { event: 'job.started', queue: 'deployments', jobId, attempt: 1, maxAttempts: 3 });
    write('ideploy-api', 'error', 'job.failed', {
      event: 'job.failed',
      queue: 'deployments',
      jobId,
      attempt: 3,
      maxAttempts: 3,
      error: { type: 'Error', message: 'docker compose up exited with code 1', stack: 'Error: docker compose up exited with code 1\n    at runCompose (api/jobs/deployment.worker.ts:212:11)' },
    });
  }
}

console.log(`Écriture de journaux de démonstration pendant ${seconds}s dans ${root}`);

if (flag('--critical')) {
  const requestId = randomUUID();
  write('idem-api', 'error', 'payment.fulfillment_failed', {
    event: 'payment.fulfillment_failed',
    alert: 'critical',
    requestId,
    userId: 'u_amina',
    transactionId: 'tx_demo_001',
    depositId: 'dep_demo_001',
    source: 'callback',
    error: { type: 'MongoServerError', message: 'Credit balance update failed: write conflict', stack: 'MongoServerError: write conflict\n    at creditLedgerService.grant (api/services/billing/credit-ledger.service.ts:88:13)' },
  });
  console.log(`→ incident critique écrit (requestId ${requestId}) : e-mail attendu dans Mailpit sous ~1 min.`);
}

if (flag('--burst-5xx')) {
  for (let i = 0; i < 10; i++) {
    request('idem-api', {
      status: 500,
      error: { event: 'http.unhandled_error', type: 'TypeError', message: "Cannot read properties of undefined (reading 'sections')", stack: "TypeError: Cannot read properties of undefined (reading 'sections')\n    at ProjectService.getProject (api/services/project.service.ts:141:27)" },
    });
  }
  console.log('→ 10 réponses 5xx écrites : alerte « Erreurs serveur (5xx) » attendue sous ~1 min.');
}

tick();
const timer = setInterval(tick, 2000);
setTimeout(() => {
  clearInterval(timer);
  console.log('Terminé.');
}, seconds * 1000);

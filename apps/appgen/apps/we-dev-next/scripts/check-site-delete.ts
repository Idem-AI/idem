/**
 * Contrôle de « Supprimer le site » côté serveur iCode (`POST /api/ideploy/site/delete`) — contre un faux iDeploy,
 * sans réseau ni modèle.
 *
 *   npm run check:site-delete
 *
 * Vérifie l'ordre (interface, serveur, site, base, espace de travail), qu'une ressource déjà absente compte comme
 * supprimée, qu'un espace de travail non vide est gardé, et qu'un refus (mise en ligne en cours) arrête tout et
 * remonte tel quel.
 */
import http from 'http';
import type { AddressInfo } from 'net';
import express from 'express';

type Reply = { status: number; body: unknown };
let calls: string[] = [];
let replies: Record<string, Reply> = {};

const fake = http.createServer((req, res) => {
  const key = `${req.method} ${req.url}`;
  calls.push(key);
  const reply = replies[key] ?? { status: 200, body: { success: true, data: { deleted: true } } };
  res.writeHead(reply.status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(reply.body));
});

let failed = 0;
const check = (label: string, ok: boolean, detail = '') => {
  if (!ok) failed += 1;
  console.log(`${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
};

(async () => {
  await new Promise<void>((resolve) => fake.listen(0, '127.0.0.1', resolve));
  process.env.IDEPLOY_API_URL = `http://127.0.0.1:${(fake.address() as AddressInfo).port}`;
  const { default: router } = await import('../src/routes/ideploy.js');
  const app = express();
  app.use(express.json());
  app.use('/api/ideploy', router);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/ideploy/site/delete`;
  const post = async (ideploy: unknown) => {
    const response = await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ideploy }) });
    return { status: response.status, body: (await response.json()) as { success: boolean; results: { resource: string; outcome: string }[]; code?: string } };
  };

  // 1. Site statique : une seule application.
  calls = [];
  replies = {};
  let r = await post({ mode: 'static', applicationUuid: 'app-1' });
  check('statique : l’application est supprimée', r.status === 200 && r.body.success && calls.join('|') === 'DELETE /api/v1/applications/app-1', calls.join('|'));

  // 2. Application complète : ordre, base, espace de travail non vide gardé, ressource déjà absente.
  calls = [];
  replies = {
    'DELETE /api/v1/applications/back-1': { status: 404, body: { success: false, error: { code: 'NOT_FOUND', message: 'Application not found' } } },
    'DELETE /api/v1/workspaces/ws-1': { status: 409, body: { success: false, error: { code: 'WORKSPACE_NOT_EMPTY', message: 'not empty' } } },
  };
  r = await post({ mode: 'fullstack', frontendUuid: 'front-1', backendUuid: 'back-1', databaseUuid: 'db-1', workspaceUuid: 'ws-1' });
  check(
    'complète : interface, serveur, base, puis espace de travail',
    calls.join('|') === 'DELETE /api/v1/applications/front-1|DELETE /api/v1/applications/back-1|DELETE /api/v1/databases/postgresql/db-1|DELETE /api/v1/workspaces/ws-1',
    calls.join(' | ')
  );
  check('complète : réussite malgré un serveur déjà absent et un espace gardé', r.status === 200 && r.body.success);
  check(
    'complète : chaque issue rendue',
    JSON.stringify(r.body.results) === JSON.stringify([
      { resource: 'frontend', outcome: 'deleted' },
      { resource: 'backend', outcome: 'absent' },
      { resource: 'database', outcome: 'deleted' },
      { resource: 'workspace', outcome: 'kept' },
    ]),
    JSON.stringify(r.body.results)
  );

  // 3. Mise en ligne en cours : tout s'arrête, le refus remonte.
  calls = [];
  replies = { 'DELETE /api/v1/applications/front-2': { status: 409, body: { success: false, error: { code: 'DEPLOYMENT_IN_PROGRESS', message: 'A deployment is running' } } } };
  r = await post({ mode: 'fullstack', frontendUuid: 'front-2', backendUuid: 'back-2', databaseUuid: 'db-2' });
  check('mise en ligne en cours : refus rendu (409, code)', r.status === 409 && !r.body.success && r.body.code === 'DEPLOYMENT_IN_PROGRESS');
  check('mise en ligne en cours : rien d’autre n’est supprimé', calls.length === 1, calls.join(' | '));

  // 4. Identifiants douteux : ignorés, jamais envoyés.
  calls = [];
  replies = {};
  r = await post({ applicationUuid: '../../servers/1', databaseUuid: 'db 1;rm' });
  check('identifiants douteux ignorés', r.status === 200 && calls.length === 0, calls.join(' | '));

  server.close();
  fake.close();
  console.log(failed ? `\n${failed} contrôle(s) en échec` : '\nTout est bon');
  process.exit(failed ? 1 : 0);
})();

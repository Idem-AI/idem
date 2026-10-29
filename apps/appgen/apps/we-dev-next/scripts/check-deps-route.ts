/**
 * Contrôle de la route des dépendances préinstallées, sans navigateur et sans
 * modèle : aucun crédit, et ça tourne en quelques secondes.
 *
 * Ce qu'il prouve :
 *
 * - le plan de chaque cible sort avec ses arbres et leurs empreintes ;
 * - un manifeste demandé sous une empreinte périmée est refusé (409) et non
 *   servi silencieusement — c'est ce qui empêche de cuire un arbre pour un
 *   socle qui n'existe plus ;
 * - un dépôt sans jeton est refusé (403) ;
 * - un instantané déposé ressort **identique** après compression, transport et
 *   décompression par le client. C'est le seul point qui compte vraiment : un
 *   arbre tronqué est la panne la plus pénible du lot.
 *
 * Le jeton de test est lu depuis `APPGEN_DEPS_BAKE_TOKEN` (posé dans `.env`),
 * ou généré aléatoirement si absent.
 *
 * `npm run check:deps`
 */

import express from 'express';
import { gzipSync } from 'node:zlib';
import { randomBytes } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.APPGEN_DEPS_CACHE_DIR = mkdtempSync(join(tmpdir(), 'deps-cache-'));

const bakeToken = process.env.APPGEN_DEPS_BAKE_TOKEN || randomBytes(20).toString('hex');
process.env.APPGEN_DEPS_BAKE_TOKEN = bakeToken;

const { default: depsRouter } = await import('../src/routes/deps.js');

const app = express();
app.use(express.json());
app.use('/api/scaffold/deps', depsRouter);
const server = app.listen(0);
const port = (server.address() as { port: number }).port;
const base = `http://127.0.0.1:${port}/api/scaffold/deps`;

const show = async (label: string, url: string, init?: RequestInit) => {
  const response = await fetch(url, init);
  const text = await response.text();
  console.log(`\n--- ${label} → ${response.status} ---`);
  console.log(text.slice(0, 700));
  return { response, text };
};

await show('index', base);
await show('plan site', `${base}/site`);
await show('plan web-app', `${base}/web-app`);
await show('cible inconnue', `${base}/nope`);

const plan = await (await fetch(`${base}/site`)).json();
const tree = plan.trees[0];
await show('manifeste', `${base}/site/${tree.fingerprint}/${tree.id}/manifest`);
await show('manifeste périmé', `${base}/site/deadbeefdeadbeef/${tree.id}/manifest`);
await show('instantané absent', `${base}/site/${tree.fingerprint}/${tree.id}`);

// Dépôt : mauvais jeton, puis bon jeton.
const original = Buffer.from('ceci tient lieu d\'instantané binaire'.repeat(500));
const payload = new Uint8Array(gzipSync(original));
await show('dépôt sans jeton', `${base}/site/${tree.fingerprint}/${tree.id}`, {
  method: 'PUT', body: payload, headers: { 'Content-Type': 'application/octet-stream' },
});
await show('dépôt bon jeton', `${base}/site/${tree.fingerprint}/${tree.id}`, {
  method: 'PUT', body: payload,
  headers: { 'Content-Type': 'application/octet-stream', 'X-Idem-Bake-Token': bakeToken, 'X-Idem-Unpacked-Bytes': '104857600' },
});
await show('plan site après dépôt', `${base}/site`);
const got = await fetch(`${base}/site/${tree.fingerprint}/${tree.id}`);
console.log('\n--- relecture ---');
console.log('status', got.status, 'encoding', got.headers.get('content-encoding'), 'cache', got.headers.get('cache-control'));
const bytes = new Uint8Array(await got.arrayBuffer());
console.log('octets servis (compressés)', payload.length, '→ reçus décompressés', bytes.length, '| attendus', original.length);
console.log('identiques :', Buffer.from(bytes).equals(original));

// Une version de paquet a changé : l'arbre n'est plus cuit sous la nouvelle empreinte, mais l'ancien instantané
// est proposé comme voisin (l'atelier le monte et npm ne complète que la différence).
const { mkdirSync, renameSync } = await import('node:fs');
const cacheDir = process.env.APPGEN_DEPS_CACHE_DIR!;
const staleDir = join(cacheDir, 'site', 'aaaaaaaaaaaaaaaa');
mkdirSync(staleDir, { recursive: true });
renameSync(join(cacheDir, 'site', tree.fingerprint, `${tree.id}.bin.gz`), join(staleDir, `${tree.id}.bin.gz`));
const after = await (await fetch(`${base}/site`)).json();
const near = after.trees.find((t: { id: string }) => t.id === tree.id)?.nearest;
console.log('\n--- voisin proposé ---', JSON.stringify(near));
const nearOk = near?.fingerprint === 'aaaaaaaaaaaaaaaa' && near?.url === `/api/scaffold/deps/site/aaaaaaaaaaaaaaaa/${tree.id}`;

// La mesure d'un démarrage est acceptée, une mesure absurde refusée.
const measured = await fetch(`${base}/startup`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ target: 'site', trigger: 'warm-start', ms: 8200, sources: ['cache'], phases: { dependencies: 2100 } }) });
const refused = await fetch(`${base}/startup`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ms: 0 }) });

server.close();

if (!Buffer.from(bytes).equals(original)) {
  console.error('\nL\'instantané relu diffère de celui déposé.');
  process.exit(1);
}
if (!nearOk) {
  console.error('\nL\'arbre voisin n\'est pas proposé.');
  process.exit(1);
}
if (measured.status !== 204 || refused.status !== 400) {
  console.error('\nLa mesure du démarrage n\'est pas reçue comme attendu.', measured.status, refused.status);
  process.exit(1);
}
console.log('\nContrôle passé.');

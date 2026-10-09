/**
 * La passerelle d'iVision (`/internal/ivision`) — `npm run check:ivision`.
 *
 * Sans base ni modèle : la clé de service (absente → 503, fausse → 403, aucune autre clé
 * acceptée), la validation des débits (actions d'iVision seulement, montant borné) et le
 * barème servi (celui d'IDEM, le même que ses routes).
 */
import express from 'express';
import http from 'http';
import { BUSINESS_CREDIT_COSTS } from '../models/billing.model';

let failures = 0;
const check = (label: string, ok: boolean, detail = '') => {
  if (!ok) failures++;
  console.log(`  ${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
};

(async () => {
  console.log('Passerelle iVision\n');
  process.env.INTERNAL_API_KEY = 'admin-key';
  delete process.env.IVISION_SERVICE_KEY;
  const { default: routes } = await import('../routes/ivision.routes');
  const app = express();
  app.use(express.json());
  app.use('/internal/ivision', routes);
  const server = await new Promise<http.Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const base = `http://127.0.0.1:${(server.address() as any).port}/internal/ivision`;
  const call = async (method: string, path: string, key?: string, body?: object) => {
    const res = await fetch(`${base}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(key ? { 'x-ivision-key': key } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  try {
    check('clé non configurée : 503 (jamais ouverte par défaut)', (await call('GET', '/billing/prices', 'anything')).status === 503);
    process.env.IVISION_SERVICE_KEY = 'service-key';
    check('sans clé : 403', (await call('GET', '/billing/prices')).status === 403);
    check('fausse clé : 403', (await call('GET', '/billing/prices', 'nope')).status === 403);
    check('la clé d’administration n’ouvre pas la passerelle', (await call('GET', '/billing/prices', 'admin-key')).status === 403);
    const prices = await call('GET', '/billing/prices', 'service-key');
    check(`barème d'IDEM servi (vidéo ${prices.body?.motion_video}, visuel ${prices.body?.flyer})`, prices.status === 200 && prices.body.motion_video === BUSINESS_CREDIT_COSTS.motion_video && prices.body.flyer === BUSINESS_CREDIT_COSTS.flyer && prices.body.creativity?.ultra === 2);
    check('débit d’une action hors iVision refusé', (await call('POST', '/billing/charge', 'service-key', { userId: 'u', action: 'logo_brand', cost: 5 })).status === 400);
    check('débit démesuré refusé', (await call('POST', '/billing/charge', 'service-key', { userId: 'u', action: 'motion_video', cost: 1e6 })).status === 400);
    check('débit sans utilisateur refusé', (await call('POST', '/billing/charge', 'service-key', { action: 'flyer', cost: 2 })).status === 400);
    check('restitution négative refusée', (await call('POST', '/billing/refund', 'service-key', { userId: 'u', action: 'flyer', cost: -2 })).status === 400);
    check('profil d’agent inconnu refusé', (await call('POST', '/ai/agent', 'service-key', { userId: 'u', profile: 'root', system: 's', user: 'u' })).status === 400);
    // Les profils du moteur partagé passent la validation (l'appel lui-même échoue ici, sans modèle).
    for (const profile of ['agents', 'critic', 'coder']) check(`profil « ${profile} » accepté`, (await call('POST', '/ai/agent', 'service-key', { userId: 'u', profile, system: 's', user: 'u' })).status !== 400);
    check('image de vision invalide refusée', (await call('POST', '/ai/vision', 'service-key', { base64: 'x', mimeType: 'text/html' })).status === 400);
  } finally {
    server.close();
  }
  console.log(failures ? `\n✗ ${failures} vérification(s) en échec.` : '\n✓ Passerelle iVision : fermée par défaut, bornée, au barème d’IDEM.');
  process.exit(failures ? 1 : 0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});

/**
 * iVision SANS l'API IDEM — `npm run dev:offline` (dans apps/ivision/api).
 *
 * Pour travailler l'interface sans modèles ni crédits réels : un IDEM simulé (identité,
 * modèles à réponses écrites, portefeuille en mémoire) et un petit site de démonstration à
 * scanner. L'API iVision est la vraie, sur MongoDB et MinIO de développement (base
 * `ivision_dev`). Dans le navigateur, posez le cookie `session=good` sur `localhost`.
 *
 *   IDEM simulé   http://localhost:3901   (SERVICES_API_URL du front)
 *   site démo     http://localhost:3902   (à coller dans la conversation)
 *   API iVision   http://localhost:3006
 *
 * `IVISION_OFFLINE_RESET=1` vide la base `ivision_dev` au démarrage.
 */
import fs from 'fs';
import http from 'http';
import path from 'path';
import dotenv from 'dotenv';
import { startFakeIdem } from './fake-idem';

const devEnv = ['.env', '.env.secret'].reduce<Record<string, string>>((acc, name) => {
  try {
    return { ...acc, ...dotenv.parse(fs.readFileSync(path.resolve(__dirname, '../../../api', name))) };
  } catch {
    return acc;
  }
}, {});
for (const k of ['MONGODB_PASSWORD', 'MONGODB_USERNAME', 'MINIO_ENDPOINT', 'MINIO_PORT', 'MINIO_ACCESS_KEY', 'MINIO_SECRET_KEY', 'MINIO_BUCKET_NAME', 'MINIO_PUBLIC_URL', 'MINIO_USE_SSL']) if (devEnv[k] && !process.env[k]) process.env[k] = devEnv[k];
delete process.env.MONGODB_URI;
process.env.MONGODB_DATABASE = process.env.MONGODB_DATABASE_OFFLINE || 'ivision_dev';
process.env.USE_SECRET_MANAGER = 'false';
process.env.IVISION_SERVICE_KEY = 'offline-key';
process.env.RENDER_ALLOWED_HOSTS = '127.0.0.1,localhost';
process.env.IVISION_API_URL = process.env.IVISION_API_URL || 'http://localhost:3006';

const DEMO_SITE = `<!doctype html><html lang="fr"><head><title>Kora Café — Torréfacteur à Abidjan</title>
<meta name="description" content="Café de spécialité torréfié chaque semaine à Abidjan, livré chez vous."><meta property="og:site_name" content="Kora Café"><meta name="theme-color" content="#b4532a">
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Inter:wght@400;600&display=swap" rel="stylesheet">
<style>body{margin:0;background:#fbf7f2;color:#2a1d17;font-family:Inter,Arial,sans-serif}header{display:flex;justify-content:space-between;align-items:center;padding:24px 48px}h1,h2{font-family:'Playfair Display',Georgia,serif}h1{font-size:64px;margin:0}
.hero{padding:96px 48px}.cta{display:inline-block;background:#b4532a;color:#fff;padding:18px 32px;font-weight:700;text-decoration:none}section.dark{background:#3b2a22;color:#fbf7f2;padding:80px 48px}</style></head><body>
<header><a href="/" class="logo"><svg class="logo" width="120" height="40" viewBox="0 0 120 40"><circle cx="20" cy="20" r="16" fill="#b4532a"/><rect x="44" y="12" width="70" height="16" fill="#2a1d17"/></svg></a><nav><a href="/a-propos">À propos</a></nav></header>
<div class="hero"><h1>Le café qui réveille Abidjan</h1><p>Des grains d'Afrique de l'Ouest, torréfiés chaque semaine à Cocody, livrés en 24 h partout à Abidjan.</p><a class="cta" href="#">Commander</a></div>
<section class="dark"><h2>Torréfié ici, chaque lundi</h2><p>En direct avec les coopératives de Man et de Daloa.</p></section></body></html>`;

(async () => {
  const idem = await startFakeIdem({ port: Number(process.env.FAKE_IDEM_PORT) || 3901, key: 'offline-key' });
  process.env.IDEM_API_URL = idem.url;
  http
    .createServer((req, res) => {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(req.url?.startsWith('/a-propos') ? DEMO_SITE.replace('Le café qui réveille Abidjan', 'Notre histoire') : DEMO_SITE);
    })
    .listen(Number(process.env.DEMO_SITE_PORT) || 3902, '127.0.0.1');

  const { connectDatabase } = await import('../src/config/db');
  await connectDatabase();
  // `IVISION_OFFLINE_RESET=1` : on repart d'une base vide (aucune marque, aucune conversation).
  if (process.env.IVISION_OFFLINE_RESET === '1') {
    const mongoose = (await import('mongoose')).default;
    await mongoose.connection.db!.dropDatabase();
  }
  const { configureCoreForIvision, syncPricesFromIdem } = await import('../src/core-host');
  configureCoreForIvision();
  await syncPricesFromIdem();
  const { syncBasePrices } = await import('../src/services/billing');
  await syncBasePrices();
  const { createApp } = await import('../src/app');
  const port = Number(process.env.PORT) || 3006;
  createApp().listen(port, () => {
    console.log(`\niVision hors ligne\n  API iVision  http://localhost:${port}\n  IDEM simulé  ${idem.url}\n  site démo    http://localhost:${Number(process.env.DEMO_SITE_PORT) || 3902}\n  cookie       session=good (domaine localhost)\n`);
  });
})().catch((error) => {
  console.error(error);
  process.exit(1);
});

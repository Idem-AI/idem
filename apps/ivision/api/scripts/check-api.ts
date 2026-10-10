/**
 * L'API iVision de bout en bout — `npm run check` (dans apps/ivision/api).
 *
 * Un faux IDEM (identité, passerelle de modèles et de crédits) et un faux site tournent en
 * local ; l'API iVision, elle, est la vraie : MongoDB et MinIO de développement (base
 * `ivision_check`, effacée à la fin), moteur partagé, rendu Chromium, ffmpeg.
 *
 * Parcours vérifiés : marque demandée → site scanné → palette choisie → modèle demandé →
 * vidéo modèle analysée → vidéo reproduite (débit au prix d'IDEM) → aperçu avec pont
 * d'édition → retouche ; visuel en mode images ; refus faute de crédits ; session refusée.
 */
import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import dotenv from 'dotenv';
import { startFakeIdem } from './fake-idem';

let passes = 0;
let failures = 0;
function check(label: string, ok: boolean, detail = '') {
  if (ok) passes++;
  else failures++;
  console.log(`  ${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
}
const section = (t: string) => console.log(`\n${t}`);

// ─── Environnement : services de développement d'IDEM, base dédiée ──────────
// Le `.env` de l'API IDEM, puis son `.env.secret` (mots de passe locaux).
const devEnv = ['.env', '.env.secret'].reduce<Record<string, string>>((acc, name) => {
  try {
    return { ...acc, ...dotenv.parse(fs.readFileSync(path.resolve(__dirname, '../../../api', name))) };
  } catch {
    return acc;
  }
}, {});
for (const k of ['MONGODB_PASSWORD', 'MONGODB_USERNAME', 'MINIO_ENDPOINT', 'MINIO_PORT', 'MINIO_ACCESS_KEY', 'MINIO_SECRET_KEY', 'MINIO_BUCKET_NAME', 'MINIO_PUBLIC_URL', 'MINIO_USE_SSL']) if (devEnv[k] && !process.env[k]) process.env[k] = devEnv[k];
delete process.env.MONGODB_URI;
process.env.MONGODB_DATABASE = 'ivision_check';
process.env.USE_SECRET_MANAGER = 'false';
process.env.IVISION_SERVICE_KEY = 'check-key';
process.env.RENDER_ALLOWED_HOSTS = '127.0.0.1,localhost';
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'warn';

const SITE = `<!doctype html><html lang="fr"><head><title>Kora Café — Torréfacteur à Abidjan</title>
<meta name="description" content="Café de spécialité torréfié chaque semaine à Abidjan, livré chez vous.">
<meta property="og:site_name" content="Kora Café"><meta name="theme-color" content="#b4532a">
<style>body{margin:0;background:#fbf7f2;color:#2a1d17;font-family:Georgia,serif}h1{font-family:'Playfair Display',Georgia,serif;font-size:64px}
.cta{display:inline-block;background:#b4532a;color:#fff;padding:18px 32px;font-family:Arial,sans-serif;font-weight:700}p{font-family:Inter,Arial,sans-serif}</style></head><body>
<header><a href="/" class="logo"><svg class="logo" width="120" height="40" viewBox="0 0 120 40"><circle cx="20" cy="20" r="16" fill="#b4532a"/><rect x="44" y="12" width="70" height="16" fill="#2a1d17"/></svg></a></header>
<div class="hero"><h1>Le café qui réveille Abidjan</h1><p>Des grains torréfiés chaque semaine à Cocody, livrés en 24 h partout à Abidjan.</p><a class="cta" href="#">Commander</a></div>
</body></html>`;

function serveSite(): Promise<{ url: string; close: () => void }> {
  return new Promise((resolve) => {
    const server = http.createServer((_req, res) => {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(SITE);
    });
    server.listen(0, '127.0.0.1', () => resolve({ url: `http://127.0.0.1:${(server.address() as any).port}/`, close: () => server.close() }));
  });
}

/** Une vidéo modèle synthétique : trois aplats coupés net (2 s, 3 s, 2,5 s). */
function syntheticVideo(file: string) {
  const seg = (color: string, d: number, i: number) => `color=c=${color}:s=540x960:d=${d},format=yuv420p[b${i}];color=c=white:s=120x120:d=${d}[w${i}];[b${i}][w${i}]overlay=x='40+t*120':y=400[v${i}]`;
  const filter = `${seg('0xb4532a', 2, 0)};${seg('0x2a6fb4', 3, 1)};${seg('0x3bb45a', 2.5, 2)};[v0][v1][v2]concat=n=3:v=1:a=0[out]`;
  const r = spawnSync(process.env.FFMPEG_PATH || 'ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-filter_complex', filter, '-map', '[out]', '-r', '30', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', file]);
  if (r.status !== 0) throw new Error(`ffmpeg: ${r.stderr}`);
}

/** Un tour de conversation en flux : tous les événements, dans l'ordre. */
async function turn(api: string, cookie: string, sessionId: string, body: object): Promise<any[]> {
  const res = await fetch(`${api}/v1/sessions/${sessionId}/turn`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify(body) });
  const text = await res.text();
  return text
    .split('\n\n')
    .filter((l) => l.startsWith('data: '))
    .map((l) => JSON.parse(l.slice(6)));
}

(async () => {
  console.log('API iVision — de bout en bout, avec un faux IDEM\n');
  const idemServer = await startFakeIdem();
  const { charges, refunds } = idemServer;
  const site = await serveSite();
  process.env.IDEM_API_URL = idemServer.url;

  const { connectDatabase } = await import('../src/config/db');
  const mongoose = (await import('mongoose')).default;
  await connectDatabase();
  await mongoose.connection.db!.dropDatabase();
  const { configureCoreForIvision, syncPricesFromIdem } = await import('../src/core-host');
  configureCoreForIvision();
  await syncPricesFromIdem();
  const { syncBasePrices } = await import('../src/services/billing');
  await syncBasePrices();
  const { createApp } = await import('../src/app');
  const server = await new Promise<http.Server>((resolve) => {
    const s = createApp().listen(0, '127.0.0.1', () => resolve(s));
  });
  const api = `http://127.0.0.1:${(server.address() as any).port}`;
  process.env.IVISION_API_URL = api;
  const good = 'session=good';
  const json = async (method: string, p: string, body?: object, cookie = good) => {
    const res = await fetch(`${api}${p}`, { method, headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, body: res.status === 204 ? null : await res.json().catch(() => null) };
  };

  try {
    section('1. Identité déléguée à IDEM');
    check('sans session : 401', (await json('GET', '/v1/me', undefined, '')).status === 401);
    const me = await json('GET', '/v1/me');
    check(`session IDEM reconnue (${me.body?.user?.uid}, ${me.body?.credits} crédits)`, me.status === 200 && me.body.user.uid === 'check-user' && me.body.credits === 500);

    section('2. Conversation vidéo : marque, site, palette, modèle');
    const session = (await json('POST', '/v1/sessions', { mode: 'video' })).body;
    check('conversation créée en mode vidéo', session?.mode === 'video');
    let events = await turn(api, good, session.id, { text: 'Une vidéo pour fêter nos 500 clients' });
    let asked = events.find((e) => e.type === 'message' && e.message.role === 'assistant')?.message;
    check('sans marque : l’assistant la demande', asked?.ask?.kind === 'brand', asked?.text);

    events = await turn(api, good, session.id, { text: `Mon site : ${site.url} — une vidéo pour fêter nos 500 clients chaque mois` });
    const brand = events.find((e) => e.type === 'brand')?.brand;
    asked = events.filter((e) => e.type === 'message' && e.message.role === 'assistant').pop()?.message;
    check(`site scanné : ${brand?.name}, primaire ${brand?.palette?.primary}`, brand?.name === 'Kora Café' && brand?.palette?.primary === '#b4532a');
    check('trois palettes et trois typographies proposées', brand?.proposals?.palettes?.length === 3 && brand?.proposals?.typographies?.length === 3);
    check('l’assistant demande de choisir (la demande attend)', asked?.ask?.kind === 'brand-choice' && (await json('GET', `/v1/sessions/${session.id}`)).body.pending?.text?.includes('500 clients'));

    const chosen = await json('POST', `/v1/brands/${brand.id}/choose`, { palette: 'contrast' });
    check('palette « contraste » choisie, marque prête', chosen.body?.status === 'ready' && chosen.body.palette.primary === brand.proposals.palettes.find((p: any) => p.id === 'contrast').colors.primary);

    events = await turn(api, good, session.id, { resume: true });
    asked = events.find((e) => e.type === 'message')?.message;
    check('reprise : l’assistant demande une vidéo modèle', asked?.ask?.kind === 'reference' && asked.ask.mode === 'video');

    section('3. Vidéo modèle analysée puis reproduite');
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ivision-api-check-'));
    const file = path.join(tmp, 'modele.mp4');
    syntheticVideo(file);
    const form = new FormData();
    form.append('file', new Blob([fs.readFileSync(file)], { type: 'video/mp4' }), 'modele.mp4');
    const uploaded = await (await fetch(`${api}/v1/references`, { method: 'POST', headers: { Cookie: good }, body: form })).json();
    check('modèle déposé, analyse lancée', uploaded?.status === 'analyzing');
    let ref: any = uploaded;
    for (let i = 0; i < 80 && ref.status === 'analyzing'; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      ref = (await json('GET', `/v1/references/${uploaded.id}`)).body;
    }
    check(`modèle analysé : ${ref.shots?.length} plans (${ref.shots?.map((s: any) => s.duration).join(' + ')} s)`, ref.status === 'ready' && ref.shots?.length === 3);
    const sheet = await fetch(`${api}/v1/references/${ref.id}/sheets/0`, { headers: { Cookie: good } });
    check('planche du premier plan servie (JPEG)', sheet.status === 200 && sheet.headers.get('content-type') === 'image/jpeg');

    const before = charges.length;
    events = await turn(api, good, session.id, { resume: true, referenceId: ref.id, options: { durationSec: 15, formats: ['story'], creativity: 'low', musicMood: 'none', sfx: false } });
    const result = events.find((e) => e.type === 'result');
    const stages = [...new Set(events.filter((e) => e.type === 'progress').map((e) => e.stage))];
    check(`progression réelle en direct (${stages.join(', ')})`, stages.length >= 3);
    const video = result?.video;
    check(`vidéo produite : ${video?.storyboard?.scenes?.map((s: any) => s.sceneId).join(' › ')}`, !!video && video.storyboard.scenes.length === 3, events.find((e) => e.type === 'error')?.message);
    check('les plans du modèle sont repris (rapport « reference »)', video?.storyboard?.creative?.reference?.shots === 3);
    const paid = charges.slice(before);
    check(`débit au prix d'IDEM (${paid.map((c) => `${c.action} ${c.cost}`).join(', ')})`, paid.length === 1 && paid[0].action === 'motion_video' && paid[0].cost > 0);
    check('la demande en attente est soldée', !(await json('GET', `/v1/sessions/${session.id}`)).body.pending);

    section('4. Aperçu et retouche en direct');
    const preview = await json('GET', `/v1/brands/${brand.id}/videos/${video.id}/preview`);
    check('aperçu HTML autonome, avec le pont d’édition', preview.status === 200 && preview.body.html.includes('__VIDEO_DATA__') && preview.body.html.includes('ivision:ready'));
    const scene = video.storyboard.scenes.find((s: any) => s.slots?.title) || video.storyboard.scenes[0];
    const slotKey = scene.slots.title !== undefined ? 'title' : Object.keys(scene.slots)[0];
    const patched = await json('PATCH', `/v1/brands/${brand.id}/videos/${video.id}`, { slots: { [scene.key]: { [slotKey]: 'Merci à vous' } } });
    check(`texte retouché (${scene.key}.${slotKey})`, patched.status === 200 && patched.body.storyboard.scenes.find((s: any) => s.key === scene.key).slots[slotKey] === 'Merci à vous');
    const options = await json('GET', '/v1/videos/options');
    check('options vidéo partagées avec IDEM (cases et longueurs)', options.status === 200 && Object.keys(options.body.scenes || {}).length > 5);

    section('5. Conversation images (sans mélange)');
    const imageSession = (await json('POST', '/v1/sessions', { mode: 'image', brandId: brand.id })).body;
    events = await turn(api, good, imageSession.id, { text: 'Soldes de rentrée : -20 % sur tous nos cafés' });
    asked = events.find((e) => e.type === 'message' && e.message.role === 'assistant')?.message;
    check('en mode images, l’assistant demande une IMAGE modèle', asked?.ask?.kind === 'reference' && asked.ask.mode === 'image');
    events = await turn(api, good, imageSession.id, { resume: true, referenceId: ref.id });
    check('une vidéo modèle est refusée en mode images', events.some((e) => e.type === 'message' && e.message.status === 'error'));
    events = await turn(api, good, imageSession.id, { resume: true, noReference: true, options: { format: 'square', creativity: 'low', withPhoto: false } });
    const visual = events.find((e) => e.type === 'result')?.visual;
    check(`visuel composé et rendu (${visual?.layout}, score ${visual?.score})`, !!visual?.imageUrl && visual.score >= 60, events.find((e) => e.type === 'error')?.message);
    check('débit d’un visuel au prix d’IDEM (2 crédits au cran Low)', charges[charges.length - 1]?.action === 'flyer' && charges[charges.length - 1]?.cost === 2);

    section('6. Crédits insuffisants, import IDEM');
    const poorSession = (await json('POST', '/v1/sessions', { mode: 'image' }, 'session=poor')).body;
    const imported = await json('POST', '/v1/brands/import-idem', { projectId: 'p1' }, 'session=poor');
    check('charte d’un projet IDEM importée', imported.status === 201 && imported.body.source === 'idem' && imported.body.palette.primary === '#b4532a');
    await json('PATCH', `/v1/sessions/${poorSession.id}`, { brandId: imported.body.id }, 'session=poor');
    events = await turn(api, 'session=poor', poorSession.id, { text: 'Promo du week-end', noReference: true, options: { creativity: 'low' } });
    const refused = events.find((e) => e.type === 'error');
    check('solde insuffisant : refus avec le détail d’IDEM, demande gardée', refused?.error === 'payment_required' && refused.payment?.missing > 0 && !!(await json('GET', `/v1/sessions/${poorSession.id}`, undefined, 'session=poor')).body.pending);
    check('refus avant débit : rien à restituer', refunds.every((r) => r.userId !== 'poor-user'));
    check('aucune création n’a échoué (aucune restitution)', refunds.length === 0);
    check('la marque d’un autre utilisateur reste privée', (await json('GET', `/v1/brands/${brand.id}`, undefined, 'session=poor')).status === 404);
    fs.rmSync(tmp, { recursive: true, force: true });
  } finally {
    await mongoose.connection.db!.dropDatabase().catch(() => undefined);
    await mongoose.disconnect();
    server.close();
    idemServer.close();
    site.close();
    const { closeRenderBrowser } = await import('../../core/src/video/video.renderer');
    await closeRenderBrowser().catch(() => undefined);
  }
  console.log(`\n${passes} vérifications réussies, ${failures} en échec`);
  process.exit(failures ? 1 : 0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});

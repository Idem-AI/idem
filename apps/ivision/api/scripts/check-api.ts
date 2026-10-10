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
import sharp from 'sharp';
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

/** Un PDF minimal (une page, une ligne de texte) : de quoi vérifier la lecture d'une charte. */
function minimalPdf(text: string): Buffer {
  const esc = text.replace(/[()\\]/g, (c) => `\\${c}`);
  const stream = `BT /F1 12 Tf 40 760 Td (${esc}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(out, 'latin1');
}

/** Une prise de parole de synthèse (voix macOS sur une mire), avec pauses et faux départ. */
function speechSample(file: string): boolean {
  if (process.platform !== 'darwin') return false;
  const aiff = file.replace(/\.mp4$/, '.aiff');
  const said = spawnSync('say', ['-v', 'Thomas', '-o', aiff, "Bonjour, je m'appelle Awa Diop, fondatrice de Saveurs d'Abidjan. [[slnc 1500]] Aujourd'hui je vais... [[slnc 700]] Aujourd'hui je vais vous présenter notre nouveau jus de bissap. [[slnc 1200]] Il est cent pour cent naturel. [[slnc 1400]] Seulement 1000 francs la bouteille ! [[slnc 1000]] Commandez dès maintenant sur WhatsApp."]);
  if (said.status !== 0) return false;
  return spawnSync(process.env.FFMPEG_PATH || 'ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=1280x720:rate=30', '-i', aiff, '-shortest', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', file]).status === 0;
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

    section('2. Conversation vidéo : la marque n’est jamais exigée');
    const session = (await json('POST', '/v1/sessions', { mode: 'video' })).body;
    check('conversation créée en mode vidéo, avec une marque provisoire', session?.mode === 'video' && !!session.brandId);
    check('la marque provisoire n’encombre pas « Marques »', !(await json('GET', '/v1/brands')).body.brands.some((b: any) => b.id === session.brandId));
    let events = await turn(api, good, session.id, { text: 'Une vidéo en bleu et or pour fêter nos 500 clients' });
    let asked = events.find((e) => e.type === 'message' && e.message.role === 'assistant')?.message;
    check('sans charte, aucune question de marque : on passe au modèle', asked?.ask?.kind === 'reference', asked?.text);
    const colored = events.find((e) => e.type === 'brand')?.brand;
    check('« en bleu et or » : les couleurs dites colorent la création', colored?.source === 'auto' && colored.palette.primary === '#1f5fbf' && colored.palette.accent === '#c9a227', JSON.stringify(colored?.palette));

    events = await turn(api, good, session.id, { text: `Mon site : ${site.url} — une vidéo pour fêter nos 500 clients chaque mois` });
    const brand = events.find((e) => e.type === 'brand')?.brand;
    const said = events.filter((e) => e.type === 'message' && e.message.role === 'assistant').map((e) => e.message);
    asked = said[said.length - 1];
    check(`site lu : ${brand?.name}, primaire ${brand?.palette?.primary}, prêt aussitôt`, brand?.name === 'Kora Café' && brand?.palette?.primary === '#b4532a' && brand.status === 'ready');
    check('trois palettes et trois typographies gardées pour changer d’avis', brand?.proposals?.palettes?.length === 3 && brand?.proposals?.typographies?.length === 3);
    check('l’assistant dit qu’il applique le site, sans rien demander, puis continue', said.some((m) => /^chat\.brand\.applied/.test(m.i18n?.key || '')) && asked?.ask?.kind === 'reference' && (await json('GET', `/v1/sessions/${session.id}`)).body.pending?.text?.includes('500 clients'));

    const chosen = await json('POST', `/v1/brands/${brand.id}/choose`, { palette: 'contrast' });
    check('changer d’avis plus tard : palette « contraste »', chosen.body?.status === 'ready' && chosen.body.palette.primary === brand.proposals.palettes.find((p: any) => p.id === 'contrast').colors.primary);

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

    // L'éditeur partagé enregistre le HTML retouché : nettoyé, image re-rendue, aucun débit.
    {
      const before = (await json('GET', `/v1/visuals/${visual.id}`)).body;
      const chargesBefore = charges.length;
      const retouched = before.html.replace(/>([^<>]{3,})</, '>Retouché à la main<') + '<script>alert(1)</script>';
      const saved = await json('PUT', `/v1/visuals/${visual.id}/html`, { html: retouched });
      check(
        'éditeur : HTML retouché enregistré, script retiré, image re-rendue, gratuit',
        saved.status === 200 && saved.body.html.includes('Retouché à la main') && !saved.body.html.includes('<script') && saved.body.imageUrl !== before.imageUrl && charges.length === chargesBefore,
        JSON.stringify({ status: saved.status, url: saved.body?.imageUrl })
      );
      const empty = await json('PUT', `/v1/visuals/${visual.id}/html`, { html: '<script></script>' });
      check('éditeur : un visuel vidé est refusé', empty.status === 400);
    }

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

    section('7. Montage d’une prise de parole, en conversation');
    const talk = path.join(tmp, 'prise.mp4');
    const silent = path.join(tmp, 'plan.mp4');
    const status = await json('GET', '/v1/montages/status');
    if (!status.body?.available || !speechSample(talk)) {
      console.log('  — ignoré : Whisper local ou voix de synthèse absents sur ce poste');
    } else {
      // Un plan sans parole (une mire muette de 4 s) : il doit devenir un plan de coupe.
      spawnSync(process.env.FFMPEG_PATH || 'ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc=size=640x360:rate=30:d=4', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', silent]);
      const form = new FormData();
      form.append('files', new Blob([fs.readFileSync(talk)], { type: 'video/mp4' }), 'prise.mp4');
      form.append('files', new Blob([fs.readFileSync(silent)], { type: 'video/mp4' }), 'boutique.mp4');
      const up = await fetch(`${api}/v1/montages/uploads`, { method: 'POST', headers: { Cookie: good }, body: form });
      const uploads = (await up.json()).uploads || [];
      check('deux vidéos déposées, sondées, avec leur affiche', up.status === 201 && uploads.length === 2 && uploads.every((u: any) => u.durationSec > 0 && u.posterUrl) && uploads[0].hasAudio && !uploads[1].hasAudio, JSON.stringify(uploads.map((u: any) => [u.durationSec, u.hasAudio])));
      const seconds = uploads.reduce((sum: number, u: any) => sum + u.durationSec, 0);
      const quoteRes = await json('POST', '/v1/montages/quote', { durationSec: seconds, creativity: 'medium' });
      const forged = await json('POST', '/v1/montages', { inputs: [{ url: 'http://localhost:9000/idem-storage/ivision/users/someone-else/montage-uploads/x.mp4' }] });
      check('une vidéo qui n’est pas à soi est refusée', forged.status === 400);
      const chargesBefore = charges.length;
      // Sans marque, sans consigne obligatoire : seulement les vidéos (et une consigne facultative).
      const created = await json('POST', '/v1/montages', { inputs: uploads.map((u: any) => ({ url: u.url, name: u.name, posterUrl: u.posterUrl })), prompt: 'Finir par notre WhatsApp 07 08 09 10' });
      const montage = created.body;
      check('montage lancé sans marque (202), conversation ouverte', created.status === 202 && montage.status === 'processing' && montage.messages?.[0]?.inputs?.length === 2, `${created.status} ${montage?.message || ''}`);
      check('débit au prix annoncé (durée totale)', charges.length === chargesBefore + 1 && charges[charges.length - 1].cost === quoteRes.body.cost, JSON.stringify(charges[charges.length - 1]));
      const until = async (id: string, done: (m: any) => boolean, ms = 6 * 60_000) => {
        const end = Date.now() + ms;
        for (;;) {
          const m = (await json('GET', `/v1/montages/${id}`)).body;
          if (done(m) || Date.now() > end) return m;
          await new Promise((r) => setTimeout(r, 1500));
        }
      };
      let m = await until(montage.id, (x) => x?.status !== 'processing');
      check('montage prêt : transcrit, coupé, recadré', m?.status === 'ready' && m.words.length > 20 && m.edit?.width === 1080 && m.edit.durationSec < m.source.durationSec - 4, `${m?.status} ${m?.error || ''} · ${m?.words?.length} mots · ${m?.source?.durationSec}s → ${m?.edit?.durationSec}s`);
      check('la vidéo muette est devenue un plan de coupe, montré à l’écran', m.clips?.length === 1 && m.inputs?.[1]?.speech === false && m.elements.some((e: any) => e.clip === 'c1'), `${m.clips?.length} plan(s) · ${m.elements.map((e: any) => e.clip || e.type).join(',')}`);
      check('le résultat arrive dans la conversation', m.messages?.some((x: any) => x.kind === 'result'));
      check('le monteur IA a choisi (nom, chiffre), un mot inventé est refusé', m.plannedBy === 'llm' && m.elements.some((e: any) => e.type === 'lowerThird') && !m.elements.some((e: any) => e.text === 'GRATUIT'), m.elements.map((e: any) => e.type).join(','));
      const preview = await json('GET', `/v1/montages/${m.id}/preview`);
      check('aperçu : la page du montage, avec le plan de coupe', preview.status === 200 && preview.body.html.includes('__MONTAGE__') && preview.body.html.includes(m.clips[0].url));

      // Un retour écrit, comme on parle : « sans musique, et en carré ».
      const revised = await json('POST', `/v1/montages/${m.id}/messages`, { text: 'Sans musique, et en carré stp' });
      check('retour écrit compris : musique coupée, format carré, réponse dans le fil (gratuit)', revised.status === 200 && revised.body.musicEnabled === false && revised.body.format === 'square' && revised.body.messages.at(-1)?.role === 'assistant' && charges.length === chargesBefore + 1, `${revised.status} ${revised.body?.format} ${revised.body?.messages?.at(-1)?.text}`);
      m = await until(m.id, (x) => x?.status === 'ready');
      check('le carré est remonté (1080 × 1080), l’habillage suit', m.edit.width === 1080 && m.edit.height === 1080 && m.elements.some((e: any) => e.type === 'lowerThird'));
      const unclear = await json('POST', `/v1/montages/${m.id}/messages`, { text: 'hmm' });
      check('un retour incompris est dit, sans rien casser', unclear.status === 200 && unclear.body.messages.at(-1)?.i18n?.key === 'montage.chat.notUnderstood' || unclear.body.messages.at(-1)?.kind === 'revision');

      // La charte, ajoutée après coup : un logo (PNG détouré), puis une charte PDF.
      const logo = await sharp({ create: { width: 400, height: 160, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
        .composite([{ input: Buffer.from('<svg width="400" height="160"><rect x="20" y="30" width="360" height="100" rx="20" fill="#b4532a"/></svg>'), top: 0, left: 0 }])
        .png()
        .toBuffer();
      const lf = new FormData();
      lf.append('file', new Blob([logo], { type: 'image/png' }), 'logo.png');
      const fromLogo = await fetch(`${api}/v1/brands/from-file`, { method: 'POST', headers: { Cookie: good }, body: lf });
      const logoBrand = await fromLogo.json();
      check('un logo déposé : reconnu comme logo, sa couleur devient la primaire', fromLogo.status === 201 && logoBrand.found?.logo === true && logoBrand.palette?.primary?.toLowerCase().startsWith('#b'), JSON.stringify({ s: fromLogo.status, found: logoBrand.found, p: logoBrand.palette?.primary }));
      const moved = await json('PATCH', `/v1/montages/${m.id}`, { brandId: logoBrand.id });
      check('le montage prend la charte ajoutée après coup', moved.status === 200 && moved.body.brandId === logoBrand.id);
      const pf = new FormData();
      pf.append('file', new Blob([minimalPdf('Charte Saveurs - Couleur principale #1F6F4A - Accent #F2A93B - Titres : Montserrat - Texte : Lato')], { type: 'application/pdf' }), 'charte.pdf');
      const fromPdf = await fetch(`${api}/v1/brands/from-file`, { method: 'POST', headers: { Cookie: good }, body: pf });
      const pdfBrand = await fromPdf.json();
      check('une charte PDF : couleurs et polices ÉCRITES lues', fromPdf.status === 201 && pdfBrand.palette?.primary === '#1f6f4a' && pdfBrand.fonts?.display === 'Montserrat', JSON.stringify({ s: fromPdf.status, p: pdfBrand.palette, f: pdfBrand.fonts, found: pdfBrand.found }));

      const exported = await json('POST', `/v1/montages/${m.id}/export`);
      check('export lancé, premier export inclus (aucun débit)', exported.status === 202 && charges.length === chargesBefore + 1);
      m = await until(m.id, (x) => !x?.renders?.some((r: any) => r.status === 'rendering'), 8 * 60_000);
      const file = await fetch(`${api}/v1/montages/${m.id}/file`, { headers: { Cookie: good } });
      check('MP4 rendu (avec le plan de coupe) et téléchargeable', m.renders[0]?.status === 'done' && file.status === 200 && /attachment/.test(file.headers.get('content-disposition') || ''), `${m.renders[0]?.status} ${m.renders[0]?.error || ''} · ${m.renders[0]?.sizeBytes} octets`);
      check('le montage d’un autre utilisateur reste privé', (await json('GET', `/v1/montages/${m.id}`, undefined, 'session=poor')).status === 404);
      check('aucun montage n’a été remboursé (tout a abouti)', refunds.length === 0);
    }
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

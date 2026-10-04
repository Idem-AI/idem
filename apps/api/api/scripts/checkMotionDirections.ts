/**
 * DIVERSITÉ DES DIRECTIONS — `npm run check:video:directions`.
 *
 * Le même brief, rendu dans les huit directions de motion, puis :
 *  1. le contrôle anti-réflexe sur chaque plan (entrées, ancrages, transitions,
 *     libellés, tout-centré) — aucune alerte ne doit subsister après réparation ;
 *  2. une MESURE de la diversité : chaque vidéo est réduite à une empreinte
 *     (12 images en 24×42 pixels) et comparée aux sept autres. Deux directions
 *     trop proches font échouer le contrôle : « ça se ressemble » devient un nombre.
 *
 * Sorties : tmp/motion-directions/ (MP4 et planches par direction).
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import sharp from 'sharp';
import { buildVideoTheme } from '../services/Communication/video/video.theme';
import { buildStoryboard } from '../services/Communication/video/video.storyboard';
import { composeVideoHtml, inlineAssets } from '../services/Communication/video/video.composer';
import { renderVideo, closeRenderBrowser } from '../services/Communication/video/video.renderer';
import { DIRECTION_IDS, DIRECTIONS, lintMotion } from '../services/Communication/video/video.direction';
import { brandById } from './fixtures/motion-video/brands';
import { makePhotos } from './fixtures/motion-video/media';

const OUT = path.resolve(__dirname, '../../tmp/motion-directions');
fs.mkdirSync(OUT, { recursive: true });
let failures = 0;
const check = (label: string, ok: boolean, detail = '') => {
  if (ok) console.log(`  ✓ ${label}`);
  else {
    failures++;
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
  }
};

const IDS = ['hook', 'product', 'benefits', 'offer', 'cta', 'logo'];
const SLOTS: Record<string, string>[] = [
  { kicker: 'Soldes', title: 'Vos pagnes à prix doux' },
  { name: 'Pagne wax premium', tagline: 'Des motifs qui racontent votre histoire', price: '15 000 FCFA' },
  { title: 'Pourquoi Wax & Co', b1: 'Livraison 24h à Abidjan', b2: 'Paiement Mobile Money', b3: 'Retour gratuit' },
  { oldPrice: '21 500 FCFA', price: '15 000 FCFA', badge: '-30 %', note: 'Jusqu’au 31 décembre' },
  { title: 'Commandez avant dimanche', action: 'Écrire sur WhatsApp', contact: '+225 07 08 09 10 11' },
  { tagline: 'Le wax authentique' },
];

async function fingerprint(mp4: string): Promise<Buffer[]> {
  const frames: Buffer[] = [];
  for (let i = 0; i < 12; i++) {
    const f = path.join(OUT, `.fp${i}.png`);
    spawnSync('ffmpeg', ['-v', 'error', '-y', '-ss', String((i + 0.5) * 15 / 12), '-i', mp4, '-frames:v', '1', f]);
    frames.push(await sharp(f).resize(24, 42, { fit: 'fill' }).removeAlpha().raw().toBuffer());
    fs.rmSync(f, { force: true });
  }
  return frames;
}

function distance(a: Buffer[], b: Buffer[]): number {
  let sum = 0;
  let n = 0;
  a.forEach((fa, i) => {
    for (let k = 0; k < fa.length; k++) {
      sum += Math.abs(fa[k] - b[i][k]);
      n++;
    }
  });
  return sum / n / 255;
}

(async () => {
  const theme = buildVideoTheme(brandById('wax').branding, 'Wax & Co');
  const photos = await makePhotos(path.resolve(__dirname, '../../tmp/motion-video-check/photos'));
  const images = ['pagne-1', 'pagne-2', 'pagne-3'].map((p) => `data:image/jpeg;base64,${fs.readFileSync(photos[p]).toString('base64')}`);
  const prints: Record<string, Buffer[]> = {};

  console.log('\n1. Plans de mouvement et contrôle anti-réflexe');
  for (const dir of DIRECTION_IDS) {
    const sb = buildStoryboard({ sceneIds: IDS, slots: SLOTS, durationSec: 15, style: 'energetic', seed: 11, images, beat: { bpm: 110, offset: 0, confidence: 0.9 }, direction: dir });
    const plan = sb.scenes.map((s) => s.motion!) as any;
    const after = lintMotion(plan, IDS, DIRECTIONS[dir]);
    check(`${dir} : ${sb.scenes.map((s) => `${s.motion?.headline}`).join(' · ')}`, after.issues.length === 0, after.issues.join(', '));
  }

  console.log('\n2. Rendu des huit directions');
  for (const dir of DIRECTION_IDS) {
    const sb = buildStoryboard({ sceneIds: IDS, slots: SLOTS, durationSec: 15, style: 'energetic', seed: 11, images, beat: { bpm: 110, offset: 0, confidence: 0.9 }, direction: dir });
    const assets = await inlineAssets(sb, theme, 'render');
    const { html, spec } = await composeVideoHtml({ ...assets, format: 'story', quality: 'standard', mode: 'render' });
    const out = await renderVideo({ html, width: spec.width, height: spec.height, fps: spec.fps, durationSec: 15, quality: 'standard' });
    const mp4 = path.join(OUT, `${dir}.mp4`);
    fs.copyFileSync(out.file, mp4);
    prints[dir] = await fingerprint(mp4);
    const frames: string[] = [];
    for (let i = 0; i < 12; i++) {
      const f = path.join(OUT, `.f${i}.jpg`);
      spawnSync('ffmpeg', ['-v', 'error', '-y', '-ss', String((i + 0.5) * 15 / 12), '-i', mp4, '-frames:v', '1', '-vf', 'scale=-2:400', f]);
      frames.push(f);
    }
    spawnSync('ffmpeg', ['-v', 'error', '-y', ...frames.flatMap((f) => ['-i', f]), '-filter_complex', `${frames.map((_, i) => `[${i}:v]`).join('')}xstack=inputs=12:grid=12x1`, path.join(OUT, `${dir}.jpg`)]);
    frames.forEach((f) => fs.rmSync(f, { force: true }));
    check(`${dir} rendu`, fs.existsSync(mp4));
  }
  await closeRenderBrowser();

  console.log('\n3. Diversité mesurée (distance moyenne entre empreintes, 0 = identiques)');
  let min = 1;
  let pair = '';
  for (let i = 0; i < DIRECTION_IDS.length; i++) {
    for (let j = i + 1; j < DIRECTION_IDS.length; j++) {
      const d = distance(prints[DIRECTION_IDS[i]], prints[DIRECTION_IDS[j]]);
      if (d < min) {
        min = d;
        pair = `${DIRECTION_IDS[i]} / ${DIRECTION_IDS[j]}`;
      }
    }
  }
  check(`les deux directions les plus proches restent distinctes : ${pair} = ${min.toFixed(3)} (seuil 0,08)`, min >= 0.08);
  console.log(failures ? `\n✗ ${failures} échec(s).` : '\n✓ Huit directions, huit vidéos différentes.');
  process.exit(failures ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

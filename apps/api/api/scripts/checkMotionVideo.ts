/**
 * Contrôle des VIDÉOS MOTION DESIGN — `npm run check:video`.
 *
 * Tourne SANS crédit GLM : les réponses du modèle sont simulées à partir des
 * cas écrits dans `fixtures/motion-video/cases.ts` (propres, en désordre, en
 * JSON, avec un prix inventé, vides, fournisseur en panne). Les photos et les
 * musiques de test sont fabriquées sur place. Aucune base de données : le
 * stockage du module est remplacé par un double en mémoire.
 *
 *   npx ts-node --transpile-only api/scripts/checkMotionVideo.ts           # tout, rendus inclus
 *   npx ts-node --transpile-only api/scripts/checkMotionVideo.ts --fast    # sans rendu MP4
 *   npx ts-node --transpile-only api/scripts/checkMotionVideo.ts --all     # rend TOUS les cas
 *   npx ts-node --transpile-only api/scripts/checkMotionVideo.ts --online  # + banques Openverse / ccMixter réelles
 *
 * Les MP4, affiches et planches-contact sont écrits dans `tmp/motion-video-check/`.
 */
import crypto from 'crypto';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { spawnSync } from 'child_process';
import puppeteer from 'puppeteer';

// Banques distantes coupées par défaut : le contrôle doit être reproductible hors ligne.
const ONLINE = process.argv.includes('--online');
const FAST = process.argv.includes('--fast');
const ALL = process.argv.includes('--all');
if (!ONLINE) {
  process.env.VIDEO_MUSIC_OPENVERSE = 'off';
  process.env.VIDEO_MUSIC_CCMIXTER = 'off';
  delete process.env.JAMENDO_CLIENT_ID;
  delete process.env.FREESOUND_API_KEY;
}
delete process.env.PEXELS_API_KEY;
if (!ONLINE) process.env.VIDEO_SFX_OFFLINE = '1';
process.env.VIDEO_SFX_DIR = path.resolve(__dirname, '../../tmp/motion-video-check/sfx');
process.env.RENDER_ALLOWED_HOSTS = '127.0.0.1,localhost';
process.env.VIDEO_ALLOW_FILE_URLS = '1';

import { MotionVideo, VideoBrief } from '../models/motionVideo.model';
import { exportCost, normalizeScope, videoCost, VIDEO_PRICING } from '../services/Communication/video/video.pricing';
import { BUSINESS_CREDIT_COSTS } from '../models/billing.model';
import { extractFacts, fitLength, isGrounded, parseCopy, copyPlan, writeCopy, buildCopyPrompt, estimateTokens } from '../services/Communication/video/video.copy';
import { planScenes, RECIPES } from '../services/Communication/video/video.recipes';
import { allocateDurations, buildStoryboard, snapToBeats, retime } from '../services/Communication/video/video.storyboard';
import { buildVideoTheme } from '../services/Communication/video/video.theme';
import { contrastRatio } from '../services/design/color';
import { analyzeTrack, pickExcerptStart } from '../services/Communication/video/video.beats';
import { licenseFromUrl, pickTrack, registerLocalTracks, searchMusic, MUSIC_PROVIDERS, openverseProvider, ccmixterProvider } from '../services/Communication/video/video.music';
import { composeVideoHtml, inlineAssets, frameSpec } from '../services/Communication/video/video.composer';
import { closeRenderBrowser, probe } from '../services/Communication/video/video.renderer';
import { MotionVideoService, drainRenderQueue } from '../services/Communication/video/motionVideo.service';
import { SCENES } from '../services/Communication/video/video.scenes';
import { BRANDS, brandById } from './fixtures/motion-video/brands';
import { CASES, simulateAgent, simulateCoder, simulateModel, VideoCase } from './fixtures/motion-video/cases';
import { CreativityLevel } from '../models/creativity.model';
import { TRANSITION_IDS } from '../services/Communication/video/video.direction';
import { makeMusic, makePhotos, SYNTH_TRACKS } from './fixtures/motion-video/media';
import { planTypeScenes, TYPE_DEFS } from '../services/Communication/video/video.types';
import { expandConcept, pickConcept } from '../services/Communication/video/video.concepts';
import { builtinLottie, BUILTIN_LOTTIES } from '../services/Communication/video/video.lottie';
import { detectKind, processUpload, validateLottie } from '../services/Communication/video/video.media';
import { refineCues, sfxLibrary, SFX_SPECS } from '../services/Communication/video/video.sfx';
import { VIDEO_TYPES, SFX_KINDS } from '../models/motionVideo.model';
import { starsLottie, makeBottleGlb } from './fixtures/motion-video/examples';

const OUT = path.resolve(__dirname, '../../tmp/motion-video-check');
fs.mkdirSync(OUT, { recursive: true });

let failures = 0;
let passes = 0;
function check(label: string, condition: boolean, detail = ''): void {
  if (condition) {
    passes++;
    console.log(`  ✓ ${label}`);
  } else {
    failures++;
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}
const section = (title: string) => console.log(`\n${title}`);

// ─── Doubles ────────────────────────────────────────────────────────────────

/** Le module Communication, en mémoire : un projet par marque de test. */
class FakeCommunication {
  projects = new Map<string, any>();
  calls = 0;
  constructor() {
    for (const brand of BRANDS) {
      this.projects.set(brand.id, {
        id: brand.id,
        name: brand.name,
        type: brand.type,
        description: brand.description,
        analysisResultModel: { branding: brand.branding, communication: { context: brand.context, videos: [], visuals: [] } },
      });
    }
  }
  async loadProjectForVideo(_u: string, projectId: string) {
    return this.projects.get(projectId) || null;
  }
  async listVideos(_u: string, projectId: string): Promise<MotionVideo[]> {
    return JSON.parse(JSON.stringify(this.projects.get(projectId)?.analysisResultModel.communication.videos || []));
  }
  async saveVideo(_u: string, projectId: string, video: MotionVideo) {
    const comm = this.projects.get(projectId).analysisResultModel.communication;
    comm.videos = [...comm.videos.filter((v: MotionVideo) => v.id !== video.id), JSON.parse(JSON.stringify(video))];
  }
  async mutateVideo(_u: string, projectId: string, videoId: string, fn: (v: MotionVideo) => MotionVideo) {
    const comm = this.projects.get(projectId).analysisResultModel.communication;
    let out: MotionVideo | null = null;
    comm.videos = comm.videos.map((v: MotionVideo) => (v.id === videoId ? (out = JSON.parse(JSON.stringify(fn(v)))) : v));
    return out;
  }
  async removeVideo(_u: string, projectId: string, videoId: string) {
    const comm = this.projects.get(projectId).analysisResultModel.communication;
    const before = comm.videos.length;
    comm.videos = comm.videos.filter((v: MotionVideo) => v.id !== videoId);
    return comm.videos.length !== before;
  }
  // Calendrier éditorial (comme CommunicationService).
  async findPlanItem(_u: string, projectId: string, contentId: string) {
    for (const plan of this.projects.get(projectId)?.analysisResultModel.communication.plans || []) {
      const hit = plan.items.find((i: any) => i.id === contentId);
      if (hit) return JSON.parse(JSON.stringify(hit));
    }
    return null;
  }
  async linkVideoToContent(_u: string, projectId: string, contentId: string, videoId: string) {
    for (const plan of this.projects.get(projectId)?.analysisResultModel.communication.plans || []) {
      for (const item of plan.items) if (item.id === contentId) item.videoIds = [...(item.videoIds || []), videoId];
    }
  }
}

/** Stockage d'objets remplacé par des fichiers locaux. */
const fakeStorage = {
  async uploadFile(content: Buffer | string, fileName: string, folder: string) {
    const dir = path.join(OUT, 'storage', folder.replace(/[^a-zA-Z0-9/_-]/g, '_'));
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, fileName);
    fs.writeFileSync(file, content);
    return { fileName, filePath: file, downloadURL: `file://${file}` };
  },
};

/** Petit serveur HTTP local : les photos de test sont servies comme des URL réelles. */
function servePhotos(files: Record<string, string>): Promise<{ base: string; close: () => void }> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const name = decodeURIComponent((req.url || '').replace(/^\//, '').replace(/\.jpg$/, ''));
      const file = files[name];
      if (!file) {
        res.statusCode = 404;
        res.end();
        return;
      }
      res.setHeader('Content-Type', 'image/jpeg');
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as any).port;
      resolve({ base: `http://127.0.0.1:${port}`, close: () => server.close() });
    });
  });
}

// ─── Mise en page : chaque texte tient dans son cadre, à chaque scène ───────

async function layoutAudit(html: string, spec: { width: number; height: number }, scenes: { start: number; duration: number }[]) {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader'] });
  const issues: string[] = [];
  const hashes: Record<string, string> = {};
  try {
    const page = await browser.newPage();
    // Une erreur dans le moteur (scène, kit, addon) est un défaut, pas un détail.
    page.on('pageerror', (e) => issues.push(`erreur moteur : ${String((e as Error).message || e).slice(0, 160)}`));
    await page.setViewport({ width: spec.width, height: spec.height, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'load', timeout: 60000 });
    await page.evaluate(() => (window as any).__IDEM_VIDEO__.ready);
    const sections = await page.evaluate(() => document.querySelectorAll('section.scene').length);
    if (sections !== scenes.length) {
      issues.push(`${sections} scène(s) affichée(s) sur ${scenes.length}`);
      return { issues, deterministic: false };
    }
    for (const [i, s] of scenes.entries()) {
      const t = s.start + s.duration * 0.8;
      await page.evaluate((x: number) => (window as any).__IDEM_VIDEO__.seek(x), t);
      const found: string[] = await page.evaluate((index: number) => {
        const out: string[] = [];
        const scene = document.querySelectorAll('section.scene')[index] as HTMLElement;
        const safe = scene.querySelector('.safe') as HTMLElement | null;
        const stage = document.getElementById('stage')!.getBoundingClientRect();
        scene.querySelectorAll('[data-fit]').forEach((el) => {
          const e = el as HTMLElement;
          if (e.scrollWidth > e.clientWidth + 2) out.push(`texte trop large : « ${e.textContent?.trim().slice(0, 40)} »`);
        });
        if (safe) {
          safe.querySelectorAll('.kt, .btn, .price, .badge, .tagline').forEach((el) => {
            const r = (el as HTMLElement).getBoundingClientRect();
            if (!r.width) return;
            if (r.left < stage.left - 2 || r.right > stage.right + 2 || r.top < stage.top - 2 || r.bottom > stage.bottom + 2) {
              out.push(`hors cadre : « ${(el as HTMLElement).textContent?.trim().slice(0, 40)} »`);
            }
          });
        }
        return out;
      }, i);
      issues.push(...found.map((f) => `scène ${i + 1} — ${f}`));
    }
    // Déterminisme : la même image, que l'on arrive par l'avant ou par l'arrière.
    const t = scenes[1] ? scenes[1].start + 0.37 : 1.37;
    const shots: Buffer[] = [];
    const shot = async () => {
      const png = Buffer.from(await page.screenshot({ type: 'png' }));
      shots.push(png);
      return crypto.createHash('sha1').update(png).digest('hex');
    };
    await page.evaluate((x: number) => (window as any).__IDEM_VIDEO__.seek(x), t);
    hashes.forward = await shot();
    await page.evaluate(() => (window as any).__IDEM_VIDEO__.seek(14));
    await page.evaluate((x: number) => (window as any).__IDEM_VIDEO__.seek(x), t);
    hashes.backward = await shot();
    await page.evaluate(() => (window as any).__IDEM_VIDEO__.seek(0));
    await page.evaluate((x: number) => (window as any).__IDEM_VIDEO__.seek(x), t);
    hashes.fromStart = await shot();
    // Comparaison tolérante : Chromium peut réutiliser une couche rastérisée à
    // une échelle voisine selon l'historique, d'où des écarts sous-pixel
    // invisibles. Un vrai défaut (élément déplacé, texte absent) touche bien
    // plus que 0,2 % des pixels.
    const sharpLib = (await import('sharp')).default;
    const raws = await Promise.all(shots.map((png) => sharpLib(png).raw().toBuffer()));
    const changed = (a: Buffer, b: Buffer) => {
      let n = 0;
      for (let k = 0; k < a.length; k += 4) if (Math.abs(a[k] - b[k]) > 8 || Math.abs(a[k + 1] - b[k + 1]) > 8 || Math.abs(a[k + 2] - b[k + 2]) > 8) n++;
      return n / (a.length / 4);
    };
    const worst = Math.max(changed(raws[0], raws[1]), changed(raws[1], raws[2]));
    if (worst <= 0.002) Object.keys(hashes).forEach((k) => (hashes[k] = hashes.forward));
    if (new Set(Object.values(hashes)).size > 1) {
      // Diagnostic : les images et la zone qui diffère sont gardées.
      const stamp = Date.now().toString(36);
      shots.forEach((png, i) => fs.writeFileSync(path.join(OUT, `nondeterminism-${stamp}-${i}.png`), png));
      const sharp = (await import('sharp')).default;
      const [a, b] = await Promise.all([shots[0], shots[1]].map((png) => sharp(png).raw().toBuffer({ resolveWithObject: true })));
      let box = [1e9, 1e9, -1, -1];
      for (let i = 0; i < a.data.length; i += a.info.channels) {
        if (a.data[i] !== b.data[i] || a.data[i + 1] !== b.data[i + 1] || a.data[i + 2] !== b.data[i + 2]) {
          const p = i / a.info.channels;
          const x = p % a.info.width;
          const y = Math.floor(p / a.info.width);
          box = [Math.min(box[0], x), Math.min(box[1], y), Math.max(box[2], x), Math.max(box[3], y)];
        }
      }
      issues.push(`images différentes à t=${t.toFixed(2)} s, zone ${box.join(',')} (nondeterminism-${stamp}-*.png)`);
    }
  } finally {
    await browser.close();
  }
  return { issues, deterministic: hashes.forward === hashes.backward && hashes.backward === hashes.fromStart };
}

function contactSheet(mp4: string, out: string, duration: number, cols = 6): void {
  const times = Array.from({ length: cols * 2 }, (_, i) => ((i + 0.5) * duration) / (cols * 2));
  const frames: string[] = [];
  times.forEach((t, i) => {
    const f = path.join(path.dirname(out), `.frame-${i}.jpg`);
    spawnSync('ffmpeg', ['-v', 'error', '-y', '-ss', t.toFixed(2), '-i', mp4, '-frames:v', '1', '-vf', 'scale=320:-2', f]);
    frames.push(f);
  });
  spawnSync('ffmpeg', ['-v', 'error', '-y', ...frames.flatMap((f) => ['-i', f]), '-filter_complex', `${frames.map((_, i) => `[${i}:v]`).join('')}xstack=inputs=${frames.length}:grid=${cols}x2:fill=white`, out]);
  frames.forEach((f) => fs.rmSync(f, { force: true }));
}

// ─── Les contrôles ──────────────────────────────────────────────────────────

async function main() {
  const t0 = Date.now();

  // 1. Prix ───────────────────────────────────────────────────────────────────
  section('1. Prix selon le périmètre');
  const charte = BUSINESS_CREDIT_COSTS.logo_brand;
  check(`référence (15 s · 1 format · HD) = 2 × la charte (${2 * charte})`, videoCost({ durationSec: 15, formats: ['story'], quality: 'hd' }) === 2 * charte);
  check('6 s coûte moins que 15 s', videoCost({ durationSec: 6, formats: ['story'], quality: 'hd' }) < VIDEO_PRICING.referenceCost);
  check('60 s coûte plus que 30 s', videoCost({ durationSec: 60, formats: ['story'], quality: 'hd' }) > videoCost({ durationSec: 30, formats: ['story'], quality: 'hd' }));
  const one = videoCost({ durationSec: 15, formats: ['story'], quality: 'hd' });
  const two = videoCost({ durationSec: 15, formats: ['story', 'square'], quality: 'hd' });
  check('un format de plus coûte 35 % du premier', two === Math.ceil(one * 1.35), `${two}`);
  check('premium > hd > standard', videoCost({ durationSec: 15, formats: ['story'], quality: 'premium' }) > one && one > videoCost({ durationSec: 15, formats: ['story'], quality: 'standard' }));
  const s = normalizeScope({ durationSec: 20, formats: ['story', 'story', 'cinema'], quality: 'ultra' });
  check('périmètre invalide ramené au plus proche', s.durationSec === 15 && s.formats.length === 1 && s.quality === 'hd', JSON.stringify(s));
  check('périmètre vide → défaut', normalizeScope(undefined).formats[0] === 'story');
  check('premier export inclus', exportCost({ paidCredits: one, exportCount: 0, scope: { durationSec: 15, formats: ['story'], quality: 'hd' } }) === 0);
  check('premier export + un format = la différence seule', exportCost({ paidCredits: one, exportCount: 0, scope: { durationSec: 15, formats: ['story', 'square'], quality: 'hd' } }) === two - one);
  check('nouvel export = 10 % du périmètre', exportCost({ paidCredits: one, exportCount: 1, scope: { durationSec: 15, formats: ['story'], quality: 'hd' } }) === Math.ceil(one * 0.1));
  console.log('    barème :', [6, 15, 30, 60].map((d) => `${d}s=${videoCost({ durationSec: d as any, formats: ['story'], quality: 'hd' })}`).join(' · '));

  // 2. Faits du brief ─────────────────────────────────────────────────────────
  section('2. Faits extraits du brief (rien n’est inventé)');
  const wax = extractFacts(`${CASES[0].brief.message}\n${CASES[0].brief.details}`);
  check('deux prix trouvés', wax.prices.length === 2, JSON.stringify(wax.prices));
  check('remise en % trouvée', wax.percents[0]?.replace(/\s/g, '') === '-30%');
  check('date trouvée', wax.dates.some((d) => /31 décembre/.test(d)), JSON.stringify(wax.dates));
  check('téléphone trouvé', wax.phones[0]?.replace(/\D/g, '') === '2250708091011', JSON.stringify(wax.phones));
  check('« 24h » n’est pas un chiffre-clé', !wax.stats.some((st) => st.value === '24'));
  const kofi = extractFacts(`${CASES[2].brief.message}\n${CASES[2].brief.details}`);
  check('site trouvé (EN)', kofi.urls.includes('kofitech.africa'), JSON.stringify(kofi.urls));
  check('chiffre-clé trouvé (EN)', kofi.stats.some((st) => st.value === '12'), JSON.stringify(kofi.stats));
  const bissapAvis = extractFacts(`${CASES[5].brief.message}\n${CASES[5].brief.details}`);
  check('témoignage trouvé avec son auteur', bissapAvis.quotes[0]?.author === 'Awa Diop', JSON.stringify(bissapAvis.quotes));
  const mama = extractFacts(`${CASES[3].brief.message}\n${CASES[3].brief.details}`);
  check('heure et lieu trouvés', mama.times.includes('19h') && mama.places.some((p) => /Lomé|Boulevard/.test(p)), JSON.stringify({ t: mama.times, p: mama.places }));

  // 3. Lecture des réponses du modèle ────────────────────────────────────────
  section('3. Lecture tolérante des réponses');
  const plan = copyPlan(['hook', 'offer', 'cta', 'logo']);
  const parsedMessy = parseCopy(
    'Voici :\n- **1.title**: "Les soldes sont là" ✨\n2. price (max 18) – « 15 000 FCFA »\n* 3.action = Commandez #promo\n99.x: rien\n4.tagline: Le wax authentique.',
    plan
  );
  check('puces, gras, guillemets et emoji retirés', parsedMessy[1]?.title === 'Les soldes sont là', JSON.stringify(parsedMessy[1]));
  check('« 2. price (max 18) – … » lu', parsedMessy[2]?.price === '15 000 FCFA');
  check('hashtag retiré', parsedMessy[3]?.action === 'Commandez');
  check('clé inconnue ignorée', !(99 in parsedMessy));
  const parsedJson = parseCopy('{"1.title":"Bonjour","2.price":"9 F"}', plan);
  check('réponse JSON acceptée', parsedJson[1]?.title === 'Bonjour' && parsedJson[2]?.price === '9 F');
  check('coupe au mot, sans mot vide final', fitLength('Les soldes de fin d’année commencent pour de bon', 30) === 'Les soldes de fin d’année', fitLength('Les soldes de fin d’année commencent pour de bon', 30));
  check('garde-fou : prix présent dans le brief', isGrounded('15 000 F', 'à 15000 FCFA'));
  check('garde-fou : prix inventé refusé', !isGrounded('5 000 FCFA', 'à 15000 FCFA'));

  // 4. Recettes ───────────────────────────────────────────────────────────────
  section('4. Recettes : accroche d’abord, signature à la fin, pas de scène sans fait');
  const noFacts = extractFacts('Venez nous voir');
  let recipesOk = true;
  for (const objective of Object.keys(RECIPES) as (keyof typeof RECIPES)[]) {
    for (const d of [6, 15, 30, 60]) {
      const ids = planScenes(objective, d, noFacts, 0);
      if (ids[0] !== 'hook' || ids[ids.length - 1] !== 'logo') recipesOk = false;
      if (ids.some((id) => ['offer', 'stat', 'event', 'quote', 'gallery'].includes(id))) recipesOk = false;
      if (d === 6 && ids.length > 3) recipesOk = false;
    }
  }
  check('7 objectifs × 4 durées : structure valide, aucune scène factuelle sans fait', recipesOk);
  const promo15 = planScenes('promotion', 15, wax, 3);
  check('promotion avec prix → scène « offre »', promo15.includes('offer'), promo15.join(','));
  const totalNominal = (ids: string[]) => ids.reduce((n, id) => n + SCENES[id].nominal, 0);
  check('60 s : assez de scènes pour remplir', totalNominal(planScenes('promotion', 60, wax, 3)) >= 60 * 0.75, `${totalNominal(planScenes('promotion', 60, wax, 3)).toFixed(1)} s`);

  // 5. Minutage et rythme ─────────────────────────────────────────────────────
  section('5. Minutage exact et coupes sur le temps');
  for (const d of [6, 15, 30, 60]) {
    const ids = planScenes('promotion', d, wax, 3);
    const durs = allocateDurations(ids, ids.map(() => ({ title: 'Un titre de six mots ici' })), d);
    check(`${d} s : la somme des scènes fait exactement ${d} s`, Math.abs(durs.reduce((a, b) => a + b, 0) - d) < 1e-6);
  }
  const ids15 = planScenes('promotion', 15, wax, 3);
  const snapped = snapToBeats(allocateDurations(ids15, ids15.map(() => ({})), 15), { bpm: 120, offset: 0, confidence: 0.9 }, 15, 2.2);
  let acc = 0;
  const cuts = snapped.slice(0, -1).map((d) => (acc += d));
  const onBeat = cuts.filter((c) => Math.abs(c / 0.5 - Math.round(c / 0.5)) < 1e-6).length;
  check('120 BPM : les coupes tombent sur le temps', onBeat >= cuts.length - 1, cuts.map((c) => c.toFixed(2)).join(' '));
  check('aucune scène sous 1,2 s', snapped.every((d) => d >= 1.2 - 1e-6), snapped.map((d) => d.toFixed(2)).join(' '));
  const sbA = buildStoryboard({ sceneIds: ids15, slots: ids15.map(() => ({ title: 'Titre' })), durationSec: 15, style: 'energetic', seed: 7, images: [] });
  const sbB = buildStoryboard({ sceneIds: ids15, slots: ids15.map(() => ({ title: 'Titre' })), durationSec: 15, style: 'energetic', seed: 7, images: [] });
  check('même graine → même storyboard', JSON.stringify(sbA) === JSON.stringify(sbB));
  check('jamais deux surfaces identiques d’affilée', sbA.scenes.every((sc, i) => i === 0 || sc.surface !== sbA.scenes[i - 1].surface));
  check('retouche : le minutage est recalculé et reste exact', Math.abs(retime(sbA).scenes.reduce((a, sc) => a + sc.duration, 0) - 15) < 0.01);

  // 6. Musique : tempo et extrait ─────────────────────────────────────────────
  section('6. Musique : tempo retrouvé, introduction sautée');
  const music = makeMusic(path.join(OUT, 'music'));
  for (const spec of SYNTH_TRACKS) {
    const file = path.join(OUT, 'music', `${spec.id}.mp3`);
    const analysis = await analyzeTrack(file);
    const bpmOk = Math.abs(analysis.bpm - spec.bpm) <= 1.5 || Math.abs(analysis.bpm - spec.bpm * 2) <= 2 || Math.abs(analysis.bpm * 2 - spec.bpm) <= 2;
    const start = pickExcerptStart(analysis, 15);
    check(`${spec.title} (${spec.bpm} BPM) → ${analysis.bpm} BPM, extrait à ${start.toFixed(2)} s`, bpmOk && start >= 7.5);
  }
  check('licences : NC / ND / SA refusées', licenseFromUrl('https://creativecommons.org/licenses/by-nc/4.0/') === null && licenseFromUrl('http://creativecommons.org/licenses/by-sa/3.0/') === null && licenseFromUrl('http://creativecommons.org/licenses/by-nd/3.0/') === null);
  check('licences : CC0 et CC BY acceptées', licenseFromUrl('https://creativecommons.org/publicdomain/zero/1.0/') === 'cc0' && licenseFromUrl('https://creativecommons.org/licenses/by/4.0/') === 'cc-by');
  registerLocalTracks(music);
  const afro = await searchMusic({ mood: 'afro', minDuration: 18 });
  check('catalogue maison interrogé par ambiance', afro[0]?.id === 'local:synth-afro-104', afro.map((t) => t.id).join(','));
  const upbeat = await searchMusic({ mood: 'upbeat', minDuration: 18 });
  check('piste déjà utilisée évitée quand une autre existe', upbeat.length < 2 || pickTrack(upbeat, 3, [upbeat[0].id])?.id !== upbeat[0].id);
  if (ONLINE) {
    for (const provider of [openverseProvider, ccmixterProvider]) {
      try {
        const found = await provider.search({ mood: 'upbeat', minDuration: 20 });
        check(`${provider.id} en ligne : ${found.length} pistes libres`, found.length > 0 && found.every((t) => ['cc0', 'pdm', 'cc-by'].includes(t.license)));
      } catch (error: any) {
        check(`${provider.id} en ligne`, false, error.message);
      }
    }
    console.log(`    sources configurées : ${MUSIC_PROVIDERS.filter((p) => p.enabled()).map((p) => p.id).join(', ')}`);
  }

  // 7. Charte ─────────────────────────────────────────────────────────────────
  section('7. Charte : surfaces claires et contraste');
  for (const brand of BRANDS) {
    const theme = buildVideoTheme(brand.branding, brand.name);
    const ratios = Object.entries(theme.surfaces).map(([name, sf]) => [name, contrastRatio(sf.ink, sf.bg), contrastRatio(sf.hlInk, sf.hl)] as const);
    check(`${brand.name} : encre ≥ 4,5:1 sur toutes les surfaces, texte de pastille ≥ 4,5:1`, ratios.every(([, a, b]) => a >= 4.5 && b >= 4.5), ratios.map(([n, a, b]) => `${n} ${a.toFixed(1)}/${b.toFixed(1)}`).join(' · '));
  }
  const kofiTheme = buildVideoTheme(brandById('kofi').branding, 'Kofi Tech');
  check('fond de marque sombre redressé en fond clair', !kofiTheme.surfaces.light.dark, kofiTheme.surfaces.light.bg);
  check('marque sans logo : aucune image de logo inventée', !buildVideoTheme(brandById('mama').branding, 'Chez Mama Afia').logo.onLight);

  // 8. Budget de tokens ───────────────────────────────────────────────────────
  section('8. Budget de tokens (un seul appel de modèle par vidéo)');
  for (const d of [6, 15, 30, 60]) {
    const ids = planScenes('promotion', d, wax, 3);
    const prompt = buildCopyPrompt(copyPlan(ids), CASES[0].brief, { brandName: 'Wax & Co', language: 'fr' });
    const input = estimateTokens(prompt.system + prompt.user);
    const output = copyPlan(ids).reduce((n, p) => n + p.slots.reduce((m, sl) => m + Math.ceil((sl.max * 0.8 + 10) / 4), 0), 0);
    check(`${d} s : ~${input} tokens d’entrée + ~${output} de sortie (< 1 500 au total)`, input + output < 1500);
  }

  // 8 bis. Types de motion ────────────────────────────────────────────────
  section('8 bis. Types de motion : concept tiré par le graphe, type garanti');
  for (const type of VIDEO_TYPES.filter((t) => t !== 'mix')) {
    for (const d of TYPE_DEFS[type].durations || [6, 15, 30]) {
      const media = { images: 4, videos: 3, models: 1, lotties: 1 };
      const concept = pickConcept({ objective: 'promotion', type, direction: 'editorial', durationSec: d, facts: wax, media, seed: 7 });
      const ids = expandConcept(concept, { durationSec: d, facts: wax, media, type }).scenes;
      const signature: Record<string, string> = { kinetic: 'kinetic', footage: 'footage', showcase3d: 'showcase3d', illustrated: 'lottie', slideshow: 'gallery', product: 'product', promo: 'offer', logo: 'logo' };
      check(
        `${type} · ${d} s · ${concept} : ${ids.join(' → ')}`,
        !['cta', 'logo'].includes(ids[0]) || type === 'logo' ? ids[ids.length - 1] === 'logo' && ids.includes(signature[type]) : false
      );
    }
  }
  const noMedia = planTypeScenes('footage', 'promotion', 15, noFacts, { images: 0, videos: 0, models: 0, lotties: 0 });
  check('vidéo + texte sans aucun média : repli sans scène vidéo vide', !noMedia.includes('footage') && noMedia[0] === 'hook', noMedia.join(','));

  // 8 ter. Lottie, imports, effets sonores ───────────────────────────────
  section('8 ter. Lottie, imports et effets sonores');
  const palette = { primary: '#c2410c', accent: '#facc15', secondary: '#1e3a5f', ink: '#1c1917' };
  check(`${BUILTIN_LOTTIES.length} animations Lottie intégrées valides`, BUILTIN_LOTTIES.every((n) => validateLottie(builtinLottie(n, palette))));
  check('Lottie importée (étoiles) valide', validateLottie(starsLottie()));
  check('JSON quelconque refusé comme Lottie', !validateLottie({ hello: 'world' }));
  const glbFile = path.join(OUT, 'bouteille.glb');
  await makeBottleGlb(glbFile, { glass: '#9f1239', label: '#ffffff', cap: '#065f46' });
  check('modèle GLB reconnu par son contenu', detectKind(fs.readFileSync(glbFile), 'application/octet-stream', 'x.bin') === 'model3d');
  check('photo, vidéo, Lottie reconnues', detectKind(Buffer.from('x'), 'image/png', 'a.png') === 'image' && detectKind(Buffer.from('x'), 'video/mp4', 'a.mp4') === 'video' && detectKind(Buffer.from('{}'), 'application/json', 'a.json') === 'lottie');
  const clipSrc = path.join(OUT, 'clip-source.mp4');
  if (!fs.existsSync(clipSrc)) spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=s=1920x1080:r=30:d=20', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', clipSrc]);
  const uploadedClip = await processUpload({ buffer: fs.readFileSync(clipSrc), mimetype: 'video/mp4', originalname: 'clip.mp4' }, fakeStorage as any, 'test/uploads');
  check(`clip importé réencodé en WebM ≤ 1280 px, 15 s max (${uploadedClip.width}×${uploadedClip.height}, ${uploadedClip.durationSec} s)`, uploadedClip.url.endsWith('.webm') && Math.max(uploadedClip.width || 0, uploadedClip.height || 0) <= 1280 && (uploadedClip.durationSec || 0) <= 15.1 && !!uploadedClip.posterUrl);
  const uploadedGlb = await processUpload({ buffer: fs.readFileSync(glbFile), mimetype: 'model/gltf-binary', originalname: 'bouteille.glb' }, fakeStorage as any, 'test/uploads');
  check('modèle 3D importé', uploadedGlb.kind === 'model3d' && uploadedGlb.url.endsWith('.glb'));
  const uploadedLottie = await processUpload({ buffer: Buffer.from(JSON.stringify(starsLottie())), mimetype: 'application/json', originalname: 'etoiles.json' }, fakeStorage as any, 'test/uploads');
  check(`Lottie importée (${uploadedLottie.durationSec} s)`, uploadedLottie.kind === 'lottie' && uploadedLottie.durationSec === 2);
  let refused = false;
  try {
    await processUpload({ buffer: Buffer.from('{"a":1}'), mimetype: 'application/json', originalname: 'faux.json' }, fakeStorage as any, 'test/uploads');
  } catch {
    refused = true;
  }
  check('faux Lottie refusé à l’import', refused);
  const lib = await sfxLibrary();
  check(`sonothèque : un son pour chacun des ${SFX_KINDS.length} moments sonores`, SFX_KINDS.every((k) => (lib.sounds[k] || []).length > 0 && fs.existsSync(lib.sounds[k][0].file)));
  check('sons dans leur gabarit de durée', SFX_KINDS.every((k) => lib.sounds[k].every((snd) => snd.durationSec <= SFX_SPECS[k].max + 0.1)));
  const dense = Array.from({ length: 40 }, (_, i) => ({ t: i * 0.05, kind: 'click' as const }));
  check('effets : densité plafonnée (40 clics serrés → quelques-uns)', refineCues(dense, 'energetic', 10).length <= 12);
  // Un film élégant garde son design sonore : des clics plus discrets, jamais muets.
  {
    const premium = refineCues([{ t: 1, kind: 'click' }], 'premium', 10)[0];
    const energetic = refineCues([{ t: 1, kind: 'click' }], 'energetic', 10)[0];
    check('style élégant : clics présents mais plus discrets', !!premium && !!energetic && premium.db <= energetic.db - 6, `${premium?.db} dB / ${energetic?.db} dB`);
    const subtle = refineCues([{ t: 1, kind: 'pop' }], 'energetic', 10, 'subtle')[0];
    const punchy = refineCues([{ t: 1, kind: 'pop' }], 'energetic', 10, 'punchy')[0];
    check('intensité du sound designer : discrète −4 dB, appuyée +3 dB', !!subtle && !!punchy && Math.round((punchy.db - subtle.db) * 10) === 70, `${subtle?.db} → ${punchy?.db}`);
  }
  check('effets hors durée ignorés', refineCues([{ t: 11, kind: 'pop' }], 'energetic', 10).length === 0);

  // 9. Pipeline complet, réponses simulées ────────────────────────────────────
  section('9. Pipeline complet (modèle simulé : propre, désordre, JSON, invention, vide, panne)');
  const photos = await makePhotos(path.join(OUT, 'photos'));
  const server = await servePhotos(photos);
  const fake = new FakeCommunication();
  let currentCase: VideoCase = CASES[0];
  const service = new MotionVideoService(
    fake as any,
    () => (system, user) => simulateModel(currentCase)(system, user),
    // Les agents : même comportement simulé que la copie (propre, désordre, invention, vide, panne).
    () => (system, user) => simulateAgent(currentCase.behaviour, system, user),
    // L'agent codeur du cran Ultra : un composant générique, éprouvé par le vrai lint et le vrai rendu.
    () => async () => simulateCoder(currentCase.behaviour)
  );
  // Chaque comportement de modèle tourne à un cran différent de la jauge de créativité.
  const LEVEL_OF: Record<string, CreativityLevel> = { clean: 'ultra', messy: 'max', json: 'high', hallucinate: 'high', down: 'low', empty: 'medium' };
  (service as any).storage = fakeStorage;

  const created: { c: VideoCase; video: MotionVideo }[] = [];
  for (const c of CASES) {
    currentCase = c;
    const brief: VideoBrief = { ...c.brief, imageUrls: (c.photos || []).map((p) => `${server.base}/${p}.jpg`) };
    const video = await service.createVideo('test-user', c.brandId, { brief, scope: c.scope, creativity: LEVEL_OF[c.behaviour] }, videoCost(c.scope));
    created.push({ c, video });
    const sb = video.storyboard;
    const total = sb.scenes.reduce((a, sc) => a + sc.duration, 0);
    const allText = sb.scenes.flatMap((sc) => Object.values(sc.slots)).join(' | ');
    // L'ouverture dépend du concept (accroche, offre, chiffre, clip…) ; jamais l'appel à l'action ni la signature.
    check(`${c.id} [${c.behaviour}] : ${sb.scenes.length} scènes, ${total.toFixed(2)} s, concept ${sb.concept}, copie ${video.copyTokens?.source}`, Math.abs(total - c.scope.durationSec) < 0.01 && !['cta', 'logo'].includes(sb.scenes[0].sceneId) && sb.scenes[sb.scenes.length - 1].sceneId === 'logo');
    const tooLong = sb.scenes.flatMap((sc) => (SCENES[sc.sceneId].slots || []).filter((sl) => (sc.slots[sl.key] || '').length > sl.max).map((sl) => `${sc.sceneId}.${sl.key}`));
    check(`${c.id} : toutes les cases respectent leur longueur`, tooLong.length === 0, tooLong.join(','));
    const required = sb.scenes.flatMap((sc) => (SCENES[sc.sceneId].slots || []).filter((sl) => sl.required && !sc.slots[sl.key]).map((sl) => `${sc.sceneId}.${sl.key}`));
    check(`${c.id} : aucune case obligatoire vide`, required.length === 0, required.join(','));
    if (c.behaviour === 'hallucinate') {
      check(`${c.id} : prix et numéro inventés supprimés`, !/5 000 FCFA|90 00 00 00/.test(allText), allText);
    }
    if (c.behaviour === 'messy') check(`${c.id} : ni emoji, ni hashtag, ni guillemets`, !/[✨#«»"]/.test(allText), allText);
    if (c.behaviour === 'down' || c.behaviour === 'empty') check(`${c.id} : la vidéo sort quand même (copie heuristique)`, video.copyTokens?.source === 'heuristic' && sb.scenes.length >= 3);
    if (c.brief.musicMood === 'none') check(`${c.id} : sans musique demandée → vidéo muette`, !video.music);
    else check(`${c.id} : musique ${video.music?.title} (${video.music?.beat?.bpm} BPM, extrait à ${video.music?.startAt}s)`, !!video.music && !!video.music.beat);
    if (c.photos?.length) check(`${c.id} : les photos du commerce sont utilisées`, sb.scenes.some((sc) => sc.image || sc.images?.length));
    // Les bonnes pratiques (video.rules.ts) : réparées si besoin, aucun écart restant.
    check(`${c.id} : bonnes pratiques respectées (${sb.qa?.repaired ?? 0} réparation(s), rythme ${sb.rhythm}, caméra ${sb.kit?.camera}, entrées ${sb.kit?.entrance})`, !!sb.qa && sb.qa.issues.length === 0, (sb.qa?.issues || []).map((i) => `${i.rule}: ${i.detail}`).join(' ; '));
    // L'équipe d'agents : chacun a tourné ; ses choix sont dans les menus ; jamais de répétition.
    {
      const agents = sb.agents || [];
      const names = agents.map((a) => a.agent);
      const llm = (agent: string) => agents.find((a) => a.agent === agent)?.source === 'llm';
      const level = LEVEL_OF[c.behaviour];
      const expectLlm = c.behaviour === 'clean' || c.behaviour === 'messy';
      check(
        `${c.id} [${level}] : agents ${agents.filter((a) => !a.agent.startsWith('sceneCoder')).map((a) => `${a.agent}:${a.source}`).join(' ')}`,
        ['strategist', 'writer', 'artDirector', 'animator', 'critic'].every((n) => names.includes(n)) && (!expectLlm || (llm('artDirector') && llm('animator'))) && (c.behaviour !== 'down' || !llm('animator')) && video.creativity === level
      );
      // Sous High, aucun agent de composition n'est appelé : la décision est celle du code.
      if (level === 'low' || level === 'medium') check(`${c.id} [${level}] : mises en page, transitions et relecture décidées par le code`, ['artDirector', 'animator', 'critic'].every((n) => !llm(n)));
      if (level === 'ultra') {
        const coded = sb.scenes.filter((sc) => sc.code?.tsx);
        check(`${c.id} [ultra] : ${coded.length} scène(s) écrite(s) par l’agent codeur, contrôlée(s) et retenue(s)`, coded.length >= 1 && agents.some((a) => a.agent.startsWith('sceneCoder') && a.source === 'llm'));
      }
      const layouts = sb.scenes.map((sc) => sc.layout);
      const repeatedLayout = layouts.some((l, i) => l && l !== 'classic' && l === layouts[i - 1]);
      const textScenes = sb.scenes.filter((sc) => ['hook', 'statement', 'stat', 'benefits', 'offer', 'quote', 'cta', 'event'].includes(sc.sceneId));
      check(`${c.id} : mises en page ${layouts.map((l) => l || '-').join(',')} (aucune répétée, scènes de texte mises en page)`, !repeatedLayout && textScenes.every((sc) => !!sc.layout));
      const cuts = sb.scenes.map((sc) => sc.motion?.transition).filter(Boolean) as string[];
      check(`${c.id} : transitions ${cuts.join(',')} (catalogue, jamais deux fois de suite)`, cuts.every((t, i) => (TRANSITION_IDS as string[]).includes(t) && t !== cuts[i - 1]));
    }
    console.log(`      ${sb.scenes.map((sc) => `${sc.sceneId}/${sc.variant}·${sc.surface}·${sc.duration.toFixed(1)}s${sc.transitionIn ? `←${sc.transitionIn}` : ''}`).join('  ')}`);
    console.log(`      « ${sb.scenes[0].slots.title} » … « ${sb.scenes[sb.scenes.length - 2]?.slots.action || sb.scenes[sb.scenes.length - 2]?.slots.title || ''} »`);
  }

  // Vidéo d'un contenu du calendrier : aucun message dans la demande (la route le laisse passer),
  // le brief et le type viennent du contenu, la vidéo lui est rattachée.
  {
    const comm = fake.projects.get('wax').analysisResultModel.communication;
    comm.plans = [{ id: 'plan-1', items: [{ id: 'content-promo', title: 'Soldes de fin d’année', hook: 'Vos pagnes wax à -30 % jusqu’au 31 décembre', description: 'Les soldes : livraison 24h à Abidjan.', callToAction: 'Commandez sur WhatsApp', intent: 'promotion', format: 'reel', channel: 'instagram', videoType: 'promo', scheduledFor: '2026-12-01', week: 1, hashtags: [], status: 'idea' }] }];
    currentCase = { ...CASES[0], behaviour: 'down' } as VideoCase;
    const fromCalendar = await service.createVideo('test-user', 'wax', { brief: { musicMood: 'none', sfx: false } as any, scope: { durationSec: 15, formats: ['story'], quality: 'standard' }, contentId: 'content-promo' }, 0);
    const item = comm.plans[0].items[0];
    check(
      `calendrier : vidéo du type du contenu (${fromCalendar.type}), brief tiré du contenu, rattachée`,
      fromCalendar.type === 'promo' && fromCalendar.brief.message.includes('-30 %') && fromCalendar.brief.objective === 'promotion' && (item.videoIds || []).includes(fromCalendar.id)
    );
    comm.videos = comm.videos.filter((v: MotionVideo) => v.id !== fromCalendar.id);
  }

  // Retouche gratuite des textes.
  const first = created[0].video;
  const titled = first.storyboard.scenes.find((sc) => SCENES[sc.sceneId]?.slots.some((sl) => sl.key === 'title')) || first.storyboard.scenes[0];
  const hookKey = titled.key;
  const edited = await service.updateVideo('test-user', 'wax', first.id, { slots: { [hookKey]: { title: 'Un titre retouché à la main par la commerçante, beaucoup trop long pour la case' } } });
  check('retouche : texte borné à la longueur de la case', !!edited && (edited.storyboard.scenes.find((sc) => sc.key === hookKey)?.slots.title || '').length <= (SCENES[titled.sceneId].slots.find((sl) => sl.key === 'title')?.max || 999), edited?.storyboard.scenes.find((sc) => sc.key === hookKey)?.slots.title);
  const restyled = await service.updateVideo('test-user', 'wax', first.id, { style: 'premium' });
  check('retouche : changement de style', restyled?.storyboard.style === 'premium');
  await service.updateVideo('test-user', 'wax', first.id, { slots: { [hookKey]: { title: 'Vos pagnes à prix doux' } } });

  // Aperçu : HTML autonome, mise en page contrôlée dans Chromium.
  section('10. Aperçu et mise en page (Chromium)');
  for (const { c, video } of created) {
    const brand = brandById(c.brandId);
    const theme = buildVideoTheme(brand.branding, brand.name);
    const fresh = (await fake.listVideos('test-user', c.brandId)).find((v) => v.id === video.id)!;
    for (const format of fresh.scope.formats) {
      const assets = await inlineAssets(fresh.storyboard, theme);
      const { html, spec } = await composeVideoHtml({ ...assets, format, quality: 'standard', mode: 'render' });
      const external = (html.match(/<script[^>]+src=/g) || []).length;
      const audit = await layoutAudit(html, spec, fresh.storyboard.scenes);
      const layoutIssues = audit.issues.filter((i) => !i.startsWith('images'));
      check(`${c.id} · ${format} : aucun texte qui déborde, aucun élément hors cadre`, layoutIssues.length === 0, layoutIssues.slice(0, 4).join(' ; '));
      check(`${c.id} · ${format} : image identique quel que soit l’ordre de lecture`, audit.deterministic, audit.issues.filter((i) => i.startsWith('images')).join(' ; '));
      check(`${c.id} · ${format} : aucun script externe (moteur React embarqué)`, external === 0);
    }
    const preview = await service.previewHtml('test-user', c.brandId, video.id);
    check(`${c.id} : aperçu lecteur disponible (${Math.round((preview?.length || 0) / 1024)} ko)`, !!preview && preview.includes('"mode":"preview"'));
  }

  // Logo illisible (SVG invalide) : la signature affiche le nom de la marque.
  {
    const theme = buildVideoTheme(brandById('wax').branding, 'Wax & Co');
    theme.logo.onLight = `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><text>A & B</text></svg>').toString('base64')}`;
    theme.logo.onDark = theme.logo.onLight;
    const sb = buildStoryboard({ sceneIds: ['hook', 'logo'], slots: [{ title: 'Titre' }, {}], durationSec: 6, style: 'premium', seed: 1, images: [] });
    const { html, spec } = await composeVideoHtml({ storyboard: sb, theme, format: 'square', quality: 'standard', mode: 'render' });
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setViewport({ width: spec.width, height: spec.height });
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate(() => (window as any).__IDEM_VIDEO__.ready);
    await page.evaluate(() => (window as any).__IDEM_VIDEO__.seek(5.5));
    const state = await page.evaluate(() => {
      const scene = document.querySelector('section.scene-logo') as HTMLElement;
      return { img: !!scene.querySelector('.logo-img'), text: (scene.textContent || '').replace(/\s+/g, ' ').trim() };
    });
    await browser.close();
    check('logo illisible → nom de la marque à la place', !state.img && state.text.includes('Wax & Co'), JSON.stringify(state));
  }

  // 11. Rendu MP4 ─────────────────────────────────────────────────────────────
  if (!FAST) {
    section('11. Rendu MP4 sur nos serveurs (Puppeteer + ffmpeg)');
    const toRender = created.filter(({ c }) => ALL || c.render);
    for (const { c, video } of toRender) {
      currentCase = c;
      const started = Date.now();
      await service.startExport('test-user', c.brandId, video.id, undefined, { cost: 0, action: 'motion_video' });
      await drainRenderQueue();
      const done = (await fake.listVideos('test-user', c.brandId)).find((v) => v.id === video.id)!;
      const seconds = ((Date.now() - started) / 1000).toFixed(1);
      check(`${c.id} : export terminé en ${seconds} s (statut ${done.status})`, done.status === 'ready' && done.exportCount === 1);
      for (const r of done.renders) {
        const file = (r.url || '').replace('file://', '');
        if (r.status !== 'done' || !fs.existsSync(file)) {
          check(`${c.id} · ${r.format} : fichier produit`, false, r.error || 'absent');
          continue;
        }
        const info = await probe(file);
        const spec = frameSpec(r.format, done.scope.quality);
        check(
          `${c.id} · ${r.format} : ${info.width}×${info.height}, ${info.duration.toFixed(2)} s, ${Math.round(info.fps)} i/s, son ${info.hasAudio ? 'oui' : 'non'}, ${(r.sizeBytes! / 1024 / 1024).toFixed(1)} Mo`,
          info.width === spec.width && info.height === spec.height && Math.abs(info.duration - c.scope.durationSec) < 0.15 && Math.abs(info.fps - spec.fps) < 0.5 && info.hasAudio === (!!done.music || !!done.sfx?.enabled)
        );
        const target = path.join(OUT, `${c.id}-${r.format}.mp4`);
        fs.copyFileSync(file, target);
        contactSheet(target, path.join(OUT, `${c.id}-${r.format}-planche.jpg`), c.scope.durationSec);
        check(`${c.id} · ${r.format} : affiche produite`, !!r.posterUrl && fs.existsSync(r.posterUrl.replace('file://', '')));
      }
    }
    await closeRenderBrowser();
  }

  server.close();
  console.log(`\n${passes} vérifications réussies, ${failures} en échec — ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  console.log(`Fichiers : ${OUT}`);
  if (failures) {
    console.error('\n✗ Vidéos motion design : des vérifications échouent.');
    process.exit(1);
  }
  console.log('\n✓ Vidéos motion design : tout est conforme.');
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

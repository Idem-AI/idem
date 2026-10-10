/**
 * EXEMPLES DE CHAQUE TYPE DE MOTION — `npm run check:video:types`.
 *
 * Huit vidéos complètes, une par type (typographie, produit, offre flash,
 * vidéo + texte, vitrine 3D, animations Lottie, diaporama, révélation de logo),
 * rendues en MP4 avec :
 *   - de VRAIES musiques libres (Openverse, ccMixter) ;
 *   - de VRAIS effets sonores (Freesound CC0 via Openverse), nettoyés et mixés ;
 *   - de vrais médias : photos et vidéos Pexels, un modèle 3D GLB importé, une
 *     animation Lottie importée, un clip importé.
 *
 * Le modèle de langage est simulé (réponses écrites dans les cas) : aucun
 * crédit GLM n'est consommé. Réseau nécessaire (banques, Pexels).
 *
 *   npx ts-node --transpile-only api/scripts/checkMotionVideoTypes.ts            # les 8 types
 *   npx ts-node --transpile-only api/scripts/checkMotionVideoTypes.ts --only=3d  # un seul (id partiel)
 *   npx ts-node --transpile-only api/scripts/checkMotionVideoTypes.ts --generate # + une vidéo aux médias générés par les modèles GLM d'IDEM, avec voix off (payant)
 *
 * Sorties : `tmp/motion-video-examples/` (MP4, planches, index.html à ouvrir).
 */
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { spawnSync } from 'child_process';
import { loadSecrets } from '../config/secrets';
import { MotionVideo } from '../models/motionVideo.model';
import { IdemVideoStore } from '../services/Communication/video/idemVideoStore';
import { configureCore } from '../../../ivision/core/src/runtime/host';
import { MotionVideoService, drainRenderQueue } from '../../../ivision/core/src/video/motionVideo.service';
import { closeRenderBrowser, probe } from '../../../ivision/core/src/video/video.renderer';
import { videoCost } from '../../../ivision/core/src/video/video.pricing';
import { sfxLibrary } from '../../../ivision/core/src/video/video.sfx';
import { BRANDS, brandById } from './fixtures/motion-video/brands';
import { EXAMPLES, ExampleCase, makeBottleGlb, starsLottie, GENERATED_EXAMPLE } from './fixtures/motion-video/examples';
import { idemAnalyzeImage, idemGenerateImage, idemGenerateVideo, idemSynthesizeSpeech } from '../services/ivision/host';
import { simulateModel } from './fixtures/motion-video/cases';
import { makePhotos } from './fixtures/motion-video/media';

const OUT = path.resolve(__dirname, '../../tmp/motion-video-examples');
const FIX = path.join(OUT, 'fixtures');
fs.mkdirSync(FIX, { recursive: true });
process.env.RENDER_ALLOWED_HOSTS = '127.0.0.1,localhost';
process.env.VIDEO_ALLOW_FILE_URLS = '1';

let failures = 0;
function check(label: string, ok: boolean, detail = ''): void {
  if (ok) console.log(`  ✓ ${label}`);
  else {
    failures++;
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

class FakeCommunication {
  projects = new Map<string, any>();
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
  async loadProjectForVideo(_u: string, id: string) {
    return this.projects.get(id) || null;
  }
  async listVideos(_u: string, id: string): Promise<MotionVideo[]> {
    return JSON.parse(JSON.stringify(this.projects.get(id)?.analysisResultModel.communication.videos || []));
  }
  async saveVideo(_u: string, id: string, video: MotionVideo) {
    const c = this.projects.get(id).analysisResultModel.communication;
    c.videos = [...c.videos.filter((v: MotionVideo) => v.id !== video.id), JSON.parse(JSON.stringify(video))];
  }
  async mutateVideo(_u: string, id: string, videoId: string, fn: (v: MotionVideo) => MotionVideo) {
    const c = this.projects.get(id).analysisResultModel.communication;
    let out: MotionVideo | null = null;
    c.videos = c.videos.map((v: MotionVideo) => (v.id === videoId ? (out = JSON.parse(JSON.stringify(fn(v)))) : v));
    return out;
  }
  async removeVideo() {
    return true;
  }
}

const fakeStorage = {
  async uploadFile(content: Buffer | string, fileName: string, folder: string) {
    const dir = path.join(OUT, 'storage', folder.replace(/[^a-zA-Z0-9/_-]/g, '_'));
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, fileName);
    fs.writeFileSync(file, content);
    return { fileName, filePath: file, downloadURL: `file://${file}` };
  },
};

/** Les fichiers « importés » par l'utilisateur, fabriqués ou téléchargés une fois. */
async function prepareImports(): Promise<Record<string, { file: string; mimetype: string; name: string }>> {
  const photos = await makePhotos(path.join(FIX, 'photos'));
  const out: Record<string, { file: string; mimetype: string; name: string }> = {};
  for (const [name, file] of Object.entries(photos)) out[`photo:${name}`] = { file, mimetype: 'image/jpeg', name: `${name}.jpg` };

  const glb = path.join(FIX, 'bouteille-bissap.glb');
  await makeBottleGlb(glb, { glass: '#9f1239', label: '#fff7f9', cap: '#065f46' });
  out['glb:bottle'] = { file: glb, mimetype: 'model/gltf-binary', name: 'bouteille-bissap.glb' };

  const stars = path.join(FIX, 'etoiles-avis.json');
  fs.writeFileSync(stars, JSON.stringify(starsLottie('#facc15')));
  out['lottie:stars'] = { file: stars, mimetype: 'application/json', name: 'etoiles-avis.json' };

  // Un « clip du commerçant » : une vraie vidéo de marché, téléchargée sur Pexels.
  const clip = path.join(FIX, 'marche.mp4');
  if (!fs.existsSync(clip) && process.env.PEXELS_API_KEY) {
    const res = await axios.get('https://api.pexels.com/videos/search', {
      headers: { Authorization: process.env.PEXELS_API_KEY },
      params: { query: 'african market food', per_page: 5, orientation: 'portrait', size: 'medium' },
      timeout: 10000,
    });
    const video = (res.data?.videos || []).find((v: any) => v.duration >= 5 && v.duration <= 30);
    const file = video?.video_files?.filter((f: any) => f.height >= 720).sort((a: any, b: any) => a.height - b.height)[0];
    if (file) fs.writeFileSync(clip, Buffer.from((await axios.get(file.link, { responseType: 'arraybuffer', timeout: 60000 })).data));
  }
  if (fs.existsSync(clip)) out['clip:market'] = { file: clip, mimetype: 'video/mp4', name: 'marche.mp4' };
  return out;
}

function contactSheet(mp4: string, out: string, duration: number, landscape: boolean): void {
  const n = 14;
  const frames: string[] = [];
  for (let i = 0; i < n; i++) {
    const f = path.join(OUT, `.f${i}.jpg`);
    spawnSync('ffmpeg', ['-v', 'error', '-y', '-ss', (((i + 0.5) * duration) / n).toFixed(2), '-i', mp4, '-frames:v', '1', '-vf', landscape ? 'scale=480:-2' : 'scale=-2:480', f]);
    frames.push(f);
  }
  spawnSync('ffmpeg', ['-v', 'error', '-y', ...frames.flatMap((f) => ['-i', f]), '-filter_complex', `${frames.map((_, i) => `[${i}:v]`).join('')}xstack=inputs=${n}:grid=7x2:fill=white`, out]);
  frames.forEach((f) => fs.rmSync(f, { force: true }));
}

interface Result {
  c: ExampleCase;
  video: MotionVideo;
  mp4?: string;
  sheet?: string;
  seconds?: number;
  cues?: Record<string, number>;
}

async function main() {
  await loadSecrets().catch(() => undefined);
  const only = process.argv.find((a) => a.startsWith('--only='))?.split('=')[1];
  const generate = process.argv.includes('--generate');
  const cases = [...EXAMPLES, ...(generate ? [GENERATED_EXAMPLE] : [])].filter((c) => !only || c.id.includes(only));

  console.log('\nSonothèque (Freesound CC0 via Openverse)…');
  const lib = await sfxLibrary();
  for (const [kind, list] of Object.entries(lib.sounds)) console.log(`  ${kind.padEnd(10)} ${list.map((s) => `« ${s.title.slice(0, 26)} » (${s.author})`).slice(0, 3).join(' · ')}`);

  console.log('\nFichiers importés (photos, GLB, Lottie, clip)…');
  const imports = await prepareImports();
  console.log(`  ${Object.keys(imports).join(', ')}`);

  const fake = new FakeCommunication();
  let current: ExampleCase = cases[0];
  const service = new MotionVideoService(new IdemVideoStore(fake as any), () => (system, user) => simulateModel({ ...current, behaviour: 'clean' } as any)(system, user));
  // `--generate` : les vrais modèles d'IDEM (GLM-Image, CogVideoX-3, GLM-TTS ou son repli, vision) ;
  // sinon aucun port de génération, les médias viennent des imports et de Pexels.
  configureCore(generate ? { storage: fakeStorage, generateImage: idemGenerateImage, generateVideo: idemGenerateVideo, synthesizeSpeech: idemSynthesizeSpeech, analyzeImage: idemAnalyzeImage } : { storage: fakeStorage });

  const results: Result[] = [];
  for (const c of cases) {
    current = c;
    console.log(`\n${c.id} — type « ${c.type} », ${c.scope.durationSec} s, ${c.scope.formats.join('+')}`);
    const media = [];
    for (const key of c.imports || []) {
      const imp = imports[key];
      if (!imp) {
        console.log(`  (import ${key} indisponible)`);
        continue;
      }
      media.push(await service.uploadMedia('user', c.brandId, { buffer: fs.readFileSync(imp.file), mimetype: imp.mimetype, originalname: imp.name }));
    }
    const started = Date.now();
    const video = await service.createVideo('user', c.brandId, { brief: { ...c.brief, media }, scope: c.scope, type: c.type }, videoCost(c.scope));
    const report = service.lastMediaReport;
    console.log(`  scènes : ${video.storyboard.scenes.map((s) => `${s.sceneId}/${s.variant}`).join(' → ')}`);
    console.log(`  médias : ${media.length} importés · Pexels ${report?.stockPhotos ?? 0} photos, ${report?.stockVideos ?? 0} vidéos · générés ${report?.generatedVideos ?? 0} clip(s) — recherche « ${report?.query ?? ''} »`);
    console.log(`  musique : ${video.music ? `« ${video.music.title} » par ${video.music.artist} (${video.music.provider}, ${video.music.license}, ${video.music.beat?.bpm} BPM)` : 'aucune'}`);
    console.log(`  effets : ${Object.values(video.sfx?.sounds || {}).map((s) => `${s!.kind}=« ${s!.title.slice(0, 22)} »`).join(' · ')}`);

    const ids = video.storyboard.scenes.map((s) => s.sceneId);
    const expect: Record<string, () => boolean> = {
      kinetic: () => ids.includes('kinetic'),
      product: () => ids.includes('product') && video.storyboard.scenes.some((s) => s.image),
      promo: () => ids.includes('offer'),
      footage: () => video.storyboard.scenes.some((s) => s.sceneId === 'footage' && s.video),
      showcase3d: () => video.storyboard.scenes.some((s) => s.sceneId === 'showcase3d' && s.model),
      illustrated: () => video.storyboard.scenes.filter((s) => s.sceneId === 'lottie').length >= 2 && video.storyboard.scenes.some((s) => s.lottie && !s.lottie.startsWith('builtin:')),
      slideshow: () => ids.includes('gallery'),
      logo: () => ids.includes('logo'),
    };
    check(`${c.id} : la vidéo porte bien la signature de son type`, expect[c.type](), ids.join(','));
    check(`${c.id} : musique réelle trouvée dans une banque`, !!video.music && video.music.provider !== 'local' || c.brief.musicMood === 'none', video.music?.provider);
    check(`${c.id} : effets sonores de banque retenus`, Object.values(video.sfx?.sounds || {}).some((s) => s && s.license === 'cc0'));

    await service.startExport('user', c.brandId, video.id, undefined, { cost: 0, action: 'motion_video' });
    await drainRenderQueue();
    const done = (await fake.listVideos('user', c.brandId)).find((v) => v.id === video.id)!;
    const seconds = Math.round((Date.now() - started) / 1000);
    const r: Result = { c, video: done, seconds };
    for (const render of done.renders) {
      const file = (render.url || '').replace('file://', '');
      if (render.status !== 'done' || !fs.existsSync(file)) {
        check(`${c.id} · ${render.format} : MP4 produit`, false, render.error);
        continue;
      }
      const info = await probe(file);
      const target = path.join(OUT, `${c.id}-${render.format}.mp4`);
      fs.copyFileSync(file, target);
      const sheet = target.replace(/\.mp4$/, '-planche.jpg');
      contactSheet(target, sheet, c.scope.durationSec, render.format === 'landscape');
      r.mp4 = path.basename(target);
      r.sheet = path.basename(sheet);
      check(
        `${c.id} · ${render.format} : ${info.width}×${info.height}, ${info.duration.toFixed(2)} s, son ${info.hasAudio ? 'oui' : 'non'}, ${(render.sizeBytes! / 1024 / 1024).toFixed(1)} Mo — ${seconds} s au total`,
        info.hasAudio && Math.abs(info.duration - c.scope.durationSec) < 0.2
      );
    }
    results.push(r);
  }
  await closeRenderBrowser();

  // Galerie locale : les vidéos, leurs scènes et tous les crédits.
  const rows = results
    .map((r) => {
      const credits = [
        r.video.music ? `Musique : ${r.video.music.attribution}` : '',
        ...Object.values(r.video.sfx?.sounds || {}).map((s) => `Effet « ${s!.kind} » : ${s!.title} — ${s!.author} (CC0)${s!.sourceUrl ? ` ${s!.sourceUrl}` : ''}`),
        ...(r.video.media || []).filter((m) => m.credit).map((m) => `${m.credit}${m.sourceUrl ? ` — ${m.sourceUrl}` : ''}`),
      ].filter(Boolean);
      return `<section><h2>${r.c.id} · ${r.c.type}</h2><p>${r.video.storyboard.scenes.map((s) => s.sceneId).join(' → ')}</p>
${r.mp4 ? `<video src="${r.mp4}" controls playsinline preload="metadata"></video>` : '<p>rendu absent</p>'}
${r.sheet ? `<img src="${r.sheet}" alt="">` : ''}
<details><summary>Crédits</summary><ul>${credits.map((cr) => `<li>${cr.replace(/</g, '&lt;')}</li>`).join('')}</ul></details></section>`;
    })
    .join('\n');
  fs.writeFileSync(
    path.join(OUT, 'index.html'),
    `<!doctype html><meta charset="utf-8"><title>Exemples motion design IDEM</title><style>body{font:15px system-ui;margin:24px;background:#faf8f5;color:#1c1917}section{margin:0 0 40px}video{max-height:70vh;max-width:100%;display:block;margin:8px 0;border-radius:10px;background:#000}img{max-width:100%;border-radius:8px}h2{margin:0 0 4px}</style><h1>Exemples par type de motion</h1>${rows}`
  );

  console.log(`\nGalerie : ${path.join(OUT, 'index.html')}`);
  if (failures) {
    console.error(`\n✗ ${failures} vérification(s) en échec.`);
    process.exit(1);
  }
  console.log('\n✓ Tous les types de motion ont produit leur exemple.');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

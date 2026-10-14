/**
 * `npm run check:motion` — le moteur Motion Canvas, de bout en bout, sans modèle :
 *
 *   1. chaque exemple du kit (`motion/examples`) compile ;
 *   2. un film fait de ces exemples est contrôlé (exécution de chaque scène, vignettes) ;
 *   3. une scène fautive est attribuée à SA scène, les autres restent intactes ;
 *   4. le film est rendu en MP4 : durée exacte, image et son lisibles (ffprobe) ;
 *   5. la référence d'API donnée à l'auteur existe dans la version installée de Motion Canvas ;
 *   6. la création complète avec des modèles SIMULÉS (directeur, planificateur, auteur) : textes du
 *      scénario repris, chiffre inventé retiré et signalé, AUTOCORRECTION bornée (compilation et
 *      exécution ; trois approches au plus, une à la fois, montée de modèle, budget de jetons ; ce qui
 *      résiste reste signalé), « Corriger », retouche de texte (le code ne change pas), retouche
 *      écrite, aperçu, export MP4 ; une vidéo de l'ancien moteur reste en lecture seule.
 *
 * Sorties dans `apps/ivision/core/tmp/check-motion/` (vignettes, MP4, images tirées du MP4).
 */
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import sharp from 'sharp';
import { buildFilmBundle, compileScene } from '../src/video/rendering/compiler';
import { closeFilmBrowser, localizeFilm, probeFilm, renderFilm, cleanupFilmRender } from '../src/video/rendering/runner';
import { previewPageHtml } from '../src/video/rendering/preview';
import { COMPOSITION, frameSpec } from '../src/video/rendering/formats';
import { probe } from '../src/video/rendering/ffmpeg';
import type { FilmData } from '../motion/runtime/film-data';
import { MC_SYMBOLS } from '../src/video/author/api-reference';
import { configureCore } from '../src/runtime/host';
import { drainRenderQueue, MotionVideoService } from '../src/video/motionVideo.service';
import type { VideoStore } from '../src/video/contracts/store';
import type { MotionVideo } from '../src/video/contracts/model';
import type { AgentCall } from '../src/creativity/orchestrator';

process.env.VIDEO_ALLOW_FILE_URLS = '1';
const OUT = path.resolve(__dirname, '../tmp/check-motion');
const EXAMPLES = path.resolve(__dirname, '../motion/examples');
let failures = 0;
const check = (ok: boolean, label: string, detail = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};

async function fixtures() {
  fs.mkdirSync(OUT, { recursive: true });
  const photo = path.join(OUT, 'photo.jpg');
  if (!fs.existsSync(photo)) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1500"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e9a23b"/><stop offset="1" stop-color="#7b2d26"/></linearGradient></defs><rect width="1200" height="1500" fill="url(#g)"/><circle cx="600" cy="640" r="320" fill="#f6efe2" opacity="0.85"/><rect x="380" y="560" width="440" height="300" rx="40" fill="#2f5d50"/></svg>`;
    await sharp(Buffer.from(svg)).jpeg({ quality: 88 }).toFile(photo);
  }
  const clip = path.join(OUT, 'clip.webm');
  if (!fs.existsSync(clip)) execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=720x1280:rate=30:duration=5', '-c:v', 'libvpx-vp9', '-b:v', '1M', clip]);
  return { photo: `file://${photo}`, clip: `file://${clip}` };
}

async function main() {
  const media = await fixtures();
  const files = fs.readdirSync(EXAMPLES).filter((f) => f.endsWith('.tsx')).sort();
  const sources: Record<string, string> = {};
  for (const f of files) {
    const code = fs.readFileSync(path.join(EXAMPLES, f), 'utf8');
    const res = await compileScene(code);
    check(res.ok, `compile ${f}`, res.error || '');
    sources[f.replace('.tsx', '')] = code;
  }
  // Un import inutilisé est retiré par TypeScript (sans effet) : celui-ci sert.
  const bad = await compileScene(`import fs from 'fs';\nexport default function* () { fs.readFileSync('/etc/passwd'); }`);
  check(!bad.ok && /import interdit/.test(bad.error || ''), 'import interdit refusé', bad.error);
  const syntax = await compileScene(`export default function* (view) { view.add(<Rect }`);
  check(!syntax.ok && /ligne \d+/.test(syntax.error || ''), 'erreur de syntaxe localisée', syntax.error);

  // Le film : chaque exemple est une scène ; une scène qui plante à l'exécution est ajoutée.
  const order = ['typography', 'photo', 'infographic', 'interface', 'clip', 'logo-transition'];
  const keys = order.map((_, i) => `s${i + 1}`);
  const crashing = `export default function* (view, ctx) { yield* (null as any).boom(); }`;
  const scenes = [...order.map((name, i) => ({ key: keys[i], code: sources[name] })), { key: 's7', code: crashing }];
  const durations = [2.5, 2.5, 2.5, 3, 2, 2.5, 1];
  let start = 0;
  const format = 'story' as const;
  const spec = frameSpec(format, 'standard');
  const data: FilmData = {
    format,
    ...COMPOSITION[format],
    resolutionScale: spec.scale,
    fps: spec.fps,
    background: '#fbfaf7',
    lang: 'fr',
    fontFamilies: ['Inter'],
    brand: { name: 'Kora Café', colors: { primary: '#1f6f4a', secondary: '#14324a', accent: '#f2a93b', background: '#fbfaf7', text: '#16181d' }, fonts: { display: 'Inter', body: 'Inter' } },
    scenes: scenes.map((s, i) => {
      const scene = {
        key: s.key,
        start,
        duration: durations[i],
        texts: { headline: 'Le café qui réveille Dakar', sub: 'Torréfié chaque matin', caption: 'Grains du Fouta', figure: '1 250 clients', label: 'servis chaque semaine', button: 'Commander', cta: 'Commandez sur WhatsApp' },
        media: [
          { id: 'm1', kind: 'image' as const, url: media.photo, width: 1200, height: 1500, note: 'photo' },
          { id: 'm2', kind: 'video' as const, url: media.clip, width: 720, height: 1280, durationSec: 5 },
        ],
      };
      start += durations[i];
      return scene;
    }),
    captions: [{ text: 'Le café qui réveille Dakar.', start: 0.3, end: 2.3 }],
  };
  const total = durations.reduce((a, b) => a + b, 0);
  const bundle = await buildFilmBundle(scenes, 'render');
  check(bundle.length > 100000, 'paquet du film construit', `${Math.round(bundle.length / 1024)} ko`);

  const local = await localizeFilm(data);
  const t0 = Date.now();
  const probed = await probeFilm({ data: local.data, bundle, fontCss: '', files: local.files });
  check(probed.errors.length === 1 && probed.errors[0].key === 's7', 'seule la scène fautive est en erreur', JSON.stringify(probed.errors));
  check(Object.keys(probed.thumbnails).length === scenes.length, 'une vignette par scène', `${Date.now() - t0} ms`);
  check(probed.cues.some((c) => c.kind === 'click' && c.scene === 's4'), 'effet sonore posé par le code relevé', JSON.stringify(probed.cues.slice(0, 4)));
  for (const [key, buf] of Object.entries(probed.thumbnails)) fs.writeFileSync(path.join(OUT, `thumb-${key}.jpg`), buf);

  const previewBundle = await buildFilmBundle(scenes, 'preview');
  const html = await previewPageHtml({ data: { ...data, resolutionScale: 0.5 }, audio: { voice: [], sfx: {} }, bundle: previewBundle, fontCss: '' });
  fs.writeFileSync(path.join(OUT, 'preview.html'), html);
  check(html.includes('Content-Security-Policy') && html.length > 100000, 'page d’aperçu autonome', `${Math.round(html.length / 1024)} ko`);

  const t1 = Date.now();
  const out = await renderFilm({ data: local.data, bundle, fontCss: '', files: local.files, durationSec: total, quality: 'standard', concurrency: Number(process.env.CONC || 3), onProgress: process.env.DEBUG_PROGRESS ? (r) => console.log('progress', r.toFixed(2)) : undefined });
  const info = await probe(out.file);
  check(Math.abs(info.duration - total) < 0.1, 'durée exacte du MP4', `${info.duration.toFixed(2)} s pour ${total} s, rendu en ${Date.now() - t1} ms`);
  check(info.width === spec.width && info.height === spec.height, 'dimensions de sortie', `${info.width}×${info.height}`);
  fs.copyFileSync(out.file, path.join(OUT, 'film.mp4'));
  fs.copyFileSync(out.poster, path.join(OUT, 'poster.jpg'));
  let at = 0;
  for (let i = 0; i < durations.length; i++) {
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', (at + durations[i] * 0.85).toFixed(2), '-i', out.file, '-frames:v', '1', path.join(OUT, `frame-s${i + 1}.jpg`)]);
    at += durations[i];
  }
  cleanupFilmRender(out);

  await apiReference();
  await pipeline(media, sources);
  await closeFilmBrowser();
  console.log(failures ? `\n${failures} échec(s)` : '\nTout est vert.');
  process.exit(failures ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await closeFilmBrowser();
  process.exit(1);
});

/** 5. Chaque nom cité par la référence d'API s'importe depuis les paquets installés (esbuild refuse un import absent). */
async function apiReference() {
  const lines = Object.entries(MC_SYMBOLS).map(([mod, names]) => `import { ${names.join(', ')} } from '${mod}';`);
  const all = Object.values(MC_SYMBOLS).flat();
  const code = `${lines.join('\n')}\nconst used: unknown[] = [${all.join(', ')}];\nexport default function* () { if (used.length < 0) yield; }`;
  try {
    await buildFilmBundle([{ key: 's1', code }], 'render');
    check(true, 'référence d’API : tous les noms existent dans la version installée', `${all.length} noms`);
  } catch (error) {
    check(false, 'référence d’API : tous les noms existent dans la version installée', String((error as Error).message).slice(0, 400));
  }
}

/** 6. La création de bout en bout, modèles simulés. */
async function pipeline(media: { photo: string; clip: string }, sources: Record<string, string>) {
  const storageDir = path.join(OUT, 'storage');
  fs.mkdirSync(storageDir, { recursive: true });
  configureCore({
    storage: {
      uploadFile: async (content, fileName, folder) => {
        const dir = path.join(storageDir, folder);
        fs.mkdirSync(dir, { recursive: true });
        const file = path.join(dir, fileName);
        fs.writeFileSync(file, content);
        return { downloadURL: `file://${file}` };
      },
    },
  });
  const videos = new Map<string, MotionVideo>();
  const legacy = { id: 'video-old', title: 'Ancienne', brief: { objective: 'promotion', message: 'old', musicMood: 'none' }, scope: { durationSec: 15, formats: ['story'], quality: 'hd' }, storyboard: { version: 1, scenes: [] }, renders: [{ format: 'story', status: 'done', progress: 1, url: 'https://x/old.mp4' }], status: 'ready', paidCredits: 120, exportCount: 1, createdAt: '2026-10-01', updatedAt: '2026-10-01' } as unknown as MotionVideo;
  videos.set(legacy.id, legacy);
  const store: VideoStore = {
    loadBrand: async () => ({ brandName: 'Kora Café', branding: { colors: { colors: { primary: '#1f6f4a', secondary: '#14324a', accent: '#f2a93b', background: '#fbfaf7', text: '#16181d' } } } as never, voice: { tone: 'chaleureux', language: 'fr' }, visuals: [], videos: [...videos.values()] }),
    listVideos: async () => [...videos.values()],
    saveVideo: async (_u, _p, v) => void videos.set(v.id, v),
    mutateVideo: async (_u, _p, id, fn) => {
      const v = videos.get(id);
      if (!v) return null;
      const next = fn(v);
      videos.set(id, next);
      return next;
    },
    removeVideo: async (_u, _p, id) => videos.delete(id),
  };
  const calls: Record<string, number> = {};
  /** Ce que reçoit chaque appel d'auteur : scène, cran (donc modèle) et stratégie de correction. */
  const authorLog: { scene: number; level?: string; strategy: string }[] = [];
  const broken = `export default function* (view, ctx) { view.add(<Rect width={100} }`;
  // Compile, mais plante à l'exécution : seul le contrôle réel (Motion Canvas) peut le voir.
  const crashing = `export default function* (view, ctx) { const n: any = null; yield* n.go(); }`;
  /** fixable : la scène 3 casse au premier jet et se corrige ; stubborn : elle casse toujours ; runtime : elle plante à l'exécution puis se corrige. */
  let mode: 'fixable' | 'stubborn' | 'runtime' = 'fixable';
  const call: AgentCall = async ({ role, user, level }) => {
    calls[role] = (calls[role] || 0) + 1;
    if (role === 'video.concept') return 'TITLE: Le café qui réveille\nCONCEPT: Une journée qui commence par une tasse.\nBIBLE: fond crème, vert de la marque, gros titres serrés, mouvements nets.\nSCENE 1: le titre se pose mot à mot\nSCENE 2: la photo des grains\nSCENE 3: le chiffre de la semaine\nSCENE 4: la signature';
    if (role === 'video.planner')
      return [
        'TITLE: Le café qui réveille',
        'CONCEPT: Une journée qui commence par une tasse.',
        'BIBLE: fond crème, vert de la marque.',
        'SCENE 1 | 4', 'purpose: accrocher', 'visual: titre géant à gauche', 'motion: mots qui montent', 'text.headline: Le café qui réveille Dakar', 'text.sub: Torréfié chaque matin', 'voice: Le café qui réveille Dakar.',
        'SCENE 2 | 4', 'purpose: montrer le produit', 'visual: la photo dans un cadre arrondi', 'motion: travelling avant', 'media: m1', 'text.caption: Grains du Fouta',
        'SCENE 3 | 3', 'purpose: prouver', 'visual: un compteur et des barres', 'motion: barres qui poussent', 'text.figure: 1 250 clients', 'text.label: servis chaque semaine', 'text.promo: -50 % ce week-end',
        'SCENE 4 | 4', 'purpose: signer', 'visual: logo sur le vert', 'motion: glisse depuis la droite', 'transition: slide', 'text.cta: Commandez sur WhatsApp',
      ].join('\n');
    if (role === 'video.author') {
      const strategy = /IT FAILS WITH/.test(user) ? 'fix' : /SIMPLEST version/.test(user) ? 'minimal' : /FAILED with/.test(user) ? 'rewrite' : 'first';
      const scene = Number(user.match(/scene (\d) of/)?.[1] || 1);
      authorLog.push({ scene, level, strategy });
      if (scene === 3 && (mode === 'stubborn' || strategy === 'first')) return '```tsx\n' + (mode === 'runtime' ? crashing : broken) + '\n```';
      const pick = ['typography', 'photo', 'infographic', 'logo-transition'][scene - 1];
      return 'Voici la scène :\n```tsx\n' + sources[pick] + '\n```';
    }
    if (role === 'video.reviser') return 'TEXT s1.headline: Le café du matin\nVISUAL s2: le cadre entre plus lentement\nREPLY: C’est fait.';
    return '';
  };
  const service = new MotionVideoService(store, call);
  const request = 'Une vidéo pour Kora Café : 1 250 clients chaque semaine, café torréfié chaque matin à Dakar. Commandez sur WhatsApp.';
  const create = (onProgress?: (e: { stage: string; state: string }) => void) =>
    service.createVideo('u1', 'p1', { brief: { message: request, request, musicMood: 'none', sfx: false, media: [{ id: 'up1', kind: 'image', url: media.photo, width: 1200, height: 1500, origin: 'upload' }] as never, allowGenerate: false, allowStock: false }, scope: { durationSec: 15, formats: ['story'], quality: 'standard' }, creativity: 'medium' }, 120, onProgress);
  const s3Calls = () => authorLog.filter((x) => x.scene === 3);
  const events: string[] = [];
  const video = await create((e) => events.push(`${e.stage}:${e.state}`));
  const film = video.film!;
  check(film.scenes.length === 4 && film.engine === 'motion-canvas', 'création : un film Motion Canvas de 4 scènes', `${film.scenes.length} scènes`);
  check(Math.abs(film.scenes.reduce((a, s) => a + s.duration, 0) - 15) < 0.01, 'les durées font la durée achetée');
  check(calls['video.concept'] === 1 && calls['video.planner'] === 1, 'directeur et planificateur, une fois chacun', JSON.stringify(calls));
  check(!('promo' in film.scenes[2].texts) && (film.fidelity?.notes || []).some((n) => /50/.test(n)), 'un chiffre absent de la demande n’est pas affiché, et c’est dit', (film.fidelity?.notes || []).join(' | '));
  check(film.scenes[1].media.includes('m1') && (video.media || []).some((m) => m.id === 'm1' && m.origin === 'upload'), 'la photo importée est le média m1 de la scène 2');
  check(film.scenes.every((s) => s.status === 'ready' && !!s.thumbnail), 'autocorrection : la scène 3 cassée au premier jet est corrigée AVANT livraison', JSON.stringify(film.scenes.map((s) => s.error)));
  check(JSON.stringify(s3Calls().map((x) => x.strategy)) === '["first","fix"]' && film.repair?.fixed.join() === 's3' && film.repair.attempts === 1 && film.scenes[2].author?.repairs?.[0]?.strategy === 'fix', 'une seule tentative suffit : « corriger » au même modèle, puis rien de plus', JSON.stringify({ calls: s3Calls(), repair: film.repair }));
  check(['plan:done', 'concept:done', 'storyboard:done', 'code:done', 'check:done', 'repair:done'].every((e) => events.includes(e)), 'progression réelle (SSE), correction comprise', events.filter((e) => e.endsWith('done')).join(' '));

  // Une scène qui résiste : trois approches au plus, une à la fois, le modèle monte d'un cran ; puis elle reste signalée.
  mode = 'stubborn';
  authorLog.length = 0;
  const stubborn = await create();
  const sb = stubborn.film!;
  check(JSON.stringify(s3Calls().map((x) => x.strategy)) === '["first","fix","rewrite","minimal"]', 'scène qui résiste : corriger › réécrire › version minimale, puis on s’arrête (3 tentatives au plus)', JSON.stringify(s3Calls()));
  check(JSON.stringify(s3Calls().map((x) => x.level)) === '["medium","medium","high","high"]', 'changer d’approche = le modèle du cran au-dessus (Medium → High)', JSON.stringify(s3Calls().map((x) => x.level)));
  check(sb.scenes[2].status === 'error' && sb.repair?.unresolved.join() === 's3' && sb.repair.attempts === 3 && sb.scenes.filter((s) => s.key !== 's3').every((s) => s.status === 'ready'), 'non résolue : la scène reste signalée, les autres sont prêtes', JSON.stringify(sb.repair));
  await service.startExport('u1', 'p1', stubborn.id, stubborn.scope).then(
    () => check(false, 'export refusé tant qu’une scène est en erreur'),
    (e) => check(/scene_errors/.test(e.message), 'export refusé tant qu’une scène est en erreur', e.message)
  );
  mode = 'fixable';
  authorLog.length = 0;
  const manual = await service.updateVideo('u1', 'p1', stubborn.id, { fix: ['s3'] });
  check(manual!.film!.scenes[2].status === 'ready' && JSON.stringify(s3Calls().map((x) => x.strategy)) === '["fix"]', '« Corriger » (demandé) : la même boucle bornée, une tentative ici', JSON.stringify(s3Calls()));

  // Une erreur d'EXÉCUTION (le code compile) : vue par le contrôle réel, corrigée de même.
  mode = 'runtime';
  authorLog.length = 0;
  const runtime = await create();
  check(runtime.film!.scenes[2].status === 'ready' && runtime.film!.repair?.fixed.join() === 's3' && /reading 'go'/.test(runtime.film!.scenes[2].author?.repairs?.[0]?.error || 'x') === false, 'erreur d’exécution détectée par Motion Canvas puis corrigée', JSON.stringify(runtime.film!.repair));

  // Le budget de jetons coupe la correction pour tout le film, même au milieu des approches.
  mode = 'stubborn';
  authorLog.length = 0;
  process.env.VIDEO_REPAIR_TOKEN_BUDGET = '1';
  const capped = await create();
  delete process.env.VIDEO_REPAIR_TOKEN_BUDGET;
  check(capped.film!.repair?.attempts === 1 && capped.film!.repair.stopped === 'budget' && s3Calls().length === 2, 'budget épuisé : arrêt net après une tentative (stopped = budget)', JSON.stringify(capped.film!.repair));
  mode = 'fixable';

  const codeBefore = film.scenes[0].code;
  const edited = await service.updateVideo('u1', 'p1', video.id, { texts: { s1: { headline: 'Le meilleur café de Dakar', invented: 'x' } } });
  check(edited!.film!.scenes[0].texts.headline === 'Le meilleur café de Dakar' && !('invented' in edited!.film!.scenes[0].texts) && edited!.film!.scenes[0].code === codeBefore, 'retouche de texte : la donnée change, le code non');

  const revised = await service.reviseFromText('u1', 'p1', video.id, 'Change le titre et fais entrer la photo plus lentement', 'fr');
  check(revised.video!.film!.scenes[0].texts.headline === 'Le café du matin' && revised.report.recoded.includes('s2'), 'retouche écrite : texte changé, scène 2 réécrite par l’auteur', JSON.stringify(revised.report));

  const html = await service.previewHtml('u1', 'p1', video.id);
  check(!!html && html.includes('__IDEM_FILM__') && html.includes('connect-src') && html.includes('data:image/jpeg;base64'), 'aperçu : page autonome, réseau coupé, photo embarquée', `${Math.round((html?.length || 0) / 1024)} ko`);
  fs.writeFileSync(path.join(OUT, 'pipeline-preview.html'), html || '');

  const t0 = Date.now();
  await service.startExport('u1', 'p1', video.id, { formats: ['story'], quality: 'standard' });
  await drainRenderQueue();
  const done = (await service.getVideo('u1', 'p1', video.id))!;
  const render = done.renders.find((r) => r.status === 'done');
  const info = render?.url ? await probe(render.url.replace('file://', '')) : null;
  check(!!info && Math.abs(info.duration - 15) < 0.1 && done.status === 'ready' && done.exportCount === 1, 'export MP4 de 15 s', `${info?.duration.toFixed(2)} s en ${Date.now() - t0} ms`);
  if (render?.url) fs.copyFileSync(render.url.replace('file://', ''), path.join(OUT, 'pipeline.mp4'));

  const old = (await service.listVideos('u1', 'p1')).find((v) => v.id === 'video-old');
  const oldPreview = await service.previewHtml('u1', 'p1', 'video-old').then(() => 'ok', (e) => e.message);
  check(!!old?.legacy && oldPreview === 'legacy_video' && old.renders[0].url === 'https://x/old.mp4', 'ancienne vidéo : lecture seule, MP4 conservé');
}

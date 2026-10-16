/**
 * `npm run check:motion` — le moteur vidéo, de bout en bout, sans modèle :
 *
 *   1. un film fait des programmes d'exemple (langage de mouvement compilé) est contrôlé : exécution de chaque
 *      scène, vignettes, effets sonores ; une scène fautive est attribuée à SA scène, les autres restent intactes ;
 *   2. une scène écrite avant le langage qui importe un nom inexistant ne fait plus tomber le film entier ;
 *   3. le film est rendu en MP4 : durée exacte (ffprobe) ;
 *   4. la création complète avec des modèles SIMULÉS (directeur, planificateur, auteur de programmes) : textes du
 *      scénario repris, chiffre inventé retiré et signalé, programme refusé puis redemandé avec ses erreurs,
 *      AUTOCORRECTION bornée (trois approches au plus, une à la fois, montée de modèle, budget de jetons ; ce qui
 *      résiste reste signalé), défaut d'AFFICHAGE (textes qui se chevauchent) corrigé avant livraison, vidéo en
 *      DEUX formats (un seul programme, contrôlé dans chacun), « Corriger », retouche de texte (le code ne change
 *      pas), retouche écrite, scène écrite avant le langage réécrite en programme, aperçu, export MP4 ; une vidéo
 *      de l'ancien moteur reste en lecture seule.
 *
 * Sorties dans `apps/ivision/core/tmp/check-motion/` (vignettes, MP4, images tirées du MP4).
 */
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import sharp from 'sharp';
import { buildFilmBundle } from '../src/video/rendering/compiler';
import { closeFilmBrowser, localizeFilm, probeFilm, renderFilm, cleanupFilmRender } from '../src/video/rendering/runner';
import { COMPOSITION, frameSpec } from '../src/video/rendering/formats';
import { probe } from '../src/video/rendering/ffmpeg';
import type { FilmData } from '../motion/runtime/film-data';
import { configureCore, coreHost } from '../src/runtime/host';
import { cutPoints, fitScenesToVoice, synthesizeVoice, personaById } from '../src/video/audio/voice';
import { drainRenderQueue, MotionVideoService } from '../src/video/motionVideo.service';
import type { VideoStore } from '../src/video/contracts/store';
import type { MotionVideo } from '../src/video/contracts/model';
import type { AgentCall } from '../src/creativity/orchestrator';
import { compileProgram, PROGRAM_EXAMPLES, programOf, validateProgram } from '../../../../packages/motion-compiler/src';
import type { MotionProgram } from '../../../../packages/motion-compiler/src';

process.env.VIDEO_ALLOW_FILE_URLS = '1';
process.env.VIDEO_SFX_OFFLINE = '1';
const OUT = path.resolve(__dirname, '../tmp/check-motion');
let failures = 0;
const check = (ok: boolean, label: string, detail = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${!ok && detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};

async function fixtures() {
  fs.mkdirSync(OUT, { recursive: true });
  const photo = path.join(OUT, 'photo.jpg');
  if (!fs.existsSync(photo)) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1500"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e9a23b"/><stop offset="1" stop-color="#7b2d26"/></linearGradient></defs><rect width="1200" height="1500" fill="url(#g)"/><circle cx="600" cy="640" r="320" fill="#f6efe2" opacity="0.85"/><rect x="380" y="560" width="440" height="300" rx="40" fill="#2f5d50"/></svg>`;
    await sharp(Buffer.from(svg)).jpeg({ quality: 88 }).toFile(photo);
  }
  return { photo: `file://${photo}` };
}

const BRAND = { name: 'Kora Café', colors: { primary: '#1f6f4a', secondary: '#14324a', accent: '#f2a93b', background: '#fbfaf7', text: '#16181d' }, fonts: { display: 'Inter', body: 'Inter' } };
const TEXTS: Record<string, string> = { headline: 'Le café qui réveille Dakar', sub: 'Torréfié chaque matin', caption: 'Grains du Fouta', figure: '1 250 clients', label: 'servis chaque semaine', headline2: 'Commandez', tagline: 'Réveillez votre journée', cta: 'kora.sn' };

/** Un programme d'exemple compilé pour le contrôle du film (le logo est retiré : la marque du contrôle n'en a pas). */
function exampleCode(id: string): string {
  const ex = PROGRAM_EXAMPLES.find((e) => e.id === id)!;
  const program: MotionProgram = { ...ex.program, nodes: ex.program.nodes.filter((n) => n.type !== 'logo'), timeline: ex.program.timeline.filter((s) => s.target !== 'logo') };
  const v = validateProgram(program, { texts: ex.texts, media: ex.media, duration: 3, hasLogo: false });
  if (!v.ok) throw new Error(`${id} : ${v.errors.join(' | ')}`);
  return compileProgram(v.program!).code;
}

/** La narration continue : découpe d'une prise aux pauses, scènes calées sans trou entre les phrases. */
async function voiceChecks() {
  const gaps = [{ start: 0, end: 0.1 }, { start: 1.6, end: 2.1 }, { start: 2.9, end: 3.05 }, { start: 4.4, end: 4.9 }, { start: 7.0, end: 7.2 }];
  const cuts = cutPoints(['Une première phrase,', 'puis une suite ici,', 'et la fin du récit.'], gaps, 7.2);
  check(!!cuts && cuts.length === 2 && Math.abs(cuts[0] - 1.85) < 0.01 && Math.abs(cuts[1] - 4.65) < 0.01, 'prise continue : coupée aux pauses entre les lignes (pas dans une respiration)', JSON.stringify(cuts));
  check(cutPoints(['Une ligne,', 'une autre.'], [{ start: 0, end: 0.05 }], 6) === null, 'prise sans pause plausible : refusée (repli ligne par ligne)');

  const scenes = [0, 1, 2, 3].map((i) => ({ key: `s${i}`, start: i * 5, duration: 5 }));
  const lines = [0, 1, 2].map((i) => ({ sceneKey: `s${i}`, text: 'x', url: `u${i}`, durationSec: 3.8 }));
  const fit = fitScenesToVoice(scenes, lines, 20);
  const at = fit.lines.map((l) => fit.scenes.find((sc) => sc.key === l.sceneKey)!.start + l.offset);
  const pauses = at.slice(1).map((t, i) => t - (at[i] + 3.8));
  check(pauses.every((p) => p < 1.5) && Math.abs(fit.scenes.reduce((a, sc) => a + sc.duration, 0) - 20) < 0.01 && fit.scenes[3].duration >= 4.9, 'narration enchaînée : pas de long blanc entre deux phrases, le plan muet final garde son temps', JSON.stringify({ pauses, durations: fit.scenes.map((sc) => sc.duration) }));

  // Une vraie prise (trois « phrases » sonores séparées de silences), découpée par ffmpeg.
  const take = path.join(OUT, 'take.wav');
  execFileSync(process.env.FFMPEG_PATH || 'ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'sine=f=220:d=1.5', '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=mono', '-filter_complex', '[0]aresample=48000,asplit=3[a][b][c];[1]atrim=0:0.5,asplit=2[g1][g2];[a][g1][b][g2][c]concat=n=5:v=0:a=1', '-ac', '1', take]);
  let calls = 0;
  const storageDir = path.join(OUT, 'voice');
  configureCore({ synthesizeSpeech: async () => (calls++, { buffer: fs.readFileSync(take), mimeType: 'audio/wav', provider: 'openrouter', model: 'fake', voice: 'fake' }) });
  const said = await synthesizeVoice({
    lines: [0, 1, 2].map((index) => ({ index, text: `Phrase numéro ${index + 1},`, maxSec: 4 })),
    language: 'fr',
    persona: personaById('warm'),
    storage: { uploadFile: async (content, fileName) => (fs.mkdirSync(storageDir, { recursive: true }), fs.writeFileSync(path.join(storageDir, fileName), content), { downloadURL: `file://${path.join(storageDir, fileName)}` }) },
    folder: 'v',
    continuous: true,
  });
  check(calls === 1 && said.lines.length === 3 && said.lines.every((l) => Math.abs(l.durationSec - 1.5) < 0.25), 'toute la narration en UN appel, rendue en trois lignes', JSON.stringify({ calls, durations: said.lines.map((l) => l.durationSec) }));
  (coreHost() as { synthesizeSpeech?: unknown }).synthesizeSpeech = undefined;
}

async function main() {
  const media = await fixtures();

  // ── 1. Le film des programmes, une scène qui plante ──
  const order = ['kinetic-title', 'photo-reveal', 'data-bars', 'logo-signature'];
  const crashing = `export default function* (view, ctx) { yield* (null as any).boom(); }`;
  const scenes = [...order.map((id, i) => ({ key: `s${i + 1}`, code: exampleCode(id) })), { key: 's5', code: crashing }];
  const durations = [3, 3, 3, 3, 1];
  const format = 'story' as const;
  const spec = frameSpec(format, 'standard');
  let start = 0;
  const data: FilmData = {
    format,
    ...COMPOSITION[format],
    resolutionScale: spec.scale,
    fps: spec.fps,
    background: BRAND.colors.background,
    lang: 'fr',
    fontFamilies: ['Inter'],
    brand: BRAND,
    scenes: scenes.map((s, i) => {
      const scene = { key: s.key, start, duration: durations[i], texts: TEXTS, media: [{ id: 'm1', kind: 'image' as const, url: media.photo, width: 1200, height: 1500, note: 'photo' }] };
      start += durations[i];
      return scene;
    }),
  };
  const total = durations.reduce((a, b) => a + b, 0);
  const bundle = await buildFilmBundle(scenes, 'render');
  check(bundle.length > 100000, 'paquet du film construit (scènes compilées depuis leurs programmes)', `${Math.round(bundle.length / 1024)} ko`);
  const local = await localizeFilm(data);
  const probed = await probeFilm({ data: local.data, bundle, fontCss: '', files: local.files });
  check(probed.errors.length === 1 && probed.errors[0].key === 's5', 'seule la scène fautive est en erreur', JSON.stringify(probed.errors));
  check(Object.keys(probed.thumbnails).length === scenes.length, 'une vignette par scène');
  check(probed.cues.some((c) => c.kind === 'pop' && c.scene === 's3'), 'effet sonore posé par un programme relevé', JSON.stringify(probed.cues.slice(0, 4)));
  check(Object.keys(probed.layout).length === 0, 'aucun texte coupé ni chevauché', JSON.stringify(probed.layout));
  for (const [key, buf] of Object.entries(probed.thumbnails)) fs.writeFileSync(path.join(OUT, `thumb-${key}.jpg`), buf);

  // ── 2. Une scène d'avant le langage qui importe un nom inexistant ──
  const badImport = `import { easeOut } from '@motion-canvas/core';\nexport default function* (view, ctx) { void easeOut; }`;
  const robust = await buildFilmBundle([{ key: 's1', code: exampleCode('kinetic-title') }, { key: 's2', code: badImport }], 'render').then(
    (b) => b.length > 100000,
    () => false
  );
  check(robust, 'un import inexistant (« easeOut ») ne fait plus tomber le film entier : seule sa scène est retirée');

  // ── 3. Le MP4 ──
  const t1 = Date.now();
  const out = await renderFilm({ data: local.data, bundle, fontCss: '', files: local.files, durationSec: total, quality: 'standard', concurrency: 3 });
  const info = await probe(out.file);
  check(Math.abs(info.duration - total) < 0.1, 'durée exacte du MP4', `${info.duration.toFixed(2)} s pour ${total} s, rendu en ${Date.now() - t1} ms`);
  fs.copyFileSync(out.file, path.join(OUT, 'film.mp4'));
  cleanupFilmRender(out);

  await voiceChecks();
  await pipeline(media);
  await closeFilmBrowser();
  console.log(failures ? `\n${failures} échec(s)` : '\nTout est vert.');
  process.exit(failures ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await closeFilmBrowser();
  process.exit(1);
});

/** Un programme correct pour la scène décrite par le prompt : ses textes dans une pile, sa photo si elle en a une. */
function programFor(user: string, opts: { overlap?: boolean } = {}): MotionProgram {
  const scene = user.split('THIS SCENE')[1] || user;
  const keys = [...scene.matchAll(/\$(\w+) = "/g)].map((m) => m[1]);
  const hasMedia = /\nmedia[^:\n]*: 0 = image/.test(scene);
  const nodes: MotionProgram['nodes'] = [];
  if (hasMedia) nodes.push({ id: 'photo', type: 'image', media: 0, x: 'pick(0, -SW*0.25)', y: 'pick(-SH*0.15, 0)', w: 'pick(SW, SW*0.45)', h: 'pick(SH*0.5, SH)', radius: 2, zoom: 1.1 });
  if (opts.overlap) keys.forEach((k, i) => nodes.push({ id: `t${i}`, type: 'text', text: `$${k}`, y: i, size: 8 }));
  else nodes.push({ id: 'words', type: 'stack', dir: 'column', gap: 2, y: hasMedia ? 'pick(SH*0.32, 0)' : 0, x: hasMedia ? 'pick(0, SW*0.27)' : 0, children: keys.map((k, i) => ({ type: 'text' as const, text: `$${k}`, size: i ? 4.6 : 9, width: hasMedia ? 'pick(SW, SW*0.4)' : 'SW', weight: i ? 400 : 800 })) });
  return {
    bg: 'background',
    nodes,
    timeline: [
      ...(hasMedia ? [{ at: 0, target: 'photo', dur: 'D', ease: 'linear' as const, to: { zoom: 1 } }] : []),
      ...(opts.overlap ? keys.map((_, i) => ({ at: 0.2 * i, target: `t${i}`, dur: 0.5, from: { opacity: 0 }, to: {} })) : [{ at: 0.1, target: 'words', dur: 0.6, ease: 'outBack' as const, from: { opacity: 0, scale: 0.9 }, to: {} }]),
      { at: 0.1, sfx: 'softwhoosh' },
    ],
  };
}
const json = (p: unknown) => '```json\n' + JSON.stringify(p) + '\n```';

/** 4. La création de bout en bout, modèles simulés. */
async function pipeline(media: { photo: string }) {
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
    loadBrand: async () => ({ brandName: 'Kora Café', branding: { colors: { colors: BRAND.colors } } as never, voice: { tone: 'chaleureux', language: 'fr' }, visuals: [], videos: [...videos.values()] }),
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
  /** Chaque appel d'auteur : scène, cran (donc modèle), stratégie (first, retry = programme refusé redemandé, fix, rewrite, minimal, revise). */
  const authorLog: { scene: number; level?: string; strategy: string; user: string }[] = [];
  const invalid = { nodes: [{ id: 'x', type: 'sparkle' }], timeline: [] };
  /** fixable : la scène 3 est refusée au premier jet puis se corrige ; stubborn : toujours refusée ; layout : ses textes se chevauchent au premier jet. */
  let mode: 'fixable' | 'stubborn' | 'layout' | 'contrast' | 'plate' = 'fixable';
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
        'SCENE 4 | 4', 'purpose: signer', 'visual: le nom sur le vert', 'motion: glisse depuis la droite', 'transition: slide', 'text.cta: Commandez sur WhatsApp',
      ].join('\n');
    if (role === 'video.author') {
      const strategy = /IT WAS REJECTED/.test(user) ? 'retry' : /CURRENT PROGRAM OF THIS SCENE[\s\S]*PROBLEM:|PREVIOUS PROGRAM WAS REJECTED/.test(user) ? 'fix' : /SIMPLEST program/.test(user) ? 'minimal' : /PREVIOUS PROGRAM HAD A PROBLEM/.test(user) ? 'rewrite' : /THE CLIENT ASKS/.test(user) ? 'revise' : 'first';
      const scene = Number(user.match(/SCENE (\d) of/)?.[1] || 1);
      authorLog.push({ scene, level, strategy, user });
      if (scene === 3 && (mode === 'stubborn' || (mode === 'fixable' && (strategy === 'first' || strategy === 'retry')))) return json(invalid);
      if (scene === 3 && mode === 'layout' && strategy === 'first') return json(programFor(user, { overlap: true }));
      // Un modèle qui s'obstine : texte bleu nuit sur un bandeau bleu nuit, à chaque approche.
      // Un modèle qui s'obstine à poser la légende sur la photo plein cadre, à chaque approche.
      if (scene === 2 && mode === 'plate') return json({ nodes: [{ type: 'image', media: 0, w: 'W', h: 'H' }, { id: 'cap', type: 'text', text: '$caption', size: 9, color: 'ink' }], timeline: [{ at: 0.2, target: 'cap', dur: 0.5, from: { opacity: 0, y: '+=4' }, to: {} }] });
      if (scene === 3 && mode === 'contrast') return json({ nodes: [{ type: 'rect', w: 'SW', h: 30, fill: 'secondary' }, { id: 'n', type: 'text', text: '$figure', size: 10, color: '#14324a' }, { type: 'text', text: '$label', y: 30, size: 5 }], timeline: [{ at: 0.1, target: 'n', dur: 0.5, from: { opacity: 0 }, to: {} }] });
      return 'Voici le programme :\n' + json(programFor(user));
    }
    if (role === 'video.reviser') return 'TEXT s1.headline: Le café du matin\nVISUAL s2: le cadre entre plus lentement\nREPLY: C’est fait.';
    return '';
  };
  const service = new MotionVideoService(store, call);
  const request = 'Une vidéo pour Kora Café : 1 250 clients chaque semaine, café torréfié chaque matin à Dakar. Commandez sur WhatsApp.';
  const create = (onProgress?: (e: { stage: string; state: string }) => void, formats: ('story' | 'landscape')[] = ['story']) =>
    service.createVideo('u1', 'p1', { brief: { message: request, request, musicMood: 'none', sfx: false, media: [{ id: 'up1', kind: 'image', url: media.photo, width: 1200, height: 1500, origin: 'upload' }] as never, allowGenerate: false, allowStock: false }, scope: { durationSec: 15, formats, quality: 'standard' }, creativity: 'medium' }, 120, onProgress);
  const s3 = () => authorLog.filter((x) => x.scene === 3);
  const strategies = () => s3().map((x) => x.strategy).filter((s) => s !== 'retry');
  const events: string[] = [];
  const video = await create((e) => events.push(`${e.stage}:${e.state}`));
  const film = video.film!;
  check(film.scenes.length === 4 && film.engine === 'motion-canvas', 'création : un film Motion Canvas de 4 scènes', `${film.scenes.length} scènes`);
  check(Math.abs(film.scenes.reduce((a, s) => a + s.duration, 0) - 15) < 0.01, 'les durées font la durée achetée');
  check(calls['video.concept'] === 1 && calls['video.planner'] === 1, 'directeur et planificateur, une fois chacun', JSON.stringify(calls));
  check(!('promo' in film.scenes[2].texts) && (film.fidelity?.notes || []).some((n) => /50/.test(n)), 'un chiffre absent de la demande n’est pas affiché, et c’est dit', (film.fidelity?.notes || []).join(' | '));
  check(film.scenes[1].media.includes('m1') && (video.media || []).some((m) => m.id === 'm1' && m.origin === 'upload'), 'la photo importée est le média m1 de la scène 2');
  check(film.scenes.every((s) => !!programOf(s.code)), 'chaque scène est un programme compilé (gardé en tête de son code)');
  check(s3()[1]?.strategy === 'retry' && /type inconnu « sparkle »/.test(s3()[1]?.user || ''), 'programme refusé : le modèle reçoit l’erreur exacte et répond une fois de plus', JSON.stringify(s3().map((x) => x.strategy)));
  check(film.scenes.every((s) => s.status === 'ready' && !!s.thumbnail), 'autocorrection : la scène 3 refusée au premier jet est corrigée AVANT livraison', JSON.stringify(film.scenes.map((s) => s.error)));
  check(JSON.stringify(strategies()) === '["first","fix"]' && film.repair?.fixed.join() === 's3' && film.repair.attempts === 1, 'une seule tentative suffit : « corriger » au même modèle, puis rien de plus', JSON.stringify({ s: strategies(), repair: film.repair }));
  check(['plan:done', 'concept:done', 'storyboard:done', 'code:done', 'check:done', 'repair:done'].every((e) => events.includes(e)), 'progression réelle (SSE), correction comprise', events.filter((e) => e.endsWith('done')).join(' '));

  // Une scène qui résiste : trois approches au plus, une à la fois, le modèle monte d'un cran ; puis elle reste signalée.
  mode = 'stubborn';
  authorLog.length = 0;
  const stubborn = await create();
  const sb = stubborn.film!;
  check(JSON.stringify(strategies()) === '["first","fix","rewrite","minimal"]', 'scène qui résiste : corriger › réécrire › version minimale, puis on s’arrête', JSON.stringify(strategies()));
  check(JSON.stringify([...new Set(s3().filter((x) => x.strategy !== 'retry').map((x) => `${x.strategy}:${x.level}`))]) === '["first:medium","fix:medium","rewrite:high","minimal:high"]', 'changer d’approche = le modèle du cran au-dessus (Medium → High)', JSON.stringify(s3().map((x) => x.level)));
  check(sb.scenes[2].status === 'error' && sb.repair?.unresolved.join() === 's3' && sb.repair.attempts === 3 && sb.scenes.filter((s) => s.key !== 's3').every((s) => s.status === 'ready'), 'non résolue : la scène reste signalée, les autres sont prêtes', JSON.stringify(sb.repair));
  await service.startExport('u1', 'p1', stubborn.id, stubborn.scope).then(
    () => check(false, 'export refusé tant qu’une scène est en erreur'),
    (e) => check(/scene_errors/.test(e.message), 'export refusé tant qu’une scène est en erreur', e.message)
  );
  mode = 'fixable';
  authorLog.length = 0;
  const manual = await service.updateVideo('u1', 'p1', stubborn.id, { fix: ['s3'] });
  check(manual!.film!.scenes[2].status === 'ready', '« Corriger » (demandé) : la même boucle bornée', JSON.stringify(strategies()));

  // Un défaut d'AFFICHAGE : deux textes posés au même endroit — vu par le contrôle réel, corrigé avant livraison.
  mode = 'layout';
  authorLog.length = 0;
  const lay = await create();
  const fixMsg = s3().find((x) => x.strategy === 'fix')?.user || '';
  check(/se chevauchent/.test(fixMsg) && lay.film!.repair?.layoutFixed?.join() === 's3' && !lay.film!.scenes[2].layout?.length, 'textes qui se chevauchent : détectés dans Motion Canvas, le modèle reçoit le défaut exact, scène corrigée', JSON.stringify({ repair: lay.film!.repair, msg: fixMsg.slice(-300) }));
  mode = 'fixable';

  // Un texte qui reste illisible après les trois approches : l'encre lisible est posée par le code (dernier recours).
  mode = 'contrast';
  authorLog.length = 0;
  const ink = await create();
  const s3c = ink.film!.scenes[2];
  check(!s3c.layout?.length && /"color":"#ffffff"/.test(s3c.code || '') && JSON.stringify(strategies()) === '["first","fix","rewrite"]', 'texte illisible malgré deux approches : le code lui donne l’encre lisible d’après le fond réel, la scène se lit', JSON.stringify({ layout: s3c.layout, repair: ink.film!.repair }));
  mode = 'fixable';

  // Un texte posé sur une photo malgré deux approches : le code pose un aplat sous le texte (dernier recours).
  mode = 'plate';
  authorLog.length = 0;
  const plated = await create();
  const s2p = plated.film!.scenes[1];
  check(!s2p.layout?.length && /"type":"stack"[^\n]*"fill":"background\/92"/.test(s2p.code || '') && authorLog.filter((x) => x.scene === 2 && x.strategy !== 'retry').length === 3, 'légende posée sur la photo malgré deux approches : le code pose un aplat sous le texte, ses mouvements suivent', JSON.stringify({ layout: s2p.layout, repair: plated.film!.repair }));
  mode = 'fixable';

  // Le budget de jetons coupe la correction pour tout le film, même au milieu des approches.
  mode = 'stubborn';
  authorLog.length = 0;
  process.env.VIDEO_REPAIR_TOKEN_BUDGET = '1';
  const capped = await create();
  delete process.env.VIDEO_REPAIR_TOKEN_BUDGET;
  check(capped.film!.repair?.attempts === 1 && capped.film!.repair.stopped === 'budget', 'budget épuisé : arrêt net après une tentative (stopped = budget)', JSON.stringify(capped.film!.repair));
  mode = 'fixable';

  // Deux formats : un seul programme, écrit pour les deux cadres et contrôlé dans chacun.
  authorLog.length = 0;
  const both = await create(undefined, ['story', 'landscape']);
  const first = authorLog.find((x) => x.strategy === 'first')?.user || '';
  check(/FRAMES — this SAME program is rendered in 2 formats/.test(first) && /story \(vertical\)/.test(first) && /landscape \(horizontal\)/.test(first) && both.film!.scenes.every((s) => s.status === 'ready' && !s.layout?.length), 'vidéo story + paysage : l’auteur reçoit les deux cadres, chaque scène s’affiche bien dans les deux', JSON.stringify(both.film!.scenes.map((s) => s.layout)));

  const codeBefore = film.scenes[0].code;
  const edited = await service.updateVideo('u1', 'p1', video.id, { texts: { s1: { headline: 'Le meilleur café de Dakar', invented: 'x' } } });
  check(edited!.film!.scenes[0].texts.headline === 'Le meilleur café de Dakar' && !('invented' in edited!.film!.scenes[0].texts) && edited!.film!.scenes[0].code === codeBefore, 'retouche de texte : la donnée change, le code non');

  const revised = await service.reviseFromText('u1', 'p1', video.id, 'Change le titre et fais entrer la photo plus lentement', 'fr');
  check(revised.video!.film!.scenes[0].texts.headline === 'Le café du matin' && revised.report.recoded.includes('s2') && /CURRENT PROGRAM OF THIS SCENE/.test(authorLog.filter((x) => x.strategy === 'revise').pop()?.user || ''), 'retouche écrite : texte changé, scène 2 réécrite depuis son programme', JSON.stringify(revised.report));

  // Une scène écrite AVANT le langage (code TSX gardé tel quel) : elle joue toujours, et se réécrit en programme.
  const legacyCode = `import { Txt, View2D } from '@motion-canvas/2d';\nimport { waitFor } from '@motion-canvas/core';\nimport { SceneContext } from '@idem/motion';\nexport default function* (view: View2D, ctx: SceneContext) { view.add(<Txt text={ctx.texts.cta || ''} fontSize={ctx.unit * 6} fill={'#16181d'} />); yield* waitFor(ctx.duration); }`;
  await store.mutateVideo('u1', 'p1', video.id, (v) => ({ ...v, film: { ...v.film!, scenes: v.film!.scenes.map((s) => (s.key === 's4' ? { ...s, code: legacyCode } : s)) } }));
  const legacyHtml = await service.previewHtml('u1', 'p1', video.id);
  check(!!legacyHtml && legacyHtml.includes('__IDEM_FILM__'), 'scène écrite avant le langage : elle joue toujours (aperçu)');
  authorLog.length = 0;
  const rewritten = await service.updateVideo('u1', 'p1', video.id, { visual: { s4: 'plus énergique' } });
  check(!!programOf(rewritten!.film!.scenes[3].code) && /written before the animation language existed/.test(authorLog[0]?.user || ''), '« Changer cette scène » sur une scène d’avant : réécrite en programme');

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

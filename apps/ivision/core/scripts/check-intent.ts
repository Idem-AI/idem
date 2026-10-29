/**
 * `npm run check:intent` — le compilateur 0.3 dans le moteur, de bout en bout, modèles SIMULÉS (aucun appel payant) :
 *
 *   plan du film     direction nommée (jamais celle du film précédent), énergie, système de design, coutures, sons ;
 *   médias           recadrage par format, zone calme, étalonnage commun (copie étalonnée, original gardé) ;
 *   musique          grille des temps (BeatRoot) sur une piste locale à 120 BPM, extrait calé sur les phrases ;
 *   échantillonnage  plusieurs intentions par scène (sortie structurée, raisonnement coupé, températures étalées),
 *                    variantes résolues et pré-jugées, contrôle réel des meilleures, la meilleure gardée ;
 *   juge             une intention plate (« prudence = platitude ») perd contre une intention travaillée ;
 *   retouches        texte → géométrie recalculée sans modèle ; demande visuelle → intention réécrite ;
 *   export           MP4 à la durée exacte, flou de mouvement (sous-images), sons planifiés.
 */
process.env.VIDEO_ALLOW_FILE_URLS = '1';
process.env.VIDEO_SFX_OFFLINE = '1';
process.env.VIDEO_AUTHOR_MODE = 'intent';
process.env.VIDEO_SAMPLES_MEDIUM = '4';
process.env.VIDEO_MUSIC_OPENVERSE = 'off';
process.env.VIDEO_MUSIC_CCMIXTER = 'off';
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import sharp from 'sharp';
import { configureCore } from '../src/runtime/host';
import { drainRenderQueue, MotionVideoService } from '../src/video/motionVideo.service';
import { closeFilmBrowser } from '../src/video/rendering/runner';
import { probe } from '../src/video/rendering/ffmpeg';
import { registerLocalTracks } from '../src/video/audio/music';
import type { VideoStore } from '../src/video/contracts/store';
import type { MotionVideo } from '../src/video/contracts/model';
import type { AgentCall, AgentCallOptions } from '../src/creativity/orchestrator';
import { COMPILER_VERSION, PROGRAM_MARK } from '../../../../packages/motion-compiler/src';

const OUT = path.resolve(__dirname, '../tmp/check-intent');
let failures = 0;
let passes = 0;
const check = (ok: boolean, label: string, detail = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${!ok && detail ? ` — ${detail}` : ''}`);
  if (ok) passes++;
  else failures++;
};

async function fixtures() {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  const photo = path.join(OUT, 'photo.jpg');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000"><defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#5a3b22"/><stop offset="1" stop-color="#efe6d6"/></linearGradient></defs><rect width="1600" height="1000" fill="url(#g)"/><circle cx="420" cy="500" r="230" fill="#24160c"/><rect x="330" y="300" width="60" height="400" fill="#f2a93b"/></svg>`;
  await sharp(Buffer.from(svg)).jpeg({ quality: 88 }).toFile(photo);
  // Une piste à 120 BPM (un coup sourd sur chaque temps, plus fort sur chaque mesure), 40 s.
  const track = path.join(OUT, 'beat.mp3');
  execFileSync(process.env.FFMPEG_PATH || 'ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', "aevalsrc='0.9*exp(-30*mod(t\\,0.5))*sin(2*PI*90*t)*(1+0.8*lt(mod(t\\,2)\\,0.5))':s=44100:d=40", '-ac', '2', track]);
  registerLocalTracks([{ id: 'local-beat', provider: 'local', title: 'Beat 120', artist: 'IDEM', url: `file://${track}`, durationSec: 40, license: 'cc0', attribution: 'IDEM', moods: ['upbeat', 'corporate', 'calm', 'epic', 'afro'], bpm: 120 }]);
  return { photo: `file://${photo}` };
}

const BRAND = { primary: '#1f6f4a', secondary: '#14324a', accent: '#f2a93b', background: '#fbfaf7', text: '#16181d' };

/** Une intention pour la scène décrite par le prompt : travaillée à basse température, plate à haute température. */
function intentFor(user: string, temperature: number): unknown {
  const keys = [...user.matchAll(/\$(\w+) = "/g)].map((m) => m[1]);
  const media = /media \(every one must appear\): 0 = image/.test(user);
  const flat = temperature >= 0.85;
  if (flat) return { layout: 'hero', elements: keys.map((k, i) => ({ id: `t${i}`, kind: 'text', text: `$${k}`, rank: i ? 2 : 1, level: 'body' })), beats: keys.map((_, i) => ({ verb: 'rise', target: `t${i}`, with: i ? 't0' : null })) };
  const [first, ...rest] = keys;
  if (media) return { role: 'feature', layout: 'media-split', elements: [{ id: 'shot', kind: 'image', media: 0, rank: 2, crop: 'subject' }, { id: 'title', kind: 'text', text: `$${first}`, rank: 1 }, ...rest.map((k, i) => ({ id: `t${i}`, kind: 'text', text: `$${k}`, rank: 2 }))], beats: [{ verb: 'wipe', target: 'shot', from: 'top' }, { verb: 'reveal', target: 'title', style: 'words', after: 'shot' }, ...rest.map((_, i) => ({ verb: 'blur-in', target: `t${i}`, after: 'title' }))] };
  if (keys.includes('figure')) return { role: 'data', layout: 'figure', elements: [{ id: 'n', kind: 'text', text: '$figure', rank: 1, level: 'display' }, ...keys.filter((k) => k !== 'figure').map((k, i) => ({ id: `t${i}`, kind: 'text', text: `$${k}`, rank: 2 }))], beats: [{ verb: 'count', target: 'n', intensity: 'strong', sync: 'downbeat' }, ...keys.filter((k) => k !== 'figure').map((_, i) => ({ verb: 'rise', target: `t${i}`, after: 'n' }))] };
  return { layout: 'hero-left', elements: [{ id: 'title', kind: 'text', text: `$${first}`, rank: 1, level: 'title' }, ...rest.map((k, i) => ({ id: `t${i}`, kind: 'text', text: `$${k}`, rank: 2 })), { id: 'bar', kind: 'shape', shape: 'bar', rank: 3 }], beats: [{ verb: 'reveal', target: 'title', style: 'words' }, { verb: 'draw', target: 'bar', with: 'title' }, ...rest.map((_, i) => ({ verb: 'blur-in', target: `t${i}`, after: 'title' }))] };
}

(async () => {
  console.log('Compilateur 0.3 dans le moteur — intention, échantillonnage, juge (modèles simulés)\n');
  const media = await fixtures();
  const storageDir = path.join(OUT, 'storage');
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
  // Le film précédent de la marque avait la direction « editorial » : le directeur la redemande, le code l'évite.
  videos.set('video-prev', { id: 'video-prev', title: 'Précédent', brief: { objective: 'promotion', message: 'x', musicMood: 'none' }, scope: { durationSec: 15, formats: ['story'], quality: 'hd' }, film: { version: 2, engine: 'motion-canvas', title: 'Précédent', concept: 'x', bible: '', durationSec: 15, seed: 1, language: 'fr', scenes: [], captions: false, agents: [], design: { direction: 'editorial' } }, renders: [], status: 'ready', paidCredits: 0, exportCount: 0, createdAt: '2026-10-20', updatedAt: '2026-10-20' } as unknown as MotionVideo);
  const store: VideoStore = {
    loadBrand: async () => ({ brandName: 'Kora Café', branding: { colors: { colors: BRAND } } as never, voice: { tone: 'chaleureux', language: 'fr' }, visuals: [], videos: [...videos.values()] }),
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
  const samplerOptions: AgentCallOptions[] = [];
  const authorAsks: string[] = [];
  const call: AgentCall = async ({ role, user, options }) => {
    calls[role] = (calls[role] || 0) + 1;
    if (role === 'video.concept') return 'TITLE: Le café qui réveille\nDIRECTION: editorial, second: tech\nENERGY: 4, 3, 5, 2\nCONCEPT: Une journée qui commence par une tasse.\nBIBLE: fond crème, vert de la marque.\nSCENE 1: le titre\nSCENE 2: la photo\nSCENE 3: le chiffre\nSCENE 4: la signature';
    if (role === 'video.planner')
      return [
        'TITLE: Le café qui réveille', 'CONCEPT: Une journée qui commence par une tasse.', 'BIBLE: fond crème.',
        'SCENE 1 | 4', 'role: hook', 'energy: 4', 'purpose: accrocher', 'visual: un titre fort', 'motion: mots qui arrivent', 'text.headline: Le café qui réveille Dakar', 'text.sub: Torréfié chaque matin',
        'SCENE 2 | 4', 'role: feature', 'energy: 3', 'purpose: montrer le produit', 'visual: la photo des grains', 'motion: le cadre s’ouvre', 'media: m1', 'text.caption: Grains du Fouta',
        'SCENE 3 | 3', 'role: proof', 'energy: 5', 'purpose: prouver', 'visual: un compteur', 'motion: le chiffre défile', 'text.figure: 1 250 clients', 'text.label: servis chaque semaine',
        'SCENE 4 | 4', 'role: signature', 'energy: 2', 'purpose: signer', 'visual: le nom', 'motion: glisse', 'text.cta: Commandez sur WhatsApp',
      ].join('\n');
    if (role === 'video.sampler') {
      samplerOptions.push(options || {});
      return JSON.stringify(intentFor(user, options?.temperature ?? 0.5));
    }
    if (role === 'video.author') {
      authorAsks.push(/THE CLIENT ASKS/.test(user) ? 'revise' : /MEASURED PROBLEMS/.test(user) ? 'repair' : 'other');
      if (/THE CLIENT ASKS/.test(user)) return JSON.stringify({ layout: 'full-bleed', elements: [{ id: 'shot', kind: 'image', media: 0, rank: 2 }, { id: 'cap', kind: 'text', text: '$caption', rank: 1, level: 'title' }], beats: [{ verb: 'zoom', target: 'shot' }, { verb: 'reveal', target: 'cap', style: 'line' }] });
      return JSON.stringify(intentFor(user, 0.4));
    }
    return '';
  };
  const service = new MotionVideoService(store, call);
  const request = 'Une vidéo pour Kora Café : 1 250 clients chaque semaine, café torréfié chaque matin à Dakar. Commandez sur WhatsApp.';
  const stages: string[] = [];
  const video = await service.createVideo('u1', 'p1', { brief: { message: request, request, musicMood: 'upbeat', sfx: true, media: [{ id: 'up1', kind: 'image', url: media.photo, width: 1600, height: 1000, origin: 'upload' }] as never, allowGenerate: false, allowStock: false }, scope: { durationSec: 15, formats: ['story', 'landscape'], quality: 'standard' }, creativity: 'medium' }, 120, (e) => stages.push(`${e.stage}:${e.state}`));
  const film = video.film!;

  console.log('\nPlan du film');
  check(film.design?.direction === 'tech' && !!film.direction?.repeatedAvoided, 'direction : « editorial » venait de servir, la seconde du directeur (« tech ») est prise', JSON.stringify(film.direction));
  check(film.scenes.map((s) => s.role).join(',') === 'hook,feature,proof,signature' && film.scenes.map((s) => s.energy).join(',') === '4,3,5,2', 'rôles et énergie du planificateur gardés sur chaque scène', JSON.stringify(film.scenes.map((s) => [s.role, s.energy])));
  check((film.seams?.length || 0) === 3 && (film.transitionCues?.some((c) => c.kind === 'impact') ?? false), 'coutures planifiées entre scènes, montée + impact sur le moment fort', JSON.stringify({ seams: film.seams, cues: film.transitionCues?.map((c) => c.kind) }));

  console.log('\nMédias et musique');
  const photo = (video.media || []).find((m) => m.origin === 'upload');
  check(!!photo?.prep?.focus?.story && !!photo.prep.focus.landscape && /graded-/.test(photo.url) && !!photo.prep.originalUrl, 'photo préparée : point d’intérêt par format, copie étalonnée (original gardé)', JSON.stringify(photo?.prep).slice(0, 300));
  check(!!video.music?.beat?.beats?.length && (video.music.beat.phrases?.length || 0) > 0 && Math.abs((video.music.beat.bpm || 0) - 120) < 3, 'musique : grille des temps (BeatRoot), phrases, ≈ 120 BPM', JSON.stringify({ bpm: video.music?.beat?.bpm, n: video.music?.beat?.beats?.length }));

  console.log('\nÉchantillonnage et juge');
  check(film.scenes.every((s) => s.intent && s.variant && s.judge && s.code?.includes(`${PROGRAM_MARK} v${COMPILER_VERSION}`)), 'chaque scène : intention, variante gardée, jugement, code du compilateur 0.3', JSON.stringify(film.scenes.map((s) => [s.key, !!s.intent, s.judge?.score, s.error?.message])));
  check(film.scenes.every((s) => s.status === 'ready' && !s.layout?.length), 'chaque scène s’exécute et s’affiche sans défaut, dans les deux formats', JSON.stringify(film.scenes.map((s) => [s.key, s.status, s.layout])));
  const temps = new Set(samplerOptions.map((o) => o.temperature));
  check(samplerOptions.length >= film.scenes.length && samplerOptions.every((o) => !!o.schema && o.reasoning === false) && temps.size >= 2, 'essais en sortie structurée stricte, raisonnement coupé, températures étalées', JSON.stringify({ n: samplerOptions.length, temps: [...temps] }));
  check((calls['video.sampler'] || 0) <= film.scenes.length * 4 + 4, 'budget tenu (au plus 4 essais par scène ici, VIDEO_SAMPLES_MEDIUM)', String(calls['video.sampler']));
  check(film.scenes.every((s) => s.intent!.beats.some((b) => b.verb !== 'rise')), 'les intentions plates (tout en « rise », corps de texte) ont perdu contre les travaillées', JSON.stringify(film.scenes.map((s) => s.intent?.beats.map((b) => b.verb))));
  check(!!film.sampling && film.sampling.candidates > film.sampling.authored, 'chaque intention a donné plusieurs variantes jugées', JSON.stringify(film.sampling));
  check(stages.includes('code:done') && stages.includes('check:done'), 'progression réelle (SSE) jusqu’au contrôle');

  console.log('\nAperçu et retouches');
  const html = (await service.previewHtml('u1', 'p1', video.id))!;
  check(/"seamOut"/.test(html) && /"cues":\[\{/.test(html) && /"design"/.test(html), 'aperçu : système de design, coutures et sons planifiés dans les données de la page');
  const before = film.scenes[0].code;
  const edited = (await service.updateVideo('u1', 'p1', video.id, { texts: { s1: { headline: 'Le café qui réveille tout Dakar, chaque matin' } } }))!;
  check(edited.film!.scenes[0].code !== before && edited.film!.scenes[0].status === 'ready', 'retouche de texte : la géométrie se recalcule, sans modèle', edited.film!.scenes[0].error?.message);
  const revised = (await service.updateVideo('u1', 'p1', video.id, { visual: { s2: 'la photo en plein cadre' } }))!;
  check(authorAsks.includes('revise') && revised.film!.scenes[1].intent?.layout === 'full-bleed' && revised.film!.scenes[1].status === 'ready', 'demande visuelle : l’intention est réécrite (auteur de qualité), la scène s’exécute', JSON.stringify({ asks: authorAsks, layout: revised.film!.scenes[1].intent?.layout }));

  console.log('\nExport');
  await service.startExport('u1', 'p1', video.id, { formats: ['story'], quality: 'standard', durationSec: 15 });
  await drainRenderQueue();
  const done = (await service.getVideo('u1', 'p1', video.id))!;
  const render = done.renders.find((r) => r.format === 'story');
  const file = render?.url?.replace('file://', '');
  const info = file && fs.existsSync(file) ? await probe(file) : null;
  check(render?.status === 'done' && !!info && Math.abs(info.duration - 15) < 0.15 && info.hasAudio, 'MP4 de 15 s avec son (flou de mouvement à l’export, images clés vérifiées)', JSON.stringify({ status: render?.status, error: render?.error, info }));

  await closeFilmBrowser();
  console.log(`\n${passes} vérifications réussies, ${failures} en échec · ${OUT}`);
  process.exit(failures ? 1 : 0);
})().catch(async (error) => {
  console.error(error);
  await closeFilmBrowser().catch(() => undefined);
  process.exit(1);
});

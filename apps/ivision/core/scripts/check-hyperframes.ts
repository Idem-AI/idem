/**
 * `npm run check:hyperframes` — le rendu HyperFrames et l'exploration du concept, sans modèle (agents simulés) :
 *
 *   1. le contrôle du code d'une scène (script interdit, réseau, minuteur, hasard, texte en dur, média inconnu…) ;
 *   2. l'exploration : quatre pistes lues, la plus éloignée des films déjà faits retenue ;
 *   3. la création complète : exploration, concept, storyboard, scènes HTML (GSAP), une scène refusée par le contrôle
 *      puis corrigée, contrôle dans Chrome (vignettes), film « hyperframes » ; l'axe de départ gardé ;
 *   4. une scène dont le script plante au jeu : attribuée à SA scène, corrigée par l'auteur ;
 *   5. l'aperçu (page autonome, sans réseau sauf médias https, bouton « Lire ») ; une retouche écrite (auteur HTML) ;
 *   6. une scène Anime.js pilotée par la timeline GSAP ;
 *   7. l'export MP4 par HyperFrames (durée exacte), sauf avec `--fast`.
 *
 * Sorties dans `apps/ivision/core/tmp/check-hyperframes/`.
 */
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { configureCore } from '../src/runtime/host';
import { drainRenderQueue, MotionVideoService } from '../src/video/motionVideo.service';
import type { VideoStore } from '../src/video/contracts/store';
import type { MotionVideo } from '../src/video/contracts/model';
import type { AgentCall } from '../src/creativity/orchestrator';
import { lintScene } from '../src/video/rendering/hyperframes/lint';
import { buildComposition } from '../src/video/rendering/hyperframes/composition';
import { probeComposition } from '../src/video/rendering/hyperframes/probe';
import { chooseTrack, parseTracks } from '../src/video/director/concept.agent';
import { closeFilmBrowser } from '../src/video/rendering/runner';
import { probe } from '../src/video/rendering/ffmpeg';

process.env.VIDEO_ALLOW_FILE_URLS = '1';
process.env.VIDEO_SFX_OFFLINE = '1';
process.env.IDEM_VIDEO_RENDERER = 'hyperframes';
process.env.IDEM_VIDEO_ANIMATION = 'gsap';
process.env.IDEM_DESIGN_TOOLS_OFFLINE = '1';
const fast = process.argv.includes('--fast');
const OUT = path.resolve(__dirname, '../tmp/check-hyperframes');
let failures = 0;
let passed = 0;
const check = (ok: boolean, label: string, detail = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${!ok && detail ? ` — ${detail}` : ''}`);
  if (ok) passed++;
  else failures++;
};

const BRAND = { primary: '#1f6f4a', secondary: '#14324a', accent: '#f2a93b', background: '#fbfaf7', text: '#16181d' };
const scene = (keys: string[], media?: string) =>
  `\`\`\`html\n<div class="relative flex h-full w-full flex-col justify-center gap-[24px] bg-ground p-[8%]">${media ? `<img class="photo absolute inset-0 h-full w-full object-cover opacity-30" src="{{media.${media}}}">` : ''}${keys.map((k, i) => `<p class="${i ? 'line' : 'title'} relative font-display ${i ? 'text-[48px] text-muted' : 'text-[110px] font-bold text-brand-primary'}">{{text.${k}}}</p>`).join('')}</div>\n\`\`\`\n\`\`\`js\ntl.fromTo(root.querySelector('.title'), { opacity: 0, y: 60 }, { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out' }, 0.1);\ntl.fromTo(root.querySelectorAll('.line'), { opacity: 0 }, { opacity: 1, duration: 0.5, stagger: 0.15 }, 0.5);\ntl.to(root.querySelector('.title'), { scale: 1.04, duration: D - 1.3, ease: 'none' }, 1.2);\n\`\`\``;

async function main() {
  fs.mkdirSync(OUT, { recursive: true });

  // 1. Le contrôle du code d'une scène
  const base = { animation: 'gsap' as const, textKeys: ['headline'], mediaIds: ['m1'] };
  const okHtml = '<div class="h-full w-full"><h1 class="t">{{text.headline}}</h1><img src="{{media.m1}}"></div>';
  const okJs = "tl.fromTo(root.querySelector('.t'), { opacity: 0 }, { opacity: 1, duration: 0.5 }, 0);";
  check(lintScene({ ...base, html: okHtml, script: okJs }).length === 0, 'contrôle : une scène correcte passe');
  const refusals: Array<[string, Partial<{ html: string; script: string }>, RegExp]> = [
    ['un script dans le HTML', { html: `${okHtml}<script>alert(1)</script>` }, /no <script>/],
    ['un appel réseau', { script: `${okJs}\nfetch('https://x.io')` }, /no network/],
    ['un minuteur', { script: `${okJs}\nsetTimeout(() => 0, 10)` }, /no timers/],
    ['le hasard', { script: `${okJs}\ntl.to(root, { x: Math.random() * 10 }, 0)` }, /Math\.random/],
    ['un texte écrit en dur', { html: okHtml.replace('{{text.headline}}', 'Bienvenue chez nous') }, /words written|missing/],
    ['un média inconnu', { html: okHtml.replace('m1', 'm9') }, /unknown media/],
    ['une adresse externe', { html: okHtml.replace('{{media.m1}}', 'https://evil.example/x.png') }, /external address/],
    ['un script qui ne compile pas', { script: 'tl.fromTo(root, { opacity: 0 }, ' }, /does not parse/],
    ['un script GSAP sans timeline de scène', { script: "gsap.to('.t', { opacity: 1 })" }, /timeline `tl`/],
  ];
  for (const [label, patch, expected] of refusals) {
    const errors = lintScene({ ...base, html: patch.html ?? okHtml, script: patch.script ?? okJs });
    check(errors.some((e) => expected.test(e)), `contrôle : refusé — ${label}`, errors.join(' | '));
  }
  check(lintScene({ ...base, animation: 'anime', html: okHtml, script: "const t = anime.createTimeline({ autoplay: false }); t.add(root.querySelector('.t'), { opacity: [0, 1], duration: 500 }, 0); return t;" }).length === 0, 'contrôle : une scène Anime.js qui rend sa timeline passe');

  // 2. L'exploration
  const tracks = parseTracks('TRACK 1: Stall stage — the market stall becomes a stage and the trader is the hero.\nTRACK 2: Morning ritual — the coffee is followed from bean to cup in one continuous camera move.\n**TRACK 3:** Numbers — a single huge figure fills each beat of the film, counting up.\nTRACK 4: Hands — only hands are shown, roasting, pouring, giving.');
  check(tracks.length === 4, 'exploration : quatre pistes lues (même en gras)', JSON.stringify(tracks.map((t) => t.title)));
  const chosen = chooseTrack(tracks, ['Stall stage — the market stall becomes a stage and the trader is the hero']);
  check(!!chosen && chosen.track.title !== 'Stall stage', 'exploration : la piste déjà faite est écartée', chosen?.track.title);

  // 3. La création complète, modèles simulés
  const photoFile = path.join(OUT, 'photo.jpg');
  await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1500"><rect width="1200" height="1500" fill="#e9a23b"/><circle cx="600" cy="640" r="320" fill="#2f5d50"/></svg>')).jpeg({ quality: 85 }).toFile(photoFile);
  const storageDir = path.join(OUT, 'storage');
  configureCore({
    storage: {
      uploadFile: async (content, fileName, folder) => {
        const dir = path.join(storageDir, folder);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, fileName), content);
        return { downloadURL: `file://${path.join(dir, fileName)}` };
      },
    },
  });
  const videos = new Map<string, MotionVideo>();
  const store: VideoStore = {
    loadBrand: async () => ({ brandName: 'Kora Café', country: 'Sénégal', branding: { colors: { colors: BRAND } } as never, voice: { tone: 'chaleureux', language: 'fr' }, visuals: [], videos: [...videos.values()] }),
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
  const calls: { role: string; user: string }[] = [];
  let crash = false;
  const call: AgentCall = async ({ role, user }) => {
    calls.push({ role, user });
    if (role === 'video.concept-explore') return 'TRACK 1: Morning ritual — the coffee followed from bean to cup in one camera move.\nTRACK 2: Hands — only hands roasting, pouring, giving the cup.\nTRACK 3: Big numbers — one huge figure per beat.\nTRACK 4: City wakes — Dakar wakes up street by street around the café.';
    if (role === 'video.concept') return 'TITLE: Le café qui réveille\nCONCEPT: Une journée qui commence par une tasse.\nBIBLE: fond crème, vert de la marque, gros titres serrés.\nSCENE 1: le titre se pose\nSCENE 2: la photo\nSCENE 3: le chiffre\nSCENE 4: la signature';
    if (role === 'video.planner')
      return ['TITLE: Le café qui réveille', 'CONCEPT: Une journée qui commence par une tasse.', 'BIBLE: fond crème.', 'SCENE 1 | 4', 'purpose: accrocher', 'visual: titre géant', 'motion: mots qui montent', 'text.headline: Le café qui réveille Dakar', 'text.sub: Torréfié chaque matin', 'SCENE 2 | 4', 'purpose: montrer', 'visual: la photo', 'motion: travelling', 'media: m1', 'text.caption: Grains du Fouta', 'SCENE 3 | 3', 'purpose: prouver', 'visual: un compteur', 'motion: le chiffre monte', 'text.figure: 1 250 clients', 'text.label: chaque semaine', 'SCENE 4 | 4', 'purpose: signer', 'visual: le nom', 'motion: glisse', 'text.cta: Commandez sur WhatsApp'].join('\n');
    if (role === 'video.html-author') {
      const keys = [...user.matchAll(/^\{\{text\.([\w-]+)\}\} = /gm)].map((m) => m[1]);
      const media = user.match(/^\{\{media\.([\w-]+)\}\}/m)?.[1];
      const sceneNo = Number(user.match(/SCENE (\d+) OF/)?.[1] || 1);
      // La scène 3 écrit d'abord un mot en dur (refusée par le contrôle), puis se corrige.
      if (sceneNo === 3 && !/THE CODE REFUSED IT/.test(user)) return scene(keys).replace('</div>\n```', '<span>Incroyable</span></div>\n```');
      // Mode « plante au jeu » : la scène 2 lève une erreur à l'exécution, puis se corrige quand on lui dit l'erreur.
      if (crash && sceneNo === 2 && !/FAILED WHEN PLAYED/.test(user)) return scene(keys, media).replace("tl.fromTo(root.querySelector('.title')", "root.querySelector('.missing').classList.add('x');\ntl.fromTo(root.querySelector('.title')");
      return scene(keys, media);
    }
    if (role === 'video.reviser') return 'VISUAL s2: le cadre entre plus lentement\nREPLY: C’est fait.';
    return '';
  };
  const service = new MotionVideoService(store, call);
  const request = 'Une vidéo pour Kora Café : 1 250 clients chaque semaine, café torréfié chaque matin à Dakar. Commandez sur WhatsApp.';
  const create = () => service.createVideo('u1', 'p1', { brief: { message: request, request, musicMood: 'none', sfx: false, media: [{ id: 'up1', kind: 'image', url: `file://${photoFile}`, width: 1200, height: 1500, origin: 'upload' }] as never, allowGenerate: false, allowStock: false }, scope: { durationSec: 15, formats: ['story'], quality: 'standard' }, creativity: 'medium' }, 120);
  const video = await create();
  const film = video.film!;
  check(film.engine === 'hyperframes' && film.scenes.length === 4, 'création : un film HyperFrames de 4 scènes', `${film.engine}, ${film.scenes.length} scènes`);
  check(film.scenes.every((s) => !!s.html && !!s.script && s.animation === 'gsap'), 'chaque scène : fragment HTML + script GSAP');
  check(film.scenes.every((s) => s.status === 'ready' && !!s.thumbnail), 'contrôle dans Chrome : toutes prêtes, vignettes prises', JSON.stringify(film.scenes.map((s) => [s.status, s.error?.message])));
  const s3calls = calls.filter((c) => c.role === 'video.html-author' && /SCENE 3 OF/.test(c.user));
  check(s3calls.length === 2 && /words written/.test(s3calls[1].user), 'scène 3 refusée (mot en dur), l’erreur exacte renvoyée, corrigée', String(s3calls.length));
  check(calls.findIndex((c) => c.role === 'video.concept-explore') >= 0 && calls.findIndex((c) => c.role === 'video.concept-explore') < calls.findIndex((c) => c.role === 'video.concept'), 'exploration avant le concept');
  check(/THE FILM IDEA CHOSEN/.test(calls.find((c) => c.role === 'video.concept')?.user || '') && !!film.explored?.chosen, 'la piste retenue est donnée au concept et gardée dans le film', film.explored?.chosen);
  check(!!film.axis, 'l’axe de départ est gardé dans le film (jamais deux fois le même pour la marque)', film.axis);
  check(/STARTING POINT/.test(calls.find((c) => c.role === 'video.concept-explore')?.user || ''), 'le point de départ parvient à l’exploration');

  // 4. Une scène qui plante au jeu : attribuée à sa scène, corrigée
  crash = true;
  calls.length = 0;
  const crashed = await create();
  const s2fix = calls.filter((c) => c.role === 'video.html-author' && /SCENE 2 OF/.test(c.user));
  check(crashed.film!.scenes.every((s) => s.status === 'ready') && s2fix.some((c) => /FAILED WHEN PLAYED/.test(c.user) && /missing|null|classList/.test(c.user)), 'scène qui plante au jeu : erreur attribuée à SA scène, renvoyée à l’auteur, corrigée', JSON.stringify(crashed.film!.scenes.map((s) => s.status)));
  crash = false;
  const second = crashed.film!.axis;
  check(!!second && second !== film.axis, 'deuxième film de la marque : un autre axe de départ', `${film.axis} → ${second}`);

  // 5. Aperçu et retouche
  const preview = (await service.previewHtml('u1', 'p1', video.id)) || '';
  check(/Content-Security-Policy/.test(preview) && /connect-src 'none'/.test(preview) && /id="play"/.test(preview) && /window\.__timelines\.film/.test(preview) && !/\{\{text\./.test(preview), 'aperçu : page autonome, sans réseau, bouton « Lire », textes posés');
  check(/Le café qui réveille Dakar/.test(preview) && /data-ge-tailwind/.test(preview), 'aperçu : textes exacts, feuille Tailwind de la marque compilée');
  fs.writeFileSync(path.join(OUT, 'preview.html'), preview);
  calls.length = 0;
  const revised = await service.updateVideo('u1', 'p1', video.id, { visual: { s2: 'le cadre entre plus lentement' } });
  const rev = calls.find((c) => c.role === 'video.html-author');
  check(!!rev && /THE CLIENT ASKS FOR THIS CHANGE: le cadre entre plus lentement/.test(rev.user) && /CURRENT SCENE/.test(rev.user) && revised!.film!.scenes[1].author?.instruction === 'le cadre entre plus lentement', 'retouche écrite : l’auteur HTML reçoit la scène actuelle et la demande');

  // 6. Une scène Anime.js pilotée par la timeline GSAP
  const animeHtml = await buildComposition({
    scenes: [{ key: 's1', start: 0, duration: 2, html: '<div class="h-full w-full bg-ground"><p class="t text-[80px] text-brand-primary">{{text.h}}</p></div>', script: "const t = anime.createTimeline({ autoplay: false }); t.add(root.querySelector('.t'), { opacity: [0, 1], translateY: [40, 0], duration: 800 }, 0); return t;", animation: 'anime', texts: { h: 'Anime' } }],
    width: 540, height: 540, durationSec: 2,
    brand: { name: 'Kora', colors: BRAND, fonts: { display: 'Inter', body: 'Inter' } },
    media: {}, fontCss: '', mode: 'render',
  });
  const animeProbe = await probeComposition(animeHtml, [], [{ key: 's1', start: 0, duration: 2 }], { width: 540, height: 540 });
  check(animeProbe.errors.length === 0 && !!animeProbe.thumbnails.s1, 'Anime.js : la timeline se joue sous la timeline GSAP, sans erreur', JSON.stringify(animeProbe.errors));

  // 7. L'export MP4
  if (!fast) {
    const before = videos.get(video.id)!.film!.scenes.filter((s) => s.status !== 'ready');
    if (before.length) console.log('  scènes non prêtes avant export :', JSON.stringify(before.map((s) => [s.key, s.status, s.error])));
    const started = Date.now();
    await service.startExport('u1', 'p1', video.id, video.scope);
    await drainRenderQueue();
    const done = videos.get(video.id)!.renders.find((r) => r.status === 'done');
    const file = done?.url?.replace('file://', '');
    const meta = file && fs.existsSync(file) ? await probe(file) : null;
    check(!!meta && Math.abs(meta.duration - 15) < 0.25 && meta.height === 1280, 'export : MP4 HyperFrames de 15 s en 720 × 1280 (qualité standard)', JSON.stringify({ meta, error: videos.get(video.id)!.renders.map((r) => r.error) }));
    console.log(`  (rendu : ${Math.round((Date.now() - started) / 1000)} s)`);
  }

  await closeFilmBrowser();
  console.log(`\n${passed} vérifications réussies, ${failures} en échec · fichiers : ${OUT}`);
  process.exit(failures ? 1 : 0);
}

main().catch(async (error) => {
  console.error(error);
  await closeFilmBrowser().catch(() => undefined);
  process.exit(1);
});

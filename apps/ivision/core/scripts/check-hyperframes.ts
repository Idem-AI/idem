/**
 * `npm run check:hyperframes` — le rendu HyperFrames des films, sans modèle (agents simulés). Depuis le 11/11/2026
 * les scènes sont ASSEMBLÉES depuis le catalogue vidéo (aucun auteur HTML) :
 *
 *   1. l'exploration : quatre pistes lues, la plus éloignée des films déjà faits retenue ;
 *   2. la création (cran Medium) : concept, storyboard, UN appel `video.template` pour tout le film, scènes assemblées,
 *      contrôle dans Chrome (vignettes), film « hyperframes » ; pas d'exploration sous l'Ultra (économie) ; l'axe gardé ;
 *   3. la création au cran Ultra : l'exploration avant le concept, la piste retenue donnée au concept et gardée,
 *      le point de départ tiré par le code donné à l'exploration ; un deuxième film prend un autre axe ;
 *   4. la correction SANS modèle : une scène en défaut prend le candidat suivant ;
 *   5. l'aperçu, la retouche écrite (configuration actuelle + consigne), la nouvelle version (sans modèle), et un film
 *      écrit avant le catalogue qui y passe à sa première retouche ;
 *   6. un film d'avant (HTML libre, Anime.js) se rend toujours ;
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
import { buildComposition } from '../src/video/rendering/hyperframes/composition';
import { probeComposition } from '../src/video/rendering/hyperframes/probe';
import { chooseTrack, parseTracks } from '../src/video/director/concept.agent';
import { closeFilmBrowser } from '../src/video/rendering/runner';
import { probe } from '../src/video/rendering/ffmpeg';

process.env.VIDEO_ALLOW_FILE_URLS = '1';
process.env.VIDEO_SFX_OFFLINE = '1';
process.env.IDEM_VIDEO_RENDERER = 'hyperframes';
process.env.IDEM_DESIGN_TOOLS_OFFLINE = '1';
process.env.IDEM_TEMPLATES_DIR = process.env.IDEM_TEMPLATES_DIR || path.resolve(__dirname, '../../../../../idem-templates');
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

async function main() {
  fs.mkdirSync(OUT, { recursive: true });

  // 1. L'exploration
  const tracks = parseTracks('TRACK 1: Stall stage — the market stall becomes a stage and the trader is the hero.\nTRACK 2: Morning ritual — the coffee is followed from bean to cup in one continuous camera move.\n**TRACK 3:** Numbers — a single huge figure fills each beat of the film, counting up.\nTRACK 4: Hands — only hands are shown, roasting, pouring, giving.');
  check(tracks.length === 4, 'exploration : quatre pistes lues (même en gras)', JSON.stringify(tracks.map((t) => t.title)));
  const chosen = chooseTrack(tracks, ['Stall stage — the market stall becomes a stage and the trader is the hero']);
  check(!!chosen && chosen.track.title !== 'Stall stage', 'exploration : la piste déjà faite est écartée', chosen?.track.title);

  // 2. La création au cran Medium
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
  const call: AgentCall = async ({ role, user }) => {
    calls.push({ role, user });
    if (role === 'video.concept-explore') return 'TRACK 1: Morning ritual — the coffee followed from bean to cup in one camera move.\nTRACK 2: Hands — only hands roasting, pouring, giving the cup.\nTRACK 3: Big numbers — one huge figure per beat.\nTRACK 4: City wakes — Dakar wakes up street by street around the café.';
    if (role === 'video.concept') return 'TITLE: Le café qui réveille\nCONCEPT: Une journée qui commence par une tasse.\nBIBLE: fond crème, vert de la marque, gros titres serrés.\nSCENE 1: le titre se pose\nSCENE 2: la photo\nSCENE 3: le chiffre\nSCENE 4: la signature';
    if (role === 'video.planner')
      return ['TITLE: Le café qui réveille', 'CONCEPT: Une journée qui commence par une tasse.', 'BIBLE: fond crème.', 'SCENE 1 | 4', 'purpose: accrocher', 'visual: titre géant', 'motion: mots qui montent', 'text.headline: Le café qui réveille Dakar', 'text.sub: Torréfié chaque matin', 'SCENE 2 | 4', 'purpose: montrer', 'visual: la photo', 'motion: travelling', 'media: m1', 'text.caption: Grains du Fouta', 'SCENE 3 | 3', 'purpose: prouver', 'visual: un compteur', 'motion: le chiffre monte', 'text.figure: 1 250 clients', 'text.label: chaque semaine', 'SCENE 4 | 4', 'purpose: signer', 'visual: le nom', 'motion: glisse', 'text.cta: Commandez sur WhatsApp'].join('\n');
    if (role === 'video.reviser') return 'VISUAL s2: le cadre entre plus lentement\nREPLY: C’est fait.';
    if (role === 'video.template') return /CLIENT'S REQUEST FOR/.test(user) ? '{"scenes":[{"scene":"s2","pick":"B"}]}' : JSON.stringify({ theme: 'B', scenes: [1, 2, 3, 4].map((n) => ({ scene: `s${n}`, pick: 'A' })) });
    return '';
  };
  const service = new MotionVideoService(store, call);
  const request = 'Une vidéo pour Kora Café : 1 250 clients chaque semaine, café torréfié chaque matin à Dakar. Commandez sur WhatsApp.';
  const create = (creativity: 'medium' | 'ultra' = 'medium') => service.createVideo('u1', 'p1', { brief: { message: request, request, musicMood: 'none', sfx: false, media: [{ id: 'up1', kind: 'image', url: `file://${photoFile}`, width: 1200, height: 1500, origin: 'upload' }] as never, allowGenerate: false, allowStock: false }, scope: { durationSec: 15, formats: ['story'], quality: 'standard' }, creativity }, 120);
  const video = await create();
  const film = video.film!;
  check(film.engine === 'hyperframes' && film.scenes.length === 4 && !!film.catalog?.theme, 'création : un film HyperFrames de 4 scènes, assemblé depuis le catalogue', `${film.engine}, ${film.scenes.length} scènes, thème ${film.catalog?.theme}`);
  check(film.scenes.every((s) => !!s.html && /^__ge\.scene\(/.test(s.script || '') && !!s.catalog?.layout), 'chaque scène : HTML de la mise en page + chorégraphie (données), configuration gardée', film.scenes.map((s) => s.catalog?.gabarit ?? s.catalog?.layout).join(', '));
  check(calls.filter((c) => c.role === 'video.template').length === 1, 'un seul appel de choix (video.template) pour tout le film', calls.map((c) => c.role).join(','));
  check(film.scenes.every((s) => s.status === 'ready' && !!s.thumbnail), 'contrôle dans Chrome : toutes prêtes, vignettes prises', JSON.stringify(film.scenes.map((s) => [s.status, s.error?.message])));
  check(!calls.some((c) => c.role === 'video.concept-explore'), 'économie : pas d’exploration des idées sous le cran Ultra (l’axe de départ et la mémoire varient les films)');
  check(!!film.axis, 'l’axe de départ est gardé dans le film (jamais deux fois le même pour la marque)', film.axis);

  // 3. La création au cran Ultra : l'exploration
  calls.length = 0;
  const ultra = await create('ultra');
  check(calls.findIndex((c) => c.role === 'video.concept-explore') >= 0 && calls.findIndex((c) => c.role === 'video.concept-explore') < calls.findIndex((c) => c.role === 'video.concept'), 'Ultra : exploration avant le concept', calls.map((c) => c.role).join(','));
  check(/THE FILM IDEA CHOSEN/.test(calls.find((c) => c.role === 'video.concept')?.user || '') && !!ultra.film!.explored?.chosen, 'Ultra : la piste retenue est donnée au concept et gardée dans le film', ultra.film!.explored?.chosen);
  check(/STARTING POINT/.test(calls.find((c) => c.role === 'video.concept-explore')?.user || ''), 'Ultra : le point de départ tiré par le code parvient à l’exploration');
  check(!!ultra.film!.axis && ultra.film!.axis !== film.axis, 'deuxième film de la marque : un autre axe de départ', `${film.axis} → ${ultra.film!.axis}`);
  check(ultra.film!.scenes.every((s) => s.status === 'ready'), 'Ultra : thème, gabarits, animations choisis en un appel ; toutes les scènes prêtes', JSON.stringify(ultra.film!.scenes.map((s) => [s.key, s.status])));

  // 4. La correction sans modèle : une scène en défaut prend le candidat suivant
  calls.length = 0;
  const broken = videos.get(video.id)!;
  videos.set(video.id, { ...broken, film: { ...broken.film!, scenes: broken.film!.scenes.map((s) => (s.key === 's2' ? { ...s, status: 'error' as const, error: { stage: 'runtime' as const, message: 'a text does not fit its zone' } } : s)) } });
  const before2 = broken.film!.scenes[1].catalog;
  const fixed = await service.updateVideo('u1', 'p1', video.id, { fix: ['s2'] });
  const s2 = fixed!.film!.scenes[1];
  check(calls.length === 0 && s2.status === 'ready' && JSON.stringify(s2.catalog) !== JSON.stringify(before2) && (s2.catalog?.tried?.length ?? 0) >= 1, 'correction : la scène en défaut prend le candidat suivant, sans modèle, et repasse prête', `${calls.length} appel(s) · ${s2.status} · ${before2?.gabarit ?? before2?.layout} → ${s2.catalog?.gabarit ?? s2.catalog?.layout}`);

  // 5. Aperçu et retouches
  const preview = (await service.previewHtml('u1', 'p1', video.id)) || '';
  check(/Content-Security-Policy/.test(preview) && /connect-src 'none'/.test(preview) && /id="play"/.test(preview) && /window\.__timelines\.film/.test(preview) && !/\{\{text\./.test(preview), 'aperçu : page autonome, sans réseau, bouton « Lire », textes posés');
  check(/Le café qui réveille Dakar/.test(preview) && /data-ge-tailwind/.test(preview) && /window\.__ge/.test(preview) && /id="ge-fx"/.test(preview), 'aperçu : textes exacts, feuille de la marque, runtime du catalogue, calque des transitions');
  fs.writeFileSync(path.join(OUT, 'preview.html'), preview);
  calls.length = 0;
  const revised = await service.updateVideo('u1', 'p1', video.id, { visual: { s2: 'le cadre entre plus lentement' } });
  const tcall = calls.find((c) => c.role === 'video.template');
  check(!!tcall && /CURRENT CONFIG OF s2/.test(tcall.user) && /le cadre entre plus lentement/.test(tcall.user) && revised!.film!.scenes[1].author?.instruction === 'le cadre entre plus lentement' && revised!.film!.scenes.every((s) => s.status === 'ready'), 'retouche écrite : la configuration actuelle et la consigne, un petit appel ; le film réassemblé et recontrôlé', tcall?.user.slice(-300));
  calls.length = 0;
  const regen = await service.updateVideo('u1', 'p1', video.id, { regenerate: ['s3'] });
  check(calls.length === 0 && (regen!.film!.scenes[2].catalog?.tried?.length ?? 0) >= 1, '« nouvelle version » d’une scène : le candidat suivant, sans modèle', `${calls.length} appel(s)`);
  // Un film écrit AVANT le catalogue (scènes HTML libres, aucune configuration) passe au catalogue à sa première retouche.
  const old = videos.get(ultra.id)!;
  videos.set(ultra.id, { ...old, film: { ...old.film!, catalog: undefined, scenes: old.film!.scenes.map((s) => ({ ...s, catalog: undefined, html: '<div class="h-full w-full bg-ground"><p class="t text-[90px] text-ink">{{text.headline}}</p></div>', script: "tl.fromTo(root.querySelector('.t'), { opacity: 0 }, { opacity: 1, duration: 0.5 }, 0);" })) } });
  calls.length = 0;
  const migrated = await service.updateVideo('u1', 'p1', ultra.id, { visual: { s1: 'le titre plus grand' } });
  check(!!migrated!.film!.catalog && migrated!.film!.scenes.every((s) => !!s.catalog && /^__ge\.scene\(/.test(s.script || '')) && calls.filter((c) => c.role === 'video.template').length === 2, 'un film d’avant le catalogue y passe à sa première retouche (un appel pour le film, un pour la retouche)', calls.map((c) => c.role).join(','));

  // 6. Un film écrit AVANT le catalogue (HTML libre, Anime.js) se rend toujours tel quel
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

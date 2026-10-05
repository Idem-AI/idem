/**
 * `npm run check:video:variety` — « toutes les vidéos se ressemblent » devient un nombre.
 *
 * Même marque (Wax & Co, DA maximaliste), même brief, plusieurs vidéos à la suite,
 * avec la mémoire du projet (concepts, rythmes, kits, entrées des vidéos précédentes),
 * comme dans le service :
 *   A. le parcours normal (direction tirée par la DA) : 6 vidéos ;
 *   B. la MÊME direction imposée : 6 vidéos — le cas qui se ressemblait le plus.
 * Pour chaque paire : distance d'image (12 vignettes du MP4) et distance de structure
 * (enchaînement, durées, entrées de texte, caméra, entrées des éléments, rythme, mises
 * en scène, fond, logo). Les bonnes pratiques (video.rules.ts) doivent rester vertes.
 *
 * Planche : tmp/motion-variety/index.html
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import sharp from 'sharp';
import { VideoKit, VideoStoryboard } from '../models/motionVideo.model';
import { buildVideoTheme } from '../services/Communication/video/video.theme';
import { buildStoryboard } from '../services/Communication/video/video.storyboard';
import { composeVideoHtml, inlineAssets } from '../services/Communication/video/video.composer';
import { renderVideo, closeRenderBrowser } from '../services/Communication/video/video.renderer';
import { DirectionId, pickDirection } from '../services/Communication/video/video.direction';
import { expandConcept, pickConcept } from '../services/Communication/video/video.concepts';
import { assignIcons, KitContext, pickAccentEffect, pickRhythm, resolveKit } from '../services/Communication/video/video.capabilities';
import { motionFromArtDirection } from '../services/Communication/video/video.artdirection';
import { analyzeLogo } from '../services/Communication/video/video.logo';
import { applyRules } from '../services/Communication/video/video.rules';
import { extractFacts } from '../services/Communication/video/video.copy';
import { brandById } from './fixtures/motion-video/brands';
import { makePhotos } from './fixtures/motion-video/media';

const OUT = path.resolve(__dirname, '../../tmp/motion-variety');
fs.mkdirSync(OUT, { recursive: true });
let failures = 0;
const check = (label: string, ok: boolean, detail = '') => {
  if (!ok) failures++;
  console.log(`  ${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
};

const BRIEF = 'Les soldes de fin d’année chez Wax & Co : -30 % sur tous les pagnes, livraison 24h à Abidjan';
const facts = extractFacts(BRIEF + ' Pagne wax premium à 15 000 FCFA au lieu de 21 500 FCFA. Commandez sur WhatsApp au +225 07 08 09 10 11.');

/** Textes de démonstration pour chaque scène (la copie réelle vient du modèle). */
const BANK: Record<string, Record<string, string>> = {
  hook: { kicker: 'Soldes', title: 'Vos pagnes à prix doux' },
  statement: { title: 'Le wax qui vous ressemble', sub: 'Tissé pour durer' },
  kinetic: { l1: 'Soldes', l2: 'Wax premium', l3: '-30 % partout' },
  wordswap: { lead: 'Chez Wax & Co, c’est', w1: 'authentique', w2: 'livré', w3: 'garanti' },
  product: { name: 'Pagne wax premium', tagline: 'Des motifs qui racontent', price: '15 000 FCFA' },
  gallery: { title: 'La collection' },
  footage: { title: 'Fait main à Abidjan', sub: 'Nos ateliers' },
  showcase3d: { title: 'Le pagne sous tous les angles', sub: 'Coton 100 %' },
  lottie: { title: 'Une fête de couleurs', sub: 'Jusqu’au 31 décembre' },
  benefits: { title: 'Pourquoi Wax & Co', b1: 'Livraison 24h à Abidjan', b2: 'Paiement Mobile Money', b3: 'Retour gratuit' },
  stat: { value: '-30 %', label: 'sur tous les pagnes' },
  offer: { oldPrice: '21 500 FCFA', price: '15 000 FCFA', badge: '-30 %', note: 'Jusqu’au 31 décembre' },
  quote: { quote: 'Le plus beau wax d’Abidjan', author: 'Awa, cliente' },
  event: { title: 'Grande vente', date: 'Samedi 14 décembre', time: '9h', place: 'Cocody' },
  cta: { title: 'Commandez avant dimanche', action: 'Écrire sur WhatsApp' },
  logo: { tagline: 'Le wax authentique' },
};

async function fingerprint(mp4: string, dur: number): Promise<{ prints: Buffer[]; thumbs: string[] }> {
  const prints: Buffer[] = [];
  const thumbs: string[] = [];
  for (let i = 0; i < 12; i++) {
    const f = path.join(OUT, `.fp${i}.png`);
    spawnSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(((i + 0.5) * dur) / 12), '-i', mp4, '-frames:v', '1', f]);
    prints.push(await sharp(f).resize(24, 42, { fit: 'fill' }).removeAlpha().raw().toBuffer());
    if (i % 2 === 0) thumbs.push(`data:image/jpeg;base64,${(await sharp(f).resize({ width: 120 }).jpeg({ quality: 60 }).toBuffer()).toString('base64')}`);
    fs.rmSync(f, { force: true });
  }
  return { prints, thumbs };
}

const imageDistance = (a: Buffer[], b: Buffer[]) => {
  let sum = 0;
  let n = 0;
  a.forEach((fa, i) => {
    for (let k = 0; k < fa.length; k++) {
      sum += Math.abs(fa[k] - b[i][k]);
      n++;
    }
  });
  return sum / n / 255;
};

interface Facets {
  sequence: string;
  durations: number[];
  techniques: Set<string>;
  camera?: string;
  entrance?: string;
  rhythm?: string;
  treatments: string;
  background: string;
  logo: string;
  concept?: string;
  direction?: string;
}

/** Distance de structure : part des facettes qui diffèrent (0 = même vidéo, 1 = tout diffère). */
function structureDistance(a: Facets, b: Facets): number {
  const jaccard = (x: Set<string>, y: Set<string>) => {
    const inter = [...x].filter((v) => y.has(v)).length;
    const union = new Set([...x, ...y]).size || 1;
    return 1 - inter / union;
  };
  const durDiff = (() => {
    const n = Math.min(a.durations.length, b.durations.length);
    let s = 0;
    for (let i = 0; i < n; i++) s += Math.abs(a.durations[i] - b.durations[i]);
    return Math.min(1, s / 15 + Math.abs(a.durations.length - b.durations.length) * 0.1);
  })();
  const parts = [
    a.sequence !== b.sequence ? 1 : 0,
    durDiff,
    jaccard(a.techniques, b.techniques),
    a.camera !== b.camera ? 1 : 0,
    a.entrance !== b.entrance ? 1 : 0,
    a.rhythm !== b.rhythm ? 1 : 0,
    a.treatments !== b.treatments ? 1 : 0,
    a.background !== b.background ? 1 : 0,
    a.logo !== b.logo ? 1 : 0,
    a.concept !== b.concept ? 1 : 0,
  ];
  return parts.reduce((x, y) => x + y, 0) / parts.length;
}

(async () => {
  const brand = brandById('wax');
  const theme = buildVideoTheme(brand.branding, 'Wax & Co');
  const art = motionFromArtDirection(brand.branding.artDirection);
  const logo = analyzeLogo(theme.logo.fullSvgMarkup, theme.logo.svgMarkup !== theme.logo.fullSvgMarkup ? theme.logo.svgMarkup : undefined);
  const photos = await makePhotos(path.resolve(__dirname, '../../tmp/motion-video-check/photos'));
  const images = ['pagne-1', 'pagne-2', 'pagne-3'].map((p) => `data:image/jpeg;base64,${fs.readFileSync(photos[p]).toString('base64')}`);
  const media = { images: 3, videos: 0, models: 0, lotties: 0 };
  const sheet: string[] = [];

  for (const [series, forced] of [['A · parcours normal', undefined], ['B · même direction imposée (kinetic)', 'kinetic']] as [string, DirectionId | undefined][]) {
    console.log(`\n${series}`);
    const memory = { concepts: [] as string[], rhythms: [] as string[], directions: [] as string[], kits: [] as VideoKit[], headlines: [] as string[] };
    const videos: { facets: Facets; prints: Buffer[]; thumbs: string[]; label: string }[] = [];
    for (let i = 0; i < 6; i++) {
      const seed = 4242 + i * 7907;
      const direction = forced ?? pickDirection({ type: 'promo', artStyleId: brand.branding.artDirection?.styleId, artDirections: art.directions, seed, avoid: memory.directions });
      const kctx0: KitContext = {
        type: 'promo',
        objective: 'promotion',
        direction,
        artStyleId: brand.branding.artDirection?.styleId,
        quality: 'standard',
        format: 'story',
        durationSec: 15,
        logo,
        hasLogoIcon: !!theme.logo.icon,
        media: { ...media, rive: 0 },
        scenes: [],
        text: BRIEF,
        seed,
        recent: memory.kits.slice(-6),
        boosts: art.boosts,
      };
      const concept = pickConcept({ objective: 'promotion', type: undefined, direction, artStyleId: brand.branding.artDirection?.styleId, durationSec: 15, facts, media, seed, recent: memory.concepts, owned: media });
      const { scenes, accent } = expandConcept(concept, { durationSec: 15, facts, media, owned: media });
      const rhythm = pickRhythm(kctx0, memory.rhythms);
      const sb: VideoStoryboard = buildStoryboard({
        sceneIds: scenes,
        slots: scenes.map((id) => ({ ...BANK[id] })),
        durationSec: 15,
        style: 'energetic',
        seed,
        images,
        beat: { bpm: 110, offset: 0, confidence: 0.9 },
        direction,
        accent: { index: accent, effect: pickAccentEffect(direction, seed, art.boosts) },
        concept,
        rhythm,
        art: art.overrides,
        avoidHeadlines: memory.headlines,
      });
      const kctx: KitContext = { ...kctx0, scenes: sb.scenes.map((sc) => ({ key: sc.key, sceneId: sc.sceneId, hasMedia: !!(sc.image || sc.images?.length), hasTitle: !!sc.slots.title, three: sc.sceneId === 'showcase3d' })) };
      const kit = resolveKit(kctx);
      kit.icons = assignIcons(sb.scenes);
      sb.kit = kit;
      const qa = applyRules(sb, { objective: 'promotion' });
      check(`vidéo ${i + 1} · ${direction} · ${concept} · ${rhythm} · caméra ${kit.camera} · entrées ${kit.entrance} : bonnes pratiques`, qa.issues.length === 0, qa.issues.map((x) => `${x.rule}: ${x.detail}`).join(' ; '));
      const assets = await inlineAssets(sb, theme);
      const { html, spec } = await composeVideoHtml({ ...assets, format: 'story', quality: 'standard', mode: 'render' });
      if (process.env.DUMP_HTML) fs.writeFileSync(path.join(OUT, `${forced ? 'B' : 'A'}-${i + 1}.html`), html);
      if (process.env.ONLY_HTML) continue;
      const mp4 = path.join(OUT, `${forced ? 'B' : 'A'}-${i + 1}.mp4`);
      const out = await renderVideo({ html, width: spec.width, height: spec.height, fps: spec.fps, durationSec: 15, quality: 'standard' });
      fs.copyFileSync(out.file, mp4);
      const fp = await fingerprint(mp4, 15);
      videos.push({
        label: `${direction} · ${concept} · ${rhythm} · ${kit.camera}/${kit.entrance}`,
        facets: {
          sequence: sb.scenes.map((s) => s.sceneId).join('>'),
          durations: sb.scenes.map((s) => s.duration),
          techniques: new Set(sb.scenes.map((s) => s.motion?.headline || '')),
          camera: kit.camera,
          entrance: kit.entrance,
          rhythm,
          treatments: JSON.stringify(Object.values(kit.treatments || {})),
          background: kit.background,
          logo: kit.logo,
          concept,
          direction,
        },
        ...fp,
      });
      memory.concepts.push(concept);
      memory.rhythms.push(rhythm);
      memory.directions.push(direction);
      memory.kits.push(kit);
      memory.headlines = sb.scenes.map((s) => s.motion?.headline || '');
    }
    const pairs: { img: number; struct: number }[] = [];
    for (let a = 0; a < videos.length; a++) for (let b = a + 1; b < videos.length; b++) pairs.push({ img: imageDistance(videos[a].prints, videos[b].prints), struct: structureDistance(videos[a].facets, videos[b].facets) });
    const minImg = Math.min(...pairs.map((p) => p.img));
    const meanImg = pairs.reduce((s, p) => s + p.img, 0) / pairs.length;
    const minStruct = Math.min(...pairs.map((p) => p.struct));
    const meanStruct = pairs.reduce((s, p) => s + p.struct, 0) / pairs.length;
    const consecutive = videos.slice(1).map((v, k) => structureDistance(videos[k].facets, v.facets));
    check(`${series} : distance d’image min ${minImg.toFixed(3)}, moyenne ${meanImg.toFixed(3)}`, minImg >= 0.05);
    check(`${series} : distance de structure min ${minStruct.toFixed(2)}, moyenne ${meanStruct.toFixed(2)} (vidéos qui se suivent : min ${Math.min(...consecutive).toFixed(2)})`, Math.min(...consecutive) >= 0.5 && meanStruct >= 0.5);
    sheet.push(`<h2>${series}</h2>${videos.map((v, i) => `<div class="row"><b>${i + 1}. ${v.label}</b>${v.thumbs.map((t) => `<img src="${t}">`).join('')}</div>`).join('')}`);
  }
  await closeRenderBrowser();
  fs.writeFileSync(path.join(OUT, 'index.html'), `<!doctype html><meta charset="utf-8"><title>Variété</title><style>body{font:13px system-ui;margin:20px;background:#fafaf9}.row{display:flex;gap:8px;align-items:center;margin:6px 0}.row b{width:260px;flex:none}.row img{width:90px;border:1px solid #e7e5e4}</style>${sheet.join('')}`);
  console.log(`\nPlanche : ${path.join(OUT, 'index.html')}`);
  console.log(failures ? `\n✗ ${failures} vérification(s) en échec.` : '\n✓ Variété mesurée : les vidéos d’une même marque ne se ressemblent pas.');
  process.exit(failures ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

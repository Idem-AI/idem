/**
 * LE COMPOSITEUR — storyboard + charte → une page HTML autonome.
 *
 * La page contient tout, sans CDN ni réseau : données de la vidéo, runtime
 * React partagé, les SEULS addons que le graphe de capacités a retenus (three /
 * R3F, GSAP, anime.js, flubber, Lottie, Rive), puis le moteur (scènes, kit
 * Tailwind, techniques, transitions — cf. apps/ivision/core/engine et
 * docs/VIDEO_ENGINE.md). En mode RENDU, les images sont en plus embarquées en
 * data-URI : Chromium n'a plus rien à télécharger pendant la capture, l'image
 * 437 ne peut donc pas sortir sans sa photo.
 */
import { inlineFontLinks } from './video.fonts';
import { addonsOfSceneCode, compileSceneCode } from './video.coder';
import { LAYOUT_CATALOGUE, LayoutId } from './video.layouts';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import logger from '../runtime/logger';
import { VideoFormat, VideoQuality, VideoStoryboard } from './video.model';
import { VideoTheme } from './video.theme';
import { DirectionId, DIRECTIONS, isMotionDirection, planMotion } from './video.direction';
import { AddonId, engineBundles } from './video.engine';
import { addonsForKit } from './video.capabilities';
import { iconSvg } from './video.icons';
import { analyzeLogo } from './video.logo';

export type Orientation = 'portrait' | 'square' | 'landscape';
import { builtinLottie, BuiltinLottie, BUILTIN_LOTTIES } from './video.lottie';
import { isRenderUrlAllowed } from '../render/network-guard';

export interface FrameSpec {
  width: number;
  height: number;
  fps: number;
  orient: Orientation;
}

const SIZES: Record<VideoFormat, { w: number; h: number }> = {
  story: { w: 1080, h: 1920 },
  square: { w: 1080, h: 1080 },
  portrait: { w: 1080, h: 1350 },
  landscape: { w: 1920, h: 1080 },
};

/** Dimensions et cadence d'un format à une qualité donnée. */
export function frameSpec(format: VideoFormat, quality: VideoQuality): FrameSpec {
  const base = SIZES[format] || SIZES.story;
  const k = quality === 'standard' ? 2 / 3 : 1;
  // Dimensions paires : exigence de l'encodeur H.264 en yuv420p.
  const even = (n: number) => Math.round((n * k) / 2) * 2;
  const width = even(base.w);
  const height = even(base.h);
  return {
    width,
    height,
    fps: quality === 'premium' ? 60 : 30,
    orient: width > height ? 'landscape' : width === height ? 'square' : 'portrait',
  };
}

/**
 * Zones de sécurité par format : en story, le haut porte la barre de
 * progression et le bas l'interface de TikTok / Reels / Statut.
 */
function safeZones(format: VideoFormat, spec: FrameSpec) {
  const { width: w, height: h } = spec;
  switch (format) {
    case 'story':
      return { st: h * 0.11, sb: h * 0.17, sx: w * 0.075 };
    case 'portrait':
      return { st: h * 0.075, sb: h * 0.085, sx: w * 0.075 };
    case 'landscape':
      return { st: h * 0.1, sb: h * 0.1, sx: w * 0.065 };
    default:
      return { st: h * 0.08, sb: h * 0.08, sx: w * 0.08 };
  }
}

// ─── Images embarquées (rendu) ──────────────────────────────────────────────

const imageMemo = new Map<string, string>();

/** Fichiers locaux : contrôles seulement (`VIDEO_ALLOW_FILE_URLS=1`), jamais en production. */
function localFile(src: string): string | null {
  if (!src.startsWith('file:///') || process.env.VIDEO_ALLOW_FILE_URLS !== '1' || process.env.NODE_ENV === 'production') return null;
  const file = src.slice('file://'.length);
  return fs.existsSync(file) ? file : null;
}
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

/** Télécharge, redimensionne (2000 px max) et embarque une image en data-URI. */
export async function inlineImage(src: string | undefined): Promise<string | undefined> {
  if (!src) return undefined;
  if (src.startsWith('data:')) return src;
  const local = localFile(src);
  if (local) {
    const buf = await sharp(fs.readFileSync(local)).rotate().resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 86 }).toBuffer();
    return `data:image/jpeg;base64,${buf.toString('base64')}`;
  }
  if (!/^https?:\/\//.test(src)) return undefined;
  const hit = imageMemo.get(src);
  if (hit) return hit;
  // URL fournie par l'utilisateur : jamais vers le réseau interne (SSRF).
  if (!(await isRenderUrlAllowed(src))) return undefined;
  try {
    const res = await axios.get(src, { responseType: 'arraybuffer', timeout: 15000, maxContentLength: MAX_IMAGE_BYTES, maxRedirects: 0 });
    const input = Buffer.from(res.data);
    const type = String(res.headers['content-type'] || '');
    let out: string;
    if (type.includes('svg') || /\.svg(\?|$)/i.test(src)) {
      out = `data:image/svg+xml;base64,${input.toString('base64')}`;
    } else {
      const meta = await sharp(input).metadata();
      const keepAlpha = !!meta.hasAlpha;
      const pipeline = sharp(input).rotate().resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true });
      const buf = keepAlpha ? await pipeline.png().toBuffer() : await pipeline.jpeg({ quality: 86 }).toBuffer();
      out = `data:image/${keepAlpha ? 'png' : 'jpeg'};base64,${buf.toString('base64')}`;
    }
    if (imageMemo.size > 200) imageMemo.clear();
    imageMemo.set(src, out);
    return out;
  } catch (error: any) {
    logger.warn('video.inline_image_failed', { src: src.slice(0, 120), error: error.message });
    return undefined;
  }
}

const binaryMemo = new Map<string, string>();

/** Télécharge un fichier binaire (clip, modèle 3D) en data-URI. */
export async function inlineBinary(src: string | undefined, mime: string, maxBytes: number): Promise<string | undefined> {
  if (!src) return undefined;
  if (src.startsWith('data:')) return src;
  if (src.startsWith('file://')) {
    const file = localFile(src);
    return file ? `data:${mime};base64,${fs.readFileSync(file).toString('base64')}` : undefined;
  }
  if (!/^https?:\/\//.test(src) || !(await isRenderUrlAllowed(src))) return undefined;
  const hit = binaryMemo.get(src);
  if (hit) return hit;
  try {
    const res = await axios.get(src, { responseType: 'arraybuffer', timeout: 60000, maxContentLength: maxBytes, maxRedirects: 0 });
    const out = `data:${mime};base64,${Buffer.from(res.data).toString('base64')}`;
    if (binaryMemo.size > 40) binaryMemo.clear();
    binaryMemo.set(src, out);
    return out;
  } catch (error: any) {
    logger.warn('video.inline_binary_failed', { src: src.slice(0, 120), error: error.message });
    return undefined;
  }
}

/**
 * Storyboard et thème avec les médias embarqués.
 *  - rendu : images, clips, modèles 3D en data-URI (rien à télécharger pendant la capture) ;
 *  - aperçu : clips par URL (lecture native), mais modèles 3D et textures 3D embarqués
 *    (WebGL exige des ressources de même origine, ce qu'une iframe isolée n'a pas).
 */
export async function inlineAssets(
  storyboard: VideoStoryboard,
  theme: VideoTheme,
  mode: 'render' | 'preview' = 'render'
): Promise<{ storyboard: VideoStoryboard; theme: VideoTheme }> {
  const scenes = await Promise.all(
    storyboard.scenes.map(async (scene) => {
      const needs3dTextures = mode === 'render' || scene.sceneId === 'showcase3d';
      return {
        ...scene,
        image: scene.image ? (mode === 'render' ? await inlineImage(scene.image) : scene.image) : undefined,
        images: scene.images
          ? needs3dTextures
            ? ((await Promise.all(scene.images.map(inlineImage))).filter(Boolean) as string[])
            : scene.images
          : undefined,
        video: scene.video ? (mode === 'render' ? await inlineBinary(scene.video, 'video/webm', 80 * 1024 * 1024) : scene.video) : undefined,
        model: scene.model ? await inlineBinary(scene.model, 'model/gltf-binary', 25 * 1024 * 1024) : undefined,
        rive: scene.rive ? await inlineBinary(scene.rive, 'application/octet-stream', 8 * 1024 * 1024) : undefined,
      };
    })
  );
  const logo = {
    onLight: await inlineImage(theme.logo.onLight),
    onDark: await inlineImage(theme.logo.onDark),
    icon: await inlineImage(theme.logo.icon),
  };
  return { storyboard: { ...storyboard, scenes }, theme: { ...theme, logo: { ...logo, svgMarkup: theme.logo.svgMarkup, fullSvgMarkup: theme.logo.fullSvgMarkup } } };
}

// ─── La page ────────────────────────────────────────────────────────────────

export interface ComposeOptions {
  storyboard: VideoStoryboard;
  theme: VideoTheme;
  format: VideoFormat;
  quality: VideoQuality;
  mode: 'render' | 'preview';
  music?: { url: string; startAt: number };
  /** Aperçu : sons à jouer par moment sonore (URL publique + gain linéaire). */
  sfx?: { enabled: boolean; sounds: Record<string, { url: string; gain: number }> };
}

const LOOPING: BuiltinLottie[] = ['pulse', 'sparkle'];

/** Animation Lottie d'une scène : importée (fichier JSON) ou intégrée (aux couleurs de la marque). */
async function resolveLottie(ref: string | undefined, theme: VideoTheme): Promise<{ data: any; name: string; loop: boolean } | null> {
  if (!ref) return null;
  if (ref.startsWith('builtin:')) {
    const name = ref.slice('builtin:'.length) as BuiltinLottie;
    if (!BUILTIN_LOTTIES.includes(name)) return null;
    const p = theme.palette;
    return { data: builtinLottie(name, { primary: p.primary, accent: p.accent, secondary: p.secondary, ink: p.text }), name, loop: LOOPING.includes(name) };
  }
  try {
    let text: string;
    const local = ref.startsWith('file://') ? localFile(ref) : null;
    if (local) text = fs.readFileSync(local, 'utf8');
    else if (/^https?:\/\//.test(ref) && (await isRenderUrlAllowed(ref))) text = JSON.stringify((await axios.get(ref, { timeout: 15000, maxContentLength: 3 * 1024 * 1024 })).data);
    else return null;
    const data = typeof text === 'string' ? JSON.parse(text) : text;
    return { data, name: 'custom', loop: true };
  } catch (error: any) {
    logger.warn('video.lottie_failed', { ref: ref.slice(0, 120), error: error.message });
    return null;
  }
}

/**
 * Le coin que les compositions occupent le moins (pour le logo pendant la vidéo).
 * En story, jamais en bas : l'interface de TikTok, Reels ou Statut y est.
 */
function freeCorner(anchors: (string | undefined)[], format: VideoFormat, seed: number): 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' {
  const corners = (format === 'story' ? ['top-right', 'top-left'] : ['top-right', 'top-left', 'bottom-right', 'bottom-left']) as ('top-right' | 'top-left' | 'bottom-right' | 'bottom-left')[];
  const load: Record<string, number> = {};
  for (const a of anchors) {
    if (a === 'top-left') load['top-left'] = (load['top-left'] || 0) + 1;
    if (a === 'bottom-left') load['bottom-left'] = (load['bottom-left'] || 0) + 1;
    if (a === 'top-center') ['top-left', 'top-right'].forEach((c) => (load[c] = (load[c] || 0) + 0.5));
    if (a === 'bottom-center') ['bottom-left', 'bottom-right'].forEach((c) => (load[c] = (load[c] || 0) + 0.5));
    if (a === 'right') load['top-right'] = (load['top-right'] || 0) + 0.3;
  }
  const best = Math.min(...corners.map((c) => load[c] || 0));
  const free = corners.filter((c) => (load[c] || 0) === best);
  return free[seed % free.length];
}

/** La direction, réglée par la DA de la charte (casse, décor, rythme). */
function withArt(d: (typeof DIRECTIONS)[DirectionId], art: VideoStoryboard['art']) {
  if (!art) return d;
  const k = art.pace && art.pace > 0.6 && art.pace < 1.6 ? art.pace : 1;
  return {
    ...d,
    type: { ...d.type, ...(art.displayCase ? { displayCase: art.displayCase } : {}) },
    decor: art.decor && d.decor === 'none' ? art.decor : d.decor,
    pacing: { ...d.pacing, enter: d.pacing.enter * k, groupStagger: d.pacing.groupStagger * k },
  };
}

const cssFamily = (family: string) => `'${family.replace(/'/g, '')}'`;

/** Les scènes écrites par l'IA (cran Ultra), compilées : clé de scène → module CommonJS. */
async function customScenesOf(storyboard: VideoStoryboard): Promise<Record<string, string> | undefined> {
  const coded = storyboard.scenes.filter((sc) => sc.code?.tsx);
  if (!coded.length) return undefined;
  const out: Record<string, string> = {};
  for (const sc of coded) {
    try {
      out[sc.key] = await compileSceneCode(sc.code!.tsx);
    } catch {
      /* code illisible : la scène garde sa composition */
    }
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * Politique de sécurité d'une page qui exécute du code écrit par l'IA : aucune requête vers
 * une origine qui n'est pas DÉJÀ dans les données de la page (médias, polices, musique).
 * Le code de l'IA ne peut donc rien envoyer ailleurs, même s'il contournait le lint.
 */
export function contentSecurityPolicy(pageText: string): string {
  const found = [...pageText.matchAll(/https?:\/\/[a-z0-9.-]+(?::\d+)?/gi)].map((m) => m[0].toLowerCase());
  // Une feuille Google Fonts (aperçu) sert ses fichiers depuis gstatic.
  if (found.includes('https://fonts.googleapis.com')) found.push('https://fonts.gstatic.com');
  const origins = [...new Set(found)].join(' ');
  const src = `data: blob: ${origins}`.trim();
  return [
    "default-src 'none'",
    "script-src 'unsafe-inline' 'unsafe-eval'",
    `style-src 'unsafe-inline' ${origins}`.trim(),
    `font-src ${src}`,
    `img-src ${src}`,
    `media-src ${src}`,
    `connect-src ${src}`,
    'worker-src blob:',
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ');
}

export async function composeVideoHtml(opts: ComposeOptions): Promise<{ html: string; spec: FrameSpec }> {
  const { storyboard, theme, format } = opts;
  const spec = frameSpec(format, opts.quality);
  const zones = safeZones(format, spec);
  const landscape = spec.orient === 'landscape';

  // Direction et plan de mouvement : ceux du storyboard, sinon calculés (vidéos d'avant le moteur React).
  const directionId: DirectionId = isMotionDirection(storyboard.direction) ? storyboard.direction : 'editorial';
  const fallbackPlan = planMotion(storyboard.scenes.map((s) => s.sceneId), directionId, storyboard.seed, { landscape });

  // Kit du graphe de capacités (absent sur les vidéos d'avant le graphe : rendu inchangé).
  const kit = storyboard.kit;
  const logoInfo = kit ? analyzeLogo(theme.logo.fullSvgMarkup, theme.logo.svgMarkup !== theme.logo.fullSvgMarkup ? theme.logo.svgMarkup : undefined) : null;

  // Médias pilotés par le moteur : Lottie et 3D.
  const lotties: Record<string, unknown> = {};
  const scenes = await Promise.all(
    storyboard.scenes.map(async (scene, i) => {
      const extra: Record<string, unknown> = {};
      if (scene.sceneId === 'lottie') {
        const resolved = await resolveLottie(scene.lottie, theme);
        if (resolved) {
          lotties[scene.key] = resolved.data;
          Object.assign(extra, { lottieKey: scene.key, lottieName: resolved.name, lottieLoop: resolved.loop });
        }
      }
      const colors = { primary: theme.palette.primary, accent: theme.palette.accent, secondary: theme.palette.secondary };
      if (scene.sceneId === 'showcase3d') {
        extra.three = scene.model
          ? { mode: 'model', model: scene.model, ...colors }
          : scene.images && scene.images.length
            ? { mode: 'cards', images: scene.images, ...colors }
            : { mode: 'shapes', ...colors };
      }
      const extrude = kit ? kit.logo === 'extrude' : scene.variant === 2;
      if (scene.sceneId === 'logo' && extrude && theme.logo.svgMarkup) extra.three = { mode: 'logo', svg: theme.logo.svgMarkup, ...colors };
      if (extra.three && kit?.postfx.length) (extra.three as Record<string, unknown>).postfx = kit.postfx;
      // Kit : fond posé sur cette scène, pictogrammes de ses éléments (SVG lus côté serveur).
      if (kit?.backdropScenes.includes(scene.key)) extra.backdrop = true;
      const concepts = kit?.icons[scene.key];
      if (concepts?.length) extra.icons = concepts.map((c) => iconSvg(kit!.iconSet, c) || '');
      const motion = scene.motion ? { ...fallbackPlan[i], ...scene.motion } : fallbackPlan[i];
      return {
        key: scene.key,
        sceneId: scene.sceneId,
        variant: scene.variant,
        start: scene.start,
        duration: scene.duration,
        surface: scene.surface,
        slots: scene.slots,
        image: scene.image,
        images: scene.images,
        video: scene.video,
        rive: scene.rive,
        accent: scene.accent,
        treatment: kit?.treatments?.[scene.key],
        layout: scene.layout,
        emphasis: scene.emphasis,
        scale: scene.scale,
        pace: scene.pace,
        motion,
        ...extra,
      };
    })
  );
  // Les addons : ceux qu'exige le kit, plus ceux des médias réellement présents.
  const addons = new Set<AddonId>(kit ? addonsForKit(kit) : []);
  if (Object.keys(lotties).length) addons.add('lottie');
  // La 3D (≈ 1 Mo) seulement s'il y a réellement une scène 3D, quels que soient les effets du kit.
  if (scenes.some((s: any) => s.three)) addons.add('three');
  else addons.delete('three');
  if (scenes.some((s: any) => s.rive)) addons.add('rive');
  // Les mises en page à graphique et les scènes écrites par l'IA apportent leurs bibliothèques.
  for (const sc of storyboard.scenes) {
    const needed = sc.layout ? LAYOUT_CATALOGUE[sc.layout as Exclude<LayoutId, 'classic'>]?.addon : undefined;
    if (needed) addons.add(needed);
    if (sc.code?.tsx) addonsOfSceneCode(sc.code.tsx).forEach((id) => addons.add(id));
  }
  if (kit && !logoInfo && ['draw', 'trace', 'morph', 'assemble', 'wipe'].includes(kit.logo)) {
    addons.delete('gsap');
    addons.delete('flubber');
  }
  const bundles = await engineBundles();

  const data = {
    mode: opts.mode,
    width: spec.width,
    height: spec.height,
    fps: spec.fps,
    duration: storyboard.durationSec,
    format,
    direction: withArt(DIRECTIONS[directionId], storyboard.art),
    scenes,
    surfaces: theme.surfaces,
    palette: theme.palette,
    fonts: { display: theme.fonts.display, body: theme.fonts.body },
    brandName: theme.brandName,
    logo: { onLight: theme.logo.onLight, onDark: theme.logo.onDark, icon: theme.logo.icon },
    lotties,
    zones,
    kit: kit
      ? {
          background: kit.background,
          annotate: kit.annotate,
          annotateScene: kit.annotateScene,
          // Sans logo vectoriel exploitable, la signature de la direction reprend la main.
          logo: logoInfo || !['draw', 'trace', 'morph', 'assemble', 'wipe'].includes(kit.logo) ? kit.logo : 'classic',
          logoSvg: logoInfo?.svg,
          logoIsIcon: logoInfo?.isIcon,
          brandmark: kit.brandmark,
          camera: kit.camera,
          entrance: kit.entrance,
          brandmarkCorner: freeCorner(scenes.map((sc: any) => sc.motion?.anchor), format, storyboard.seed),
          spring: kit.spring,
        }
      : undefined,
    music: opts.mode === 'preview' && opts.music ? opts.music : undefined,
    sfx: opts.mode === 'preview' ? opts.sfx : undefined,
    // Les mises en page pulsent sur le temps de la musique (grille en temps vidéo).
    beat: storyboard.beat?.bpm ? { bpm: storyboard.beat.bpm, offset: storyboard.beat.offset || 0 } : undefined,
    // Cran Ultra : les scènes écrites par l'IA (validées à la création), compilées pour le moteur.
    customScenes: await customScenesOf(storyboard),
  };
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  // Code écrit par l'IA dans la page : le réseau est limité aux origines que la page emploie déjà.
  const csp = data.customScenes && Object.keys(data.customScenes).length ? `<meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicy(json + theme.fonts.links)}">` : '';
  // Rendu : polices embarquées (une feuille externe qui tarde bloquerait le chargement de la page).
  const fontLinks = opts.mode === 'render' ? await inlineFontLinks(theme.fonts.links, [theme.brandName, ...storyboard.scenes.flatMap((sc) => Object.values(sc.slots || {}))].join(' ')) : theme.fonts.links;

  const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
${csp}
${fontLinks}
<style>
:root{--f-display:${cssFamily(theme.fonts.display)};--f-body:${cssFamily(theme.fonts.body)}}
${opts.mode === 'render' ? `html,body{width:${spec.width}px;height:${spec.height}px}` : ''}
</style>
</head><body>
<script>window.__VIDEO_DATA__=${json};</script>
<script>${bundles.runtime}</script>
${[...addons].map((id) => `<script data-addon="${id}">${bundles.addons[id]}</script>`).join('\n')}
<script>${bundles.engine}</script>
</body></html>`;
  return { html, spec };
}

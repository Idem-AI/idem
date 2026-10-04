/**
 * LE COMPOSITEUR — storyboard + charte → une page HTML autonome.
 *
 * La page contient tout : scènes, feuille Tailwind compilée côté serveur (les
 * seules classes réellement utilisées, sans CDN ni réseau), GSAP et SplitText
 * en ligne, données de la vidéo et moteur. En mode RENDU, les images sont en
 * plus embarquées en data-URI : Chromium n'a plus rien à télécharger pendant la
 * capture, l'image 437 ne peut donc pas sortir sans sa photo.
 */
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import logger from '../../../config/logger';
import { VideoFormat, VideoQuality, VideoStoryboard } from '../../../models/motionVideo.model';
import { Orientation, sceneMarkup } from './video.scenes';
import { VIDEO_ENGINE_CSS, VIDEO_RUNTIME_JS } from './video.runtime';
import { VideoTheme } from './video.theme';
import { builtinLottie, BuiltinLottie, BUILTIN_LOTTIES } from './video.lottie';
import { isRenderUrlAllowed } from '../../../utils/render-network-guard';

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

// ─── Tailwind compilé côté serveur ──────────────────────────────────────────

type TailwindCompiler = { build(candidates: string[]): string };
let compilerPromise: Promise<TailwindCompiler | null> | null = null;

function tailwindCompiler(): Promise<TailwindCompiler | null> {
  if (!compilerPromise) {
    compilerPromise = (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { compile } = require('tailwindcss');
        const twDir = path.dirname(require.resolve('tailwindcss/package.json'));
        return await compile(
          '@import "tailwindcss/theme.css" layer(theme);\n@import "tailwindcss/utilities.css" layer(utilities);',
          {
            base: twDir,
            loadStylesheet: async (id: string, base: string) => {
              const file = id.startsWith('tailwindcss/') ? path.join(twDir, id.slice('tailwindcss/'.length)) : path.resolve(base, id);
              return { path: file, base: path.dirname(file), content: fs.readFileSync(file, 'utf8') };
            },
          }
        );
      } catch (error: any) {
        logger.error('video.tailwind_unavailable', { error: error.message });
        return null;
      }
    })();
  }
  return compilerPromise;
}

/** Feuille Tailwind des seules classes présentes dans le balisage. */
export async function compileTailwind(html: string): Promise<string> {
  const compiler = await tailwindCompiler();
  if (!compiler) return '';
  const candidates = new Set<string>();
  for (const m of html.matchAll(/class="([^"]+)"/g)) {
    for (const token of m[1].split(/\s+/)) if (token) candidates.add(token);
  }
  return compiler.build([...candidates]);
}

// ─── Scripts embarqués ──────────────────────────────────────────────────────

let gsapBundle: string | null = null;
let lottieBundle: string | null = null;
let threeBundle: Promise<string> | null = null;

function lottieScript(): string {
  lottieBundle ??= fs.readFileSync(require.resolve('lottie-web/build/player/lottie.min.js'), 'utf8');
  return lottieBundle;
}

/** three.js + chargeurs (GLB, SVG) + environnement, empaquetés une fois par esbuild. */
export function threeScript(): Promise<string> {
  threeBundle ??= (async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const esbuild = require('esbuild');
    const result = await esbuild.build({
      stdin: {
        contents:
          "import * as THREE from 'three'; import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'; import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js'; import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'; window.THREE = THREE; window.THREE_EXTRA = { GLTFLoader, SVGLoader, RoomEnvironment };",
        resolveDir: path.resolve(path.dirname(require.resolve('three')), '..'),
        loader: 'js',
      },
      bundle: true,
      format: 'iife',
      minify: true,
      write: false,
      target: 'es2020',
      logLevel: 'error',
    });
    return result.outputFiles[0].text as string;
  })();
  return threeBundle;
}

function gsapScripts(): string {
  if (!gsapBundle) {
    const read = (file: string) => fs.readFileSync(require.resolve(`gsap/dist/${file}`), 'utf8');
    gsapBundle = `${read('gsap.min.js')}\n${read('SplitText.min.js')}`;
  }
  return gsapBundle;
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
      };
    })
  );
  const logo = {
    onLight: await inlineImage(theme.logo.onLight),
    onDark: await inlineImage(theme.logo.onDark),
    icon: await inlineImage(theme.logo.icon),
  };
  return { storyboard: { ...storyboard, scenes }, theme: { ...theme, logo: { ...logo, svgMarkup: theme.logo.svgMarkup } } };
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

const cssFamily = (family: string) => `'${family.replace(/'/g, '')}'`;

export async function composeVideoHtml(opts: ComposeOptions): Promise<{ html: string; spec: FrameSpec }> {
  const { storyboard, theme, format } = opts;
  const spec = frameSpec(format, opts.quality);
  const zones = safeZones(format, spec);
  const u = Math.min(spec.width, spec.height) / 100;

  const sections = storyboard.scenes
    .map((scene, index) => {
      const surface = theme.surfaces[scene.surface] || theme.surfaces.light;
      const plate = scene.sceneId === 'logo' && scene.variant === 1;
      const logo = plate || !surface.dark ? theme.logo.onLight || theme.logo.onDark : theme.logo.onDark || theme.logo.onLight;
      const inner = sceneMarkup({ scene, theme, orient: spec.orient, index, logo });
      return `<section class="scene s-${scene.surface}" data-scene="${scene.sceneId}" data-key="${scene.key}">${inner}</section>`;
    })
    .join('\n');

  // Médias pilotés par le moteur : Lottie et 3D.
  const lotties: Record<string, unknown> = {};
  const sceneMedia = await Promise.all(
    storyboard.scenes.map(async (scene) => {
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
      if (scene.sceneId === 'logo' && scene.variant === 2) extra.three = { mode: 'logo', svg: theme.logo.svgMarkup, ...colors };
      return extra;
    })
  );
  const needsLottie = Object.keys(lotties).length > 0;
  const needsThree = sceneMedia.some((m) => m.three);

  const brandmark = theme.logo.icon ? `<div id="brandmark"><img src="${theme.logo.icon}" alt=""></div>` : '';
  const body = `<div id="stage" data-format="${format}">${sections}${brandmark}</div>`;
  const tailwind = await compileTailwind(body);

  const surfaceCss = Object.entries(theme.surfaces)
    .map(
      ([name, s]) =>
        `.s-${name}{--bg:${s.bg};--ink:${s.ink};--muted:${s.muted};--hl:${s.hl};--hl-ink:${s.hlInk};--hl-text:${s.hlText};--hl-soft:${s.hlSoft};--soft:${s.soft}}`
    )
    .join('\n');

  const data = {
    mode: opts.mode,
    width: spec.width,
    height: spec.height,
    fps: spec.fps,
    duration: storyboard.durationSec,
    style: storyboard.style,
    fonts: { display: theme.fonts.display, body: theme.fonts.body },
    scenes: storyboard.scenes.map((s) => ({
      sceneId: s.sceneId,
      variant: s.variant,
      start: s.start,
      duration: s.duration,
      surface: s.surface,
      transitionIn: s.transitionIn,
    })).map((s, i) => ({ ...s, ...sceneMedia[i] })),
    lotties,
    sfx: opts.mode === 'preview' ? opts.sfx : undefined,
    surfaces: Object.fromEntries(Object.entries(theme.surfaces).map(([k, s]) => [k, { bg: s.bg, hl: s.hl }])),
    music: opts.mode === 'preview' && opts.music ? opts.music : undefined,
  };
  const json = JSON.stringify(data).replace(/</g, '\\u003c');

  const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
${theme.fonts.links}
<style>
/* Les utilitaires Tailwind doivent pouvoir surcharger le moteur (flex-row sur .safe…). */
@layer theme, engine, utilities;
:root{--f-display:${cssFamily(theme.fonts.display)};--f-body:${cssFamily(theme.fonts.body)}}
#stage{width:${spec.width}px;height:${spec.height}px;--u:${u}px;--st:${zones.st}px;--sb:${zones.sb}px;--sx:${zones.sx}px}
${opts.mode === 'render' ? `html,body{width:${spec.width}px;height:${spec.height}px}` : ''}
@layer engine {
${VIDEO_ENGINE_CSS}
}
${surfaceCss}
</style>
<style>${tailwind}</style>
</head><body>
${body}
<script>window.__VIDEO_DATA__=${json};</script>
<script>${gsapScripts()}</script>
${needsLottie ? `<script>${lottieScript()}</script>` : ''}
${needsThree ? `<script>${await threeScript()}</script>` : ''}
<script>${VIDEO_RUNTIME_JS}</script>
</body></html>`;
  return { html, spec };
}

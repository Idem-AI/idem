/**
 * LE STORYBOARD — tout ce qui n'est pas du texte, décidé par le code.
 *
 *  - durées : temps de lecture réel des textes (≈ 2,6 mots/s), bornées par
 *    scène, ramenées exactement à la durée achetée ;
 *  - coupes recalées SUR LE TEMPS de la musique quand une grille rythmique est
 *    connue — c'est la différence entre un diaporama et du motion design ;
 *  - variantes, surfaces et transitions tirées par une graine : deux vidéos du
 *    même commerce ne se ressemblent pas, et la même graine redonne la même
 *    vidéo (retouche sans surprise).
 */
import {
  MOTION_STYLES,
  MotionStyle,
  VideoBeatGrid,
  VideoObjective,
  VideoSceneInstance,
  VideoStoryboard,
  VideoTransition,
} from '../../../models/motionVideo.model';
import { SCENES } from './video.scenes';
import { rng } from './video.music';
import { lottieForObjective } from './video.lottie';

const TRANSITIONS: Record<MotionStyle, VideoTransition[]> = {
  energetic: ['flash', 'wipe', 'push', 'split', 'zoom', 'wipe'],
  premium: ['fade', 'circle', 'wipe', 'zoom'],
  playful: ['circle', 'push', 'wipe', 'split', 'zoom'],
  corporate: ['wipe', 'push', 'fade', 'split'],
};

const ENERGETIC_STYLES = new Set(['maximalism', 'pop-art', 'graffiti', 'y2k', 'cyberpunk', 'futuristic']);
const PREMIUM_STYLES = new Set(['minimalism', 'editorial', 'swiss', 'victorian', 'aurora', 'glassmorphism', 'surreal']);
const PLAYFUL_STYLES = new Set(['clay', 'pixel-art', 'vector-art', 'collage-art', 'handwritten', 'bohemian', 'retro']);

/** Langage de mouvement : demandé, sinon déduit de la direction artistique et de l'objectif. */
export function resolveStyle(
  requested: MotionStyle | 'auto' | undefined,
  artDirectionStyleId: string | undefined,
  objective: VideoObjective
): MotionStyle {
  if (requested && requested !== 'auto' && MOTION_STYLES.includes(requested)) return requested;
  const id = (artDirectionStyleId || '').toLowerCase();
  if (ENERGETIC_STYLES.has(id)) return 'energetic';
  if (PREMIUM_STYLES.has(id)) return 'premium';
  if (PLAYFUL_STYLES.has(id)) return 'playful';
  if (objective === 'promotion' || objective === 'opening') return 'energetic';
  if (objective === 'recruitment' || objective === 'testimonial') return 'corporate';
  return 'premium';
}

const wordCount = (slots: Record<string, string>): number =>
  Object.values(slots).reduce((n, v) => n + (v ? v.split(/\s+/).filter(Boolean).length : 0), 0);

/** Durées des scènes, en secondes, sommant exactement à `total`. */
export function allocateDurations(sceneIds: string[], slots: Record<string, string>[], total: number): number[] {
  const defs = sceneIds.map((id) => SCENES[id]);
  const want = defs.map((def, i) => {
    const reading = 0.9 + wordCount(slots[i] || {}) / 2.6;
    return Math.min(def.max, Math.max(def.min, Math.max(def.nominal, reading)));
  });
  // La signature finale doit laisser le temps de lire le logo.
  const lo = defs.map((d) => (d.id === 'logo' && total >= 15 ? 2.2 : d.min * 0.75));
  const hi = defs.map((d) => d.max * 2);
  let durations = want.slice();
  for (let pass = 0; pass < 6; pass++) {
    const sum = durations.reduce((a, b) => a + b, 0);
    const free = durations.map((d, i) => (d > lo[i] + 1e-6 && d < hi[i] - 1e-6) || pass === 0);
    const freeSum = durations.reduce((a, d, i) => a + (free[i] ? d : 0), 0) || sum;
    const k = (total - (sum - freeSum)) / freeSum;
    durations = durations.map((d, i) => (free[i] ? Math.min(hi[i], Math.max(lo[i], d * k)) : d));
  }
  // Reliquat d'arrondi : posé sur la scène la plus longue.
  const diff = total - durations.reduce((a, b) => a + b, 0);
  const longest = durations.indexOf(Math.max(...durations));
  durations[longest] += diff;
  return durations;
}

/**
 * Recale chaque coupe sur le temps le plus proche. Un temps trop rapide
 * (> 133 BPM) est regroupé par deux : une coupe tous les 0,4 s ne se lit pas.
 * Une coupe qui écraserait une scène sous 1,2 s reste où elle était.
 */
export function snapToBeats(durations: number[], beat: VideoBeatGrid | undefined, total: number, minLast = 1.2): number[] {
  if (!beat || !beat.bpm || beat.confidence < 0.15) return durations;
  let unit = 60 / beat.bpm;
  while (unit < 0.45) unit *= 2;
  const offset = ((beat.offset % unit) + unit) % unit;
  const cuts: number[] = [];
  let acc = 0;
  for (let i = 0; i < durations.length - 1; i++) {
    acc += durations[i];
    const snapped = offset + Math.round((acc - offset) / unit) * unit;
    const prev = cuts.length ? cuts[cuts.length - 1] : 0;
    const minGap = 1.2;
    const isLast = i === durations.length - 2;
    cuts.push(snapped - prev >= minGap && total - snapped >= (isLast ? minLast : minGap) ? snapped : acc);
  }
  const out: number[] = [];
  let prev = 0;
  for (const c of cuts) {
    out.push(c - prev);
    prev = c;
  }
  out.push(total - prev);
  // Un recalage qui aurait inversé deux coupes est abandonné.
  return out.every((d) => d > 0.9) ? out : durations;
}

export interface StoryboardInput {
  sceneIds: string[];
  /** Textes par scène, dans l'ordre de `sceneIds`. */
  slots: Record<string, string>[];
  durationSec: number;
  style: MotionStyle;
  seed: number;
  beat?: VideoBeatGrid;
  images: string[];
  /** Clips vidéo (WebM), modèles 3D (GLB), animations Lottie importées. */
  videos?: string[];
  models?: string[];
  lotties?: string[];
  /** Objectif : choisit les animations Lottie intégrées. */
  objective?: string;
  /** Le logo peut être extrudé en 3D (SVG disponible) — et le type le souhaite. */
  logo3d?: boolean;
}

function chooseVariant(
  sceneId: string,
  slots: Record<string, string>,
  hasImage: boolean,
  r: () => number,
  used: Set<string>,
  logo3d = false
): number {
  const def = SCENES[sceneId];
  if (sceneId === 'logo' && logo3d) return 2;
  const allowed: number[] = [];
  for (let v = 0; v < def.variants; v++) {
    if (sceneId === 'logo' && v === 2) continue;
    if (sceneId === 'kinetic' && v === 1 && [slots.l1, slots.l2, slots.l3, slots.l4].filter(Boolean).length < 2) continue;
    if (sceneId === 'product' && hasImage && v === 2) continue;
    if (sceneId === 'product' && !hasImage && v !== 2) continue;
    if (sceneId === 'offer' && v === 1 && !slots.badge) continue;
    if (sceneId === 'hook' && v === 2) {
      const n = (slots.title || '').split(/\s+/).filter(Boolean).length;
      if (n < 2 || n > 6) continue;
    }
    allowed.push(v);
  }
  if (!allowed.length) allowed.push(0);
  const fresh = allowed.filter((v) => !used.has(`${sceneId}:${v}`));
  const pool = fresh.length ? fresh : allowed;
  const v = pool[Math.floor(r() * pool.length)];
  used.add(`${sceneId}:${v}`);
  return v;
}

export function buildStoryboard(input: StoryboardInput): VideoStoryboard {
  const r = rng(input.seed);
  const used = new Set<string>();
  const images = input.images.filter(Boolean);
  let imageCursor = 0;
  const nextImage = () => (images.length ? images[imageCursor++ % images.length] : undefined);
  const videos = (input.videos || []).filter(Boolean);
  let videoCursor = 0;
  const models = (input.models || []).filter(Boolean);
  let modelCursor = 0;
  const userLotties = (input.lotties || []).filter(Boolean);
  let lottieCursor = 0;

  const minLast = input.sceneIds[input.sceneIds.length - 1] === 'logo' && input.durationSec >= 15 ? 2.2 : 1.2;
  const durations = snapToBeats(allocateDurations(input.sceneIds, input.slots, input.durationSec), input.beat, input.durationSec, minLast);

  const transitions = TRANSITIONS[input.style];
  let lastTransition: VideoTransition | undefined;
  let lastSurface: VideoSceneInstance['surface'] | undefined;
  let start = 0;

  const scenes: VideoSceneInstance[] = input.sceneIds.map((sceneId, i) => {
    const def = SCENES[sceneId];
    const slots = input.slots[i] || {};
    let image: string | undefined;
    let sceneImages: string[] | undefined;
    let video: string | undefined;
    let model: string | undefined;
    let lottie: string | undefined;
    if (sceneId === 'product') image = nextImage();
    if (sceneId === 'footage') {
      if (videos.length) video = videos[videoCursor++ % videos.length];
      else image = nextImage();
    }
    if (sceneId === 'showcase3d') {
      if (models.length) model = models[modelCursor++ % models.length];
      else if (images.length) {
        sceneImages = [];
        for (let k = 0; k < Math.min(4, images.length); k++) sceneImages.push(images[(imageCursor + k) % images.length]);
        imageCursor += 1;
      }
    }
    if (sceneId === 'lottie') {
      // Les animations importées d'abord, puis celles intégrées, choisies par objectif.
      lottie = lottieCursor < userLotties.length
        ? userLotties[lottieCursor]
        : `builtin:${lottieForObjective(input.objective || 'promotion', lottieCursor - userLotties.length)}`;
      lottieCursor++;
    }
    if (sceneId === 'gallery') {
      sceneImages = [];
      for (let k = 0; k < Math.min(3, images.length); k++) sceneImages.push(images[(imageCursor + k) % images.length]);
      imageCursor += sceneImages.length;
    }
    const variant = chooseVariant(sceneId, slots, !!image, r, used, sceneId === 'logo' && !!input.logo3d);

    // Surface : la préférée de la scène, jamais deux fois la même d'affilée.
    let surfaces = def.surfaces.slice();
    if (sceneId === 'logo') surfaces = variant === 1 ? ['primary', 'light'] : ['light', 'primary'];
    if (sceneId === 'product' && image && variant === 0) surfaces = ['light', 'secondary'];
    if (sceneId === 'logo' && variant === 2) surfaces = ['light'];
    const rotation = i === 0 || sceneId === 'logo' ? 0 : Math.floor(r() * 2);
    const ordered = surfaces.slice(rotation).concat(surfaces.slice(0, rotation));
    const surface = ordered.find((s) => s !== lastSurface) || ordered[0];
    lastSurface = surface;

    let transitionIn: VideoTransition | undefined;
    if (i > 0) {
      if (sceneId === 'logo') transitionIn = input.style === 'energetic' ? 'zoom' : 'circle';
      else {
        const pool = transitions.filter((t) => t !== lastTransition);
        transitionIn = pool[Math.floor(r() * pool.length)];
      }
      lastTransition = transitionIn;
    }

    const scene: VideoSceneInstance = {
      key: `${sceneId}-${i + 1}`,
      sceneId,
      variant,
      start: Math.round(start * 1000) / 1000,
      duration: Math.round(durations[i] * 1000) / 1000,
      surface,
      transitionIn,
      slots,
      ...(image ? { image } : {}),
      ...(sceneImages ? { images: sceneImages } : {}),
      ...(video ? { video } : {}),
      ...(model ? { model } : {}),
      ...(lottie ? { lottie } : {}),
    };
    start += durations[i];
    return scene;
  });

  // La dernière scène finit exactement à la durée achetée.
  const last = scenes[scenes.length - 1];
  if (last) last.duration = Math.round((input.durationSec - last.start) * 1000) / 1000;

  return {
    version: 1,
    seed: input.seed,
    style: input.style,
    durationSec: input.durationSec,
    scenes,
    ...(input.beat ? { beat: input.beat } : {}),
  };
}

/** Recalcule le minutage après une retouche (textes, musique) sans changer les choix visuels. */
export function retime(storyboard: VideoStoryboard, beat?: VideoBeatGrid): VideoStoryboard {
  const ids = storyboard.scenes.map((s) => s.sceneId);
  const durations = snapToBeats(
    allocateDurations(ids, storyboard.scenes.map((s) => s.slots), storyboard.durationSec),
    beat,
    storyboard.durationSec,
    ids[ids.length - 1] === 'logo' && storyboard.durationSec >= 15 ? 2.2 : 1.2
  );
  let start = 0;
  const scenes = storyboard.scenes.map((scene, i) => {
    const next = { ...scene, start: Math.round(start * 1000) / 1000, duration: Math.round(durations[i] * 1000) / 1000 };
    start += durations[i];
    return next;
  });
  const last = scenes[scenes.length - 1];
  if (last) last.duration = Math.round((storyboard.durationSec - last.start) * 1000) / 1000;
  return { ...storyboard, scenes, ...(beat ? { beat } : { beat: undefined }) };
}

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
} from './video.model';
import { SCENES } from './video.scenes';
import { rng } from './video.music';
import { lottieForObjective } from './video.lottie';
import { DirectionId, DIRECTIONS, planMotion, surfacesFor, WeightedTransition } from './video.direction';
import { VideoArtOverrides } from './video.model';
import { rhythmPlan } from './video.rhythm';

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
/** Le grand moment prend un peu plus de temps (et nettement plus s'il « tient » l'image). */
export function accentBoost(effect: string | undefined): number {
  return effect === 'hold' ? 1.3 : effect ? 1.12 : 1;
}

export function allocateDurations(sceneIds: string[], slots: Record<string, string>[], total: number, boost?: { index: number; factor: number }, weights?: number[]): number[] {
  const defs = sceneIds.map((id) => SCENES[id]);
  const want = defs.map((def, i) => {
    const reading = 0.9 + wordCount(slots[i] || {}) / 2.6;
    // Le rythme module le temps voulu ; jamais sous le temps de lecture.
    const base = Math.max(reading * 0.92, Math.min(def.max * 1.2, Math.max(def.min, Math.max(def.nominal, reading)) * (weights?.[i] ?? 1)));
    return boost && boost.index === i ? Math.min(def.max * 1.3, base * boost.factor) : base;
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
export function snapToBeats(durations: number[], beat: VideoBeatGrid | undefined, total: number, minLast = 1.2, step: 1 | 2 = 1): number[] {
  if (!beat || !beat.bpm || beat.confidence < 0.15) return durations;
  let unit = 60 / beat.bpm;
  while (unit < 0.45) unit *= 2;
  // Rythme ample : les coupes tombent toutes les deux pulsations.
  if (step === 2 && unit * 2 <= 2.4) unit *= 2;
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
  /** Animations Rive importées (.riv) : prioritaires dans les scènes d'animation. */
  rives?: string[];
  /** Objectif : choisit les animations Lottie intégrées. */
  objective?: string;
  /** Le logo peut être extrudé en 3D (SVG disponible) — et le type le souhaite. */
  logo3d?: boolean;
  /** Direction de motion : composition, techniques, transitions, couleur. */
  direction?: DirectionId;
  landscape?: boolean;
  /** Réglages issus de la direction artistique de la charte (cf. video.artdirection.ts). */
  art?: VideoArtOverrides;
  /** Le grand moment : la scène (index) et l'effet retenu par la direction. */
  accent?: { index: number; effect: VideoSceneInstance['accent'] };
  /** Le concept narratif (cf. video.concepts.ts). */
  concept?: string;
  /** Le rythme (cf. video.rhythm.ts). */
  rhythm?: string;
  /** Entrées de titre de la vidéo précédente du projet : à éviter. */
  avoidHeadlines?: string[];
  /** Menu de transitions de la vidéo (catalogue filtré par la direction et la DA, cf. transitionMenu). */
  transitions?: WeightedTransition[];
  /**
   * Les médias produits POUR une scène (index dans `sceneIds`, cf. video.sourcing.ts) : ils
   * passent avant le partage des listes, pour que chaque plan corresponde à son texte.
   */
  sceneMedia?: Record<number, { image?: string; images?: string[]; video?: string }>;
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
  const rives = (input.rives || []).filter(Boolean);
  let riveCursor = 0;

  const minLast = input.sceneIds[input.sceneIds.length - 1] === 'logo' && input.durationSec >= 15 ? 2.2 : 1.2;
  const boost = input.accent ? { index: input.accent.index, factor: accentBoost(input.accent.effect) } : undefined;
  const rhythm = rhythmPlan(input.rhythm, input.sceneIds, input.accent?.index);
  const durations = snapToBeats(allocateDurations(input.sceneIds, input.slots, input.durationSec, boost, rhythm.weights), input.beat, input.durationSec, minLast, rhythm.step);

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
    let rive: string | undefined;
    const own = input.sceneMedia?.[i];
    if (sceneId === 'product') image = own?.image || own?.images?.[0] || nextImage();
    if (sceneId === 'footage') {
      if (own?.video) video = own.video;
      else if (own?.image) image = own.image;
      else if (videos.length) video = videos[videoCursor++ % videos.length];
      else image = nextImage();
    }
    if (sceneId === 'showcase3d') {
      if (models.length) model = models[modelCursor++ % models.length];
      else if (own?.images?.length) sceneImages = own.images.slice(0, 4);
      else if (images.length) {
        sceneImages = [];
        for (let k = 0; k < Math.min(4, images.length); k++) sceneImages.push(images[(imageCursor + k) % images.length]);
        imageCursor += 1;
      }
    }
    if (sceneId === 'lottie' && riveCursor < rives.length) rive = rives[riveCursor++];
    else if (sceneId === 'lottie') {
      // Les animations importées d'abord, puis celles intégrées, choisies par objectif.
      lottie = lottieCursor < userLotties.length
        ? userLotties[lottieCursor]
        : `builtin:${lottieForObjective(input.objective || 'promotion', lottieCursor - userLotties.length)}`;
      lottieCursor++;
    }
    if (sceneId === 'gallery') {
      sceneImages = (own?.images || []).slice(0, 3);
      // Une galerie incomplète se complète avec les autres photos du film.
      for (let k = 0; sceneImages.length < Math.min(3, images.length) && k < images.length; k++) {
        const next = images[(imageCursor + k) % images.length];
        if (!sceneImages.includes(next)) sceneImages.push(next);
      }
      if (!own?.images?.length) imageCursor += sceneImages.length;
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
      ...(rive ? { rive } : {}),
    };
    start += durations[i];
    return scene;
  });

  // La dernière scène finit exactement à la durée achetée.
  const last = scenes[scenes.length - 1];
  if (last) last.duration = Math.round((input.durationSec - last.start) * 1000) / 1000;

  // La direction décide de la composition, des techniques et de la couleur.
  if (input.direction) {
    const ids = scenes.map((sc) => sc.sceneId);
    const plan = planMotion(ids, input.direction, input.seed, { landscape: input.landscape, avoidHeadlines: input.avoidHeadlines, transitions: input.transitions });
    const surfaces = surfacesFor(ids, input.art?.color || DIRECTIONS[input.direction].color, input.seed);
    scenes.forEach((sc, i) => {
      sc.motion = plan[i];
      sc.transitionIn = undefined;
      // Une image plein cadre ou une scène 3D gardent une surface claire derrière elles.
      sc.surface = sc.sceneId === 'logo' && sc.variant === 2 ? 'light' : surfaces[i];
    });
  }

  // Le grand moment : l'effet sur sa scène ; « bascule » = la couleur qui tranche avec ses voisines.
  if (input.accent && scenes[input.accent.index] && scenes[input.accent.index].sceneId !== 'logo') {
    const i = input.accent.index;
    scenes[i].accent = input.accent.effect;
    if (input.accent.effect === 'flip') {
      const calm = (sf?: string) => !sf || sf === 'light' || sf === 'tint';
      scenes[i].surface = calm(scenes[i - 1]?.surface) && calm(scenes[i + 1]?.surface) ? 'primary' : 'light';
    }
  }

  // Tempo des entrées de chaque scène, selon le rythme.
  if (input.rhythm) scenes.forEach((sc, i) => (sc.pace = Math.round(rhythm.paces[i] * 100) / 100));

  return {
    ...(input.art && Object.keys(input.art).length ? { art: input.art } : {}),
    ...(input.concept ? { concept: input.concept } : {}),
    ...(input.rhythm ? { rhythm: input.rhythm } : {}),
    version: 1,
    seed: input.seed,
    style: input.style,
    ...(input.direction ? { direction: input.direction } : {}),
    durationSec: input.durationSec,
    scenes,
    ...(input.beat ? { beat: input.beat } : {}),
  };
}

/** Recalcule le minutage après une retouche (textes, musique) sans changer les choix visuels. */
export function retime(storyboard: VideoStoryboard, beat?: VideoBeatGrid): VideoStoryboard {
  const ids = storyboard.scenes.map((s) => s.sceneId);
  const accentIndex = storyboard.scenes.findIndex((s) => s.accent);
  const rhythm = rhythmPlan(storyboard.rhythm, ids, accentIndex);
  const durations = snapToBeats(
    allocateDurations(ids, storyboard.scenes.map((s) => s.slots), storyboard.durationSec, accentIndex >= 0 ? { index: accentIndex, factor: accentBoost(storyboard.scenes[accentIndex].accent) } : undefined, storyboard.rhythm ? rhythm.weights : undefined),
    beat,
    storyboard.durationSec,
    ids[ids.length - 1] === 'logo' && storyboard.durationSec >= 15 ? 2.2 : 1.2,
    rhythm.step
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

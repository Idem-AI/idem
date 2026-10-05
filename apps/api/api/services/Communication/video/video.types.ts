/**
 * LES TYPES DE MOTION — ce que l'utilisateur choisit en premier.
 *
 * L'objectif dit QUOI raconter (une promotion, un événement…) ; le type dit
 * COMMENT : typographie pure, photos produit, clips vidéo, 3D, animations
 * Lottie… Chaque type a sa recette de scènes, son langage de mouvement par
 * défaut et ses besoins en médias (ce qui déclenche, si l'utilisateur
 * l'autorise, la recherche Pexels puis la génération).
 */
import { MotionStyle, VideoObjective, VideoType } from '../../../models/motionVideo.model';
import { BriefFacts } from './video.copy';
import { SCENES } from './video.scenes';
import { sceneAvailable } from './video.recipes';

export interface MediaCounts {
  images: number;
  videos: number;
  models: number;
  lotties: number;
}

export interface VideoTypeDef {
  id: VideoType;
  icon: string;
  /** Langage de mouvement quand l'utilisateur laisse « automatique ». */
  style: MotionStyle;
  /** Médias dont le type a besoin pour être lui-même. */
  needs: { images?: number; videos?: number };
  /** Recette : scène + priorité (1 = toujours). `@objective` = la scène propre à l'objectif. */
  recipe: [string, number][];
  /** Scène de signature (logo) : variante préférée. */
  logoVariant?: number;
  /** Premières scènes admises. */
  openers: string[];
  /** Durées proposées (la « révélation de logo » est courte). */
  durations?: number[];
}

export const TYPE_DEFS: Record<VideoType, VideoTypeDef> = {
  kinetic: {
    id: 'kinetic',
    icon: 'pi pi-align-left',
    style: 'energetic',
    needs: {},
    recipe: [['hook', 1], ['kinetic', 1], ['wordswap', 3], ['@objective', 2], ['statement', 4], ['kinetic', 5], ['cta', 2], ['logo', 1]],
    openers: ['hook'],
  },
  product: {
    id: 'product',
    icon: 'pi pi-box',
    style: 'premium',
    needs: { images: 2 },
    recipe: [['hook', 1], ['product', 1], ['benefits', 2], ['gallery', 3], ['@objective', 2], ['product', 5], ['statement', 6], ['cta', 2], ['logo', 1]],
    openers: ['hook'],
  },
  promo: {
    id: 'promo',
    icon: 'pi pi-tag',
    style: 'energetic',
    needs: { images: 1 },
    recipe: [['hook', 1], ['offer', 1], ['product', 3], ['benefits', 3], ['stat', 5], ['wordswap', 6], ['cta', 1], ['logo', 1]],
    openers: ['hook'],
  },
  footage: {
    id: 'footage',
    icon: 'pi pi-video',
    style: 'corporate',
    needs: { videos: 3 },
    recipe: [['footage', 1], ['footage', 2], ['@objective', 2], ['benefits', 4], ['footage', 3], ['statement', 5], ['cta', 1], ['logo', 1]],
    openers: ['footage', 'hook'],
  },
  showcase3d: {
    id: 'showcase3d',
    icon: 'pi pi-objects-column',
    style: 'premium',
    needs: {},
    recipe: [['hook', 1], ['showcase3d', 1], ['benefits', 2], ['@objective', 2], ['showcase3d', 4], ['cta', 2], ['logo', 1]],
    logoVariant: 2,
    openers: ['hook'],
  },
  illustrated: {
    id: 'illustrated',
    icon: 'pi pi-sparkles',
    style: 'playful',
    needs: {},
    recipe: [['hook', 1], ['lottie', 1], ['benefits', 3], ['lottie', 2], ['@objective', 2], ['wordswap', 5], ['cta', 2], ['logo', 1]],
    openers: ['hook'],
  },
  slideshow: {
    id: 'slideshow',
    icon: 'pi pi-images',
    style: 'premium',
    needs: { images: 4 },
    recipe: [['hook', 1], ['gallery', 1], ['product', 2], ['gallery', 3], ['@objective', 3], ['statement', 5], ['cta', 2], ['logo', 1]],
    openers: ['hook'],
  },
  logo: {
    id: 'logo',
    icon: 'pi pi-verified',
    style: 'premium',
    needs: {},
    recipe: [['kinetic', 2], ['logo', 1]],
    logoVariant: 2,
    openers: ['kinetic', 'logo'],
    durations: [6, 15],
  },
  // Combinée : l'enchaînement est choisi par le modèle (video.storyline.ts) ;
  // cette recette n'est que le repli quand le modèle ne répond pas.
  mix: {
    id: 'mix',
    icon: 'pi pi-th-large',
    style: 'energetic',
    needs: {},
    recipe: [['hook', 1], ['kinetic', 2], ['@objective', 1], ['showcase3d', 4], ['benefits', 3], ['footage', 4], ['lottie', 5], ['cta', 1], ['logo', 1]],
    openers: ['hook', 'footage', 'kinetic'],
  },
};

/** La scène qui porte l'objectif, quand le brief contient de quoi la remplir. */
function objectiveScene(objective: VideoObjective, facts: BriefFacts, media: MediaCounts): string | null {
  const candidates: Record<VideoObjective, string[]> = {
    promotion: ['offer', 'stat'],
    product: ['product'],
    announce: ['statement'],
    event: ['event'],
    opening: ['event', 'offer'],
    testimonial: ['quote', 'stat'],
    recruitment: ['benefits', 'stat'],
  };
  return (candidates[objective] || []).find((id) => sceneAvailable(id, facts, media.images)) || null;
}

const MAX_SCENES: Record<number, number> = { 6: 3, 15: 6, 30: 9, 60: 16 };

/** Disponibilité propre aux types (3D, Lottie et clips ont toujours un repli). */
export function available(scene: string, facts: BriefFacts, media: MediaCounts): boolean {
  if (scene === 'footage') return media.videos + media.images > 0;
  if (['showcase3d', 'lottie', 'kinetic'].includes(scene)) return true;
  return sceneAvailable(scene, facts, media.images);
}

/**
 * Les scènes d'une vidéo de ce type. Même logique que les recettes par
 * objectif : les scènes de priorité 1 d'abord, les autres tant que la durée le
 * permet ; la scène de l'objectif s'insère à sa place dans la recette.
 */
export function planTypeScenes(type: VideoType, objective: VideoObjective, durationSec: number, facts: BriefFacts, media: MediaCounts): string[] {
  const def = TYPE_DEFS[type] || TYPE_DEFS.kinetic;
  const objScene = objectiveScene(objective, facts, media);
  const recipe = def.recipe
    .map(([scene, priority]) => [scene === '@objective' ? objScene : scene, priority] as [string | null, number])
    .filter((step): step is [string, number] => !!step[0] && available(step[0], facts, media));

  const maxScenes = MAX_SCENES[durationSec] ?? Math.max(3, Math.round(durationSec / 4.5));
  const chosen = new Set<number>();
  let used = 0;
  const ordered = recipe.map((s, index) => ({ scene: s[0], priority: s[1], index })).sort((a, b) => a.priority - b.priority || a.index - b.index);
  for (const step of ordered) {
    const cost = step.priority === 1 ? SCENES[step.scene].min : SCENES[step.scene].nominal;
    if (step.priority === 1 || (used + cost <= durationSec * 1.06 && chosen.size < maxScenes)) {
      chosen.add(step.index);
      used += cost;
    }
  }
  let scenes = recipe.filter((_, i) => chosen.has(i)).map((s) => s[0]);

  // Trop de scènes obligatoires pour une vidéo courte : ouverture, cœur, signature.
  if (scenes.length > maxScenes) {
    const opener = scenes[0];
    const core = scenes.slice(1, -1).filter((id) => id !== 'cta');
    scenes = [opener, ...core.slice(0, Math.max(0, maxScenes - 2)), 'logo'].slice(0, maxScenes);
  }

  // Durée longue : on reprend les scènes propres au type (autres variantes, autres textes).
  const signature = def.recipe.map(([s]) => s).filter((s) => s !== '@objective' && s !== 'logo' && s !== 'cta' && available(s, facts, media));
  let guard = 0;
  while (used < durationSec * 0.82 && scenes.length < maxScenes && guard < 12) {
    const extra = signature[(guard + 1) % signature.length] || 'statement';
    const at = Math.max(1, scenes.length - (scenes.includes('cta') ? 2 : 1));
    scenes.splice(at, 0, extra);
    used += SCENES[extra].nominal;
    guard++;
  }

  // Ouverture : la première admise par le type qui a de quoi s'afficher.
  const opener = def.openers.find((id) => available(id, facts, media)) || 'hook';
  if (!def.openers.includes(scenes[0]) || !available(scenes[0], facts, media)) {
    if (!available(scenes[0], facts, media)) scenes.shift();
    if (scenes[0] !== opener) scenes.unshift(opener);
  }
  if (scenes[scenes.length - 1] !== 'logo') scenes.push('logo');
  return scenes;
}

/** Combien de clips et de photos la vidéo voudrait, d'après sa recette. */
export function mediaWanted(sceneIds: string[]): { images: number; videos: number } {
  const videos = sceneIds.filter((s) => s === 'footage').length;
  const images = sceneIds.reduce((n, s) => n + (s === 'product' ? 1 : s === 'gallery' ? 3 : s === 'showcase3d' ? 2 : 0), 0);
  return { images: Math.min(6, images), videos: Math.min(4, videos) };
}

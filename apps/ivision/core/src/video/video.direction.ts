/**
 * DIRECTIONS DE MOTION — huit systèmes complets, mutuellement distincts.
 *
 * C'est le pendant vidéo de la « forge » d'iCode : la qualité est CALCULÉE, pas
 * demandée. Une direction fixe tout ce qui fait qu'une vidéo ressemble à une
 * autre : typographie (casse, chasse, graisse, alignement), grille de
 * composition (où se posent les blocs), vocabulaire d'entrée des textes,
 * transitions, rythme (durées d'entrée, décalages, temps de lecture), stratégie
 * de couleur, décor et « grain » du mouvement (fluide ou image par image).
 *
 * Deux vidéos du même commerce reçoivent deux directions différentes : c'est le
 * mécanisme anti-monoculture. La même vidéo, retouchée, garde la sienne.
 *
 * Règles de motion design appliquées (sources dans docs/MOTION_VIDEO.md) :
 *  - une seule chose bouge à la fois quand l'attention compte ;
 *  - le texte en mouvement ne se lit pas : l'entrée livre, le temps fixe dit ;
 *  - entrées très amorties (l'essentiel du trajet dans le premier tiers),
 *    sorties en accélération, durée de sortie ≈ 2/3 de l'entrée ;
 *  - le décalage est une grammaire : ~70 ms = « lisez dans cet ordre »,
 *    ~300 ms = « événements distincts » ;
 *  - pas de mouvement linéaire, pas de rebond hors des tons ludiques ;
 *  - jamais la même entrée sur tout le film (le « réflexe uniforme »).
 */
import { MotionStyle, VideoSceneInstance, VideoType } from './video.model';
import { rng } from './video.music';

export type DirectionId = 'editorial' | 'swiss' | 'brutal' | 'kinetic' | 'cinematic' | 'collage' | 'precision' | 'drenched';

export const DIRECTION_IDS: DirectionId[] = ['editorial', 'swiss', 'brutal', 'kinetic', 'cinematic', 'collage', 'precision', 'drenched'];

/** Techniques d'entrée des textes (moteur React, `video-engine/src/text.tsx`). */
export type TextTechnique =
  | 'maskUp'
  | 'charCascade'
  | 'trackIn'
  | 'scaleBlur'
  | 'typewriter'
  | 'lineWipe'
  | 'blurWords'
  | 'flipChars'
  | 'scramble'
  | 'boxReveal'
  | 'stackPush'
  | 'slideAlternate'
  // Vocabulaire élargi (ressorts motion, 3D, dispersion, contour) : chaque direction en reçoit quelques-unes.
  | 'springUp'
  | 'wave'
  | 'stretch'
  | 'rotateX'
  | 'zoomWords'
  | 'skewIn'
  | 'scatter'
  | 'outlineFill';

/** Transitions (moteur React, `video-engine/src/transitions.ts`). */
export type MotionTransition =
  | 'cut'
  | 'dissolve'
  | 'wipe'
  | 'push'
  | 'zoomThrough'
  | 'whip'
  | 'iris'
  | 'blockStack'
  | 'slideOver'
  | 'flashCut'
  // Catalogue élargi : chaque direction en emprunte quelques-unes (cf. TRANSITION_CATALOGUE).
  | 'shapeWipe'
  | 'stripes'
  | 'split'
  | 'liquid'
  | 'zoomBlur'
  | 'cube'
  | 'glitch';

/**
 * LE CATALOGUE GLOBAL DES TRANSITIONS. Une direction n'est plus enfermée dans ses quatre
 * transitions : elle garde sa signature (bonus) et emprunte au catalogue celles qui
 * s'accordent à son caractère (poids > 0). Poids 0 ou absent = incompatible.
 */
export const TRANSITION_CATALOGUE: Record<MotionTransition, { feel: 'hard' | 'soft' | 'graphic' | 'spatial'; summary: string; directions: Partial<Record<DirectionId, number>> }> = {
  cut: { feel: 'hard', summary: 'Coupe franche, sur le temps.', directions: { brutal: 3, swiss: 2.5, kinetic: 2, precision: 2, editorial: 1.5, collage: 1.5, drenched: 1.5, cinematic: 1 } },
  flashCut: { feel: 'hard', summary: 'Coupe + éclair de la couleur d’accent.', directions: { brutal: 3, kinetic: 3, drenched: 1.5, collage: 1 } },
  glitch: { feel: 'hard', summary: 'Coupe hachée : tranches décalées, une fraction de seconde.', directions: { brutal: 2.5, kinetic: 2, drenched: 1.5, precision: 0.8 } },
  dissolve: { feel: 'soft', summary: 'Fondu enchaîné.', directions: { cinematic: 3, editorial: 3, precision: 1.2, drenched: 1.2 } },
  zoomBlur: { feel: 'spatial', summary: 'Sortie en zoom flou, entrée par un léger dézoom.', directions: { kinetic: 2.5, cinematic: 2, drenched: 2, precision: 1.5 } },
  zoomThrough: { feel: 'spatial', summary: 'On traverse l’image.', directions: { kinetic: 3, cinematic: 2, precision: 2, drenched: 1.5 } },
  whip: { feel: 'spatial', summary: 'Panoramique filé.', directions: { kinetic: 3, collage: 1.5, brutal: 1.5, drenched: 1 } },
  cube: { feel: 'spatial', summary: 'Rotation de cube 3D : la scène suivante est la face voisine.', directions: { precision: 2, kinetic: 2, drenched: 1.5, swiss: 1 } },
  push: { feel: 'graphic', summary: 'La scène suivante pousse la précédente.', directions: { swiss: 3, collage: 2.5, brutal: 2, kinetic: 2, precision: 1.5 } },
  slideOver: { feel: 'graphic', summary: 'La nouvelle scène glisse par-dessus.', directions: { collage: 3, editorial: 2.5, precision: 2, swiss: 1.5 } },
  iris: { feel: 'graphic', summary: 'Raccord graphique depuis le point focal.', directions: { precision: 3, drenched: 3, kinetic: 2, cinematic: 1.5, editorial: 1 } },
  wipe: { feel: 'graphic', summary: 'Volet net, bord à la couleur d’accent.', directions: { editorial: 2.5, swiss: 2.5, drenched: 2.5, precision: 1.5 } },
  blockStack: { feel: 'graphic', summary: 'Bandes de couleur qui recouvrent.', directions: { swiss: 2.5, brutal: 2.5, collage: 2.5, kinetic: 1.5 } },
  shapeWipe: { feel: 'graphic', summary: 'Disque de la marque qui grandit, couvre, puis s’ouvre.', directions: { drenched: 3, precision: 2, kinetic: 2, collage: 1.5, swiss: 1.5, editorial: 1 } },
  stripes: { feel: 'graphic', summary: 'Lames obliques aux couleurs de la marque.', directions: { kinetic: 3, collage: 2.5, brutal: 2, drenched: 1.5 } },
  split: { feel: 'graphic', summary: 'Deux panneaux se referment puis s’écartent.', directions: { swiss: 2.5, editorial: 2, precision: 2, cinematic: 1.5, drenched: 1.5 } },
  liquid: { feel: 'soft', summary: 'Volet au bord en vague.', directions: { drenched: 2.5, collage: 2, kinetic: 1.5, cinematic: 1 } },
};
export const TRANSITION_IDS = Object.keys(TRANSITION_CATALOGUE) as MotionTransition[];

export interface WeightedTransition {
  id: MotionTransition;
  weight: number;
}

/**
 * Le menu de transitions d'une vidéo : le catalogue filtré par la direction et la DA de la
 * charte (exclusions), pondéré (signature de la direction, bonus de la DA), moins celles
 * des dernières vidéos du projet (mémoire qui s'estompe). C'est dans ce menu, et seulement
 * là, que l'agent animateur choisit.
 */
export function transitionMenu(direction: DirectionId, opts: { excluded?: string[]; boosts?: Record<string, number>; recent?: string[][]; size?: number } = {}): WeightedTransition[] {
  const d = DIRECTIONS[direction];
  const excluded = new Set(opts.excluded || []);
  // Mémoire : la dernière vidéo pèse plus que l'avant-dernière.
  const recency = new Map<string, number>();
  (opts.recent || []).slice(-3).forEach((list, k, all) => {
    const w = k === all.length - 1 ? 0.9 : k === all.length - 2 ? 0.5 : 0.25;
    for (const id of new Set(list)) recency.set(id, (recency.get(id) || 0) + w);
  });
  const scored = TRANSITION_IDS.filter((id) => !excluded.has(id))
    .map((id) => {
      const base = TRANSITION_CATALOGUE[id].directions[direction] || 0;
      if (base <= 0) return { id, weight: 0 };
      const signature = d.transitions.includes(id) ? 1.2 : 0;
      return { id, weight: Math.max(0.1, base + signature + (opts.boosts?.[`transition:${id}`] || 0) - (recency.get(id) || 0) * 1.4) };
    })
    .filter((t) => t.weight > 0)
    .sort((a, b) => b.weight - a.weight || a.id.localeCompare(b.id));
  const menu = scored.slice(0, opts.size ?? 6);
  // Jamais moins de trois : la signature de la direction complète (hors exclusions).
  for (const id of d.transitions) if (menu.length < 3 && !excluded.has(id) && !menu.some((m) => m.id === id)) menu.push({ id, weight: 1 });
  if (!menu.length) menu.push({ id: 'cut', weight: 1 });
  return menu;
}

/** Transitions d'ouverture de la signature finale (douces ou graphiques), par ordre de préférence. */
const LOGO_TRANSITIONS: MotionTransition[] = ['iris', 'shapeWipe', 'dissolve', 'split', 'liquid', 'wipe', 'slideOver'];

/** Ancrages de composition : où se pose le bloc principal d'une scène. */
export type Anchor = 'top-left' | 'center-left' | 'bottom-left' | 'center' | 'bottom-center' | 'top-center' | 'right';

export type ColorStrategy = 'restrained' | 'committed' | 'drenched' | 'full' | 'studio';
export type Decor = 'none' | 'rules' | 'grid' | 'grain' | 'letterbox' | 'paper' | 'frame';

export interface DirectionDef {
  id: DirectionId;
  type: {
    /** Casse des grands titres (le corps n'est jamais en capitales). */
    displayCase: 'none' | 'upper';
    /** Chasse des grands titres, en em (négative = serré). */
    tracking: number;
    weight: number;
    lineHeight: number;
    /** Multiplicateur de taille des titres. */
    scale: number;
  };
  anchors: Anchor[];
  headline: TextTechnique[];
  support: TextTechnique[];
  transitions: MotionTransition[];
  pacing: {
    /** Durée d'une entrée de titre (s). */
    enter: number;
    /** Décalage entre unités d'un même groupe (s) — « lisez dans l'ordre ». */
    unitStagger: number;
    /** Décalage entre groupes (s) — « événements distincts ». */
    groupStagger: number;
    /** Durée d'une transition (s). */
    transition: number;
  };
  /** Courbes de Bézier : entrée (décélération) et sortie (accélération). */
  ease: { out: [number, number, number, number]; in: [number, number, number, number] };
  /** Rebond autorisé (tons ludiques seulement). */
  overshoot: boolean;
  color: ColorStrategy;
  decor: Decor;
  /** Mouvement « image par image » (2 = animé à 12 i/s, collage). 0 = fluide. */
  stepped: 0 | 2;
  /** Mouvement de caméra lent sur les scènes de lecture. */
  camera: 'still' | 'push' | 'drift' | 'pull' | 'rise' | 'tilt';
  /** Petit libellé au-dessus du titre : sur l'accroche seulement, ou jamais. */
  kicker: 'hook' | 'never';
}

export const DIRECTIONS: Record<DirectionId, DirectionDef> = {
  editorial: {
    id: 'editorial',
    type: { displayCase: 'none', tracking: -0.02, weight: 600, lineHeight: 1.06, scale: 0.95 },
    anchors: ['bottom-left', 'top-left', 'center-left', 'right'],
    headline: ['lineWipe', 'maskUp', 'blurWords', 'trackIn', 'rotateX', 'scatter', 'outlineFill'],
    support: ['blurWords', 'lineWipe', 'scatter'],
    transitions: ['dissolve', 'cut', 'wipe', 'slideOver'],
    pacing: { enter: 0.9, unitStagger: 0.08, groupStagger: 0.32, transition: 0.7 },
    ease: { out: [0.16, 1, 0.3, 1], in: [0.7, 0, 0.84, 0] },
    overshoot: false,
    color: 'restrained',
    decor: 'rules',
    stepped: 0,
    camera: 'drift',
    kicker: 'hook',
  },
  swiss: {
    id: 'swiss',
    type: { displayCase: 'none', tracking: -0.035, weight: 800, lineHeight: 0.98, scale: 1.05 },
    anchors: ['top-left', 'bottom-left', 'center-left', 'right'],
    headline: ['slideAlternate', 'maskUp', 'trackIn', 'stackPush', 'rotateX', 'skewIn'],
    support: ['maskUp', 'blurWords', 'rotateX'],
    transitions: ['cut', 'push', 'wipe', 'blockStack'],
    pacing: { enter: 0.55, unitStagger: 0.06, groupStagger: 0.28, transition: 0.45 },
    ease: { out: [0.22, 1, 0.36, 1], in: [0.64, 0, 0.78, 0] },
    overshoot: false,
    color: 'committed',
    decor: 'grid',
    stepped: 0,
    camera: 'still',
    kicker: 'never',
  },
  brutal: {
    id: 'brutal',
    type: { displayCase: 'upper', tracking: -0.03, weight: 900, lineHeight: 0.92, scale: 1.25 },
    anchors: ['center-left', 'top-left', 'bottom-left', 'center'],
    headline: ['stackPush', 'boxReveal', 'slideAlternate', 'maskUp', 'skewIn', 'stretch', 'zoomWords'],
    support: ['boxReveal', 'maskUp', 'skewIn'],
    transitions: ['cut', 'blockStack', 'flashCut', 'push'],
    pacing: { enter: 0.42, unitStagger: 0.05, groupStagger: 0.22, transition: 0.36 },
    ease: { out: [0.33, 1, 0.68, 1], in: [0.32, 0, 0.67, 0] },
    overshoot: false,
    color: 'drenched',
    decor: 'none',
    stepped: 0,
    camera: 'still',
    kicker: 'never',
  },
  kinetic: {
    id: 'kinetic',
    type: { displayCase: 'none', tracking: -0.03, weight: 800, lineHeight: 1.0, scale: 1.12 },
    anchors: ['center', 'center-left', 'bottom-center', 'top-left'],
    headline: ['charCascade', 'scaleBlur', 'flipChars', 'scramble', 'springUp', 'zoomWords', 'stretch', 'wave'],
    support: ['blurWords', 'charCascade', 'springUp'],
    transitions: ['zoomThrough', 'whip', 'flashCut', 'iris', 'push'],
    pacing: { enter: 0.6, unitStagger: 0.025, groupStagger: 0.25, transition: 0.42 },
    ease: { out: [0.16, 1, 0.3, 1], in: [0.7, 0, 0.84, 0] },
    overshoot: true,
    color: 'full',
    decor: 'none',
    stepped: 0,
    camera: 'push',
    kicker: 'hook',
  },
  cinematic: {
    id: 'cinematic',
    type: { displayCase: 'none', tracking: 0.01, weight: 500, lineHeight: 1.1, scale: 0.9 },
    anchors: ['bottom-center', 'center', 'bottom-left'],
    headline: ['blurWords', 'trackIn', 'scaleBlur', 'lineWipe', 'outlineFill', 'rotateX'],
    support: ['blurWords', 'lineWipe'],
    transitions: ['dissolve', 'dissolve', 'zoomThrough', 'cut'],
    pacing: { enter: 1.2, unitStagger: 0.1, groupStagger: 0.45, transition: 1.0 },
    ease: { out: [0.25, 1, 0.5, 1], in: [0.5, 0, 0.75, 0] },
    overshoot: false,
    color: 'restrained',
    decor: 'letterbox',
    stepped: 0,
    camera: 'push',
    kicker: 'never',
  },
  collage: {
    id: 'collage',
    type: { displayCase: 'none', tracking: -0.01, weight: 800, lineHeight: 1.02, scale: 1.0 },
    anchors: ['center-left', 'top-left', 'bottom-left', 'right', 'center'],
    headline: ['boxReveal', 'slideAlternate', 'typewriter', 'charCascade', 'wave', 'scatter', 'springUp'],
    support: ['typewriter', 'boxReveal', 'scatter'],
    transitions: ['slideOver', 'push', 'cut', 'blockStack'],
    pacing: { enter: 0.6, unitStagger: 0.07, groupStagger: 0.3, transition: 0.5 },
    ease: { out: [0.34, 1.56, 0.64, 1], in: [0.36, 0, 0.66, -0.56] },
    overshoot: true,
    color: 'full',
    decor: 'paper',
    stepped: 2,
    camera: 'still',
    kicker: 'never',
  },
  precision: {
    id: 'precision',
    type: { displayCase: 'none', tracking: -0.025, weight: 600, lineHeight: 1.04, scale: 0.92 },
    anchors: ['center', 'top-center', 'bottom-left', 'center-left'],
    headline: ['maskUp', 'trackIn', 'lineWipe', 'blurWords', 'rotateX', 'outlineFill'],
    support: ['maskUp', 'blurWords', 'rotateX'],
    transitions: ['iris', 'dissolve', 'slideOver', 'cut'],
    pacing: { enter: 0.8, unitStagger: 0.07, groupStagger: 0.35, transition: 0.65 },
    ease: { out: [0.19, 1, 0.22, 1], in: [0.95, 0.05, 0.795, 0.035] },
    overshoot: false,
    color: 'studio',
    decor: 'frame',
    stepped: 0,
    camera: 'drift',
    kicker: 'hook',
  },
  drenched: {
    id: 'drenched',
    type: { displayCase: 'none', tracking: -0.03, weight: 800, lineHeight: 0.98, scale: 1.1 },
    anchors: ['bottom-left', 'center-left', 'top-left', 'center'],
    headline: ['boxReveal', 'maskUp', 'stackPush', 'slideAlternate', 'zoomWords', 'springUp', 'outlineFill'],
    support: ['maskUp', 'lineWipe', 'zoomWords'],
    transitions: ['iris', 'wipe', 'cut', 'zoomThrough'],
    pacing: { enter: 0.7, unitStagger: 0.06, groupStagger: 0.3, transition: 0.55 },
    ease: { out: [0.22, 1, 0.36, 1], in: [0.64, 0, 0.78, 0] },
    overshoot: false,
    color: 'drenched',
    decor: 'none',
    stepped: 0,
    camera: 'push',
    kicker: 'never',
  },
};

/** Directions compatibles avec chaque type de motion. */
const TYPE_AFFINITY: Record<VideoType, DirectionId[]> = {
  kinetic: ['kinetic', 'brutal', 'swiss', 'drenched', 'editorial'],
  product: ['precision', 'editorial', 'swiss', 'drenched', 'collage'],
  promo: ['brutal', 'kinetic', 'swiss', 'drenched', 'collage'],
  footage: ['cinematic', 'editorial', 'swiss', 'precision'],
  showcase3d: ['precision', 'cinematic', 'drenched', 'swiss'],
  illustrated: ['collage', 'kinetic', 'drenched', 'editorial'],
  slideshow: ['editorial', 'cinematic', 'swiss', 'collage', 'precision'],
  logo: ['precision', 'cinematic', 'brutal', 'drenched'],
  // Combinée : toutes les directions, la DA de la marque départage.
  mix: ['editorial', 'swiss', 'brutal', 'kinetic', 'cinematic', 'collage', 'precision', 'drenched'],
};

/** Direction artistique de la marque → directions qui lui ressemblent (poids). */
const ART_AFFINITY: Record<string, DirectionId[]> = {
  minimalism: ['precision', 'swiss', 'editorial'],
  swiss: ['swiss', 'precision'],
  editorial: ['editorial', 'cinematic'],
  maximalism: ['kinetic', 'brutal', 'collage'],
  'pop-art': ['kinetic', 'collage', 'brutal'],
  graffiti: ['brutal', 'collage'],
  'collage-art': ['collage'],
  retro: ['collage', 'editorial'],
  aurora: ['cinematic', 'drenched'],
  glassmorphism: ['precision', 'cinematic'],
  futuristic: ['precision', 'kinetic'],
  cyberpunk: ['kinetic', 'brutal'],
  clay: ['collage', 'kinetic'],
  handwritten: ['collage', 'editorial'],
  bohemian: ['collage', 'editorial'],
  victorian: ['editorial', 'cinematic'],
  y2k: ['kinetic', 'collage'],
};

/**
 * Direction d'une vidéo : compatible avec le type, rapprochée de la direction
 * artistique de la marque, différente des vidéos précédentes du projet.
 */
export function pickDirection(opts: {
  type: VideoType;
  artStyleId?: string;
  /** Directions préférées par la DA de la charte (video.artdirection.ts) : elles pèsent plus. */
  artDirections?: DirectionId[];
  /** Directions exclues par la DA : jamais tirées. */
  artExcluded?: DirectionId[];
  seed: number;
  avoid?: string[];
  requested?: DirectionId;
}): DirectionId {
  if (opts.requested && DIRECTION_IDS.includes(opts.requested)) return opts.requested;
  const typePool = TYPE_AFFINITY[opts.type] || DIRECTION_IDS;
  const art = opts.artDirections?.length ? opts.artDirections : ART_AFFINITY[(opts.artStyleId || '').toLowerCase()] || [];
  // Toutes les directions, sauf celles que la DA exclut : la DA donne le LOOK, pas un seul langage.
  const allowed = DIRECTION_IDS.filter((id) => !(opts.artExcluded || []).includes(id));
  const recent = (opts.avoid || []).slice(-3);
  const fresh = allowed.filter((id) => !recent.includes(id));
  const pool = fresh.length >= 2 ? fresh : allowed;
  const weighted: DirectionId[] = [];
  for (const id of pool) {
    // Préférée par la DA : 3, 2.5, 2 ; compatible avec le type : +1 ; sinon 1.
    const a = art.indexOf(id);
    const weight = Math.round((1 + (a === 0 ? 2 : a === 1 ? 1.5 : a >= 2 ? 1 : 0) + (typePool.includes(id) ? 1 : 0)) * 2);
    for (let k = 0; k < weight; k++) weighted.push(id);
  }
  const r = rng(opts.seed ^ 0xd1ec7);
  return weighted[Math.floor(r() * weighted.length)] || pool[0] || 'editorial';
}

/** Langage de mouvement (effets sonores, musique) cohérent avec la direction. */
export function styleOfDirection(id: DirectionId): MotionStyle {
  return ({ editorial: 'premium', swiss: 'corporate', brutal: 'energetic', kinetic: 'energetic', cinematic: 'premium', collage: 'playful', precision: 'premium', drenched: 'corporate' } as const)[id];
}

// ─── Plan de mouvement par scène ────────────────────────────────────────────

export interface SceneMotion {
  anchor: Anchor;
  headline: TextTechnique;
  support: TextTechnique;
  /** Alignement du texte, déduit de l'ancrage. */
  align: 'left' | 'center';
  /** Transition qui ouvre la scène (absente sur la première). */
  transition?: MotionTransition;
  /** Le petit libellé est-il affiché sur cette scène ? */
  kicker: boolean;
}

const CENTERED: Anchor[] = ['center', 'bottom-center', 'top-center'];

/** Scènes qui imposent leur propre composition (média plein cadre, 3D, signature). */
const FIXED_LAYOUT = new Set(['logo', 'gallery', 'showcase3d']);

/**
 * Le plan de mouvement : ancrage, techniques et transition pour chaque scène,
 * tirés dans la direction, puis passés au contrôle anti-réflexe.
 */
export function planMotion(
  sceneIds: string[],
  direction: DirectionId,
  seed: number,
  opts: {
    landscape?: boolean;
    avoidHeadlines?: string[];
    /** Menu de transitions (catalogue filtré par la direction et la DA) ; à défaut, celles de la direction. */
    transitions?: WeightedTransition[];
    /** Transitions choisies par l'agent animateur (index de scène → transition du menu). */
    chosen?: Record<number, MotionTransition>;
  } = {}
): SceneMotion[] {
  const d = DIRECTIONS[direction];
  const r = rng(seed ^ 0x5ce4e);
  const pick = <T,>(list: T[], avoid?: T): T => {
    const pool = list.filter((x) => x !== avoid);
    const from = pool.length ? pool : list;
    return from[Math.floor(r() * from.length)];
  };
  // « Le moins récemment utilisé » : ni répétition, ni alternance A·B·A·B.
  // Les entrées de la vidéo précédente du projet partent « déjà utilisées » : la nouvelle en choisit d'autres.
  const recent: Record<string, unknown[]> = { headline: [...(opts.avoidHeadlines || [])].filter((h) => (d.headline as string[]).includes(h)), transition: [], anchor: [] };
  const lru = <T,>(key: string, list: T[]): T => {
    const used = recent[key] as T[];
    // Fenêtre d'oubli : 2 pour les petits menus, 4 quand la direction offre 6 entrées ou plus.
    const fresh = list.filter((x) => !used.slice(-Math.min(list.length - 1, list.length >= 6 ? 4 : 2)).includes(x));
    const choice = (fresh.length ? fresh : list)[Math.floor(r() * (fresh.length || list.length))];
    used.push(choice);
    return choice;
  };
  const menu = opts.transitions?.length ? opts.transitions : d.transitions.map((id) => ({ id, weight: 1 }));
  const cuts = Math.max(1, sceneIds.length - 1);
  // Une même transition au plus sur un tiers des coupes : le film varie ses raccords.
  const cap = Math.max(1, Math.ceil(cuts / 3));
  const usedCount = new Map<string, number>();
  const pickTransition = (i: number, sceneId: string, previous?: MotionTransition): MotionTransition => {
    const chosen = opts.chosen?.[i];
    if (chosen && menu.some((m) => m.id === chosen) && chosen !== previous) return chosen;
    if (sceneId === 'logo') return LOGO_TRANSITIONS.find((t) => menu.some((m) => m.id === t) && t !== previous) || menu.find((m) => m.id !== previous)?.id || menu[0].id;
    const pool = menu.filter((m) => m.id !== previous && (usedCount.get(m.id) || 0) < cap);
    const from = pool.length ? pool : menu.filter((m) => m.id !== previous);
    const list = from.length ? from : menu;
    // Une transition déjà vue dans le film pèse moins : on varie les raccords avant de les répéter.
    const weightOf = (m: WeightedTransition) => m.weight / (1 + (usedCount.get(m.id) || 0) * 1.5);
    const total = list.reduce((n, m) => n + weightOf(m), 0);
    let x = r() * total;
    for (const m of list) {
      x -= weightOf(m);
      if (x <= 0) return m.id;
    }
    return list[list.length - 1].id;
  };
  let prev: SceneMotion | undefined;
  const plan = sceneIds.map((sceneId, i) => {
    let anchor = FIXED_LAYOUT.has(sceneId) ? 'center' : lru('anchor', d.anchors);
    // En paysage, l'ancrage « droite » laisse la place à un média à gauche.
    if (opts.landscape && anchor === 'top-center') anchor = 'center-left';
    const motion: SceneMotion = {
      anchor,
      headline: lru('headline', d.headline),
      support: pick(d.support),
      align: CENTERED.includes(anchor) ? 'center' : 'left',
      transition: i === 0 ? undefined : pickTransition(i, sceneId, prev?.transition),
      kicker: d.kicker === 'hook' && i === 0,
    };
    if (motion.transition) usedCount.set(motion.transition, (usedCount.get(motion.transition) || 0) + 1);
    prev = motion;
    return motion;
  });
  return lintMotion(plan, sceneIds, d, menu.map((m) => m.id)).plan;
}

// ─── Contrôle anti-réflexe (pendant vidéo de l'« anti-slop » d'iCode) ───────

export interface MotionLintReport {
  plan: SceneMotion[];
  issues: string[];
}

/**
 * Détecte puis répare, sans modèle, les tics qui signent une vidéo générée :
 *  - la même entrée de titre sur trois scènes d'affilée ;
 *  - deux scènes consécutives au même ancrage ;
 *  - tout centré (au moins un tiers des scènes de texte doivent être ferrées) ;
 *  - la même transition partout, ou deux fois de suite ;
 *  - un petit libellé au-dessus de chaque titre (au plus un, sur l'accroche).
 */
export function lintMotion(plan: SceneMotion[], sceneIds: string[], d: DirectionDef, transitions?: MotionTransition[]): MotionLintReport {
  // Une réparation peut créer un autre défaut : on repasse jusqu'à stabilité.
  let current = plan;
  const menu = transitions?.length ? transitions : d.transitions;
  const first = lintPass(plan, sceneIds, d, menu);
  current = first.plan;
  for (let pass = 0; pass < 3; pass++) {
    const next = lintPass(current, sceneIds, d, menu);
    current = next.plan;
    if (!next.issues.length) break;
  }
  return { plan: current, issues: first.issues };
}

function lintPass(plan: SceneMotion[], sceneIds: string[], d: DirectionDef, menu: MotionTransition[]): MotionLintReport {
  const issues: string[] = [];
  const out = plan.map((m) => ({ ...m }));
  // D'abord le « tout centré » (il déplace des ancrages), puis les répétitions.
  {
    const text = out.filter((_, i) => !FIXED_LAYOUT.has(sceneIds[i]));
    const centered = text.filter((m) => m.align === 'center').length;
    if (text.length >= 3 && centered > text.length * 0.67) {
      issues.push('tout est centré');
      const leftAnchors = d.anchors.filter((a) => !CENTERED.includes(a));
      let flips = Math.ceil(text.length / 3);
      for (let i = 1; i < out.length && flips > 0; i += 2) {
        if (FIXED_LAYOUT.has(sceneIds[i]) || out[i].align === 'left') continue;
        out[i].anchor = leftAnchors.find((a) => a !== out[i - 1].anchor && a !== out[i + 1]?.anchor) || leftAnchors[0] || 'center-left';
        out[i].align = 'left';
        flips--;
      }
    }
  }
  for (let i = 1; i < out.length; i++) {
    if (out[i].headline === out[i - 1].headline && (i < 2 || out[i - 2].headline === out[i].headline)) {
      issues.push(`entrée répétée « ${out[i].headline} » (scène ${i + 1})`);
      out[i].headline = d.headline.find((h) => h !== out[i - 1].headline) || out[i].headline;
    }
    if (!FIXED_LAYOUT.has(sceneIds[i]) && out[i].anchor === out[i - 1].anchor) {
      issues.push(`ancrage répété « ${out[i].anchor} » (scène ${i + 1})`);
      out[i].anchor = d.anchors.find((a) => a !== out[i - 1].anchor && a !== out[i + 1]?.anchor) || out[i].anchor;
      out[i].align = CENTERED.includes(out[i].anchor) ? 'center' : 'left';
    }
    if (out[i].transition && out[i].transition === out[i - 1].transition && sceneIds[i] !== 'logo') {
      issues.push(`transition répétée « ${out[i].transition} » (scène ${i + 1})`);
      out[i].transition = menu.find((t) => t !== out[i - 1].transition && t !== out[i + 1]?.transition) || out[i].transition;
    }
  }
  // Alternance mécanique A·B·A·B des entrées : un motif aussi reconnaissable qu'une répétition.
  for (let i = 3; i < out.length; i++) {
    if (out[i].headline === out[i - 2].headline && out[i - 1].headline === out[i - 3].headline && out[i].headline !== out[i - 1].headline) {
      issues.push(`alternance mécanique des entrées (scène ${i + 1})`);
      out[i].headline = d.headline.find((h) => h !== out[i - 1].headline && h !== out[i - 2].headline) || out[i].headline;
    }
  }
  const kickers = out.filter((m) => m.kicker).length;
  if (kickers > 1) {
    issues.push(`${kickers} petits libellés`);
    out.forEach((m, i) => (m.kicker = i === 0 && d.kicker === 'hook'));
  }
  const transitions = new Set(out.map((m) => m.transition).filter(Boolean));
  if (out.length > 4 && transitions.size < 2) issues.push('une seule transition sur tout le film');
  return { plan: out, issues };
}

// ─── Surfaces selon la stratégie de couleur ─────────────────────────────────

type Surface = VideoSceneInstance['surface'];

/**
 * Couleur des scènes selon la stratégie de la direction — pas une alternance
 * mécanique : une stratégie « retenue » garde la marque pour l'accroche et
 * l'appel à l'action, une stratégie « trempée » décline une seule teinte.
 */
export function surfacesFor(sceneIds: string[], strategy: ColorStrategy, seed: number): Surface[] {
  const r = rng(seed ^ 0xc0102);
  return sceneIds.map((id, i) => {
    const last = i === sceneIds.length - 1;
    switch (strategy) {
      case 'restrained':
        if (i === 0) return r() < 0.5 ? 'primary' : 'light';
        if (id === 'cta') return 'primary';
        return 'light';
      case 'studio':
        // Fond de studio : une teinte claire continue, la marque sur l'appel à l'action.
        if (id === 'cta') return 'primary';
        return 'tint';
      case 'committed':
        if (last) return 'primary';
        return i % 2 === 0 ? 'primary' : 'light';
      case 'drenched':
        if (last) return 'deep';
        return (['primary', 'deep', 'tint'] as Surface[])[i % 3];
      default:
        if (last) return 'light';
        return (['primary', 'light', 'secondary', 'accent'] as Surface[])[(i + Math.floor(r() * 2)) % 4];
    }
  });
}

export function isMotionDirection(id: unknown): id is DirectionId {
  return typeof id === 'string' && DIRECTION_IDS.includes(id as DirectionId);
}

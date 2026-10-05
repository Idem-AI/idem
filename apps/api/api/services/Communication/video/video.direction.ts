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
import { MotionStyle, VideoSceneInstance, VideoType } from '../../../models/motionVideo.model';
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
  | 'flashCut';

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
  /** Directions admises par la DA de la charte (video.artdirection.ts) : elles l'emportent sur le type. */
  artDirections?: DirectionId[];
  seed: number;
  avoid?: string[];
  requested?: DirectionId;
}): DirectionId {
  if (opts.requested && DIRECTION_IDS.includes(opts.requested)) return opts.requested;
  const typePool = TYPE_AFFINITY[opts.type] || DIRECTION_IDS;
  const art = opts.artDirections?.length ? opts.artDirections : ART_AFFINITY[(opts.artStyleId || '').toLowerCase()] || [];
  // La charte d'abord : les directions de sa DA compatibles avec le type, sinon celles de la DA seules.
  const both = typePool.filter((id) => art.includes(id));
  const pool = art.length ? (both.length ? both : art) : typePool;
  const recent = (opts.avoid || []).slice(-3);
  const weighted: DirectionId[] = [];
  for (const id of pool) {
    if (recent.includes(id) && pool.some((p) => !recent.includes(p))) continue;
    // La première direction de la DA est la plus fidèle : elle pèse plus.
    const weight = 1 + (art[0] === id ? 2 : art.includes(id) ? 1 : 0);
    for (let k = 0; k < weight; k++) weighted.push(id);
  }
  const r = rng(opts.seed ^ 0xd1ec7);
  return weighted[Math.floor(r() * weighted.length)] || pool[0];
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
export function planMotion(sceneIds: string[], direction: DirectionId, seed: number, opts: { landscape?: boolean; avoidHeadlines?: string[] } = {}): SceneMotion[] {
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
      transition: i === 0 ? undefined : sceneId === 'logo' ? (d.transitions.includes('iris') ? 'iris' : d.transitions[0]) : lru('transition', d.transitions),
      kicker: d.kicker === 'hook' && i === 0,
    };
    prev = motion;
    return motion;
  });
  return lintMotion(plan, sceneIds, d).plan;
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
export function lintMotion(plan: SceneMotion[], sceneIds: string[], d: DirectionDef): MotionLintReport {
  // Une réparation peut créer un autre défaut : on repasse jusqu'à stabilité.
  let current = plan;
  const first = lintPass(plan, sceneIds, d);
  current = first.plan;
  for (let pass = 0; pass < 3; pass++) {
    const next = lintPass(current, sceneIds, d);
    current = next.plan;
    if (!next.issues.length) break;
  }
  return { plan: current, issues: first.issues };
}

function lintPass(plan: SceneMotion[], sceneIds: string[], d: DirectionDef): MotionLintReport {
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
      out[i].transition = d.transitions.find((t) => t !== out[i - 1].transition) || out[i].transition;
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

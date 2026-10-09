/**
 * L'EMPREINTE CRÉATIVE — deux vidéos sont-elles VRAIMENT différentes ?
 *
 * Le moteur évitait déjà la répétition (concepts, directions, kits, transitions récents exclus).
 * Mais deux vidéos aux choix tous « différents » peuvent encore donner le même film : gros texte →
 * entrée animée → élément central → transition → gros texte → appel. L'empreinte résume ce qu'un
 * spectateur perçoit — structure du récit, motifs, mises en page, mouvement, coupes, composition,
 * tempo, densité, contraste, vocabulaire d'outils — et la DISTANCE entre deux empreintes mesure
 * l'écart réel, sans aucun modèle (zéro token) :
 *
 *   distance < 0,30   trop proche
 *   0,30 – 0,55       acceptable
 *   > 0,55            réellement différente
 *
 * L'empreinte se calcule sur n'importe quel storyboard, y compris ceux des vidéos créées avant
 * elle : la mémoire du projet couvre toutes ses vidéos.
 */
import { VideoCreativeFingerprint, VideoStoryboard } from '../../../models/motionVideo.model';
import { addonsOfSceneCode } from './video.coder';
import { derivedPattern, PATTERN_BY_ID, patternForLayout, PatternFamily } from './video.patterns';

export const SIMILARITY = { tooClose: 0.3, distinct: 0.55 } as const;

export type Level3 = VideoCreativeFingerprint['tempo'];
export type CreativeFingerprint = VideoCreativeFingerprint;

const ROLE: Record<string, string> = {
  hook: 'hook',
  statement: 'claim',
  kinetic: 'claim',
  wordswap: 'claim',
  product: 'show',
  showcase3d: 'show',
  gallery: 'show',
  footage: 'show',
  lottie: 'show',
  benefits: 'list',
  stat: 'proof',
  quote: 'proof',
  offer: 'offer',
  event: 'invite',
  cta: 'cta',
  logo: 'sign',
};

/** Famille de composition d'une mise en page (le regard ne lit pas l'identifiant, il lit la forme). */
const LAYOUT_SHAPE: Record<string, string> = {
  wordStack: 'poster',
  quoteBig: 'poster',
  marqueeBack: 'bands',
  ticker: 'bands',
  bigNumber: 'giant',
  diagonalBand: 'diagonal',
  splitBlock: 'split',
  gridCards: 'grid',
  layeredCards: 'stack',
  checklist: 'list',
  circleStage: 'radial',
  chartRing: 'radial',
  dataArc: 'radial',
  priceBurst: 'radial',
  barCompare: 'bars',
  spotlightWord: 'center',
  frameOverlap: 'offset',
};

const anchorSide = (anchor?: string) => (!anchor ? 'center' : /left/.test(anchor) ? 'left' : anchor === 'right' ? 'right' : 'center');

const words = (slots: Record<string, string>) => Object.entries(slots).filter(([k]) => !['icons', 'visual'].includes(k)).reduce((n, [, v]) => n + String(v || '').split(/\s+/).filter(Boolean).length, 0);

const level = (v: number, lo: number, hi: number): Level3 => (v < lo ? 'low' : v > hi ? 'high' : 'medium');

/** Outils lus sur une scène du pipeline des menus. */
function sceneTools(sc: VideoStoryboard['scenes'][number], kit: VideoStoryboard['kit']): string[] {
  const out = ['type'];
  if (sc.code?.tsx) {
    const names = [...sc.code.tsx.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]@idem\/kit['"]/g)].flatMap((m) => m[1].split(',').map((n) => n.trim().split(/\s+as\s+/)[0]));
    const addons = addonsOfSceneCode(sc.code.tsx);
    if (names.includes('Odometer')) out.push('counter');
    if (names.includes('AfricaMap')) out.push('map');
    if (names.includes('Icon')) out.push('icon');
    if (names.includes('LogoMotion')) out.push('logo');
    if (names.some((n) => ['Sketch', 'Brush'].includes(n))) out.push('drawn');
    if (names.some((n) => ['FlowField', 'useNoise'].includes(n))) out.push('organic');
    if (addons.includes('chart')) out.push('chart');
    if (addons.includes('viz') && !names.includes('AfricaMap')) out.push('viz');
    if (addons.includes('zdog')) out.push('flat3d');
    if (/s\.image\b/.test(sc.code.tsx)) out.push('photo');
    return out;
  }
  const layout = sc.layout || '';
  if (['chartRing', 'barCompare'].includes(layout)) out.push('chart');
  if (layout === 'dataArc') out.push('viz');
  if (['bigNumber', 'chartRing', 'dataArc', 'priceBurst'].includes(layout) || sc.sceneId === 'stat') out.push('counter');
  if (layout === 'checklist') out.push('drawn');
  if (sc.sceneId === 'benefits' && kit?.icons?.[sc.key]?.length) out.push('icon');
  if (sc.image || sc.images?.length) out.push('photo');
  if (sc.video) out.push('footage');
  if (sc.model || sc.sceneId === 'showcase3d') out.push('3d');
  if (sc.lottie || sc.rive) out.push('illustration');
  if (sc.sceneId === 'logo') out.push('logo');
  if (kit && kit.backdropScenes?.includes(sc.key)) {
    const bg = kit.background;
    if (['flow-field'].includes(bg)) out.push('organic');
    else if (['sketch-shapes'].includes(bg)) out.push('drawn');
    else if (bg === 'flat3d') out.push('flat3d');
    else if (bg === 'voronoi') out.push('viz');
    else if (bg && bg !== 'none') out.push('graphic');
  }
  if (kit?.annotateScene === sc.key && kit.annotate && kit.annotate !== 'none') out.push('drawn');
  return out;
}

/** Le motif d'une scène : celui que le planificateur a posé, sinon déduit de ce que la scène montre. */
export function scenePattern(sc: VideoStoryboard['scenes'][number], kit: VideoStoryboard['kit']): string | undefined {
  if (sc.pattern && PATTERN_BY_ID.has(sc.pattern)) return sc.pattern;
  return derivedPattern(sc.sceneId, kit, sc.key) || patternForLayout(sc.sceneId, sc.layout, sc.motion?.headline);
}

/** L'empreinte d'un storyboard (vidéo neuve ou ancienne, film d'auteur compris). */
export function fingerprintOf(sb: VideoStoryboard): CreativeFingerprint {
  const scenes = sb.scenes || [];
  const kit = sb.kit;
  const text = scenes.filter((sc) => sc.sceneId !== 'logo');
  const patterns = scenes.map((sc) => scenePattern(sc, kit) || `scene:${sc.sceneId}`);
  const families = [...new Set(patterns.map((id) => PATTERN_BY_ID.get(id)?.family).filter(Boolean) as PatternFamily[])];
  const n = Math.max(1, scenes.length);
  const duration = sb.durationSec || scenes.reduce((s, sc) => s + sc.duration, 0) || 1;
  const cutsPerSec = (n - 1) / duration;
  let tempoIndex = cutsPerSec > 0.36 ? 2 : cutsPerSec < 0.24 ? 0 : 1;
  if (sb.rhythm === 'staccato') tempoIndex = Math.min(2, tempoIndex + 1);
  if (sb.rhythm === 'breathe') tempoIndex = Math.max(0, tempoIndex - 1);
  const wps = text.reduce((s, sc) => s + words(sc.slots || {}), 0) / duration;
  const brand = scenes.filter((sc) => ['primary', 'secondary', 'accent', 'deep'].includes(sc.surface)).length / n;
  const switches = scenes.filter((sc, i) => i > 0 && sc.surface !== scenes[i - 1].surface).length;
  const contrast: Level3 = brand >= 0.5 && switches >= (n - 1) / 2 ? 'high' : brand <= 0.2 ? 'low' : 'medium';
  const kitTokens = kit
    ? [
        `logo:${kit.logo}`,
        // « Aucun fond » et « aucune annotation » sont des choix comme les autres (mémoire du routeur).
        `bg:${kit.background && kit.background !== 'none' && kit.backdropScenes?.length ? kit.background : 'none'}`,
        `annotate:${kit.annotate && kit.annotate !== 'none' && kit.annotateScene ? kit.annotate : 'none'}`,
        ...Object.values(kit.treatments || {}).map((t) => `treatment:${t}`),
      ]
    : [];
  const layouts = scenes.map((sc) => sc.layout).filter((l): l is string => !!l);
  const motion = text.filter((sc) => !sc.code?.tsx).map((sc) => sc.motion?.headline).filter((h): h is string => !!h);
  const transitions = scenes.slice(1).map((sc) => (sc.code?.tsx ? undefined : sc.motion?.transition)).filter((t): t is string => !!t && t !== 'cut');
  const composition = scenes.map((sc) => (sc.code?.tsx ? `code:${scenePattern(sc, kit) || 'free'}` : sc.layout && sc.layout !== 'classic' ? LAYOUT_SHAPE[sc.layout] || sc.layout : anchorSide(sc.motion?.anchor)));
  const concept = sb.authored ? `authored:${(sb.authored.concept || '').toLowerCase().split(/\W+/).filter((w) => w.length > 4).slice(0, 3).join('-') || 'free'}` : sb.concept;
  const nodes = [
    ...kitTokens,
    ...(kit?.camera ? [`camera:${kit.camera}`] : []),
    ...(kit?.entrance ? [`entrance:${kit.entrance}`] : []),
    ...(sb.rhythm ? [`rhythm:${sb.rhythm}`] : []),
    ...(sb.concept ? [`concept:${sb.concept}`] : []),
    ...(sb.direction ? [`direction:${sb.direction}`] : []),
    ...layouts.map((l) => `layout:${l}`),
    ...transitions.map((t) => `transition:${t}`),
    ...motion.map((t) => `technique:${t}`),
  ];
  return {
    v: 1,
    direction: sb.direction,
    concept,
    rhythm: sb.rhythm,
    narrative: scenes.map((sc) => ROLE[sc.sceneId] || sc.sceneId),
    patterns,
    families,
    layouts,
    motion,
    transitions,
    composition,
    camera: kit?.camera,
    entrance: kit?.entrance,
    kit: kitTokens,
    surfaces: scenes.map((sc) => sc.surface),
    tools: [...new Set(scenes.flatMap((sc) => sceneTools(sc, kit)))],
    tempo: (['low', 'medium', 'high'] as Level3[])[tempoIndex],
    density: level(wps, 1.2, 2),
    contrast,
    accent: sb.creative?.accent?.pattern,
    nodes: [...new Set(nodes)],
  };
}

// ─── Distance ───────────────────────────────────────────────────────────────

const jaccard = (a: string[], b: string[]): number | null => {
  const A = new Set(a);
  const B = new Set(b);
  if (!A.size && !B.size) return null;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return 1 - inter / (A.size + B.size - inter);
};

/** Distance d'édition normalisée de deux suites (structure du récit, composition, surfaces). */
const sequence = (a: string[], b: string[]): number | null => {
  if (!a.length && !b.length) return null;
  const m = a.length;
  const n = b.length;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n] / Math.max(m, n);
};

const category = (a?: string, b?: string): number | null => (!a || !b ? null : a === b ? 0 : 1);
const ordinal = (a: Level3, b: Level3): number => Math.abs(['low', 'medium', 'high'].indexOf(a) - ['low', 'medium', 'high'].indexOf(b)) / 2;

/** Poids des dimensions (somme 1). Une dimension absente des deux côtés est retirée, les poids sont renormalisés. */
export const FINGERPRINT_WEIGHTS = {
  narrative: 0.12,
  concept: 0.07,
  patterns: 0.13,
  layouts: 0.08,
  motion: 0.08,
  transitions: 0.08,
  composition: 0.07,
  direction: 0.08,
  tools: 0.07,
  camera: 0.03,
  entrance: 0.02,
  tempo: 0.04,
  density: 0.03,
  contrast: 0.03,
  kit: 0.04,
  surfaces: 0.03,
} as const;

export type FingerprintDimension = keyof typeof FINGERPRINT_WEIGHTS;

/** Distance de 0 (même film) à 1 (rien en commun), avec le détail par dimension. */
export function fingerprintDistance(a: CreativeFingerprint, b: CreativeFingerprint): { distance: number; parts: Partial<Record<FingerprintDimension, number>> } {
  const parts: Partial<Record<FingerprintDimension, number | null>> = {
    narrative: sequence(a.narrative, b.narrative),
    concept: category(a.concept, b.concept),
    patterns: jaccard(a.patterns, b.patterns),
    layouts: jaccard(a.layouts, b.layouts),
    motion: jaccard(a.motion, b.motion),
    transitions: jaccard(a.transitions, b.transitions),
    composition: sequence(a.composition, b.composition),
    direction: category(a.direction, b.direction),
    tools: jaccard(a.tools, b.tools),
    camera: category(a.camera, b.camera),
    entrance: category(a.entrance, b.entrance),
    tempo: ordinal(a.tempo, b.tempo),
    density: ordinal(a.density, b.density),
    contrast: ordinal(a.contrast, b.contrast),
    kit: jaccard(a.kit, b.kit),
    surfaces: sequence(a.surfaces, b.surfaces),
  };
  let sum = 0;
  let weight = 0;
  const kept: Partial<Record<FingerprintDimension, number>> = {};
  for (const [dim, w] of Object.entries(FINGERPRINT_WEIGHTS) as [FingerprintDimension, number][]) {
    const v = parts[dim];
    if (v == null) continue;
    kept[dim] = Math.round(v * 1000) / 1000;
    sum += v * w;
    weight += w;
  }
  return { distance: weight ? Math.round((sum / weight) * 1000) / 1000 : 0, parts: kept };
}

export type NoveltyVerdict = 'too-close' | 'acceptable' | 'distinct' | 'first';

export const verdictOf = (distance: number | null): NoveltyVerdict => (distance == null ? 'first' : distance < SIMILARITY.tooClose ? 'too-close' : distance > SIMILARITY.distinct ? 'distinct' : 'acceptable');

/** L'écart d'une vidéo aux vidéos récentes du projet : la plus proche décide. */
export function noveltyAgainst(fp: CreativeFingerprint, recent: CreativeFingerprint[]): { nearest: number | null; index: number; mean: number | null; verdict: NoveltyVerdict } {
  if (!recent.length) return { nearest: null, index: -1, mean: null, verdict: 'first' };
  const d = recent.map((r) => fingerprintDistance(fp, r).distance);
  const nearest = Math.min(...d);
  return { nearest, index: d.indexOf(nearest), mean: Math.round((d.reduce((s, x) => s + x, 0) / d.length) * 1000) / 1000, verdict: verdictOf(nearest) };
}


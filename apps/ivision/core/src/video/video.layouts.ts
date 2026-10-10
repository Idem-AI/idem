/**
 * LES MISES EN PAGE — le catalogue que l'agent directeur artistique consulte.
 *
 * Le moteur sait composer une scène de texte de quatorze façons (video-engine/src/
 * layouts.tsx) en plus de la composition propre à sa direction (« classic »). Ici, le
 * code dit, pour chaque archétype :
 *
 *   - les scènes qu'il sait mettre en page, et ce qu'il exige de leur contenu ;
 *   - les directions de motion qui le portent bien (poids), comme pour les transitions ;
 *   - ce que la DA de la charte exclut (ART_LAYOUT_EXCLUDES, « à éviter »).
 *
 * `layoutMenu` donne à l'agent 3 ou 4 choix valides pour UNE scène ; `assignLayouts`
 * valide ses réponses (ou les remplace) pour tout le film : jamais deux fois de suite la
 * même mise en page, chaque archétype au plus une fois par vidéo (deux au-delà de neuf
 * scènes), « classic » minoritaire, et les mises en page des dernières vidéos du projet
 * reculent dans le menu.
 */
import { DirectionId } from './video.direction';

export type LayoutId =
  | 'classic'
  | 'wordStack'
  | 'marqueeBack'
  | 'bigNumber'
  | 'diagonalBand'
  | 'circleStage'
  | 'splitBlock'
  | 'layeredCards'
  | 'gridCards'
  | 'checklist'
  | 'quoteBig'
  | 'priceBurst'
  | 'ticker'
  | 'spotlightWord'
  | 'frameOverlap'
  | 'chartRing'
  | 'barCompare'
  | 'dataArc';

export interface LayoutScene {
  sceneId: string;
  slots: Record<string, string>;
  image?: string;
  video?: string;
}

export interface LayoutDef {
  summary: string;
  scenes: string[];
  /** Le contenu de la scène permet-il cette mise en page ? */
  needs: (sc: LayoutScene) => boolean;
  directions: Partial<Record<DirectionId, number>>;
  /** Bibliothèque du moteur qu'exige cette mise en page (chargée par le montage). */
  addon?: 'chart' | 'viz' | 'draw' | 'zdog';
}

const words = (text?: string) => (text || '').split(/\s+/).filter(Boolean);
const title = (sc: LayoutScene) => sc.slots.title || sc.slots.name || sc.slots.quote || '';
const items = (sc: LayoutScene) => (sc.sceneId === 'event' ? ['date', 'time', 'place'] : ['b1', 'b2', 'b3']).filter((k) => sc.slots[k]).length;
const numeric = (v?: string) => !!v && /\d/.test(v) && v.length <= 10;
/** Un pourcentage entre 0 et 100 écrit dans la case (« 87 % ») : le graphique ne montre que lui. */
const percent = (v?: string) => {
  const m = String(v || '').match(/(\d+(?:[.,]\d+)?)\s*%/);
  const n = m ? Number(m[1].replace(',', '.')) : NaN;
  return n > 0 && n <= 100;
};
/** Le premier nombre d'un prix (« 15 000 F » → 15000). */
const amount = (v?: string) => {
  const m = String(v || '').replace(/[\u00a0\u202f]/g, ' ').match(/\d{1,3}(?:[ .,]\d{3})+|\d+/);
  return m ? Number(m[0].replace(/[ .,]/g, '')) : NaN;
};

export const LAYOUT_CATALOGUE: Record<Exclude<LayoutId, 'classic'>, LayoutDef> = {
  wordStack: {
    summary: 'poster type: the headline stacked word by word, huge, alternating solid and outline',
    scenes: ['hook', 'statement', 'cta'],
    needs: (sc) => words(title(sc)).length >= 2 && words(title(sc)).length <= 8,
    directions: { brutal: 3, kinetic: 3, swiss: 2.5, drenched: 2, collage: 1.5, editorial: 1, precision: 1, cinematic: 0.8 },
  },
  marqueeBack: {
    summary: 'a giant outlined keyword scrolls behind the headline',
    scenes: ['hook', 'statement', 'cta'],
    needs: (sc) => words(title(sc)).some((w) => w.replace(/\W/g, '').length >= 4),
    directions: { kinetic: 3, brutal: 2.5, drenched: 2.5, collage: 2, swiss: 1.5, cinematic: 1, precision: 1, editorial: 0.5 },
  },
  bigNumber: {
    summary: 'the number fills the frame, label in a color block',
    scenes: ['stat', 'offer'],
    needs: (sc) => numeric(sc.slots.value || sc.slots.price),
    directions: { swiss: 3, brutal: 3, precision: 2.5, kinetic: 2.5, drenched: 2, editorial: 2, cinematic: 1.5, collage: 1.5 },
  },
  diagonalBand: {
    summary: 'a tilted brand-color band crosses the frame with the headline on it',
    scenes: ['hook', 'statement', 'cta', 'offer'],
    needs: (sc) => words(title(sc) || sc.slots.price).length >= 1 && words(title(sc)).length <= 9,
    directions: { kinetic: 3, brutal: 2.5, collage: 2.5, drenched: 2, swiss: 1 },
  },
  circleStage: {
    summary: 'a big brand circle (photo, number or symbol) with a turning ring, text beside it',
    scenes: ['hook', 'statement', 'stat', 'cta', 'product'],
    needs: (sc) => !!title(sc) || !!sc.slots.label,
    directions: { precision: 2.5, drenched: 2.5, kinetic: 2, collage: 2, editorial: 1.5, swiss: 1, cinematic: 1 },
  },
  chartRing: {
    summary: 'the percentage as a Chart.js ring that sweeps to its value, the number rolling in its center',
    scenes: ['stat'],
    needs: (sc) => percent(sc.slots.value),
    directions: { precision: 3, swiss: 2.5, drenched: 2, editorial: 2, kinetic: 1.5, cinematic: 1 },
    addon: 'chart',
  },
  barCompare: {
    summary: 'old price and new price as two Chart.js bars that rise, the saving made visible',
    scenes: ['offer'],
    needs: (sc) => amount(sc.slots.oldPrice) > amount(sc.slots.price) && amount(sc.slots.price) > 0,
    directions: { swiss: 2.5, brutal: 2.5, kinetic: 2, precision: 2, collage: 1.5, drenched: 1.5 },
    addon: 'chart',
  },
  dataArc: {
    summary: 'a thick 270° gauge (visx) that fills to the percentage, label under it',
    scenes: ['stat'],
    needs: (sc) => percent(sc.slots.value),
    directions: { cinematic: 2.5, precision: 2, drenched: 2.5, editorial: 1.5, kinetic: 1.5, collage: 1 },
    addon: 'viz',
  },
  splitBlock: {
    summary: 'the frame split in two color blocks: headline on one, details on the other',
    scenes: ['statement', 'benefits', 'stat', 'cta', 'event'],
    needs: (sc) => !!(title(sc) || sc.slots.value) && !!(sc.slots.sub || sc.slots.label || sc.slots.contact || sc.slots.action || items(sc) >= 2),
    directions: { swiss: 3, precision: 2.5, editorial: 2.5, brutal: 2, drenched: 1.5, cinematic: 1, kinetic: 1, collage: 1 },
  },
  layeredCards: {
    summary: 'each item on a card, cards stacked with depth, floating',
    scenes: ['benefits', 'event'],
    needs: (sc) => items(sc) >= 2,
    directions: { collage: 3, kinetic: 2.5, precision: 2, drenched: 1.5, editorial: 1 },
  },
  gridCards: {
    summary: 'a bento grid: headline cell in brand color, one cell per item, focus moves cell to cell',
    scenes: ['benefits', 'event'],
    needs: (sc) => items(sc) >= 2,
    directions: { swiss: 3, precision: 3, brutal: 2, editorial: 1.5, kinetic: 1.5, drenched: 1 },
  },
  checklist: {
    summary: 'items checked one by one, check marks drawn, a line connects them',
    scenes: ['benefits'],
    needs: (sc) => items(sc) >= 2,
    directions: { precision: 2.5, editorial: 2, swiss: 2, cinematic: 1.5, kinetic: 1, drenched: 1, brutal: 1, collage: 1 },
  },
  quoteBig: {
    summary: 'a giant quotation mark behind the testimonial, author with a drawn rule',
    scenes: ['quote'],
    needs: (sc) => !!sc.slots.quote,
    directions: { editorial: 3, cinematic: 2.5, collage: 2, precision: 2, swiss: 1.5, drenched: 1.5, brutal: 1, kinetic: 1 },
  },
  priceBurst: {
    summary: 'the price inside a turning starburst, old price struck',
    scenes: ['offer', 'product'],
    needs: (sc) => !!sc.slots.price && sc.slots.price.length <= 12,
    directions: { kinetic: 3, collage: 3, brutal: 2, drenched: 1.5 },
  },
  ticker: {
    summary: 'two scrolling news-ticker bands frame the headline',
    scenes: ['hook', 'cta', 'statement'],
    needs: (sc) => words(title(sc)).length >= 2,
    directions: { kinetic: 3, brutal: 3, drenched: 2, collage: 2, swiss: 1.5 },
  },
  spotlightWord: {
    summary: 'the sentence small, then its key word huge under a spotlight',
    scenes: ['hook', 'statement'],
    needs: (sc) => words(title(sc)).length >= 3,
    directions: { cinematic: 3, drenched: 2.5, editorial: 2, precision: 2, kinetic: 1.5, swiss: 1 },
  },
  frameOverlap: {
    summary: 'headline on a brand-color block, an offset outline frame behind it',
    scenes: ['hook', 'statement', 'cta', 'product'],
    needs: (sc) => words(title(sc)).length >= 2 && words(title(sc)).length <= 12,
    directions: { editorial: 2.5, swiss: 2, precision: 2, collage: 2, brutal: 1.5, drenched: 1.5, kinetic: 1 },
  },
};
export const LAYOUT_IDS = Object.keys(LAYOUT_CATALOGUE) as Exclude<LayoutId, 'classic'>[];

/** Scènes dont la mise en page peut changer (les autres ont leur propre composition : clip, galerie, 3D, signature…). */
export const LAYOUT_SCENES = new Set(['hook', 'statement', 'stat', 'benefits', 'offer', 'quote', 'cta', 'event', 'product']);

export interface LayoutContext {
  direction: DirectionId;
  /** Exclusions de la DA de la charte. */
  excluded?: string[];
  /** Bonus de la DA (`layout:<id>` → poids). */
  boosts?: Record<string, number>;
  /** Mises en page des dernières vidéos du projet (une liste par vidéo, la plus récente en dernier). */
  recent?: string[][];
}

/** L'archétype convient-il à cette scène, dans cette direction, sous cette DA ? */
export function layoutFits(id: string, sc: LayoutScene, ctx: Pick<LayoutContext, 'direction' | 'excluded'>): boolean {
  if (id === 'classic') return true;
  const def = LAYOUT_CATALOGUE[id as Exclude<LayoutId, 'classic'>];
  if (!def || !LAYOUT_SCENES.has(sc.sceneId) || !def.scenes.includes(sc.sceneId)) return false;
  if ((ctx.excluded || []).includes(id)) return false;
  if ((def.directions[ctx.direction] || 0) <= 0) return false;
  // Produit avec photo : le cercle seul sait la montrer (les autres plans passent par les mises en scène des médias).
  if (sc.sceneId === 'product' && (sc.image || sc.video)) return id === 'circleStage';
  return def.needs(sc);
}

function scored(sc: LayoutScene, ctx: LayoutContext): { id: LayoutId; weight: number }[] {
  const recency = new Map<string, number>();
  (ctx.recent || []).slice(-3).forEach((list, k, all) => {
    const w = k === all.length - 1 ? 1 : k === all.length - 2 ? 0.55 : 0.3;
    for (const id of new Set(list)) recency.set(id, (recency.get(id) || 0) + w);
  });
  return LAYOUT_IDS.filter((id) => layoutFits(id, sc, ctx))
    .map((id) => ({ id: id as LayoutId, weight: Math.max(0.15, (LAYOUT_CATALOGUE[id].directions[ctx.direction] || 0) + (ctx.boosts?.[`layout:${id}`] || 0) - (recency.get(id) || 0) * 1.3) }))
    .sort((a, b) => b.weight - a.weight || a.id.localeCompare(b.id));
}

/** Le menu d'une scène pour l'agent : les meilleures mises en page valides, plus « classic ». */
export function layoutMenu(sc: LayoutScene, ctx: LayoutContext, size = 4): LayoutId[] {
  if (!LAYOUT_SCENES.has(sc.sceneId)) return [];
  const list = scored(sc, ctx)
    .slice(0, size - 1)
    .map((x) => x.id);
  return list.length ? [...list, 'classic'] : [];
}

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Les mises en page du film. Les choix de l'agent (`chosen`) sont gardés s'ils sont dans le
 * menu de leur scène et ne créent pas de répétition ; sinon le graphe tire, pondéré, parmi
 * les archétypes encore libres. Retour : une entrée par scène (undefined = scène sans archétype).
 */
export function assignLayouts(scenes: LayoutScene[], ctx: LayoutContext & { seed: number; chosen?: Record<number, string> }): (LayoutId | undefined)[] {
  const r = rng(ctx.seed ^ 0x1a4077);
  const eligible = scenes.filter((sc) => LAYOUT_SCENES.has(sc.sceneId)).length;
  const maxUse = scenes.length > 9 ? 2 : 1;
  // « classic » (la composition de la direction) reste possible, mais minoritaire : au plus un tiers.
  const maxClassic = Math.max(1, Math.floor(eligible / 3));
  const used = new Map<string, number>();
  const out: (LayoutId | undefined)[] = [];
  scenes.forEach((sc, i) => {
    if (!LAYOUT_SCENES.has(sc.sceneId)) return void out.push(undefined);
    const prev = out[i - 1];
    const free = (id: string) => id !== prev && (id === 'classic' ? (used.get(id) || 0) < maxClassic : (used.get(id) || 0) < maxUse);
    const options = scored(sc, ctx).filter((x) => free(x.id));
    const chosen = ctx.chosen?.[i];
    let pick: LayoutId | undefined;
    if (chosen && free(chosen) && (chosen === 'classic' || options.some((o) => o.id === chosen))) pick = chosen as LayoutId;
    else if (options.length) {
      const total = options.reduce((n, o) => n + o.weight, 0);
      let x = r() * total;
      pick = options.find((o) => (x -= o.weight) <= 0)?.id || options[options.length - 1].id;
    } else {
      // Tout est déjà pris : la composition de la direction, sinon un archétype déjà vu (jamais celui d'avant).
      const reuse = scored(sc, ctx).find((x) => x.id !== prev);
      pick = prev !== 'classic' ? 'classic' : reuse?.id;
    }
    if (pick) used.set(pick, (used.get(pick) || 0) + 1);
    out.push(pick);
  });
  return out;
}

/**
 * LES RECETTES — pour chaque catégorie de logo, plusieurs façons de construire un Logo IR.
 *
 * Une recette n'est pas un gabarit figé : elle choisit un générateur d'après le brief, tire ses
 * paramètres dans leurs bornes (graine), règle la typographie d'après la personnalité de la
 * marque, et assemble des couches. Un même couple (recette, marque) donne toujours le même
 * document ; deux projets n'obtiennent presque jamais le même.
 *
 * Les 11 catégories : wordmark, lettermark, letterform, pictorial, abstract, mascot,
 * combination, emblem, dynamic, minimal, negative-space — et le logo « dynamique » est un système
 * de variantes liées au concept de base, le « minimalisme » une contrainte (budget de nœuds).
 */
import type { ConceptType, LogoPalette } from '../ir/logo.schema';
import { getGenerator, listGenerators, randomParams } from '../render/generators';
import type { GeneratorFamily, GeneratorSpec, Params } from '../render/generators';
import { affinity, initialsOf, PlanBrief, Traits } from './brief';

export type Doc = Record<string, unknown>;

export interface RecipeCtx {
  brief: PlanBrief;
  palette: LogoPalette;
  rng: () => number;
  weights: Map<string, number>;
  traits: Traits;
  /** Le nom de la marque accompagne-t-il le symbole ? (type « icône + nom » ; faux pour initiales seules) */
  withName: boolean;
  /** 0..1 : part d'exploration (écart au choix le plus évident). */
  explore: number;
  /** Générateurs déjà pris par une autre proposition de la même série (évités). */
  used: Set<string>;
  /** Direction imposée (par l'agent) : générateur et/ou variante (conteneur, effet…). */
  force?: { generator?: string; variant?: string };
}

export interface Recipe {
  id: string;
  type: ConceptType;
  /** Poids de tirage (0 : recette exclue pour ce brief). */
  weight: (ctx: RecipeCtx) => number;
  build: (ctx: RecipeCtx) => Doc | null;
}

// ─── Aides ──────────────────────────────────────────────────────────────────

const pick = <T>(rng: () => number, items: readonly T[]): T => items[Math.floor(rng() * items.length)];
const between = (rng: () => number, lo: number, hi: number) => Math.round((lo + rng() * (hi - lo)) * 100) / 100;

/** Gumbel : le bruit qui fait d'un tri par score un tirage pondéré. */
const gumbel = (rng: () => number) => -Math.log(-Math.log(Math.max(1e-9, rng())));

/** Choisit un générateur : affinité avec le brief + bruit proportionnel à l'exploration. */
export function chooseGenerator(ctx: RecipeCtx, families: GeneratorFamily[], opts: { tones?: (1 | 2 | 3)[]; exclude?: string[] } = {}): GeneratorSpec | null {
  const pool = listGenerators().filter((g) => families.includes(g.family) && !(opts.exclude ?? []).includes(g.id) && (!opts.tones || opts.tones.includes(g.tones)));
  if (!pool.length) return null;
  const temperature = 0.4 + ctx.explore * 1.8;
  const forced = ctx.force?.generator ? pool.find((g) => g.id === ctx.force!.generator) : undefined;
  if (forced) return forced;
  const scored = pool.map((g) => ({ g, s: affinity(g.tags, ctx.weights) * 2.2 + gumbel(ctx.rng) * temperature - (ctx.used.has(g.id) ? 3 : 0) }));
  scored.sort((a, b) => b.s - a.s);
  return scored[0].g;
}

/** Paramètres d'un générateur : quelques-uns tirés au sort (originalité), les autres par défaut. */
function paramsFor(ctx: RecipeCtx, spec: GeneratorSpec, mood?: string): Params {
  const keys = Object.keys(spec.params);
  const count = Math.min(keys.length, 1 + Math.floor(ctx.rng() * (2 + ctx.explore * 2)));
  const chosen = [...keys].sort(() => ctx.rng() - 0.5).slice(0, count);
  const params = randomParams(spec, ctx.rng, chosen);
  if (mood && spec.params.mood) params.mood = mood;
  return params;
}

export function moodFor(ctx: RecipeCtx): string {
  if (ctx.traits.bold) return 'bold';
  if (ctx.traits.calm || ctx.traits.luxury) return 'calm';
  if (ctx.traits.playful || ctx.traits.young) return pick(ctx.rng, ['happy', 'wink']);
  return pick(ctx.rng, ['happy', 'calm']);
}

// ─── Typographie ────────────────────────────────────────────────────────────

interface NameStyle {
  case: 'none' | 'upper' | 'lower' | 'title';
  tracking: number;
  weight: number;
}

/** La typographie du nom d'après la personnalité (règles de métier, avec un peu de hasard). */
export function nameStyle(ctx: RecipeCtx): NameStyle {
  const { traits, rng } = ctx;
  if (traits.luxury) return { case: 'upper', tracking: between(rng, 0.14, 0.26), weight: pick(rng, [400, 500, 600]) };
  if (traits.bold) return { case: pick(rng, ['upper', 'none'] as const), tracking: between(rng, -0.02, 0.03), weight: pick(rng, [800, 900]) };
  if (traits.tech) return { case: pick(rng, ['lower', 'none'] as const), tracking: between(rng, -0.03, 0.02), weight: pick(rng, [600, 700]) };
  if (traits.calm) return { case: pick(rng, ['lower', 'title'] as const), tracking: between(rng, 0.02, 0.08), weight: pick(rng, [500, 600]) };
  if (traits.classic) return { case: pick(rng, ['title', 'upper'] as const), tracking: between(rng, 0.02, 0.12), weight: pick(rng, [600, 700]) };
  if (traits.playful) return { case: pick(rng, ['lower', 'title', 'none'] as const), tracking: between(rng, -0.01, 0.04), weight: pick(rng, [700, 800]) };
  return { case: pick(rng, ['none', 'lower', 'title'] as const), tracking: between(rng, -0.01, 0.06), weight: pick(rng, [600, 700, 800]) };
}

/** Le nom en une ou deux lignes (deux au-delà de 16 caractères, à l'espace le plus central). */
function nameLines(name: string): string[] {
  const clean = name.trim();
  if (clean.length <= 16 || !clean.includes(' ')) return [clean.slice(0, 48)];
  const words = clean.split(/\s+/);
  let best = 1;
  let gap = Infinity;
  for (let i = 1; i < words.length; i++) {
    const d = Math.abs(words.slice(0, i).join(' ').length - words.slice(i).join(' ').length);
    if (d < gap) {
      gap = d;
      best = i;
    }
  }
  return [words.slice(0, best).join(' '), words.slice(best).join(' ')].map((l) => l.slice(0, 48));
}

/** Effets typographiques disponibles pour ce nom (certains exigent une lettre précise). */
function availableEffects(name: string): string[] {
  const out = ['dot', 'underline', 'bar', 'slice', 'italic', 'plain', 'plain', 'accentChar', 'cutCorner'];
  if (/[ijïî]/i.test(name)) out.push('dotReplace', 'dotReplace');
  if (/[oO0]/.test(name)) out.push('swapRound', 'swapRound');
  if (name.length >= 4 && !/\s/.test(name)) out.push('ligature');
  return out;
}

function effectFor(kind: string, name: string, ctx: RecipeCtx): Doc | null {
  const lower = name;
  switch (kind) {
    case 'dot':
      return { type: 'dot', shape: pick(ctx.rng, ['circle', 'circle', 'diamond', 'square']) };
    case 'underline':
      return { type: 'underline', span: between(ctx.rng, 0.3, 0.6) };
    case 'bar':
      return { type: 'bar' };
    case 'slice':
      return { type: 'slice', at: between(ctx.rng, 0.4, 0.6), gap: between(ctx.rng, 0.04, 0.08) };
    case 'italic':
      return { type: 'italic', angle: between(ctx.rng, 6, 12) };
    case 'dotReplace':
      return { type: 'dotReplace', shape: pick(ctx.rng, ['circle', 'diamond', 'square', 'triangle', 'leaf']) };
    case 'swapRound': {
      const indexes = [...lower].map((c, i) => (/[oO0]/.test(c) ? i : -1)).filter((i) => i >= 0);
      return indexes.length ? { type: 'swapRound', index: pick(ctx.rng, indexes), with: pick(ctx.rng, ['disc', 'ring']) } : null;
    }
    case 'accentChar':
      return { type: 'accentChar', index: Math.min(lower.length - 1, Math.floor(ctx.rng() * Math.min(3, lower.length))), color: 'accent' };
    case 'cutCorner':
      return { type: 'cutCorner', index: 0, corner: pick(ctx.rng, ['tr', 'tl', 'br']), size: between(ctx.rng, 0.22, 0.38) };
    case 'ligature':
      return { type: 'ligature', overlap: between(ctx.rng, 0.1, 0.22) };
    default:
      return null;
  }
}

/** Les couches de texte du nom. Un effet n'est posé que sur la dernière ligne (la signature). */
function nameLayers(ctx: RecipeCtx, opts: { effect?: string | null; style?: NameStyle; role?: 'wordmark' | 'symbol'; content?: string } = {}): Doc[] {
  const style = opts.style ?? nameStyle(ctx);
  const lines = nameLines(opts.content ?? ctx.brief.brandName);
  return lines.map((content, i) => {
    const last = i === lines.length - 1;
    const effects: Doc[] = [];
    if (last && opts.effect) {
      const fx = effectFor(opts.effect, content, ctx);
      if (fx) effects.push(fx);
    }
    return { kind: 'text', id: lines.length > 1 ? `name${i + 1}` : 'name', role: opts.role ?? 'wordmark', content, case: style.case, tracking: style.tracking, font: { role: 'display', weight: style.weight }, ...(effects.length ? { effects } : {}) };
  });
}

// ─── Base d'un document ─────────────────────────────────────────────────────

function baseDoc(ctx: RecipeCtx, type: ConceptType, recipe: string, layers: Doc[], extra: Doc = {}, rationale = ''): Doc {
  return {
    brief: {
      brandName: ctx.brief.brandName,
      ...(ctx.brief.tagline ? { tagline: ctx.brief.tagline } : {}),
      industry: ctx.brief.industry ?? '',
      audience: ctx.brief.audience ?? '',
      personality: (ctx.brief.personality ?? []).slice(0, 6),
    },
    concept: { type, rationale, motifs: [], recipe },
    palette: ctx.palette,
    layers,
    meta: { seed: Math.floor(ctx.rng() * 4294967295), engine: 'logo-engine/1' },
    ...extra,
  };
}

/** Un nom long (ou espacé) s'empile sous le symbole : en ligne, le symbole deviendrait minuscule. */
const layoutFor = (ctx: RecipeCtx): 'horizontal' | 'stacked' | 'symbol-only' => {
  if (!ctx.withName) return 'symbol-only';
  const long = ctx.brief.brandName.trim().length >= 10;
  return ctx.rng() < (long ? 0.65 : 0.25) ? 'stacked' : 'horizontal';
};

const composition = (ctx: RecipeCtx, overrides: Doc = {}): Doc => ({
  layout: layoutFor(ctx),
  gap: between(ctx.rng, 0.24, 0.42),
  symbolScale: between(ctx.rng, 2.4, 3.3),
  align: 'center',
  padding: 0.1,
  ...overrides,
});

const generatorLayer = (spec: GeneratorSpec, params: Params, id = 'sym', extra: Doc = {}): Doc => ({ kind: 'generator', id, generator: spec.id, params, ...extra });

const withNameLayers = (ctx: RecipeCtx, effectKind?: string | null): Doc[] => (ctx.withName ? nameLayers(ctx, { effect: effectKind ?? (ctx.rng() < 0.35 ? pick(ctx.rng, ['dot', 'underline']) : null) }) : []);

// ─── Les recettes ───────────────────────────────────────────────────────────

const RECIPES: Recipe[] = [];
const recipe = (r: Recipe) => RECIPES.push(r);

// — wordmark —
recipe({
  id: 'wordmark',
  type: 'wordmark',
  weight: () => 1,
  build: (ctx) => {
    const name = ctx.brief.brandName;
    const wanted = ctx.force?.variant;
    const kind = wanted && availableEffects(name).includes(wanted) ? wanted : pick(ctx.rng, availableEffects(name));
    const layers = nameLayers(ctx, { effect: kind === 'plain' ? null : kind });
    const tagline = ctx.brief.tagline
      ? [{ kind: 'text', id: 'tag', role: 'tagline', content: ctx.brief.tagline.slice(0, 48), case: 'upper', tracking: 0.28, font: { role: 'body', weight: 500 } }]
      : [];
    return baseDoc(ctx, 'wordmark', `wordmark:${kind}`, [...layers, ...tagline], { composition: { layout: 'wordmark-only', padding: 0.12, align: 'center' } }, `Le nom, composé en ${kind === 'plain' ? 'caractères sobres' : `typographie signée (${kind})`} : la lettre porte l'identité.`);
  },
});

// — lettermark —
const LETTER_CONTAINERS = ['tile', 'circle', 'squircle', 'ring', 'hexagon', 'diamond', 'underline', 'shield'] as const;

function letterCap(letters: string): number {
  return letters.length === 1 ? 52 : letters.length === 2 ? 34 : 25;
}

recipe({
  id: 'lettermark',
  type: 'lettermark',
  weight: () => 1,
  build: (ctx) => {
    const letters = initialsOf(ctx.brief.brandName, 2);
    const style = nameStyle(ctx);
    const container = (LETTER_CONTAINERS as readonly string[]).includes(ctx.force?.variant ?? '') ? (ctx.force!.variant as (typeof LETTER_CONTAINERS)[number]) : pick(ctx.rng, LETTER_CONTAINERS);
    const cap = letterCap(letters);
    const text = (id: string, fill: string, extra: Doc = {}): Doc => ({ kind: 'text', id, role: 'symbol', content: letters, fill, size: cap, at: { x: 50, y: 50 }, tracking: letters.length > 1 ? 0.04 : 0, case: 'upper', font: { role: 'display', weight: Math.max(600, style.weight) }, ...extra });
    let layers: Doc[];
    switch (container) {
      case 'tile':
        layers = [{ kind: 'group', id: 'mark', children: [{ kind: 'shape', id: 'bg', geometry: { type: 'rect', x: 4, y: 4, w: 92, h: 92, r: between(ctx.rng, 6, 28) } }, text('ml', 'paper')] }];
        break;
      case 'circle':
        layers = [{ kind: 'group', id: 'mark', children: [{ kind: 'shape', id: 'bg', geometry: { type: 'circle', cx: 50, cy: 50, r: 46 } }, text('ml', 'paper', { size: cap * 0.92 })] }];
        break;
      case 'squircle':
        layers = [{ kind: 'group', id: 'mark', children: [{ kind: 'shape', id: 'bg', geometry: { type: 'superellipse', cx: 50, cy: 50, rx: 46, ry: 46, n: between(ctx.rng, 3, 5) } }, text('ml', 'paper')] }];
        break;
      case 'ring':
        layers = [{ kind: 'shape', id: 'bg', geometry: { type: 'ring', cx: 50, cy: 50, r: 46, thickness: between(ctx.rng, 4, 8) } }, text('ml', 'ink', { size: cap * 0.88 }), ...(ctx.palette.accent ? [{ kind: 'shape', id: 'dot', fill: 'accent', geometry: { type: 'circle', cx: 82, cy: 18, r: 7 } }] : [])];
        break;
      case 'hexagon':
        layers = [{ kind: 'group', id: 'mark', children: [{ kind: 'shape', id: 'bg', geometry: { type: 'polygon', cx: 50, cy: 50, r: 48, sides: 6, rotation: 0, cornerRadius: between(ctx.rng, 2, 8) } }, text('ml', 'paper', { size: cap * 0.9 })] }];
        break;
      case 'diamond':
        layers = [{ kind: 'group', id: 'mark', children: [{ kind: 'shape', id: 'bg', geometry: { type: 'polygon', cx: 50, cy: 50, r: 52, sides: 4, rotation: 0, cornerRadius: between(ctx.rng, 4, 10) } }, text('ml', 'paper', { size: cap * 0.78 })] }];
        break;
      case 'underline':
        layers = [text('ml', 'ink', { size: cap * 1.1, at: { x: 50, y: 44 } }), { kind: 'shape', id: 'bar', fill: 'accent', geometry: { type: 'rect', x: 22, y: 78, w: 56, h: 8, r: 4 } }];
        break;
      default:
        layers = [{ kind: 'group', id: 'mark', children: [{ kind: 'generator', id: 'bg', generator: 'shield', params: { inner: 'none' } }, text('ml', 'paper', { size: cap * 0.84, at: { x: 50, y: 48 } })] }];
    }
    return baseDoc(ctx, 'lettermark', `lettermark:${container}`, [...layers, ...withNameLayers(ctx)], { composition: composition(ctx) }, `Les initiales « ${letters} » en monogramme (${container}) : un sceau compact, lisible jusqu'à la taille d'un avatar.`);
  },
});

// — letterform —
const ROUND_LETTERS = /[oOQDGCcaebdpq0]/;

recipe({
  id: 'letterform',
  type: 'letterform',
  weight: () => 1,
  build: (ctx) => {
    const word = ctx.brief.brandName.trim();
    // La lettre qui porte l'idée : une lettre ronde si le nom en a (elle se prête aux opérations), sinon l'initiale.
    const roundIndex = [...word].findIndex((c) => ROUND_LETTERS.test(c));
    const index = roundIndex >= 0 && ctx.rng() < 0.7 ? roundIndex : 0;
    const letter = [...word][index] ?? 'B';
    const style = nameStyle(ctx);
    const variant = pick(ctx.rng, ['accentDot', 'cut', 'swap', 'slice', 'notch', 'plain'] as const);
    const text: Doc = { kind: 'text', id: 'lf', role: 'symbol', content: letter, size: 66, at: { x: 50, y: 50 }, font: { role: 'display', weight: Math.max(700, style.weight) }, case: ctx.rng() < 0.5 ? 'lower' : 'upper' };
    let layers: Doc[];
    switch (variant) {
      case 'cut':
        layers = [{ ...text, effects: [{ type: 'cutCorner', index: 0, corner: pick(ctx.rng, ['tr', 'tl', 'br', 'bl']), size: between(ctx.rng, 0.25, 0.45) }] }];
        break;
      case 'swap':
        layers = ROUND_LETTERS.test(letter) && /[oOQ0]/.test(letter) ? [{ ...text, effects: [{ type: 'swapRound', index: 0, with: pick(ctx.rng, ['disc', 'ring']), color: 'accent' }] }] : [{ ...text, effects: [{ type: 'accentChar', index: 0, color: 'accent' }] }];
        break;
      case 'slice':
        layers = [{ ...text, effects: [{ type: 'slice', at: between(ctx.rng, 0.42, 0.58), gap: between(ctx.rng, 0.05, 0.09) }] }];
        break;
      case 'notch':
        layers = [{ kind: 'boolean', id: 'lf', op: 'subtract', operands: [text, { kind: 'shape', id: 'notch', geometry: { type: 'circle', cx: between(ctx.rng, 68, 82), cy: between(ctx.rng, 66, 80), r: between(ctx.rng, 9, 14) } }] }];
        break;
      case 'accentDot':
        layers = [text, { kind: 'shape', id: 'dot', fill: 'accent', geometry: { type: 'circle', cx: 84, cy: 20, r: between(ctx.rng, 6, 9) } }];
        break;
      default:
        layers = [{ ...text, fill: 'ink' }];
    }
    return baseDoc(ctx, 'letterform', `letterform:${variant}`, [...layers, ...withNameLayers(ctx)], { composition: composition(ctx) }, `Une seule lettre, « ${letter} », travaillée (${variant}) : la typographie devient le symbole.`);
  },
});

// — pictorial —
recipe({
  id: 'pictorial',
  type: 'pictorial',
  weight: () => 1,
  build: (ctx) => {
    const spec = chooseGenerator(ctx, ['pictorial']);
    if (!spec) return null;
    return baseDoc(ctx, 'pictorial', `pictorial:${spec.id}`, [generatorLayer(spec, paramsFor(ctx, spec)), ...withNameLayers(ctx)], { composition: composition(ctx) }, `${spec.label} : une image reconnue, simplifiée en aplats, qui dit l'activité d'un coup d'œil.`);
  },
});

// — abstract —
const BASIC_SHAPES = ['ellipse', 'rect', 'polygon'] as const;

recipe({
  id: 'abstract',
  type: 'abstract',
  weight: () => 1,
  build: (ctx) => {
    const variant = pick(ctx.rng, ['generator', 'generator', 'contained', 'repeat', 'sliced'] as const);
    if (variant === 'repeat') {
      const shape = pick(ctx.rng, BASIC_SHAPES);
      const geometry = shape === 'ellipse' ? { type: 'ellipse', cx: 50, cy: 24, rx: between(ctx.rng, 6, 12), ry: between(ctx.rng, 14, 24) } : shape === 'rect' ? { type: 'rect', x: 45, y: 8, w: between(ctx.rng, 8, 14), h: between(ctx.rng, 22, 34), r: 4 } : { type: 'polygon', cx: 50, cy: 22, r: between(ctx.rng, 10, 16), sides: pick(ctx.rng, [3, 4, 6]), rotation: 0, cornerRadius: 2 };
      const layer: Doc = { kind: 'repeat', id: 'sym', mode: 'radial', count: pick(ctx.rng, [5, 6, 8, 10]), radius: 0, merge: ctx.rng() < 0.5, child: { kind: 'shape', id: 'unit', geometry } };
      return baseDoc(ctx, 'abstract', `abstract:repeat-${shape}`, [layer, ...withNameLayers(ctx)], { composition: composition(ctx) }, 'Une forme simple répétée autour d\'un centre : une rosace sans objet, qui évoque le mouvement et le collectif.');
    }
    const spec = chooseGenerator(ctx, ['abstract'], variant === 'contained' || variant === 'sliced' ? { tones: [1, 2] } : {});
    if (!spec) return null;
    const params = paramsFor(ctx, spec);
    let layers: Doc[];
    if (variant === 'contained') {
      layers = [{ kind: 'group', id: 'sym', children: [{ kind: 'shape', id: 'bg', geometry: { type: 'rect', x: 4, y: 4, w: 92, h: 92, r: between(ctx.rng, 10, 30) } }, generatorLayer(spec, params, 'inner', { fill: 'paper', transform: { scale: 0.62 } })] }];
    } else if (variant === 'sliced' && spec.tones === 1) {
      layers = [{ kind: 'boolean', id: 'sym', op: 'subtract', operands: [generatorLayer(spec, params, 'base'), { kind: 'shape', id: 'slash', geometry: { type: 'line', x1: between(ctx.rng, 10, 30), y1: 92, x2: between(ctx.rng, 70, 90), y2: 8, width: between(ctx.rng, 3.5, 6), round: false } }] }];
    } else {
      layers = [generatorLayer(spec, params)];
    }
    return baseDoc(ctx, 'abstract', `abstract:${spec.id}`, [...layers, ...withNameLayers(ctx)], { composition: composition(ctx) }, `${spec.label} : une construction géométrique qui suggère l'esprit de la marque sans l'illustrer.`);
  },
});

// — mascot —
recipe({
  id: 'mascot',
  type: 'mascot',
  weight: (ctx) => (ctx.traits.playful || ctx.traits.young ? 2 : 1),
  build: (ctx) => {
    const spec = chooseGenerator(ctx, ['mascot']);
    if (!spec) return null;
    return baseDoc(ctx, 'mascot', `mascot:${spec.id}`, [generatorLayer(spec, paramsFor(ctx, spec, moodFor(ctx))), ...withNameLayers(ctx, ctx.rng() < 0.3 ? 'dot' : null)], { composition: composition(ctx, { symbolScale: between(ctx.rng, 2.8, 3.6) }) }, `${spec.label} : une mascotte aux aplats nets, yeux et sourire en découpe, lisible à 32 px.`);
  },
});

// — combination —
recipe({
  id: 'combination',
  type: 'combination',
  weight: () => 1,
  build: (ctx) => {
    const spec = chooseGenerator(ctx, ['pictorial', 'abstract']);
    if (!spec) return null;
    const variant = pick(ctx.rng, ['plain', 'plain', 'tile'] as const);
    const params = paramsFor(ctx, spec);
    const symbol: Doc =
      variant === 'tile' && spec.tones === 1
        ? { kind: 'group', id: 'sym', children: [{ kind: 'shape', id: 'bg', geometry: { type: 'superellipse', cx: 50, cy: 50, rx: 47, ry: 47, n: between(ctx.rng, 3, 5) } }, generatorLayer(spec, params, 'inner', { fill: 'paper', transform: { scale: 0.58 } })] }
        : generatorLayer(spec, params);
    const effect = pick(ctx.rng, [null, null, 'dot', 'underline'] as const);
    const layers = [symbol, ...nameLayers(ctx, { effect })];
    return baseDoc(ctx, 'combination', `combination:${spec.id}${variant === 'tile' ? '+tile' : ''}`, layers, { composition: composition(ctx) }, `Un symbole (${spec.label.toLowerCase()}) et le nom, composés d'après la hauteur de capitale : la marque se reconnaît avec ou sans son nom.`);
  },
});

// — emblem —
recipe({
  id: 'emblem',
  type: 'emblem',
  weight: (ctx) => (ctx.brief.brandName.length <= 20 ? 1 : 0.4),
  build: (ctx) => {
    const spec = chooseGenerator(ctx, ['pictorial', 'abstract'], { tones: [1, 2] });
    if (!spec) return null;
    const frame = pick(ctx.rng, ['ring', 'double', 'hexagon', 'squircle'] as const);
    const name = ctx.brief.brandName.trim();
    const curved = name.length <= 20;
    const style = nameStyle(ctx);
    const frameLayers: Doc[] =
      frame === 'ring'
        ? [{ kind: 'shape', id: 'frame', role: 'frame', geometry: { type: 'ring', cx: 50, cy: 50, r: 48, thickness: between(ctx.rng, 3.5, 6) } }]
        : frame === 'double'
          ? [{ kind: 'shape', id: 'frame', role: 'frame', geometry: { type: 'ring', cx: 50, cy: 50, r: 48, thickness: 3 } }, { kind: 'shape', id: 'frame2', role: 'frame', fill: 'ink2', geometry: { type: 'ring', cx: 50, cy: 50, r: 43, thickness: 1.6 } }]
          : frame === 'hexagon'
            ? [{ kind: 'boolean', id: 'frame', role: 'frame', op: 'subtract', operands: [{ kind: 'shape', id: 'outer', geometry: { type: 'polygon', cx: 50, cy: 50, r: 49, sides: 6, rotation: 0, cornerRadius: 4 } }, { kind: 'shape', id: 'inner', geometry: { type: 'polygon', cx: 50, cy: 50, r: 44, sides: 6, rotation: 0, cornerRadius: 3 } }] }]
            : [{ kind: 'boolean', id: 'frame', role: 'frame', op: 'subtract', operands: [{ kind: 'shape', id: 'outer', geometry: { type: 'superellipse', cx: 50, cy: 50, rx: 49, ry: 49, n: 4 } }, { kind: 'shape', id: 'inner', geometry: { type: 'superellipse', cx: 50, cy: 50, rx: 44, ry: 44, n: 4 } }] }];
    const center = generatorLayer(spec, paramsFor(ctx, spec), 'sym', { transform: { scale: curved ? 0.42 : 0.5, y: curved ? 2 : 0 } });
    const arc: Doc[] = curved ? [{ kind: 'text', id: 'arc', role: 'symbol', content: name, case: 'upper', tracking: 0.1, size: 8, at: { x: 50, y: 50 }, curve: { radius: frame === 'hexagon' ? 31 : 32, start: 0, side: 'top' }, font: { role: 'display', weight: Math.max(600, style.weight) } }] : [];
    const tag: Doc[] = curved && ctx.brief.tagline ? [{ kind: 'text', id: 'arc2', role: 'symbol', content: ctx.brief.tagline.slice(0, 22), case: 'upper', tracking: 0.12, size: 5, at: { x: 50, y: 50 }, curve: { radius: 34, start: 0, side: 'bottom' }, font: { role: 'body', weight: 500 }, fill: 'ink2' }] : [];
    const layers = [...frameLayers, ...arc, ...tag, center, ...(curved ? [] : nameLayers(ctx))];
    return baseDoc(ctx, 'emblem', `emblem:${frame}+${spec.id}`, layers, { composition: { layout: curved ? 'symbol-only' : 'stacked', gap: 0.18, symbolScale: 3.6, padding: 0.1, align: 'center' } }, `Un emblème (${frame}) : ${spec.label.toLowerCase()} cerclé du nom de la marque — l'autorité d'un sceau, sur n'importe quel support.`);
  },
});

// — negative-space —
recipe({
  id: 'negative-space',
  type: 'negative-space',
  weight: () => 1,
  build: (ctx) => {
    const variant = pick(ctx.rng, ['letter', 'object', 'object', 'crescent'] as const);
    const container = pick(ctx.rng, ['circle', 'squircle', 'tile'] as const);
    const containerGeo: Doc = container === 'circle' ? { type: 'circle', cx: 50, cy: 50, r: 46 } : container === 'squircle' ? { type: 'superellipse', cx: 50, cy: 50, rx: 46, ry: 46, n: 4 } : { type: 'rect', x: 4, y: 4, w: 92, h: 92, r: between(ctx.rng, 8, 24) };
    const bg: Doc = { kind: 'shape', id: 'bg', geometry: containerGeo };
    let layers: Doc[];
    let label: string;
    if (variant === 'letter') {
      const letter = initialsOf(ctx.brief.brandName, 1);
      layers = [{ kind: 'boolean', id: 'sym', op: 'subtract', operands: [bg, { kind: 'text', id: 'cutl', role: 'symbol', content: letter, case: 'upper', size: between(ctx.rng, 54, 64), at: { x: 50, y: 50 }, font: { role: 'display', weight: 800 } }] }];
      label = `la lettre « ${letter} » découpée dans le ${container}`;
    } else if (variant === 'object') {
      const spec = chooseGenerator(ctx, ['pictorial'], { tones: [1] });
      if (!spec) return null;
      layers = [{ kind: 'boolean', id: 'sym', op: 'subtract', operands: [bg, generatorLayer(spec, paramsFor(ctx, spec), 'cut', { transform: { scale: between(ctx.rng, 0.5, 0.64) } })] }];
      label = `${spec.label.toLowerCase()} creusé dans le ${container}`;
    } else {
      const dx = between(ctx.rng, 14, 24);
      layers = [{ kind: 'boolean', id: 'sym', op: 'subtract', operands: [{ kind: 'shape', id: 'moon', geometry: { type: 'circle', cx: 50, cy: 50, r: 46 } }, { kind: 'shape', id: 'bite', geometry: { type: 'circle', cx: 50 + dx, cy: 50 - dx * 0.6, r: between(ctx.rng, 34, 40) } }] }, ...(ctx.palette.accent ? [{ kind: 'shape', id: 'spark', fill: 'accent', geometry: { type: 'circle', cx: 74, cy: 28, r: between(ctx.rng, 7, 10) } }] : [])];
      label = 'un croissant né de deux cercles, relevé d\'un point d\'accent';
    }
    return baseDoc(ctx, 'negative-space', `negative-space:${variant}`, [...layers, ...withNameLayers(ctx)], { composition: composition(ctx) }, `Espace négatif : ${label}. Le vide dessine la forme ; le logo reste transparent sur tout fond.`);
  },
});

// — minimal —
recipe({
  id: 'minimal',
  type: 'minimal',
  weight: (ctx) => (ctx.traits.calm || ctx.traits.luxury || ctx.traits.tech ? 2 : 1),
  build: (ctx) => {
    const variant = pick(ctx.rng, ['halfDisc', 'bars', 'ringDot', 'slashTile', 'cornerCut'] as const);
    const mono: Doc = { palette: { ...ctx.palette, ink2: ctx.palette.ink } };
    let layers: Doc[];
    switch (variant) {
      case 'halfDisc':
        layers = [{ kind: 'boolean', id: 'sym', op: 'subtract', operands: [{ kind: 'shape', id: 'disc', geometry: { type: 'circle', cx: 50, cy: 50, r: 44 } }, { kind: 'shape', id: 'half', geometry: { type: 'rect', x: 0, y: between(ctx.rng, 44, 56), w: 100, h: 60 } }] }, { kind: 'shape', id: 'dot', fill: 'accent', geometry: { type: 'circle', cx: 50, cy: between(ctx.rng, 66, 76), r: between(ctx.rng, 7, 10) } }];
        break;
      case 'bars': {
        const n = pick(ctx.rng, [2, 3]);
        layers = Array.from({ length: n }, (_, i) => ({ kind: 'shape', id: `bar${i}`, fill: i === n - 1 ? 'accent' : 'ink', geometry: { type: 'rect', x: 10, y: 14 + i * (72 / n), w: 80 - i * between(ctx.rng, 14, 24), h: 72 / n - 8, r: 100 } }));
        break;
      }
      case 'ringDot':
        layers = [{ kind: 'shape', id: 'ring', geometry: { type: 'ring', cx: 50, cy: 50, r: 44, thickness: between(ctx.rng, 9, 13) } }, { kind: 'shape', id: 'dot', fill: 'accent', geometry: { type: 'circle', cx: 50, cy: 50, r: between(ctx.rng, 8, 13) } }];
        break;
      case 'slashTile':
        layers = [{ kind: 'boolean', id: 'sym', op: 'subtract', operands: [{ kind: 'shape', id: 'tile', geometry: { type: 'rect', x: 6, y: 6, w: 88, h: 88, r: between(ctx.rng, 4, 22) } }, { kind: 'shape', id: 'cut', geometry: { type: 'line', x1: 6, y1: 94, x2: 94, y2: 6, width: between(ctx.rng, 5, 9), round: false } }] }];
        break;
      default:
        layers = [{ kind: 'boolean', id: 'sym', op: 'subtract', operands: [{ kind: 'shape', id: 'tile', geometry: { type: 'rect', x: 6, y: 6, w: 88, h: 88, r: 0 } }, { kind: 'shape', id: 'bite', geometry: { type: 'circle', cx: pick(ctx.rng, [6, 94]), cy: pick(ctx.rng, [6, 94]), r: between(ctx.rng, 40, 56) } }] }];
    }
    const nameStyleLight = { ...nameStyle(ctx), weight: pick(ctx.rng, [400, 500, 600]) };
    return baseDoc(ctx, 'minimal', `minimal:${variant}`, [...layers, ...(ctx.withName ? nameLayers(ctx, { style: nameStyleLight }) : [])], { composition: composition(ctx), ...mono }, `Le minimum de formes (${variant}) : une idée, deux couleurs au plus, lisible à 16 px.`);
  },
});

// — dynamic —
const DYNAMIC_KEYS = ['petals', 'count', 'rays', 'teeth', 'layers', 'rows', 'peaks', 'points', 'turns', 'tilt', 'angle', 'phase', 'sweep'];

recipe({
  id: 'dynamic',
  type: 'dynamic',
  weight: (ctx) => (ctx.traits.tech || ctx.traits.young ? 2 : 1),
  build: (ctx) => {
    const spec = chooseGenerator(ctx, ['abstract']);
    if (!spec) return null;
    const key = DYNAMIC_KEYS.find((k) => spec.params[k]?.kind === 'num');
    if (!key) return null;
    const def = spec.params[key];
    if (def.kind !== 'num') return null;
    const params = paramsFor(ctx, spec);
    const base = typeof params[key] === 'number' ? (params[key] as number) : def.def;
    const alt = (factor: number) => Math.min(def.max, Math.max(def.min, def.int ? Math.round(base * factor) : base * factor));
    const lo = alt(0.7);
    const hi = alt(1.35);
    const variants: Doc[] = [
      { id: 'primary', kind: 'primary', background: 'light' },
      { id: 'monochrome', kind: 'monochrome', background: 'light' },
      { id: 'inverted', kind: 'inverted', background: 'dark' },
      { id: 'symbol', kind: 'symbol' },
      { id: 'dyn-calm', kind: 'dynamic', label: 'Version calme', overrides: { sym: { params: { [key]: lo } } } },
      { id: 'dyn-rich', kind: 'dynamic', label: 'Version riche', overrides: { sym: { params: { [key]: hi } } } },
      { id: 'dyn-accent', kind: 'dynamic', label: 'Version accent', overrides: { sym: { fill: 'accent' } } },
    ];
    return baseDoc(ctx, 'dynamic', `dynamic:${spec.id}`, [generatorLayer(spec, params), ...withNameLayers(ctx)], { composition: composition(ctx), variants }, `${spec.label} évolutif : un système de variantes liées (paramètre « ${key} » et accent) qui s'adapte aux campagnes sans changer d'identité.`);
  },
});

// ─── API ────────────────────────────────────────────────────────────────────

export const ALL_RECIPES: readonly Recipe[] = RECIPES;

export const recipesFor = (type: ConceptType): Recipe[] => RECIPES.filter((r) => r.type === type);

/** Le générateur d'un id (pour les contrôles). */
export const generatorById = getGenerator;

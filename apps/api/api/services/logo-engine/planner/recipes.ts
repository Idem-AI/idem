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
import { generatorScore } from './originality';
import type { OriginalityContext } from './originality';

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
  /** Le sens avant le secteur, les clichés bannis, la rareté dans IDEM (`originality.ts`). */
  originality?: OriginalityContext;
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
export function chooseGenerator(ctx: RecipeCtx, families: GeneratorFamily[], opts: { tones?: (1 | 2 | 3)[]; exclude?: string[]; plain?: boolean } = {}): GeneratorSpec | null {
  // Le générateur choisi par le directeur passe avant le filtre de tons : une découpe ou un contenant
  // le rend d'une seule encre de toute façon, et la direction ne doit jamais être remplacée.
  const forced = ctx.force?.generator ? listGenerators().find((g) => g.id === ctx.force!.generator && families.includes(g.family)) : undefined;
  if (forced) return forced;
  // Les générateurs à TRACÉ (lusona…) ont leur propre recette : jamais tirés au hasard pour être creusés ou contenus.
  // `plain` : pour une tuile ou une découpe, ni mosaïque (illisible une fois réduite).
  const pool = listGenerators().filter((g) => families.includes(g.family) && !g.stroked && !(opts.plain && g.style === 'modular') && !(opts.exclude ?? []).includes(g.id) && (!opts.tones || opts.tones.includes(g.tones)));
  if (!pool.length) return null;
  const temperature = 0.4 + ctx.explore * 1.8;
  // Le sens de la marque rapporte, son secteur coûte, un cliché nommé est banni (`originality.ts`).
  // Si tout est banni (catalogue étroit pour cette famille), on garde la règle sans bannissement.
  const o = ctx.originality;
  const base = (g: GeneratorSpec) => (o ? generatorScore(g, o) : affinity(g.tags, ctx.weights) * 2.2);
  const open = o ? pool.filter((g) => !o.cliches.has(g.id)) : pool;
  const field = open.length ? open : pool;
  const scored = field.map((g) => {
    const b = base(g);
    return { g, s: (Number.isFinite(b) ? b : 0) + gumbel(ctx.rng) * temperature - (ctx.used.has(g.id) ? 3 : 0) };
  });
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
    // Espacement optique : les surfaces blanches entre lettres égalisées par le moteur (sauf ligature, qui fond les lettres).
    const optical = !effects.some((e) => e.type === 'ligature');
    return { kind: 'text', id: lines.length > 1 ? `name${i + 1}` : 'name', role: opts.role ?? 'wordmark', content, case: style.case, tracking: style.tracking, ...(optical ? { spacing: 'optical' } : {}), font: { role: 'display', weight: style.weight }, ...(effects.length ? { effects } : {}) };
  });
}

// ─── Base d'un document ─────────────────────────────────────────────────────

/** Le style de construction imposé par le premier générateur qui en déclare un (sona → monoline, facettes → modular). */
function generatorStyle(layers: Doc[]): string | undefined {
  for (const layer of layers) {
    if (layer.kind === 'generator') {
      const style = getGenerator(String(layer.generator))?.style;
      if (style) return style;
    }
    const nested = [...((layer.children as Doc[]) ?? []), ...((layer.operands as Doc[]) ?? []), ...(layer.child ? [layer.child as Doc] : [])];
    const found = nested.length ? generatorStyle(nested) : undefined;
    if (found) return found;
  }
  return undefined;
}

function baseDoc(ctx: RecipeCtx, type: ConceptType, recipe: string, layers: Doc[], extra: Doc = {}, rationale = ''): Doc {
  const style = generatorStyle(layers);
  return {
    brief: {
      brandName: ctx.brief.brandName,
      ...(ctx.brief.tagline ? { tagline: ctx.brief.tagline } : {}),
      industry: ctx.brief.industry ?? '',
      audience: ctx.brief.audience ?? '',
      personality: (ctx.brief.personality ?? []).slice(0, 6),
    },
    concept: { type, rationale, motifs: [], recipe, ...(style ? { style } : {}) },
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
  optical: true,
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
const LETTER_CONTAINERS = ['tile', 'circle', 'squircle', 'ring', 'hexagon', 'diamond', 'underline', 'shield', 'monogram'] as const;

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
    // Le monogramme à fût partagé n'existe qu'à deux lettres.
    const containers = letters.length === 2 ? LETTER_CONTAINERS : LETTER_CONTAINERS.filter((c) => c !== 'monogram');
    const container = (containers as readonly string[]).includes(ctx.force?.variant ?? '') ? (ctx.force!.variant as (typeof LETTER_CONTAINERS)[number]) : pick(ctx.rng, containers);
    const cap = letterCap(letters);
    const text = (id: string, fill: string, extra: Doc = {}): Doc => ({ kind: 'text', id, role: 'symbol', content: letters, fill, size: cap, at: { x: 50, y: 50 }, tracking: letters.length > 1 ? 0.04 : 0, case: 'upper', font: { role: 'display', weight: Math.max(600, style.weight) }, ...extra });
    let layers: Doc[];
    switch (container) {
      case 'monogram':
        // Les deux initiales glissent jusqu'à partager un fût (calculé sur les contours), puis fusionnent ; l'accent souligne.
        layers = [text('ml', 'ink', { size: 46, tracking: 0, effects: [{ type: 'shareStem' }] }), ...(ctx.palette.accent ? [{ kind: 'shape', id: 'bar', fill: 'accent', geometry: { type: 'rect', x: 30, y: 82, w: 40, h: 6, r: 3 } }] : [])];
        break;
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
    const letterCase = ctx.rng() < 0.5 ? 'lower' : 'upper';
    const shown = letterCase === 'upper' ? letter.toUpperCase() : letter.toLowerCase();
    // Une lettre à creux (« a », « B », « o »…) peut porter une forme au centre exact de sa contre-forme.
    const hasCounter = /[ABDOPQRabdegopq0469]/.test(shown);
    const variants = hasCounter ? (['accentDot', 'cut', 'swap', 'slice', 'notch', 'plain', 'counter', 'counter'] as const) : (['accentDot', 'cut', 'swap', 'slice', 'notch', 'plain'] as const);
    const wanted = ctx.force?.variant;
    const variant = wanted && (variants as readonly string[]).includes(wanted) ? (wanted as (typeof variants)[number]) : pick(ctx.rng, variants);
    const text: Doc = { kind: 'text', id: 'lf', role: 'symbol', content: letter, size: 66, at: { x: 50, y: 50 }, font: { role: 'display', weight: Math.max(700, style.weight) }, case: letterCase };
    let layers: Doc[];
    switch (variant) {
      case 'counter':
        layers = [{ ...text, effects: [{ type: 'counterMark', index: 0, shape: pick(ctx.rng, ['circle', 'circle', 'diamond', 'leaf']), scale: between(ctx.rng, 0.5, 0.7), color: 'accent' }] }];
        break;
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
  // Une direction « grammaire de symétrie » (sym-*) n'est pas pour cette recette.
  weight: (ctx) => (ctx.force?.variant?.startsWith('sym-') ? 0 : 1),
  build: (ctx) => {
    // Un générateur imposé par le directeur est toujours dessiné : la répétition de formes simples l'ignorerait.
    // Un tracé ou une mosaïque se pose tel quel : réduit dans une tuile ou tranché, il ne se lit plus.
    const forcedSpec = ctx.force?.generator ? getGenerator(ctx.force.generator) : undefined;
    const forcedStroke = !!forcedSpec && (!!forcedSpec.stroked || forcedSpec.style === 'modular');
    const variant = forcedStroke ? 'generator' : pick(ctx.rng, ctx.force?.generator ? (['generator', 'generator', 'contained', 'sliced'] as const) : (['generator', 'generator', 'contained', 'repeat', 'sliced'] as const));
    if (variant === 'repeat') {
      const shape = pick(ctx.rng, BASIC_SHAPES);
      const geometry = shape === 'ellipse' ? { type: 'ellipse', cx: 50, cy: 24, rx: between(ctx.rng, 6, 12), ry: between(ctx.rng, 14, 24) } : shape === 'rect' ? { type: 'rect', x: 45, y: 8, w: between(ctx.rng, 8, 14), h: between(ctx.rng, 22, 34), r: 4 } : { type: 'polygon', cx: 50, cy: 22, r: between(ctx.rng, 10, 16), sides: pick(ctx.rng, [3, 4, 6]), rotation: 0, cornerRadius: 2 };
      const layer: Doc = { kind: 'repeat', id: 'sym', mode: 'radial', count: pick(ctx.rng, [5, 6, 8, 10]), radius: 0, merge: ctx.rng() < 0.5, child: { kind: 'shape', id: 'unit', geometry } };
      return baseDoc(ctx, 'abstract', `abstract:repeat-${shape}`, [layer, ...withNameLayers(ctx)], { composition: composition(ctx) }, 'Une forme simple répétée autour d\'un centre : une rosace sans objet, qui évoque le mouvement et le collectif.');
    }
    const spec = chooseGenerator(ctx, ['abstract'], variant === 'contained' || variant === 'sliced' ? { tones: [1, 2], plain: true } : {});
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

// — abstract : grammaire des groupes de symétrie —
//
// Un motif fondamental, UN SEUL, dessiné dans la boîte au-dessus du centre ; un groupe de
// symétrie qui le répète (Cn : rotations, Dn : rotations + miroirs) ; une opération au centre.
// La symétrie n'est pas vérifiée après coup : elle est garantie par la construction, et déclarée
// dans le document (`concept.symmetry`) pour que la mesure la confirme.
// Motif × groupe × ordre × rayon × centre × fusion : plusieurs milliers de symboles distincts.
// `segment` : un arc d'anneau interrompu — répété, il dessine un cercle que l'œil ferme (fermeture gestaltiste).
const GROUP_MOTIFS = ['petal', 'leaf', 'hook', 'wedge', 'bar', 'dot', 'chevron', 'segment'] as const;

/** Systèmes de proportions pour les rayons emboîtés : carré (√2), nombre d'or (φ), octave (2). Une option, pas une loi. */
const PROPORTIONS = [Math.SQRT2, (1 + Math.sqrt(5)) / 2, 2] as const;
type GroupMotif = (typeof GROUP_MOTIFS)[number];
/** Les variantes que le directeur peut choisir : `sym-<motif>` (un motif répété par un groupe de symétrie exact). */
export const SYMMETRY_VARIANTS: readonly string[] = GROUP_MOTIFS.map((m) => `sym-${m}`);

/** Le motif placé à `r` au-dessus du centre ; `tilt` (°) le rend asymétrique (il tourne, la rosace « vire »). */
function groupMotif(kind: GroupMotif, r: number, size: number, tilt: number, order = 6): Doc {
  const cy = 50 - r;
  const turn = tilt ? { transform: { rotate: tilt, origin: [50, cy] } } : {};
  switch (kind) {
    case 'segment': {
      // L'arc couvre sa part de cercle moins une coupure ; incliné, la coupure se décale (mouvement).
      const half = 180 / order - Math.max(5, 22 - order * 1.5) / 2;
      return { kind: 'shape', id: 'unit', geometry: { type: 'arc', cx: 50, cy: 50, r: r + size * 0.3, thickness: Math.max(4, size * 0.6), from: -half + (tilt ? tilt / 3 : 0), to: half, round: !!tilt } };
    }
    case 'petal':
      return { kind: 'shape', id: 'unit', geometry: { type: 'ellipse', cx: 50, cy, rx: size * 0.45, ry: size }, ...turn };
    case 'leaf':
      return { kind: 'boolean', id: 'unit', op: 'intersect', operands: [{ kind: 'shape', id: 'la', geometry: { type: 'circle', cx: 50 - size * 0.55, cy, r: size } }, { kind: 'shape', id: 'lb', geometry: { type: 'circle', cx: 50 + size * 0.55, cy, r: size } }], ...turn };
    case 'hook':
      return { kind: 'shape', id: 'unit', geometry: { type: 'arc', cx: 50, cy, r: size * 0.8, thickness: size * 0.45, from: 200, to: 340 + tilt, round: true } };
    case 'wedge':
      return { kind: 'shape', id: 'unit', geometry: { type: 'poly', points: [[50, 50 - r * 0.25], [50 + size * 0.7, cy - size * 0.6], [50 - size * 0.7 * (tilt ? 0.25 : 1), cy - size * 0.6]], cornerRadius: 2 } };
    case 'bar':
      return { kind: 'shape', id: 'unit', geometry: { type: 'rect', x: 50 - size * 0.28, y: cy - size, w: size * 0.56, h: size * 1.9, r: size * 0.28 }, ...turn };
    case 'dot':
      return { kind: 'shape', id: 'unit', geometry: { type: 'circle', cx: 50, cy, r: size * 0.55 } };
    default:
      return { kind: 'shape', id: 'unit', geometry: { type: 'poly', points: [[50 - size, cy + size * 0.5], [50, cy - size * 0.5], [50 + size, cy + size * 0.5], [50 + size * (tilt ? 0.4 : 1), cy + size * 0.95], [50, cy + size * 0.1], [50 - size, cy + size * 0.95]], cornerRadius: 1.5 }, ...turn };
  }
}

recipe({
  id: 'abstract-group',
  type: 'abstract',
  // Un générateur imposé par le directeur n'a pas sa place dans la grammaire : c'est la recette « abstract » qui le dessine.
  weight: (ctx) => (ctx.force?.generator ? 0 : 1),
  build: (ctx) => {
    const wanted = ctx.force?.variant?.replace(/^sym-/, '') ?? '';
    const motif = (GROUP_MOTIFS as readonly string[]).includes(wanted) ? (wanted as GroupMotif) : pick(ctx.rng, GROUP_MOTIFS);
    // Symétrie et stabilité perçue vont ensemble (Wu, PLOS ONE 2025) : marques calmes, luxe → miroirs ; jeunes, tech → rotation.
    const stable = ctx.traits.calm || ctx.traits.luxury || ctx.traits.classic;
    const moving = ctx.traits.young || ctx.traits.playful || ctx.traits.tech;
    const mirrored = stable ? ctx.rng() < 0.75 : moving ? ctx.rng() < 0.3 : ctx.rng() < 0.5;
    const order = pick(ctx.rng, motif === 'dot' ? [6, 8] : motif === 'wedge' || motif === 'chevron' ? [3, 4, 5, 6] : [3, 4, 5, 6, 8]);
    // Le crochet est asymétrique par nature : jamais de groupe diédral pour lui.
    const tilt = mirrored && motif !== 'hook' ? 0 : pick(ctx.rng, [18, 28, 38]);
    // Le motif est assez large pour toucher ses voisins (corde entre deux copies = 2r·sin(π/n)) :
    // la rosace se lit d'un seul tenant, pas comme une icône de chargement éclatée.
    const r = between(ctx.rng, 12, 22);
    const size = Math.max(7, Math.min(18, r * Math.sin(Math.PI / order) * between(ctx.rng, 1.05, 1.5)));
    const center = pick(ctx.rng, motif === 'segment' ? (['none', 'dot', 'orbit'] as const) : (['none', 'none', 'hole', 'dot', 'orbit'] as const));
    const ratio = pick(ctx.rng, PROPORTIONS);
    const unit = groupMotif(motif, r, size, tilt, order);
    // Un motif symétrique répété par rotation donne déjà un groupe diédral ; un motif incliné, un groupe cyclique.
    const group = `${tilt ? 'C' : 'D'}${order}`;
    const ring: Doc = { kind: 'repeat', id: 'ring', mode: 'radial', count: order, radius: 0, merge: true, child: unit };
    let symbol: Doc = ring;
    // Rayons emboîtés en proportion (√2, φ ou 2) : le cœur, l'œil et l'orbite se répondent.
    if (center === 'hole') symbol = { kind: 'boolean', id: 'sym', op: 'subtract', operands: [{ kind: 'group', id: 'body', children: [ring, { kind: 'shape', id: 'core', geometry: { type: 'circle', cx: 50, cy: 50, r: r * 0.9 } }] }, { kind: 'shape', id: 'eye', geometry: { type: 'circle', cx: 50, cy: 50, r: (r * 0.9) / ratio } }] };
    const extra: Doc[] =
      center === 'dot'
        ? [{ kind: 'shape', id: 'heart', fill: ctx.palette.accent ? 'accent' : 'ink', geometry: { type: 'circle', cx: 50, cy: 50, r: Math.max(4, r / (ratio * 1.6)) } }]
        : center === 'orbit'
          ? // Décalées d'un demi-pas : les lunes tombent ENTRE les motifs, la symétrie du groupe est conservée.
            [{ kind: 'repeat', id: 'orbit', mode: 'radial', count: order, radius: 0, merge: false, transform: { rotate: 180 / order, origin: [50, 50] }, child: { kind: 'shape', id: 'moon', fill: ctx.palette.accent ? 'accent' : 'ink', geometry: { type: 'circle', cx: 50, cy: 50 - r / ratio, r: Math.max(2.5, r * 0.14) } } }]
          : [];
    const doc = baseDoc(ctx, 'abstract', `abstract:group-${motif}-${group}`, [symbol, ...extra, ...withNameLayers(ctx)], { composition: composition(ctx) }, `Un seul motif (${motif}) répété selon le groupe ${group} : une symétrie exacte, construite et non dessinée, qui dit ${tilt ? 'le mouvement' : 'la stabilité'}.`);
    (doc.concept as Doc).symmetry = group;
    (doc.concept as Doc).style = 'geometric';
    return doc;
  },
});

// — abstract : sona (courbe-miroir d'un seul trait, géométrie tchokwe) —
recipe({
  id: 'abstract-lusona',
  type: 'abstract',
  // Pour une direction « lusona », ou sans direction ; jamais à la place d'un autre générateur ni d'une variante sym-*.
  weight: (ctx) => (ctx.force?.variant?.startsWith('sym-') ? 0 : ctx.force?.generator ? (ctx.force.generator === 'lusona' ? 1 : 0) : 0.6),
  build: (ctx) => {
    const spec = getGenerator('lusona');
    if (!spec) return null;
    const square = ctx.rng() < 0.5;
    const cols = pick(ctx.rng, [2, 3, 3, 4]);
    const rows = square ? cols : pick(ctx.rng, [2, 3, 4].filter((r) => r !== cols));
    const sym = square && ctx.rng() < 0.5 ? 'c4' : 'd2';
    const params = { cols, rows, sym, density: between(ctx.rng, 0.2, 0.55), thick: between(ctx.rng, 0.2, 0.3), dots: ctx.rng() < 0.7 };
    const doc = baseDoc(ctx, 'abstract', `abstract:lusona-${cols}x${rows}-${sym}`, [generatorLayer(spec, params), ...withNameLayers(ctx)], { composition: composition(ctx) }, `Un sona : une seule ligne qui contourne une grille de ${cols * rows} points et rebondit sur le cadre, comme les dessins sur sable tchokwe — le lien, le récit, la communauté.`);
    (doc.concept as Doc).symmetry = sym === 'c4' ? 'C4' : 'D2';
    (doc.concept as Doc).style = 'monoline';
    return doc;
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
      variant === 'tile' && spec.tones === 1 && !spec.stroked
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
    const symbolScale = curved ? 0.42 : 0.5;
    const center = generatorLayer(spec, paramsFor(ctx, spec), 'sym', { transform: { scale: symbolScale } });
    // Solveur radial : l'anneau libre va du symbole (rayon ≈ 50 × échelle) au bord intérieur du cadre ;
    // le nom y est centré (marges égales) et sa taille couvre un angle qui croît avec sa longueur.
    // Bord intérieur du cadre : anneau r − épaisseur (≤ 6), double 43 − 1,6, hexagone à l'apothème 44·cos 30°, carré arrondi 44.
    const frameInner = frame === 'ring' ? 42 : frame === 'double' ? 41.4 : frame === 'hexagon' ? 44 * Math.cos(Math.PI / 6) : 44;
    const band: [number, number] = [50 * symbolScale + 2, frameInner - 2];
    const sweep = Math.max(90, Math.min(250, 40 + 12 * name.length));
    const arc: Doc[] = curved ? [{ kind: 'text', id: 'arc', role: 'symbol', content: name, case: 'upper', tracking: 0.1, size: 8, at: { x: 50, y: 50 }, curve: { radius: 32, start: 0, side: 'top', sweep, band }, font: { role: 'display', weight: Math.max(600, style.weight) } }] : [];
    const tagline = ctx.brief.tagline?.slice(0, 22) ?? '';
    const tag: Doc[] = curved && tagline ? [{ kind: 'text', id: 'arc2', role: 'symbol', content: tagline, case: 'upper', tracking: 0.12, size: 5, at: { x: 50, y: 50 }, curve: { radius: 34, start: 0, side: 'bottom', sweep: Math.max(60, Math.min(150, 30 + 8 * tagline.length)), band }, font: { role: 'body', weight: 500 }, fill: 'ink2' }] : [];
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
    // Un générateur imposé par le directeur est creusé dans le contenant : ni lettre ni croissant à sa place.
    const variant = ctx.force?.generator ? 'object' : pick(ctx.rng, ['letter', 'object', 'object', 'crescent'] as const);
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

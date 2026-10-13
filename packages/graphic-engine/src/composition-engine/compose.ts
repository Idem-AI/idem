/**
 * Le MOTEUR DE COMPOSITION : proposer, noter, choisir — sans générer un octet de HTML arbitraire.
 *
 *  1. CANDIDATS : chaque motif adapté au contenu, avec plusieurs combinaisons de ses paramètres (le
 *     nombre suit le cran : explorer davantage coûte du calcul, jamais des appels de modèle) ;
 *  2. NOTE : adéquation au contenu, affinité de style, nouveauté (contre les pages précédentes du
 *     document et les documents récents de la marque), réservations du plan, usure d'un motif ;
 *  3. CHOIX : déterministe (Low), tiré parmi les meilleurs (Medium), ou confié à un agent qui choisit
 *     dans un menu (High et au-delà) — avec ce choix-ci en repli.
 *
 * Critère d'arrêt : l'exploration est bornée par le cran (`paramSamples`), et aucun candidat n'est rendu
 * avant le choix (les silhouettes se comparent sur les régions déclarées).
 */
import type { Params, ParamValue } from '../contracts/common';
import type { SectionContent } from '../contracts/content-model';
import type { SectionSpec } from '../contracts/design-spec';
import type { SectionMeta } from '../html-css-compiler/context';
import { LookInput, Look, resolveLook } from '../design-system/look';
import { patternsFor } from '../design-system/patterns/registry';
import type { PatternBuild, PatternDef, Region } from '../design-system/patterns/types';
import type { DesignTokens } from '../design-system/tokens';
import { Rng } from '../foundation/rng';
import { analyzeSection, ContentAnalysis } from './analyze';
import { DiversityMemory, Fingerprint, fingerprintOf } from './diversity';
import type { DocumentPlan, SlotPlan } from './plan';
import { styleAffinity } from './plan';
import type { CreativityPolicy } from './profiles';
import { variantChooser } from './variants';

export interface ComposeContext {
  section: SectionContent;
  analysis: ContentAnalysis;
  plan: DocumentPlan;
  slot: SlotPlan;
  tokens: DesignTokens;
  meta: SectionMeta;
  memory: DiversityMemory;
  policy: CreativityPolicy;
  imageColors?: string[];
}

export interface Candidate {
  pattern: PatternDef;
  params: Params;
  lookInput: LookInput;
  look: Look;
  build: PatternBuild;
  regions: Region[];
  fingerprint: Fingerprint;
  fit: number;
  score: number;
  /** Pourquoi cette note (traces, menus des agents). */
  reasons: string[];
}

export function combos(space: Record<string, ParamValue[]>, rng: Rng, max: number): Params[] {
  let all: Params[] = [{}];
  for (const key of Object.keys(space)) all = all.flatMap((c) => space[key].map((v) => ({ ...c, [key]: v })));
  return all.length <= max ? all : rng.shuffle(all).slice(0, max);
}

/** Le look de la section : celui du plan, que le contenu peut tempérer (pas d'inversion sur une page de données). */
export function lookInputFor(ctx: Pick<ComposeContext, 'plan' | 'slot' | 'analysis' | 'tokens' | 'imageColors'>): LookInput {
  const fixed = ctx.tokens.format.kind === 'fixed';
  const family = ctx.tokens.format.family;
  let strategy = ctx.slot.strategy;
  const calmPage = ctx.analysis.light || ctx.analysis.role === 'opening' || ctx.analysis.role === 'closing';
  if (strategy === 'inverse' && (!fixed || ctx.analysis.dataHeavy || ctx.analysis.specimen || (family !== 'visual' && family !== 'cover' && !calmPage))) {
    strategy = ctx.plan.strategy === 'inverse' ? 'monochrome-accent' : ctx.plan.strategy;
  }
  if (strategy === 'image-extracted' && !ctx.imageColors?.length) strategy = 'monochrome-accent';
  return {
    strategy,
    mood: ctx.plan.mood,
    tension: ctx.slot.tension,
    accent: ctx.slot.accent,
    density: ctx.plan.density,
    allowInverted: fixed && family !== 'card',
    imageColors: ctx.imageColors,
  };
}

export function createComposeContext(input: Omit<ComposeContext, 'analysis'> & { analysis?: ContentAnalysis }): ComposeContext {
  return { ...input, analysis: input.analysis ?? analyzeSection(input.section) };
}

export function buildCandidate(ctx: ComposeContext, pattern: PatternDef, params: Params, lookInput = lookInputFor(ctx)): Candidate {
  const look = resolveLook(ctx.tokens, lookInput);
  const rng = new Rng(`${ctx.plan.seed}:build:${ctx.section.id}:${pattern.id}`);
  const build = pattern.build({
    section: ctx.section,
    analysis: ctx.analysis,
    tokens: ctx.tokens,
    look,
    format: ctx.tokens.format,
    params,
    meta: ctx.meta,
    rng,
    variant: variantChooser(ctx.plan.seed, ctx.section.id, look, ctx.tokens),
  });
  const regions = pattern.regions(params, ctx.analysis);
  return { pattern, params, lookInput, look, build, regions, fingerprint: fingerprintOf(pattern.id, params, lookInput, regions), fit: pattern.fit(ctx.analysis, ctx.tokens.format), score: 0, reasons: [] };
}

export function generateCandidates(ctx: ComposeContext): Candidate[] {
  const patterns = patternsFor(ctx.tokens.format.family, ctx.section.role);
  const scored = patterns.map((p) => ({ p, fit: p.fit(ctx.analysis, ctx.tokens.format) }));
  let eligible = scored.filter((x) => x.fit >= ctx.policy.minFit);
  // Rien d'adapté : on garde les trois moins inadaptés plutôt que de ne rien rendre.
  if (!eligible.length) eligible = scored.sort((a, b) => b.fit - a.fit).slice(0, 3);
  const lookInput = lookInputFor(ctx);
  const out: Candidate[] = [];
  for (const { p } of eligible) {
    const rng = new Rng(`${ctx.plan.seed}:params:${ctx.section.id}:${p.id}`);
    for (const params of combos(p.params, rng, ctx.policy.paramSamples)) out.push(buildCandidate(ctx, p, params, lookInput));
  }
  return out;
}

/** La note de chaque candidat, du meilleur au moins bon. */
export function rank(candidates: Candidate[], ctx: ComposeContext): Candidate[] {
  for (const c of candidates) {
    const rng = new Rng(`${ctx.plan.seed}:noise:${ctx.section.id}:${c.pattern.id}:${JSON.stringify(c.params)}`);
    const affinity = styleAffinity(c.pattern.tags, ctx.plan.styleId);
    const near = ctx.memory.nearestInDocument(c.fingerprint);
    const recent = ctx.memory.nearestRecent(c.fingerprint);
    const preferRank = ctx.slot.prefer.indexOf(c.pattern.id);
    const slot = preferRank === 0 ? 0.9 : preferRank > 0 ? 0.45 : 0;
    const avoided = ctx.slot.avoid.includes(c.pattern.id) ? -0.9 : 0;
    // Deux pages voisines n'ont jamais la même composition tant qu'une autre convient : la pénalité est
    // relative (si un seul motif convient, tous les candidats la portent et le classement ne change pas).
    const adjacent = ctx.memory.neighbors(ctx.slot.index).includes(c.pattern.id) ? -2.4 : 0;
    const wear = -0.85 * ctx.memory.uses(c.pattern.id);
    const noise = ctx.policy.noise * rng.float(-1, 1);
    // L'intention de la page (montrer par l'image, le schéma, la capture…) pèse plus que la réservation du
    // plan et l'affinité de style : c'est ce que la page doit FAIRE. Autant que l'interdit de la page voisine
    // (deux pages d'illustration se suivent sur deux motifs qui l'illustrent), jamais une exclusion — un
    // motif sans la matière voulue (pas d'image) est déjà écarté par son adéquation.
    const strategy = ctx.analysis.intent?.visualStrategy;
    const serves = strategy && strategy !== 'free-composition' && c.pattern.strategies?.includes(strategy) ? 2.4 : 0;
    c.score = 2 * c.fit + 0.8 * affinity + 1.4 * (1 - near) + 0.5 * (1 - recent) + slot + avoided + adjacent + wear + noise + serves;
    c.reasons = [`adéquation ${c.fit.toFixed(2)}`, `style ${affinity.toFixed(2)}`, `ressemblance ${near.toFixed(2)}`, ...(serves ? [`sert la stratégie ${strategy}`] : []), ...(slot ? ['réservé'] : []), ...(avoided ? ['réservé par une voisine'] : []), ...(adjacent ? ['déjà sur la page voisine'] : [])];
  }
  return candidates.sort((a, b) => b.score - a.score);
}

/**
 * Le choix du code : le meilleur (Low), ou un tirage pondéré parmi les trois meilleurs MOTIFS DISTINCTS
 * (Medium et repli). Tirer parmi les trois meilleurs candidats donnait l'avantage au motif qui a le plus de
 * combinaisons de paramètres : il occupait le podium à lui seul et revenait d'une page à l'autre.
 */
export function choose(ranked: Candidate[], ctx: ComposeContext): Candidate {
  if (ctx.policy.noise === 0 || ranked.length === 1) return ranked[0];
  // Quand le premier sert l'intention de la page, le tirage se fait entre motifs qui la servent : la variété
  // reste (deux motifs d'illustration), mais le hasard ne rend jamais une page de texte à la place d'une image.
  const strategy = ctx.analysis.intent?.visualStrategy;
  const serving = (c: Candidate) => Boolean(strategy && c.pattern.strategies?.includes(strategy));
  const pool = serving(ranked[0]) ? ranked.filter(serving) : ranked;
  const top = menu(pool, 3);
  const rng = new Rng(`${ctx.plan.seed}:choose:${ctx.section.id}`);
  return rng.weighted(top.map((c, i) => ({ value: c, weight: Math.exp(c.score - top[0].score) * (i === 0 ? 1.4 : 1) })));
}

/** Le menu montré à un agent : des compositions DISTINCTES (un motif n'y figure qu'une fois). */
export function menu(ranked: Candidate[], size: number): Candidate[] {
  const seen = new Set<string>();
  const out: Candidate[] = [];
  for (const c of ranked) {
    if (seen.has(c.pattern.id)) continue;
    seen.add(c.pattern.id);
    out.push(c);
    if (out.length >= size) break;
  }
  return out;
}

export function specOf(c: Candidate, sectionId: string): SectionSpec {
  return {
    ref: sectionId,
    pattern: { id: c.pattern.id, params: c.params },
    density: c.lookInput.density,
    strategy: c.lookInput.strategy,
    mood: c.lookInput.mood,
    tension: c.lookInput.tension,
    accent: c.lookInput.accent,
    ...(c.build.ground ? { ground: c.build.ground } : {}),
    root: c.build.root,
    ...(c.build.decor?.length ? { decor: c.build.decor } : {}),
  };
}

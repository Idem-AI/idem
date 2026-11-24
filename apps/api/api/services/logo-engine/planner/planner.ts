/**
 * LE PLANIFICATEUR — de la créativité par RECHERCHE, sans un seul token.
 *
 * Pour un brief, il explore l'espace « catégorie × recette × générateur × paramètres × graine »,
 * construit un lot de candidats, les passe tous au pipeline qualité (construction, mesures,
 * corrections ciblées), puis retient les propositions les plus DISTINCTES entre elles et de ce
 * qui a déjà été montré au projet (mémoire d'empreintes), sans jamais sacrifier la qualité
 * mesurée.
 *
 * Même logique que les vidéos : on ne cherche pas la distance maximale, on répare jusqu'au seuil
 * (`LOGO_SIMILARITY`) ; le curseur d'exploration (le cran de la jauge) élargit le tirage.
 * C'est aussi le repli sans modèle de l'agent : si l'IA est indisponible, ce que le planificateur
 * propose est déjà un logo exploitable.
 */
import type { ConceptType, LogoPalette } from '../ir/logo.schema';
import { produceLogo } from '../pipeline';
import type { ProducedLogo } from '../pipeline';
import type { BrandFonts } from '../render/scene';
import type { BuildOptions } from '../render/build';
import { seeded } from '../render/generators';
import { diversityCell, fingerprintDistance, LOGO_SIMILARITY, nearest } from '../validate/fingerprint';
import { rankScore } from '../validate/perception';
import { refineLogo } from './optimize';
import type { LogoFingerprint } from '../validate/fingerprint';
import { briefWeights, CharterPalette, conceptMenu, inkPalette, LogoKind, PlanBrief, traitsOf } from './brief';
import { recipesFor, RecipeCtx } from './recipes';
import type { Recipe } from './recipes';
import { literalGenerators, originalityOf } from './originality';
import type { OriginalityContext } from './originality';
import type { Doc } from './recipes';

export interface PlanInput {
  brief: PlanBrief;
  palette: CharterPalette | LogoPalette;
  fonts: BrandFonts;
  /** Préférence IDEM (icône / nom / initiales) ou catégorie précise. */
  kind?: LogoKind | ConceptType;
  /** Le nom accompagne-t-il le symbole ? Par défaut : oui pour « icon », non pour « initial ». */
  withName?: boolean;
  /** Graine du projet : même graine ⇒ mêmes propositions. */
  seed: string;
  count?: number;
  /** 0..1 : largeur du tirage (cran de créativité). */
  explore?: number;
  /** Empreintes déjà montrées au projet (à éviter). */
  avoid?: LogoFingerprint[];
  /** Types de concept à écarter (déjà proposés). */
  exclude?: ConceptType[];
  /** Générateurs bannis pour cette marque (clichés nommés par le directeur) ; absent : estimés par le code. */
  cliches?: string[];
  /** Fréquence récente des générateurs dans tout IDEM (rareté). */
  usage?: Record<string, number>;
  /** Empreintes des logos récemment proposés aux AUTRES projets : un candidat trop proche est écarté. */
  crowd?: LogoFingerprint[];
  /** Essais d'affinage par candidat retenu (0 : aucun affinage). */
  refine?: number;
}

export interface PlannedLogo extends ProducedLogo {
  recipe: string;
  type: ConceptType;
  /** Distance au plus proche des autres propositions retenues et de la mémoire (1 = rien de commun). */
  novelty: number;
}

export interface PlanResult {
  logos: PlannedLogo[];
  /** Candidats construits, acceptés et écartés (pour la trace). */
  stats: { attempted: number; built: number; accepted: number; ms: number };
}

export function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

const isCharter = (p: CharterPalette | LogoPalette): p is CharterPalette => !('ink' in p);

/** Le contexte d'originalité d'un plan : clichés du directeur, sinon ceux que le secteur désigne. */
export function originalityFor(input: PlanInput): OriginalityContext {
  return originalityOf(input.brief, { cliches: input.cliches ?? literalGenerators(input.brief), usage: input.usage });
}

function weightedType(menu: Partial<Record<ConceptType, number>>, picked: ConceptType[], rng: () => number): ConceptType | null {
  const entries = Object.entries(menu).map(([type, w]) => [type as ConceptType, (w ?? 0) / (1 + 1.8 * picked.filter((t) => t === type).length)] as const).filter(([, w]) => w > 0);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  if (!total) return null;
  let r = rng() * total;
  for (const [type, w] of entries) {
    r -= w;
    if (r <= 0) return type;
  }
  return entries[entries.length - 1][0];
}

/** Tirage d'une recette proportionnel à son poids (0 : exclue pour ce brief ou cette direction). */
function pickRecipe(recipes: Recipe[], ctx: RecipeCtx): Recipe | null {
  const weighted = recipes.map((r) => ({ r, w: Math.max(0, r.weight(ctx)) })).filter((x) => x.w > 0);
  const total = weighted.reduce((s, x) => s + x.w, 0);
  if (!total) return null;
  let roll = ctx.rng() * total;
  for (const x of weighted) {
    roll -= x.w;
    if (roll <= 0) return x.r;
  }
  return weighted[weighted.length - 1].r;
}

/** Génère un lot de documents candidats (sans les construire). */
export function candidateDocs(input: PlanInput, attempts: number): { doc: Doc; type: ConceptType; recipe: string }[] {
  const palette: LogoPalette = isCharter(input.palette) ? inkPalette(input.palette) : input.palette;
  const traits = traitsOf(input.brief);
  const weights = briefWeights(input.brief);
  const kind = input.kind;
  const withName = input.withName ?? kind !== 'initial';
  let menu = conceptMenu(kind, traits, input.brief.brandName.length);
  for (const type of input.exclude ?? []) if (Object.keys(menu).length > 1) delete menu[type];
  if (!Object.keys(menu).length) menu = conceptMenu(kind, traits, input.brief.brandName.length);
  const used = new Set<string>();
  const picked: ConceptType[] = [];
  const originality = originalityFor(input);
  const out: { doc: Doc; type: ConceptType; recipe: string }[] = [];
  for (let attempt = 0; attempt < attempts; attempt++) {
    const rng = seeded(hashSeed(`${input.seed}#${attempt}`));
    const type = weightedType(menu, picked, rng);
    if (!type) break;
    const ctx: RecipeCtx = { brief: input.brief, palette, rng, weights, traits, withName, explore: input.explore ?? 0.4, used, originality };
    const recipe = pickRecipe(recipesFor(type), ctx);
    if (!recipe) continue;
    const doc = recipe.build(ctx);
    if (!doc) continue;
    picked.push(type);
    const first = (doc.layers as Doc[] | undefined)?.find((l) => l.kind === 'generator');
    if (first && typeof first.generator === 'string') used.add(first.generator);
    out.push({ doc, type, recipe: String((doc.concept as Doc).recipe ?? recipe.id) });
  }
  return out;
}

/** Construit le lot de candidats et garde ceux que le pipeline qualité accepte. */
export async function buildPool(input: PlanInput, build: BuildOptions, attempts?: number): Promise<{ pool: PlannedLogo[]; attempted: number; built: number; accepted: number }> {
  const candidates = candidateDocs(input, attempts ?? Math.min(24, (input.count ?? 3) * 5 + 2));
  const built: PlannedLogo[] = [];
  // Séquentiel : le noyau géométrique est synchrone, la concurrence n'y gagnerait rien.
  for (const candidate of candidates) {
    const result = await produceLogo(candidate.doc, build, { skipVariants: true });
    if (!result.ok || !result.logo || !result.logo.fingerprint) continue;
    built.push({ ...result.logo, recipe: candidate.recipe, type: candidate.type, novelty: 1 });
  }
  // Les meilleurs candidats sont affinés (réglages cherchés par la mesure, plus tirés au sort).
  const refineBudget = input.refine ?? REFINE.budget;
  if (refineBudget > 0) {
    const order = built.map((l, i) => ({ i, r: rankScore(l.report) })).sort((a, b) => b.r - a.r).slice(0, REFINE.top);
    for (const { i } of order) {
      const refined = await refineLogo(built[i], build, refineBudget);
      if (refined.logo !== built[i]) built[i] = { ...built[i], ...refined.logo };
    }
  }
  const accepted = built.filter((l) => l.report.accepted);
  return { pool: accepted.length >= (input.count ?? 3) ? accepted : built.filter((l) => l.report.ok), attempted: candidates.length, built: built.length, accepted: accepted.length };
}

/** L'affinage : combien de candidats (les mieux classés), combien d'essais chacun. */
export const REFINE = { top: 6, budget: 8 } as const;

/** Retient `count` propositions : la meilleure, puis les plus éloignées des précédentes et de la mémoire. */
/**
 * Le front de Pareto du lot sur trois objectifs — exploitabilité, perception, originalité (distance
 * aux logos des autres projets) : les candidats qu'aucun autre ne bat sur les trois à la fois.
 * Un score unique écraserait l'originalité sous la simplicité ; le front garde les compromis.
 */
export function paretoFront(pool: PlannedLogo[], crowd: LogoFingerprint[] = []): Set<PlannedLogo> {
  const objectives = pool.map((p) => [p.report.score, p.report.aesthetic ?? 0, crowd.length ? nearest(p.fingerprint!, crowd) : 1]);
  const front = new Set<PlannedLogo>();
  pool.forEach((p, i) => {
    const dominated = objectives.some((o, j) => j !== i && o.every((v, k) => v >= objectives[i][k]) && o.some((v, k) => v > objectives[i][k]));
    if (!dominated) front.add(p);
  });
  return front;
}

export function selectDistinct(pool: PlannedLogo[], count: number, avoid: LogoFingerprint[] = [], crowd: LogoFingerprint[] = []): PlannedLogo[] {
  const chosen: PlannedLogo[] = [];
  const front = paretoFront(pool, crowd);
  const remaining = [...pool].sort((a, b) => rankScore(b.report) - rankScore(a.report));
  while (chosen.length < count && remaining.length) {
    let bestIndex = 0;
    let bestValue = -Infinity;
    remaining.forEach((cand, i) => {
      const against = [...avoid, ...chosen.map((c) => c.fingerprint!)];
      const dist = nearest(cand.fingerprint!, against);
      const sameType = chosen.some((c) => c.type === cand.type) ? 8 : 0;
      const tooClose = dist < LOGO_SIMILARITY.tooClose ? 40 : 0;
      // Déjà proposé à un autre projet d'IDEM (même silhouette, mêmes motifs) : un logo n'est pas original s'il est celui d'un autre.
      const crowded = crowd.length && nearest(cand.fingerprint!, crowd) < LOGO_SIMILARITY.tooClose ? 30 : 0;
      // MAP-Elites : une case de diversité (structure × symétrie × rondeur) déjà occupée coûte — trois propositions, trois silhouettes.
      const cell = diversityCell(cand.fingerprint!);
      const sameCell = cell && chosen.some((c) => diversityCell(c.fingerprint!) === cell) ? 10 : 0;
      const pareto = front.has(cand) ? 6 : 0;
      const value = Math.min(dist, LOGO_SIMILARITY.distinct) * 120 + rankScore(cand.report) * 0.5 + pareto - sameType - tooClose - crowded - sameCell;
      if (value > bestValue) {
        bestValue = value;
        bestIndex = i;
      }
    });
    const [cand] = remaining.splice(bestIndex, 1);
    cand.novelty = Math.round(nearest(cand.fingerprint!, [...avoid, ...chosen.map((c) => c.fingerprint!)]) * 100) / 100;
    chosen.push(cand);
  }
  return chosen;
}

export async function planLogos(input: PlanInput, build: BuildOptions): Promise<PlanResult> {
  const started = Date.now();
  const { pool, attempted, built, accepted } = await buildPool(input, build);
  const logos = selectDistinct(pool, input.count ?? 3, input.avoid, input.crowd);
  return { logos, stats: { attempted, built, accepted, ms: Date.now() - started } };
}

type DirectionSpec = { type: ConceptType; generator?: string; variant?: string };

/**
 * Un document pour une direction imposée (type + générateur / variante) : le planificateur le
 * construit, l'agent le choisit. Seules les recettes qui ACCEPTENT la direction sont tirées (poids
 * > 0) : un générateur choisi par le directeur n'est jamais remplacé par une autre construction.
 */
export function docForDirection(input: PlanInput, direction: DirectionSpec, salt: string): { doc: Doc; recipe: string } | null {
  const palette: LogoPalette = isCharter(input.palette) ? inkPalette(input.palette) : input.palette;
  const traits = traitsOf(input.brief);
  const rng = seeded(hashSeed(`${input.seed}#dir#${salt}`));
  const ctx: RecipeCtx = { brief: input.brief, palette, rng, weights: briefWeights(input.brief), traits, withName: input.withName ?? input.kind !== 'initial', explore: input.explore ?? 0.4, used: new Set(), force: { generator: direction.generator, variant: direction.variant }, originality: originalityFor(input) };
  const recipe = pickRecipe(recipesFor(direction.type), ctx);
  if (!recipe) return null;
  const doc = recipe.build(ctx);
  return doc ? { doc, recipe: String((doc.concept as Doc).recipe ?? recipe.id) } : null;
}

/** Combien de constructions on essaie pour UNE direction, et combien on affine. */
export const DIRECTION_SEARCH = { tries: 6, refine: 2 } as const;

/**
 * La recherche DANS une direction : l'IA a choisi le sens (catégorie, motif, idée), le code
 * cherche la meilleure forme de ce sens — plusieurs constructions (paramètres, conteneurs,
 * effets, mises en page), mesurées par le profil du type, les deux meilleures affinées. Aucun
 * jeton : c'est ce qui fait qu'une direction de 30 jetons donne un logo soigné.
 */
export async function searchDirection(input: PlanInput, direction: DirectionSpec, salt: string, build: BuildOptions, tries: number = DIRECTION_SEARCH.tries): Promise<PlannedLogo | null> {
  const made: PlannedLogo[] = [];
  for (let k = 0; k < tries; k++) {
    const planned = docForDirection(input, direction, `${salt}.${k}`);
    if (!planned) continue;
    const result = await produceLogo(planned.doc, build, { skipVariants: true });
    if (result.ok && result.logo?.fingerprint) made.push({ ...result.logo, type: direction.type, recipe: planned.recipe, novelty: 1 });
  }
  if (!made.length) return null;
  made.sort((a, b) => rankScore(b.report) - rankScore(a.report));
  const budget = input.refine ?? REFINE.budget;
  for (let k = 0; k < Math.min(DIRECTION_SEARCH.refine, made.length) && budget > 0; k++) {
    const refined = await refineLogo(made[k], build, budget);
    if (refined.logo !== made[k]) made[k] = { ...made[k], ...refined.logo };
  }
  made.sort((a, b) => rankScore(b.report) - rankScore(a.report));
  return made[0];
}

export { fingerprintDistance };

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
import { fingerprintDistance, LOGO_SIMILARITY, nearest } from '../validate/fingerprint';
import type { LogoFingerprint } from '../validate/fingerprint';
import { briefWeights, CharterPalette, conceptMenu, inkPalette, LogoKind, PlanBrief, traitsOf } from './brief';
import { recipesFor, RecipeCtx } from './recipes';
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
  const out: { doc: Doc; type: ConceptType; recipe: string }[] = [];
  for (let attempt = 0; attempt < attempts; attempt++) {
    const rng = seeded(hashSeed(`${input.seed}#${attempt}`));
    const type = weightedType(menu, picked, rng);
    if (!type) break;
    const recipes = recipesFor(type);
    const recipe = recipes[Math.floor(rng() * recipes.length)];
    if (!recipe) continue;
    const ctx: RecipeCtx = { brief: input.brief, palette, rng, weights, traits, withName, explore: input.explore ?? 0.4, used };
    if (recipe.weight(ctx) <= 0) continue;
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
  const accepted = built.filter((l) => l.report.accepted);
  return { pool: accepted.length >= (input.count ?? 3) ? accepted : built.filter((l) => l.report.ok), attempted: candidates.length, built: built.length, accepted: accepted.length };
}

/** Retient `count` propositions : la meilleure, puis les plus éloignées des précédentes et de la mémoire. */
export function selectDistinct(pool: PlannedLogo[], count: number, avoid: LogoFingerprint[] = []): PlannedLogo[] {
  const chosen: PlannedLogo[] = [];
  const remaining = [...pool].sort((a, b) => b.report.score - a.report.score);
  while (chosen.length < count && remaining.length) {
    let bestIndex = 0;
    let bestValue = -Infinity;
    remaining.forEach((cand, i) => {
      const against = [...avoid, ...chosen.map((c) => c.fingerprint!)];
      const dist = nearest(cand.fingerprint!, against);
      const sameType = chosen.some((c) => c.type === cand.type) ? 8 : 0;
      const tooClose = dist < LOGO_SIMILARITY.tooClose ? 40 : 0;
      const value = Math.min(dist, LOGO_SIMILARITY.distinct) * 120 + cand.report.score * 0.5 - sameType - tooClose;
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
  const logos = selectDistinct(pool, input.count ?? 3, input.avoid);
  return { logos, stats: { attempted, built, accepted, ms: Date.now() - started } };
}

/** Un document pour une direction imposée (type + générateur / variante) : le planificateur le construit, l'agent le choisit. */
export function docForDirection(input: PlanInput, direction: { type: ConceptType; generator?: string; variant?: string }, salt: string): { doc: Doc; recipe: string } | null {
  const palette: LogoPalette = isCharter(input.palette) ? inkPalette(input.palette) : input.palette;
  const traits = traitsOf(input.brief);
  const recipes = recipesFor(direction.type);
  const rng = seeded(hashSeed(`${input.seed}#dir#${salt}`));
  const recipe = recipes[Math.floor(rng() * recipes.length)];
  if (!recipe) return null;
  const ctx: RecipeCtx = { brief: input.brief, palette, rng, weights: briefWeights(input.brief), traits, withName: input.withName ?? input.kind !== 'initial', explore: input.explore ?? 0.4, used: new Set(), force: { generator: direction.generator, variant: direction.variant } };
  const doc = recipe.build(ctx);
  return doc ? { doc, recipe: String((doc.concept as Doc).recipe ?? recipe.id) } : null;
}

export { fingerprintDistance };

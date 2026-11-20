/**
 * L'ORIGINALITÉ — ce qui empêche le moteur de dessiner deux cuillères pour un restaurant.
 *
 * Un logo cliché montre ce que la marque VEND (une tasse pour un café, un toit pour l'immobilier,
 * une croix pour une clinique). Un logo original montre ce qu'elle PORTE : son nom, ses valeurs,
 * son histoire, son lieu. Le moteur applique cette règle de métier à trois niveaux :
 *
 *   1. LE SENS AVANT LE SECTEUR (code, sans token). Les mots du brief sont séparés en deux :
 *      le secteur (`literal`) et le sens (`meaning` : nom, personnalité, valeurs, accroche, public,
 *      description privée des mots du secteur). Un générateur gagne des points par le sens et en
 *      PERD par le secteur : la représentation littérale du métier devient l'exception.
 *
 *   2. LES CLICHÉS NOMMÉS PAR LE DIRECTEUR (une ligne de plus dans l'appel des directions, aucun
 *      appel supplémentaire). L'agent dit lui-même quelles images tout designer dessinerait
 *      d'abord pour CETTE marque (identifiants du catalogue + mots libres). Le code bannit ces
 *      générateurs partout : directions, brouillons du planificateur, brouillons de l'IA, patchs
 *      du critique. Les mots libres sont donnés aux auteurs (« ne jamais dessiner ») et au critique.
 *      Sans directeur (modèle muet), le code estime les clichés par le secteur (`literalGenerators`).
 *
 *   3. LA RARETÉ À L'ÉCHELLE D'IDEM (mémoire de l'hôte). Les générateurs montrés le plus souvent
 *      à TOUS les projets sont pénalisés (logarithme de leur fréquence), et un candidat trop proche
 *      d'un logo récemment proposé à un autre projet (`crowd`, empreintes) est écarté en sélection.
 *
 * Rien ici n'interprète la demande du client : la compréhension est faite par l'agent (point 2) ;
 * le code n'applique que des faits (identifiants bannis, fréquences, distances d'empreintes).
 */
import type { GeneratorFamily, GeneratorSpec } from '../render/generators';
import { listGenerators } from '../render/generators';
import { affinity, keywords } from './brief';
import type { PlanBrief } from './brief';

export interface OriginalityContext {
  /** Mots du secteur : ce que la marque vend. */
  literal: Map<string, number>;
  /** Mots du sens : ce que la marque porte. */
  meaning: Map<string, number>;
  /** Générateurs bannis pour cette marque (clichés nommés par le directeur, ou estimés par le code). */
  cliches: Set<string>;
  /** Fréquence d'apparition récente des générateurs dans tout IDEM. */
  usage: Record<string, number>;
}

/** Combien un mot du secteur retire à un générateur (le sens rapporte 2,2 par mot pondéré). */
export const LITERAL_PENALTY = 1.6;
/** Plafond de la pénalité de fréquence (en points de score). */
export const RARITY_CAP = 3;

export function originalityOf(brief: PlanBrief, opts: { cliches?: Iterable<string>; usage?: Record<string, number> } = {}): OriginalityContext {
  const literal = new Map<string, number>();
  for (const w of keywords([brief.industry])) literal.set(w, 1);
  const meaning = new Map<string, number>();
  const add = (words: string[], weight: number) => {
    for (const w of words) if (!literal.has(w)) meaning.set(w, Math.max(meaning.get(w) ?? 0, weight));
  };
  add(keywords([brief.description, brief.audience]), 0.8);
  add(keywords([brief.tagline]), 1);
  add(keywords([...(brief.personality ?? []), ...(brief.values ?? [])]), 1.3);
  add(keywords([brief.brandName]), 1.5);
  return { literal, meaning, cliches: new Set(opts.cliches ?? []), usage: opts.usage ?? {} };
}

/** Pénalité de fréquence : 0 pour un générateur rare, jusqu'à `RARITY_CAP` pour le plus montré. */
export function rarityPenalty(id: string, usage: Record<string, number>): number {
  const counts = Object.values(usage);
  if (!counts.length) return 0;
  const mean = counts.reduce((a, b) => a + b, 0) / Math.max(1, listGenerators().length);
  const count = usage[id] ?? 0;
  if (!mean || count <= mean) return 0;
  return Math.min(RARITY_CAP, Math.log2(count / mean) * 1.2);
}

/** Score d'originalité d'un générateur (sans le bruit du tirage). `-Infinity` : banni. */
export function generatorScore(spec: GeneratorSpec, o: OriginalityContext): number {
  if (o.cliches.has(spec.id)) return -Infinity;
  return affinity(spec.tags, o.meaning) * 2.2 - affinity(spec.tags, o.literal) * LITERAL_PENALTY - rarityPenalty(spec.id, o.usage);
}

/**
 * L'estimation des clichés par le code, quand aucun directeur n'a parlé : les générateurs dont les
 * étiquettes reprennent le plus de mots du secteur (deux au moins, ou le plus littéral s'il n'y en
 * a qu'un) — la tasse et le grain pour un café, la croix et la gélule pour une pharmacie.
 */
export function literalGenerators(brief: PlanBrief, families?: GeneratorFamily[], max = 4): string[] {
  const literal = originalityOf(brief).literal;
  if (!literal.size) return [];
  const scored = listGenerators()
    .filter((g) => !families || families.includes(g.family))
    .map((g) => ({ id: g.id, s: affinity(g.tags, literal) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.id.localeCompare(b.id));
  if (!scored.length) return [];
  const top = scored[0].s;
  return scored.filter((x) => x.s >= Math.max(1, top >= 2 ? 2 : top)).slice(0, max).map((x) => x.id);
}

/** Le catalogue, ordonné du plus original au plus littéral pour cette marque (menu du directeur). */
export function originalCatalog(o: OriginalityContext, family: GeneratorFamily): GeneratorSpec[] {
  return listGenerators(family)
    .map((g) => ({ g, s: generatorScore(g, o) }))
    .filter((x) => Number.isFinite(x.s))
    .sort((a, b) => b.s - a.s || a.g.id.localeCompare(b.g.id))
    .map((x) => x.g);
}

/** Les identifiants de générateurs cités dans un texte libre (ligne `cliches:` du directeur). */
export function catalogIdsIn(text: string): string[] {
  const ids = new Set(listGenerators().map((g) => g.id.toLowerCase()));
  return [...new Set((text.toLowerCase().match(/[a-z][a-z0-9-]*/g) ?? []).filter((w) => ids.has(w)))].map((w) => listGenerators().find((g) => g.id.toLowerCase() === w)!.id);
}

/** Les générateurs qu'un document utilise (pour refuser un brouillon qui dessine un cliché). */
export function generatorsOf(layers: unknown): string[] {
  const out: string[] = [];
  const walk = (list: unknown) => {
    if (!Array.isArray(list)) return;
    for (const l of list as Record<string, unknown>[]) {
      if (!l || typeof l !== 'object') continue;
      if (l.kind === 'generator' && typeof l.generator === 'string') out.push(l.generator);
      walk(l.operands);
      walk(l.children);
      if (l.child) walk([l.child]);
    }
  };
  walk(layers);
  return out;
}

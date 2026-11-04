/**
 * LE SCORE D'UNE VARIANTE — une somme pondérée TRANSPARENTE de mesures, pour garder la meilleure de plusieurs
 * variantes d'une même page ou d'une même scène.
 *
 * Les poids sont ici, lisibles, et réglables par `IDEM_QUALITY_WEIGHTS` (JSON partiel). Aucune mesure ne dit si une
 * page est « belle » : elles disent ce qui ne va pas (défauts, foyers multiples, hiérarchie plate, répétition).
 */

/** Ce que le navigateur mesure sur une page rendue (moteur graphique, `runtime/check.ts`). */
export interface PageMetrics {
  /** Nombre de tailles de texte distinctes. */
  sizes: number;
  /** Plus grand corps / corps médian : la hiérarchie typographique. */
  hierarchy: number;
  /** Part de la page couverte par du contenu (textes, médias, aplats porteurs). */
  coverage: number;
  /** Part de la page occupée par le plus grand élément de contenu. */
  focalArea: number;
  /** Les rectangles du titre, du logo et du visuel principal (part de la page), pour la saliency. */
  regions: Record<string, { x: number; y: number; w: number; h: number }>;
}

export interface VariantEvidence {
  /** Défauts techniques constatés par le code (constats bloquants comptent double). */
  issues: { blocking: number; advisory: number };
  metrics?: PageMetrics;
  /** Nombre de foyers (saliency). */
  focalCount?: number;
  /** Part de l'attention sur le titre ou le visuel principal. */
  focalShare?: number;
  /** Juge visuel (0–1) ; absent si non posé. */
  judge?: number;
  /** Nouveauté face aux rendus récents (0–1). */
  novelty?: number;
}

export interface ScoreWeights {
  issues: number;
  hierarchy: number;
  sizes: number;
  coverage: number;
  focal: number;
  judge: number;
  novelty: number;
}

export const DEFAULT_WEIGHTS: ScoreWeights = { issues: 0.25, hierarchy: 0.15, sizes: 0.05, coverage: 0.1, focal: 0.15, judge: 0.2, novelty: 0.1 };

export function weights(): ScoreWeights {
  try {
    const raw = process.env.IDEM_QUALITY_WEIGHTS;
    return raw ? { ...DEFAULT_WEIGHTS, ...(JSON.parse(raw) as Partial<ScoreWeights>) } : DEFAULT_WEIGHTS;
  } catch {
    return DEFAULT_WEIGHTS;
  }
}

const clamp = (v: number) => Math.min(1, Math.max(0, v));

export interface VariantScore {
  score: number;
  parts: Partial<Record<keyof ScoreWeights, number>>;
  /** Ce qui ne va pas, en une ligne chacun (anglais, renvoyé à l'auteur). */
  faults: string[];
}

export function scoreVariant(e: VariantEvidence, w: ScoreWeights = weights()): VariantScore {
  const parts: VariantScore['parts'] = {};
  const faults: string[] = [];
  parts.issues = clamp(1 - (e.issues.blocking * 2 + e.issues.advisory * 0.5) / 6);
  if (e.metrics) {
    const m = e.metrics;
    // Une hiérarchie franche : le plus grand corps au moins 2,2 fois le corps médian.
    parts.hierarchy = clamp((m.hierarchy - 1) / 1.6);
    if (m.hierarchy < 1.6) faults.push(`flat hierarchy: the largest text is only ${m.hierarchy.toFixed(1)}× the body size — make the focal element clearly bigger`);
    // Peu de tailles : 3 à 5 est le bon registre.
    parts.sizes = m.sizes <= 5 ? 1 : clamp(1 - (m.sizes - 5) / 5);
    if (m.sizes > 6) faults.push(`${m.sizes} different text sizes — use at most 5`);
    // Ni page vide, ni page saturée.
    parts.coverage = m.coverage < 0.25 ? clamp(m.coverage / 0.25) : m.coverage > 0.85 ? clamp((1 - m.coverage) / 0.15) : 1;
    if (m.coverage > 0.88) faults.push('the page is crowded: give the content more space');
  }
  if (e.focalCount !== undefined || e.focalShare !== undefined) {
    const count = e.focalCount ?? 1;
    parts.focal = clamp((count <= 1 ? 1 : count === 2 ? 0.6 : 0.25) * 0.6 + clamp((e.focalShare ?? 0.2) / 0.25) * 0.4);
    if (count >= 3) faults.push(`${count} areas compete for attention — one element must dominate`);
  }
  if (e.judge !== undefined) parts.judge = clamp(e.judge);
  if (e.novelty !== undefined) parts.novelty = clamp(e.novelty / 0.3);
  // Les mesures absentes ne pèsent pas : la somme est ramenée aux poids présents.
  let total = 0;
  let weight = 0;
  for (const [k, v] of Object.entries(parts) as [keyof ScoreWeights, number][]) {
    total += v * w[k];
    weight += w[k];
  }
  return { score: weight ? Math.round((total / weight) * 1000) / 1000 : 0, parts, faults };
}

/** La meilleure variante (à score égal, la première : la moins chère à garder). */
export function bestOf<T>(variants: { value: T; score: VariantScore }[]): { value: T; score: VariantScore; index: number } | undefined {
  let best: { value: T; score: VariantScore; index: number } | undefined;
  variants.forEach((v, index) => {
    if (!best || v.score.score > best.score.score + 1e-6) best = { ...v, index };
  });
  return best;
}

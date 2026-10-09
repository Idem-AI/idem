/**
 * LA JAUGE DE CRÉATIVITÉ — partagée par l'API et le dashboard.
 *
 * Avant chaque génération (vidéo, visuel, carte de visite, pitch deck, business plan,
 * identité visuelle), l'utilisateur règle la part de décisions confiée à l'IA. Plus le cran
 * monte, plus de décisions passent du code (gabarits, graphe, graine déterministe) aux
 * agents — et plus la génération consomme de crédits :
 *
 *   low     mises en page éprouvées, adaptées à la charte et à sa direction artistique ;
 *           l'IA écrit les textes
 *   medium  + l'IA choisit la structure (sections, scènes, slides) dans des menus
 *   high    + l'IA choisit chaque composition dans un menu filtré par la DA
 *   max     + l'IA règle les paramètres de composition, dans des bornes
 *   ultra   l'IA écrit les compositions elles-mêmes (HTML, React, SVG) ; une unité qui
 *           échoue aux contrôles retombe sur son rendu « max »
 *
 * Les bonnes pratiques (lisibilité, contraste, zones de sécurité, charte) s'appliquent à
 * TOUS les crans : elles sont dans le code, pas dans le prompt.
 *
 * Ce module ne lit rien et ne dépend de rien : c'est ce qui garantit que le prix affiché
 * par le dashboard est celui que l'API débite.
 */

export type CreativityLevel = 'low' | 'medium' | 'high' | 'max' | 'ultra';

/** Du plus encadré au plus libre. */
export const CREATIVITY_LEVELS: readonly CreativityLevel[] = ['low', 'medium', 'high', 'max', 'ultra'];

/** Le cran proposé quand l'utilisateur n'a rien choisi. */
export const DEFAULT_CREATIVITY: CreativityLevel = 'medium';

/**
 * Multiplicateur du prix du livrable. Low et Medium gardent le prix historique : seuls les
 * crans qui confient plus de décisions (et de tokens) à l'IA coûtent davantage.
 */
export const CREATIVITY_MULTIPLIER: Readonly<Record<CreativityLevel, number>> = {
  low: 1,
  medium: 1,
  high: 1.25,
  max: 1.5,
  ultra: 2,
};

/** Rang du cran (0 = low … 4 = ultra). */
export function creativityRank(level: CreativityLevel): number {
  return CREATIVITY_LEVELS.indexOf(level);
}

/** Le cran est-il au moins `min` ? (« l'IA décide de cette couche à partir de High ») */
export function atLeast(level: CreativityLevel, min: CreativityLevel): boolean {
  return creativityRank(level) >= creativityRank(min);
}

/** Valeur reçue d'un client (corps, requête) : un cran inconnu ou absent vaut le cran par défaut. */
export function normalizeCreativity(raw: unknown): CreativityLevel {
  const value = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  return (CREATIVITY_LEVELS as readonly string[]).includes(value) ? (value as CreativityLevel) : DEFAULT_CREATIVITY;
}

/** Coût d'un livrable à ce cran (crédits entiers, arrondis au-dessus). */
export function creativityCost(baseCost: number, level: CreativityLevel): number {
  if (!Number.isFinite(baseCost) || baseCost <= 0) return 0;
  return Math.ceil(baseCost * CREATIVITY_MULTIPLIER[level] - 1e-9);
}

/**
 * LA JAUGE DE CRÉATIVITÉ — partagée par l'API et le dashboard.
 *
 * Avant chaque génération (vidéo, visuel, carte de visite, pitch deck, business plan,
 * identité visuelle), l'utilisateur choisit un cran. Le cran choisit la PUISSANCE DU MODÈLE qui
 * crée : à tous les crans, l'IA conçoit et écrit le livrable librement, avec le même contexte ;
 * plus le cran monte, plus le modèle qui le fait est puissant (échelles de
 * `apps/api/api/config/creative-roles.ts`) :
 *
 *   low     modèle léger
 *   medium  modèle intermédiaire (défaut)
 *   high    modèle puissant
 *   ultra   le modèle le plus puissant
 *
 * Aucune critique esthétique ni réécriture automatique, à aucun cran : seul un rendu qui ne
 * s'affiche pas (erreur technique) est corrigé, dans des bornes strictes.
 *
 * Un ancien cran « max » (données d'avant octobre 2026) vaut « high ».
 *
 * **Le cran ne change plus le prix** (modèle « Créer, Garder, Faire tourner », octobre 2026) :
 * une esquisse est gratuite, une version finale a un prix fixe, et le cran le plus puissant
 * s'achète comme une option — la version Signature (`apps/api/api/models/offer.model.ts`).
 * Le multiplicateur reste défini, à 1 partout, pour les calculs de prix existants.
 *
 * Ce module ne lit rien et ne dépend de rien : c'est ce qui garantit que le prix affiché
 * par le dashboard est celui que l'API débite.
 */

export type CreativityLevel = 'low' | 'medium' | 'high' | 'ultra';

/** Du plus encadré au plus libre. */
export const CREATIVITY_LEVELS: readonly CreativityLevel[] = ['low', 'medium', 'high', 'ultra'];

/** Le cran proposé quand l'utilisateur n'a rien choisi. */
export const DEFAULT_CREATIVITY: CreativityLevel = 'medium';

/**
 * Multiplicateur du prix d'un livrable selon le cran : 1 partout. Le prix ne dépend plus du
 * cran ; la puissance maximale se vend comme la version Signature, une option à prix fixe.
 */
export const CREATIVITY_MULTIPLIER: Readonly<Record<CreativityLevel, number>> = {
  low: 1,
  medium: 1,
  high: 1,
  ultra: 1,
};

/** Rang du cran (0 = low … 3 = ultra). */
export function creativityRank(level: CreativityLevel): number {
  return CREATIVITY_LEVELS.indexOf(normalizeCreativity(level));
}

/** Le cran est-il au moins `min` ? (« l'IA décide de cette couche à partir de High ») */
export function atLeast(level: CreativityLevel, min: CreativityLevel): boolean {
  return creativityRank(level) >= creativityRank(min);
}

/** Valeur reçue d'un client (corps, requête) : un cran inconnu ou absent vaut le cran par défaut. */
export function normalizeCreativity(raw: unknown): CreativityLevel {
  const value = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (value === 'max') return 'high';
  return (CREATIVITY_LEVELS as readonly string[]).includes(value) ? (value as CreativityLevel) : DEFAULT_CREATIVITY;
}

/** Coût d'un livrable à ce cran (crédits entiers, arrondis au-dessus). */
export function creativityCost(baseCost: number, level: CreativityLevel): number {
  if (!Number.isFinite(baseCost) || baseCost <= 0) return 0;
  return Math.ceil(baseCost * CREATIVITY_MULTIPLIER[normalizeCreativity(level)] - 1e-9);
}

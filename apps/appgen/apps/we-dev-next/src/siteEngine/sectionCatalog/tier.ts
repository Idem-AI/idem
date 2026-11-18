/**
 * LA GAMME D'UN NŒUD — le cran de créativité choisit des gabarits de plus en plus PREMIUM (18/11/2026).
 *
 * Depuis le passage au modèle unique, le cran ne choisit plus le modèle : il choisit la GAMME des nœuds du catalogue
 * (idem-templates, champ `tier` de chaque `node.json`) :
 *
 *   low      sobre, direct, peu d'effets
 *   medium   soigné, une idée de mise en page
 *   high     composition éditoriale, détails travaillés
 *   ultra    le plus premium : mises en page signature, animations fines, habillages riches
 *
 * COPIE CONFORME de `packages/graphic-engine/src/catalog/tier.ts` (appgen ne dépend pas de ce paquet) : les deux
 * fichiers doivent rester identiques — même règle de repli vers les gammes voisines.
 */

export const TIERS = ['low', 'medium', 'high', 'ultra'] as const;
export type Tier = (typeof TIERS)[number];

/** Le cran demandé ramené à une gamme (« max », ancien cran, vaut High ; inconnu : Medium). */
export function tierOf(level?: string): Tier {
  const v = String(level ?? '').toLowerCase();
  if (v === 'max') return 'high';
  return (TIERS as readonly string[]).includes(v) ? (v as Tier) : 'medium';
}

/**
 * Les nœuds de la gamme du cran. Le filtre passe APRÈS les filtres durs (élément, toile, rôle, capacité, DA) :
 * il ne retire jamais ce qui seul sait montrer la page.
 *
 *   - d'abord la gamme exacte ;
 *   - si elle compte moins de `min` nœuds, les gammes voisines s'ajoutent par distance croissante (la plus BASSE
 *     d'abord à distance égale : on ne sert jamais plus premium que demandé quand on peut l'éviter) ;
 *   - un nœud sans gamme (catalogue ancien) sert tous les crans.
 *
 * Une génération ne s'arrête donc jamais faute de couverture : au pire, la liste entière.
 */
export function inTier<T extends { tier?: string }>(list: T[], level?: string, min = 1): T[] {
  if (!level || !list.length) return list;
  const tiered = list.filter((n) => n.tier);
  if (!tiered.length) return list;
  const untiered = list.filter((n) => !n.tier);
  const want = TIERS.indexOf(tierOf(level));
  const out: T[] = [];
  for (let d = 0; d < TIERS.length; d++) {
    for (const i of d === 0 ? [want] : [want - d, want + d]) {
      if (i < 0 || i >= TIERS.length) continue;
      out.push(...tiered.filter((n) => n.tier === TIERS[i]));
    }
    if (out.length >= min) break;
  }
  return [...out, ...untiered];
}

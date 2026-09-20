/**
 * Destinataire d'un business plan.
 *
 * MODULE À PART, et minuscule, pour une raison de dépendances : le catalogue de
 * sections, les modèles de structure ET les prompts en ont tous besoin. Le
 * placer dans `templates.ts` créait un cycle — les prompts auraient importé les
 * modèles, qui importent le catalogue, qui importe les prompts.
 *
 * Ce n'est pas une étiquette décorative : c'est elle qui choisit la lentille de
 * lecture appliquée à chaque section (cf. `prompts/audience-lens.prompt.ts`).
 * Un analyste crédit et un associé de fonds d'amorçage ouvrent la même page en
 * cherchant deux choses différentes.
 */
export type BusinessPlanAudience = 'bank' | 'investor' | 'grant' | 'internal' | 'general';

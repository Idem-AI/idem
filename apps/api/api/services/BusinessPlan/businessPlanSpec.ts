/**
 * Spécification des sections du business plan, pour l'équipe de recherche.
 *
 * MODULE À PART, et non une méthode privée du service, pour une raison précise :
 * `npm run check:prompts` doit pouvoir la lire. Le contrôle de conformité
 * n'ouvre aucune connexion — importer le service entier y ferait entrer Mongo,
 * MinIO et Puppeteer. Isoler cette fonction, qui ne dépend que de textes, est
 * ce qui rend la règle vérifiable en permanence plutôt qu'une fois.
 *
 * Deux choses n'y sont plus figées :
 *
 *  - la LISTE des sections, qui vient de la structure choisie sur le projet
 *    (dossier bancaire, plan investisseur, composition libre…) ;
 *  - la CONSIGNE de chaque section, qui est composée pour ce document précis :
 *    son destinataire, son rang, la section qui la précède et celle qui la
 *    suit. Une section qui ignore ses voisines réexplique ce qu'elles ont déjà
 *    dit, et c'est le défaut le plus visible d'un plan produit par sections
 *    parallèles.
 */

import { DeliverableSection } from '../research/research.types';
import { AGENT_COVER_PROMPT } from './prompts/agent-cover.prompt';
import { composeBrief, readerBlock } from './prompts/section-prompt.registry';
import { BusinessPlanSectionDefinition } from './structure/section-catalog';
import type { BusinessPlanAudience } from './structure/audience.types';

/**
 * Prompts de composition des sections en génération LIBRE.
 *
 * Seule la couverture est dans ce cas : sa mise en page EST le livrable. Les
 * autres sections passent par le gabarit et reçoivent leur consigne de contenu.
 * Leur donner en plus un prompt de composition les ferait produire du HTML là
 * où `parseLlmJson` attend du JSON, et la section serait abandonnée.
 */
const FREEFORM_PROMPTS: Record<string, string> = {
  'Cover Page': AGENT_COVER_PROMPT,
};

/** Ce dont la composition a besoin, au-delà des sections elles-mêmes. */
export interface BusinessPlanSpecContext {
  /** Destinataire du plan, déduit du modèle de structure retenu. */
  audience: BusinessPlanAudience;
  projectDescription: string;
  /** Résumé du module Finance, ajouté aux sections qui s'appuient dessus. */
  financeContext: string;
  country: string;
}

/**
 * Construit la spécification des sections retenues pour l'équipe de recherche.
 * Les sections « marché/chiffrées » activent la recherche web sourcée ; les
 * sections qualitatives restent internes.
 *
 * @param sections Définitions ordonnées issues de la structure du projet.
 */
export function buildBusinessPlanSpec(
  sections: readonly BusinessPlanSectionDefinition[],
  ctx: BusinessPlanSpecContext
): DeliverableSection[] {
  const geo = ctx.country ? ` (priority market: ${ctx.country})` : '';
  const projectSummary = ctx.projectDescription.slice(0, 400);

  return sections.map((section, index) => {
    // Une section en composition libre garde son prompt d'origine : elle
    // compose vraiment sa page. On lui ajoute la lentille du destinataire —
    // une couverture de dossier bancaire ne ressemble pas à une couverture de
    // dossier d'amorçage, et c'est la première page que l'on voit.
    if (section.freeform) {
      const prompt = FREEFORM_PROMPTS[section.name];
      return {
        name: section.name,
        instructions: prompt ? `${readerBlock(ctx.audience)}\n\n${prompt}` : '',
        needsResearch: false,
        freeform: true,
      };
    }

    const instructions =
      composeBrief(section.key, {
        audience: ctx.audience,
        position: index + 1,
        total: sections.length,
        previous: sections[index - 1]?.name,
        next: sections[index + 1]?.name,
        financeContext: section.financeContext ? ctx.financeContext : undefined,
      }) ?? '';

    return {
      name: section.name,
      instructions,
      needsResearch: section.needsResearch,
      ...(section.researchBriefs
        ? { researchBriefs: section.researchBriefs({ projectSummary, geo }) }
        : {}),
    };
  });
}

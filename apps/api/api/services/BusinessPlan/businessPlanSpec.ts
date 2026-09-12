/**
 * Spécification des sections du business plan, pour l'équipe de recherche.
 *
 * MODULE À PART, et non une méthode privée du service, pour une raison précise :
 * `npm run check:prompts` doit pouvoir la lire. Le contrôle de conformité
 * n'ouvre aucune connexion — importer le service entier y ferait entrer Mongo,
 * MinIO et Puppeteer. Isoler cette fonction, qui ne dépend que de textes, est
 * ce qui rend la règle vérifiable en permanence plutôt qu'une fois.
 *
 * La liste des sections N'EST PLUS FIXE. Elle vient de la structure choisie sur
 * le projet (modèle bancaire, modèle investisseur, composition libre…), résolue
 * par `structure/structure.resolver.ts` contre un catalogue fermé. Ce qui ne
 * change pas : chaque section arrive ici avec son brief de CONTENU, son volume
 * et ses recherches déjà écrits — c'est la contrepartie de la souplesse.
 */

import { DeliverableSection } from '../research/research.types';
import { AGENT_COVER_PROMPT } from './prompts/agent-cover.prompt';
import { BP_SECTION_BRIEFS } from './prompts/section-briefs.prompt';
import { BusinessPlanSectionDefinition } from './structure/section-catalog';

/**
 * Prompt de composition des sections en génération LIBRE.
 *
 * Seule la couverture est dans ce cas : sa mise en page EST le livrable. Les
 * autres sections passent par le gabarit et reçoivent leur brief de contenu —
 * leur donner en plus un prompt de composition les ferait produire du HTML là
 * où `parseLlmJson` attend du JSON, et la section serait abandonnée.
 */
const FREEFORM_PROMPTS: Record<string, string> = {
  'Cover Page': AGENT_COVER_PROMPT,
};

/**
 * Construit la spécification des sections retenues pour l'équipe de recherche.
 * Les sections « marché/chiffrées » activent la recherche web sourcée; les
 * sections qualitatives restent internes.
 *
 * @param sections Définitions ordonnées issues de la structure du projet.
 */
export function buildBusinessPlanSpec(
  sections: readonly BusinessPlanSectionDefinition[],
  projectDescription: string,
  financeContext: string,
  country: string
): DeliverableSection[] {
  const geo = country ? ` (priority market: ${country})` : '';
  const projectSummary = projectDescription.slice(0, 400);

  return sections.map((section) => {
    // Une section en composition libre garde son prompt d'origine : elle
    // compose vraiment sa page.
    if (section.freeform) {
      return {
        name: section.name,
        instructions: FREEFORM_PROMPTS[section.name] ?? BP_SECTION_BRIEFS[section.name] ?? '',
        needsResearch: false,
        freeform: true,
      };
    }

    // Le brief de CONTENU, pas le prompt d'origine. Les `agent-*.prompt.ts`
    // consacrent leurs `<technical_rules>` à exiger « raw HTML + Tailwind on a
    // single minified line » : c'était juste quand la section produisait sa
    // propre page, c'est l'inverse de ce qu'on lui demande depuis que le
    // gabarit compose. Les passer tels quels au rédacteur revenait à mettre
    // deux formats de sortie contradictoires dans le même message — et le
    // modèle suivait le plus explicite des deux, le HTML.
    const brief = BP_SECTION_BRIEFS[section.name] ?? '';

    return {
      name: section.name,
      instructions: section.financeContext ? `${brief}${financeContext}` : brief,
      needsResearch: section.needsResearch,
      ...(section.researchBriefs
        ? { researchBriefs: section.researchBriefs({ projectSummary, geo }) }
        : {}),
    };
  });
}

/**
 * Spécification des 9 sections du business plan, pour l'équipe de recherche.
 *
 * MODULE À PART, et non une méthode privée du service, pour une raison précise :
 * `npm run check:prompts` doit pouvoir la lire. Le contrôle de conformité
 * n'ouvre aucune connexion — importer le service entier y ferait entrer Mongo,
 * MinIO et Puppeteer. Isoler cette fonction, qui ne dépend que de textes, est
 * ce qui rend la règle vérifiable en permanence plutôt qu'une fois.
 */

import { DeliverableSection } from '../research/research.types';
import { AGENT_COVER_PROMPT } from './prompts/agent-cover.prompt';
import { AGENT_COMPANY_SUMMARY_PROMPT } from './prompts/agent-company-summary.prompt';
import { AGENT_OPPORTUNITY_PROMPT } from './prompts/agent-opportunity.prompt';
import { AGENT_TARGET_AUDIENCE_PROMPT } from './prompts/agent-target-audience.prompt';
import { AGENT_PRODUCTS_SERVICES_PROMPT } from './prompts/agent-products-services.prompt';
import { AGENT_MARKETING_SALES_PROMPT } from './prompts/agent-marketing-sales.prompt';
import { AGENT_FINANCIAL_PLAN_PROMPT } from './prompts/agent-financial-plan.prompt';
import { AGENT_GOAL_PLANNING_PROMPT } from './prompts/agent-goal-planning.prompt';
import { AGENT_APPENDIX_PROMPT } from './prompts/agent-appendix.prompt';
import { BP_SECTION_BRIEFS } from './prompts/section-briefs.prompt';

/**
 * Construit la spécification des 9 sections pour l'équipe de recherche.
 * Les sections "marché/chiffrées" activent la recherche web sourcée; les
 * sections qualitatives (Cover, résumé, objectifs, annexe) restent internes.
 */
export function buildBusinessPlanSpec(
  projectDescription: string,
  financeContext: string,
  country: string
): DeliverableSection[] {
  const geo = country ? ` (priority market: ${country})` : '';
  const ctx = projectDescription.slice(0, 400);

  /**
   * Consigne d'une section RENDUE PAR GABARIT, sous l'équipe de recherche.
   *
   * Le brief de CONTENU, pas le prompt d'origine. Les `agent-*.prompt.ts`
   * consacrent leurs `<technical_rules>` à exiger « raw HTML + Tailwind on a
   * single minified line » : c'était juste quand la section produisait sa
   * propre page, c'est l'inverse de ce qu'on lui demande depuis que le
   * gabarit compose. Les passer tels quels au rédacteur revenait à mettre
   * deux formats de sortie contradictoires dans le même message — et le
   * modèle suivait le plus explicite des deux, le HTML. La section revenait
   * en balises, `parseLlmJson` échouait, et elle était abandonnée : les
   * sections « Opportunity » et « Target Audience » disparaissaient du plan.
   *
   * `templated()`, l'autre chemin de rendu, prend déjà ces mêmes briefs. Les
   * deux chemins parlent donc enfin du même livrable.
   */
  const brief = (name: string, fallback: string): string =>
    BP_SECTION_BRIEFS[name] ?? fallback;

  return [
    // La couverture est une composition PLEINE PAGE, à hauteur fixe (cf.
    // `fixedPageSections`) : elle ne passe pas par le gabarit, sinon elle
    // deviendrait une page de contenu comme les huit autres.
    { name: 'Cover Page', instructions: AGENT_COVER_PROMPT, needsResearch: false, freeform: true },
    {
      name: 'Company Summary',
      instructions: brief('Company Summary', AGENT_COMPANY_SUMMARY_PROMPT),
      needsResearch: false,
    },
    {
      name: 'Opportunity',
      instructions: brief('Opportunity', AGENT_OPPORTUNITY_PROMPT),
      needsResearch: true,
      researchBriefs: [
        `Market size (TAM/SAM/SOM), annual growth rate (CAGR) and recent projections for the project's sector${geo}. Context: ${ctx}`,
        `The problem addressed: recent statistics and studies quantifying its scale${geo}`,
        `Recent trends and regulatory factors affecting this market${geo}`,
      ],
    },
    {
      name: 'Target Audience',
      instructions: brief('Target Audience', AGENT_TARGET_AUDIENCE_PROMPT),
      needsResearch: true,
      researchBriefs: [
        `Size and demographics of the target customer segments${geo}. Context: ${ctx}`,
        `Purchasing behaviour, spending power and adoption rates for those segments${geo}`,
      ],
    },
    // Cette section décrit l'offre du porteur de projet : elle est déjà dans
    // le projet. Les prix pratiqués par la concurrence, eux, sont utiles —
    // ils ont rejoint le plan financier, qui est la section qui s'en sert.
    {
      name: 'Products & Services',
      instructions: brief('Products & Services', AGENT_PRODUCTS_SERVICES_PROMPT),
      needsResearch: false,
    },
    // Les CAC et taux de conversion « de référence » par secteur et par pays
    // ne se trouvent pas sous forme de données sourcées : la recherche
    // ramenait des articles génériques, et la section est de toute façon une
    // stratégie déduite du projet.
    {
      name: 'Marketing & Sales',
      instructions: brief('Marketing & Sales', AGENT_MARKETING_SALES_PROMPT),
      needsResearch: false,
    },
    {
      name: 'Financial Plan',
      instructions: brief('Financial Plan', AGENT_FINANCIAL_PLAN_PROMPT) + financeContext,
      needsResearch: true,
      researchBriefs: [
        `Benchmark gross margins and cost structures for the sector${geo}. Context: ${ctx}`,
        // Reprise de « Produits & Services » : c'est ici que les prix du
        // marché servent réellement. Les multiples de valorisation qu'on
        // cherchait avant n'ont pas leur place dans un plan à ce stade, et le
        // module Finance fournit déjà les chiffres du projet.
        `Price ranges charged by competitors for this kind of offering${geo}`,
      ],
    },
    {
      name: 'Goal Planning',
      instructions: brief('Goal Planning', AGENT_GOAL_PLANNING_PROMPT),
      needsResearch: false,
    },
    {
      name: 'Appendix',
      instructions: brief('Appendix', AGENT_APPENDIX_PROMPT),
      needsResearch: false,
    },
  ];
}

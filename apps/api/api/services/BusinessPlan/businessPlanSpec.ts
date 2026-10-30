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

import type { BlockDraft } from '@idem/graphic-engine';
import { DeliverableSection } from '../research/research.types';
import { composeBrief } from './prompts/section-prompt.registry';
import { BusinessPlanSectionDefinition } from './structure/section-catalog';
import type { BusinessPlanAudience } from './structure/audience.types';

/** Ce dont la composition a besoin, au-delà des sections elles-mêmes. */
export interface BusinessPlanSpecContext {
  /** Destinataire du plan, déduit du modèle de structure retenu. */
  audience: BusinessPlanAudience;
  projectDescription: string;
  /** Résumé du module Finance, ajouté aux sections qui s'appuient dessus. */
  financeContext: string;
  country: string;
  /** Les tableaux et le graphique du module Finance, posés par le code en tête des sections financières. */
  financeBlocks?: BlockDraft[];
}

/**
 * Les sections qui montrent une IMAGE (aérer, faire voir l'activité) — trois au plus, choisies pour ce qu'elles
 * racontent : l'entreprise au travail, ce qu'elle vend en usage, ses clients chez eux. Jamais l'équipe : on ne
 * fabrique pas le visage d'une personne réelle ; ses vraies photos passent par le registre du projet.
 */
const IMAGE_SECTIONS: Record<string, (project: string) => { subject: string; framing?: string; mood?: string }> = {
  'company-summary': (project) => ({ subject: `the activity of this business, in its real setting: ${project}`, framing: 'wide shot', mood: 'natural daylight, credible, no staged smiles' }),
  'products-services': (project) => ({ subject: `the product or service of this business in use by a real customer: ${project}`, framing: 'medium shot on the use', mood: 'natural, precise' }),
  solution: (project) => ({ subject: `the solution of this business in use by a real customer: ${project}`, framing: 'medium shot on the use', mood: 'natural, precise' }),
  'target-audience': (project) => ({ subject: `the customers of this business in their daily context: ${project}`, framing: 'environmental portrait', mood: 'natural daylight, respectful' }),
};
const MAX_IMAGE_SECTIONS = 3;

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
  // La solution n'appelle une image que si « Produits & services » n'en porte pas déjà une.
  const keys = new Set(sections.map((s) => s.key));
  const imaged = sections
    .filter((s) => IMAGE_SECTIONS[s.key] && !(s.key === 'solution' && keys.has('products-services')))
    .slice(0, MAX_IMAGE_SECTIONS)
    .map((s) => s.key);

  return sections.map((section, index) => {
    // La couverture est composée par le moteur graphique (le service y attache `compose`) : elle n'a
    // ni recherche, ni rédaction.
    if (section.freeform) {
      return { name: section.name, instructions: '', needsResearch: false, freeform: true };
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
      ...(section.financeBlocks && ctx.financeBlocks?.length ? { prependBlocks: ctx.financeBlocks } : {}),
      ...(imaged.includes(section.key)
        ? (() => {
            const image = IMAGE_SECTIONS[section.key](projectSummary.slice(0, 160));
            return { image: { ...image, subject: image.subject.slice(0, 240) } };
          })()
        : {}),
    };
  });
}

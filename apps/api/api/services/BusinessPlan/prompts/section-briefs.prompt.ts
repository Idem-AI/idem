/**
 * Briefs de CONTENU des sections de business plan — vue par nom canonique.
 *
 * Ce module ne contient plus de texte. Les consignes vivent dans
 * `prompts/sections/*.prompts.ts`, en pièces détachées (objectif, contenu
 * obligatoire, pièges, inflexion par destinataire, blocs), et sont recomposées
 * par `section-prompt.registry.ts` pour chaque génération.
 *
 * Pourquoi cette bascule : une consigne écrite d'un bloc ne peut pas varier.
 * Les prompts historiques consacraient en outre les trois quarts de leur volume
 * à la composition (format de page, `<technical_rules>` exigeant « raw HTML +
 * Tailwind on a single minified line », `<chart_requirements>`), inerte depuis
 * que le gabarit compose — et une consigne inerte n'est pas neutre, elle prend
 * la place d'une consigne utile sur un petit modèle.
 *
 * Ce qui reste ici est une VUE : les briefs composés avec un contexte neutre,
 * indexés par nom canonique. Elle sert de repli aux appelants qui n'ont pas de
 * contexte de document, et de surface de contrôle à `npm run check:prompts`.
 * Les appelants qui connaissent le destinataire et la position de la section
 * passent par `composeBrief()`, qui rend une consigne nettement plus précise.
 */

import { composeBrief, NEUTRAL_CONTEXT, SECTION_PROMPT_SPECS } from './section-prompt.registry';

export const BP_SECTION_BRIEFS: Record<string, string> = Object.fromEntries(
  SECTION_PROMPT_SPECS.map((spec) => [spec.name, composeBrief(spec.key, NEUTRAL_CONTEXT)!])
);

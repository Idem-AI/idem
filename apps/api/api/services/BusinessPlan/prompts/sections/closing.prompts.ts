/**
 * Section de FERMETURE.
 *
 * Une annexe qui porte un argument signifie que l'argument manquait au plan.
 * Elle ne contient donc que des pièces de vérification : sources, tableaux
 * détaillés, définitions, éléments réglementaires.
 */

import type { SectionPromptSpec } from '../section-prompt.types';

export const CLOSING_SECTION_PROMPTS: SectionPromptSpec[] = [
  {
    key: 'appendix',
    name: 'Appendix',
    fallbackPages: '1-2',
    objective: 'Carry the supporting material a reader will want to check.',
    mustCover: `1. The sources of the figures used in the plan, named and dated.
2. The detailed tables the body of the plan summarised.
3. The glossary of the sector terms used.
4. Any regulatory or legal element that bears on the activity.`,
    pitfalls: `Nothing new is introduced here: an appendix that carries an argument means
the argument was missing from the plan. Every item must correspond to
something the body actually referred to.`,
    lenses: {
      bank: `List the supporting documents the file will be accompanied by (quotes,
leases, statements, registration certificates) with their date and issuer,
even when the documents themselves are not attached here.`,
    },
    blocks: `One or two "table" blocks, one "prose" block for the sources, optionally one
"assumption" block recalling the hypotheses used throughout.`,
  },
];

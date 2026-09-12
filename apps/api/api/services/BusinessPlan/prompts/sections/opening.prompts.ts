/**
 * Sections d'OUVERTURE — les pages que le lecteur ouvre en premier.
 *
 * Ce sont les seules pages dont on sait qu'elles seront lues. Un comité de
 * crédit lit la synthèse et va directement au prévisionnel ; un fonds lit le
 * résumé exécutif et décide s'il continue. Elles ne résument donc pas le
 * document : elles portent la décision, et le reste du plan la justifie.
 */

import type { SectionPromptSpec } from '../section-prompt.types';

export const OPENING_SECTION_PROMPTS: SectionPromptSpec[] = [
  {
    key: 'executive-summary',
    name: 'Executive Summary',
    fallbackPages: '2',
    objective:
      'Give a reader who will read nothing else everything they need to decide.',
    mustCover: `1. What the company does, for whom, and the result it produces. One sentence.
2. The problem and its scale, with the one figure that makes it real.
3. The offer, and the mechanism that makes it work where others fail.
4. The market: size, growth, and the segment attacked first.
5. The team, and what qualifies THESE people for THIS problem.
6. The headline financials: revenue at horizon, break-even, margin.
7. What is being asked for: amount, use, and what it buys.`,
    pitfalls: `Written last in the reader's mind, read first. Introduce nothing here that
the plan does not develop later, and never announce what the document will
say ("this plan will present...") instead of saying it.`,
    lenses: {
      bank: `Open on the amount requested and the repayment horizon. A credit analyst
who reaches the second page without finding the amount stops reading. State
the personal contribution and the guarantee in the same paragraph.`,
      investor: `Open on the size of the prize and why now. State the traction in the first
third, even when it is thin: a summary that hides the stage is discovered on
the next page and costs the meeting.`,
      grant: `Open on the beneficiaries and the change pursued, with a number for each.
The amount requested and the co-financing already secured come next.`,
    },
    blocks: `One "prose" block for the concept, one "metrics" row for the headline figures
(market, revenue at horizon, break-even, amount requested), one "cards" block
for the three or four arguments that carry the decision.`,
  },

  {
    key: 'one-page-summary',
    name: 'One-Page Summary',
    fallbackPages: '1',
    objective: "Fit the company's identity and its request on a single page.",
    mustCover: `1. General information: legal name, legal form, registration number, date of
   creation, registered address, sector of activity.
2. A synthetic presentation: history, products, creations and developments.
3. The ultimate goal pursued, stated plainly.
4. What is needed to reach it: means, partners, financing.`,
    pitfalls: `ONE page. A summary that spills onto a second page is no longer a summary,
and this is the page a credit officer photocopies for the committee. Facts
only: no adjective survives this format.`,
    lenses: {
      bank: `The identity facts are what the file is opened with: legal form,
registration number and address must be present and exact, or the file is
returned before anyone reads the project.`,
    },
    blocks: `One "table" block for the identity facts (one row per fact), one "prose"
block of three or four short paragraphs for the presentation and the goal.`,
  },
];

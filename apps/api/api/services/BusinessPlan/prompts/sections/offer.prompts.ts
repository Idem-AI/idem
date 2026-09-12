/**
 * Sections « L'OFFRE » — ce qui est vendu, et pourquoi on l'achète.
 *
 * La famille où le vocabulaire promotionnel s'installe le plus facilement. La
 * consigne commune y est donc la même partout : décrire un MÉCANISME, pas une
 * promesse. « Une solution innovante qui révolutionne » ne dit rien qu'un
 * lecteur puisse vérifier ou contredire.
 */

import type { SectionPromptSpec } from '../section-prompt.types';

export const OFFER_SECTION_PROMPTS: SectionPromptSpec[] = [
  {
    key: 'solution',
    name: 'Solution',
    fallbackPages: '1-2',
    objective: 'Explain the mechanism, not the promise.',
    mustCover: `1. What the solution does, in the order the user experiences it.
2. The mechanism that makes it work: the part a competitor cannot copy by
   reading this page.
3. The before and after, measured.
4. What it deliberately does NOT do.
5. Proof it works: pilot, prototype, early users, technical validation.
6. What remains to be built.`,
    pitfalls: `If the description would still be true with the product replaced by a
competitor's, it describes the category, not the solution. The paragraph
naming what the product does not do is the one that makes the rest credible.`,
    lenses: {
      investor: `State the stage without decoration: what is live, what is a prototype, what
is a specification. An investor discovers the real stage in diligence anyway,
and discovering it there costs the round.`,
    },
    blocks: `One "prose" block for the mechanism, one "timeline" for the user journey
through the solution, one "table" for the before/after comparison, one
"assumption" block for anything not yet validated.`,
  },

  {
    key: 'products-services',
    name: 'Products & Services',
    fallbackPages: '1-2',
    objective: 'Make the offer concrete enough to be bought.',
    mustCover: `1. The actual offerings, described by what they do for the customer.
2. The features that genuinely differ from the alternatives.
3. The outcome for the customer, stated as a before and an after.
4. Comparison with the alternatives on the axes a buyer cares about.
5. The roadmap, with dates.
6. Pricing: model, levels, and what justifies each level.
7. How the value is delivered and supported after the sale.`,
    pitfalls: `Prices must match the finance module exactly. A price list that contradicts
the revenue projection two sections later is the contradiction readers find
fastest, and it discredits both sections.`,
    lenses: {
      grant: `These are programmes, not products: state for each one the activities
delivered, the beneficiaries reached, and the cost per beneficiary.`,
      bank: `Say which offering carries the revenue. A catalogue of eight equally
weighted products reads as a business that has not chosen.`,
    },
    blocks: `One "table" for the pricing levels, one "cards" block for the offerings (the
main one set to emphasis), one "table" for the competitive comparison, one
"timeline" for the roadmap.`,
  },

  {
    key: 'value-proposition',
    name: 'Unique Value Proposition',
    fallbackPages: '1',
    objective: 'One sentence a customer would repeat to a colleague.',
    mustCover: `1. The single-sentence proposition: for whom, what result, unlike what.
2. Why THIS customer cares more than any other about that result.
3. The three claims that support it, each verifiable.
4. The positioning against the two nearest alternatives.
5. The proof each claim rests on.`,
    pitfalls: `A proposition that contains "innovative", "seamless" or "best-in-class" has
said nothing. Name the result, the customer, and the alternative it beats.`,
    blocks: `One "quote" block for the proposition itself, one "cards" block for the
supporting claims, one "table" positioning against the nearest alternatives.`,
  },

  {
    key: 'unfair-advantage',
    name: 'Unfair Advantage',
    fallbackPages: '1',
    objective: 'Name what cannot be copied or bought.',
    mustCover: `1. The advantage, named precisely: it is not "our team" or "our passion".
2. Why a funded competitor could not reproduce it within two years.
3. How it compounds as the business grows.
4. What would erode it, and what protects it.`,
    pitfalls: `Acceptable advantages: proprietary data, exclusive access, network effects,
regulatory position, patents, a distribution channel others cannot enter, a
cost structure others cannot match. If none of these hold, say so. A plan that
admits it competes on execution is more credible than one that invents a moat.`,
    lenses: {
      investor: `This section decides defensibility. An advantage that disappears the moment
a funded competitor shows up is not one: say what still holds after they
arrive.`,
    },
    blocks: `One "prose" block, one "cards" block for each advantage with what protects
it, one "assumption" block where the advantage is expected rather than held.`,
  },

  {
    key: 'business-model',
    name: 'Business Model',
    fallbackPages: '1-2',
    objective: 'Show how money comes in, and what it costs to bring it in.',
    mustCover: `1. Revenue streams: what is sold, to whom, how often.
2. The pricing model and what justifies the level.
3. Unit economics: revenue per customer, cost to serve, gross margin.
4. Acquisition cost and the time it takes to recover it.
5. The cost structure: what is fixed, what scales with volume.
6. How the model improves with scale, or why it does not.`,
    pitfalls: `Unit economics are arithmetic: every figure here must reconcile with the
finance module, in the same currency and the same periods. State the
acquisition cost as a hypothesis when it has never been measured, rather than
quoting a sector benchmark as if it were yours.`,
    lenses: {
      bank: `Contribution margin per unit and the fixed cost base are what matter: they
determine the volume at which the business covers its loan repayment.`,
      investor: `Payback on acquisition cost and the trajectory of gross margin carry this
section. State what gets structurally cheaper at ten times the volume.`,
      grant: `Where the model is not commercial, describe the funding mix instead:
sources, share of each, term, and renewal risk.`,
    },
    blocks: `One "table" for the revenue streams and their pricing, one "metrics" row
for the unit economics (revenue per customer, gross margin, acquisition cost,
payback), one "prose" block for the cost structure, one "assumption" block per
economic driver.`,
  },
];

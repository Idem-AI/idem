/**
 * Sections « LE MARCHÉ » — la partie du plan qui doit être sourcée.
 *
 * Ces sections passent par l'équipe de recherche : leurs chiffres viennent du
 * web, avec une citation par donnée. C'est aussi la famille où une invention
 * coûte le plus cher — un lecteur qui reconnaît un chiffre de marché faux
 * cesse de croire le prévisionnel qui en découle.
 */

import type { SectionPromptSpec } from '../section-prompt.types';

export const MARKET_SECTION_PROMPTS: SectionPromptSpec[] = [
  {
    key: 'problem',
    name: 'Problem Statement',
    fallbackPages: '1-2',
    objective: 'Make the problem impossible to argue with.',
    mustCover: `1. The problem stated as a fact about the world, not about the product.
2. Who suffers it, how often, and what it costs them, in money or in time.
3. How it is handled today, and why that workaround is unsatisfactory.
4. Why it has not been solved yet.
5. What changed recently that makes solving it possible now.`,
    pitfalls: `A problem defined as "there is no good solution" is a description of the
market gap, not of the problem. Quantify the cost of living with it, or the
rest of the plan has nothing to stand on.`,
    lenses: {
      investor: `"Why now" carries this section. A problem that has existed unchanged for
twenty years is a problem nobody pays to solve: name the technological,
regulatory or behavioural shift that opened the window.`,
      grant: `The problem must be stated at the level of the beneficiaries, with a
baseline figure for the territory concerned, not a national average.`,
    },
    blocks: `One "prose" block for the problem, one "metrics" row for its scale (people
affected, cost per occurrence, frequency), one "table" comparing today's
workarounds on cost and effectiveness.`,
  },

  {
    key: 'opportunity',
    name: 'Opportunity',
    fallbackPages: '2-3',
    objective: 'Show a market that is moving, and why now.',
    mustCover: `1. The problem, stated as a fact about the market, with who suffers it.
2. Market context: the trends that are actually documented for this sector.
3. Why now: what changed (technology, regulation, behaviour).
4. Market size: TAM, SAM, SOM, each with its unit, its year and its derivation.
5. Competitive landscape: who is there, and how the market is structured.
6. The differentiation, expressed as a mechanism rather than an adjective.
7. Market entry: which segment first, and why that one.`,
    pitfalls: `A TAM lifted from a global report and applied to one country is the error a
reader catches first. Derive the SAM and the SOM from the TAM and show the
arithmetic; a market size with no derivation is a number nobody can check.`,
    lenses: {
      bank: `Stability matters more than size here. Show that demand existed last year
and will exist next year, and state what happens to this market in a
downturn.`,
      investor: `Size and growth rate carry this section. State the SOM reachable in three
years with the resources being raised, not the theoretical ceiling.`,
    },
    blocks: `One "chart" for the market size or its growth (readingKey states the
conclusion), one "table" for the TAM/SAM/SOM breakdown, one or two "prose"
blocks, one "assumption" block for the sizing derivation.`,
  },

  {
    key: 'market-analysis',
    name: 'Market Analysis',
    fallbackPages: '2-3',
    objective: 'Describe the market as it is, not as the project wishes it were.',
    mustCover: `1. WHICH market: local, regional, national, international. Be specific.
2. How it is evolving: overall volume, turnover, and the direction of travel
   (growth, plateau, decline), with the years the figures come from.
3. The customer base: who buys, how often, at what price point.
4. The players already present, their behaviour and their relative strengths.
5. How the market is structured: concentrated, fragmented, regulated.
6. Barriers to entry, and where this project stands against them.
7. Trends and regulatory changes that will move the market in the plan horizon.`,
    pitfalls: `"The market is growing" without a rate, a period and a source says nothing.
A declining market is not disqualifying and pretending otherwise is: if it is
declining, say so and explain which segment inside it is not.`,
    lenses: {
      bank: `The local market is the one that matters: national statistics are context,
the catchment area is the subject. State the demand within reach of this
business, and the seasonality that affects its cash.`,
      investor: `State the market structure honestly: a fragmented market means slow
consolidation, a concentrated one means an incumbent will respond. Both are
answerable, neither is ignorable.`,
    },
    blocks: `One "chart" for market size or its evolution (the readingKey states the
conclusion), one "table" for the players and their comparative strengths, one
or two "prose" blocks, one "assumption" block for any derived figure.`,
  },

  {
    key: 'target-audience',
    name: 'Target Audience',
    fallbackPages: '1-2',
    objective: 'Describe real people, not segments.',
    mustCover: `1. Two or three personas: name, age, role, what they are trying to do, what
   blocks them today, what the product changes for them.
2. The pain points, ranked by how much they cost the customer.
3. What actually triggers a purchase decision.
4. Segmentation with sizing per segment.
5. The customer journey, from the first contact to the recurring use.
6. Acquisition channels that work for THIS sector, not in general.`,
    pitfalls: `A persona built from demographics alone predicts nothing. What the person is
trying to do, and what stops them, is the part that drives the offer. A
segment with no sizing cannot be prioritised.`,
    lenses: {
      grant: `These are beneficiaries, not customers: state how they are identified, how
they are reached, and how many are within the programme's scope. Vulnerability
criteria, where they apply, belong here.`,
      investor: `Name the beachhead: the segment where the product wins today, with its size
and why it is reachable first. A plan that targets everyone targets nobody.`,
    },
    blocks: `One "cards" block for the personas, one "table" for the segmentation and its
sizing, one "timeline" for the journey, one "prose" block for the triggers.`,
  },

  {
    key: 'competition',
    name: 'Competitive Analysis',
    fallbackPages: '1-2',
    objective: 'Place the project among the ones that already exist.',
    mustCover: `1. Direct competitors: who they are, their size, their offer, their price.
2. Indirect competitors and substitutes, including "doing nothing".
3. Comparison on the axes a BUYER weighs, not the axes that flatter us.
4. Where each competitor is strong, honestly.
5. The gap this project occupies, and why it is defensible.
6. How competitors are likely to react, and the answer to that reaction.`,
    pitfalls: `A comparison table where our column wins every row is read as dishonest and
discredits the section. Concede at least one axis. "We have no competitors"
means the market has not been looked at, or there is no market.`,
    lenses: {
      bank: `Competitors already established are evidence the demand exists. Show how
this business takes its share without a price war it cannot fund.`,
      investor: `The reaction of the best-funded incumbent is the question. State what they
would do, how long it would take them, and what still holds after that.`,
    },
    blocks: `One "table" for the competitive comparison (competitors as rows, buyer
criteria as columns), one "prose" block for the likely reactions, one "cards"
block for the two or three competitors that matter most.`,
  },
];

/**
 * Briefs de CONTENU des slides — mode gabarit.
 *
 * Pourquoi de nouveaux prompts plutôt qu'un découpage des anciens : les prompts
 * historiques mêlent, dans la même phrase, ce que le slide doit DIRE et
 * comment il doit être DESSINÉ — « Brand name: displayed as the dominant hero
 * element using text-5xl font-bold in PRIMARY COLOR ». Le premier reste
 * indispensable, le second est devenu inerte (le rendu s'en charge) et nuisible :
 * un modèle à qui l'on décrit une mise en page qu'il ne produira pas dépense son
 * attention à côté de la question. C'est la même contradiction que la consigne
 * « soyez concis » retirée du point de passage unique.
 *
 * Ces briefs ne disent donc QUE le contenu, dans le vocabulaire de blocs que le
 * gabarit sait rendre. Ils sont volontairement courts : un slide porte une idée.
 *
 * Un brief se compose de deux parties. Le CADRE DE LECTURE dépend du type de
 * deck (`deck-types.ts`) : un analyste crédit et un associé de fonds ouvrent la
 * même slide « Financials » en cherchant deux choses différentes. L'OBJECTIF et
 * le CONTENU attendu, eux, appartiennent à la slide.
 *
 * Les prompts d'origine restent en place pour les slides laissés en génération
 * libre (la couverture) et comme repli si le mode gabarit est coupé.
 */

import type { PitchDeckAudience } from '../deck-types';

/** Cadre de lecture, par destinataire du deck. */
export const DECK_READER_FRAMES: Record<PitchDeckAudience, string> = {
  investor: `You are writing ONE slide of an investor pitch deck.`,

  bank: `You are writing ONE slide of a deck presented to a bank or a microfinance institution to obtain a loan.
The reader is a credit analyst. They look for the repayment capacity, the owners' own stake,
the guarantees and a plan that holds in a bad year — not for a vision or a valuation.`,

  customer: `You are writing ONE slide of a sales presentation shown to a prospective customer.
The reader is a buyer with a budget and a problem. They look for what changes for them, proof
that it works for organisations like theirs, the price and how to start — not for the company's ambitions.`,

  partner: `You are writing ONE slide of a partnership proposal.
The reader decides for another organisation. They look for what each side brings, what their
organisation gains, and how the collaboration runs day to day.`,

  jury: `You are writing ONE slide of a pitch presented to a competition jury, an incubator or a grant committee.
The reader compares many projects in one sitting. They look for the impact, the feasibility,
the team's ability to deliver and exactly what the prize or the grant will pay for.`,
};

/** Ce qu'est un slide, quel que soit son sujet et son lecteur. */
const SLIDE_RULES = `A slide carries ONE idea. Three to five blocks, never more: a slide is read in
twenty seconds, from a distance, by someone who did not ask for it.

- The title states the CONCLUSION, not the topic. "Le marché double d'ici 2028",
  never "Analyse du marché".
- The lede is one sentence, 20 words maximum, that a reader could quote.
- Every figure carries a unit and a period. A figure with no source is noise.
- No sentence that would survive a change of company name.`;

export interface SlideBriefParts {
  objective: string;
  mustCover: string;
}

/** Objectif et contenu attendu de chaque slide sous gabarit. */
export const SLIDE_BRIEF_PARTS: Record<string, SlideBriefParts> = {
  Problem: {
    objective: 'Make the reader feel a problem they had not measured.',
    mustCover: `- The problem, stated as a fact about the world, not about the company.
- Who suffers it, in numbers: how many, where, how often.
- What it costs them today — money, time, or opportunity forgone.
- Why the existing answers do not solve it. One line each, at most three.
Blocks: a "metrics" row of 2-3 figures, one "prose" block, optionally one "quote".`,
  },

  Solution: {
    objective: "Show what the product does, in the reader's terms, not in yours.",
    mustCover: `- One sentence that a non-specialist could repeat correctly.
- The three moves the product makes, and what each one removes from the problem.
- What is genuinely different from the existing answers — a mechanism, not an adjective.
Blocks: one "prose" block, one "cards" block of 3 items with the strongest set to emphasis.`,
  },

  Market: {
    objective: 'Size the opportunity without inflating it.',
    mustCover: `- TAM / SAM / SOM, each with its unit, its year and how it was derived.
- The growth driver: what is changing that makes this market move now.
- The segment attacked first, and why that one.
Blocks: one "chart" (bar or line, with a readingKey that states the conclusion),
one "table" for the TAM/SAM/SOM breakdown, one "assumption" for the derivation.`,
  },

  Product: {
    objective: 'Make the product concrete.',
    mustCover: `- What the user actually does, step by step, in three steps at most.
- The single capability competitors cannot copy quickly, and why.
- Where it stands today: shipped, in beta, in design.
Blocks: one "timeline" of the user journey OR a "cards" block of capabilities,
plus one "prose" block on the state of the build.`,
  },

  'Business Model': {
    objective: 'Explain how money is made, precisely enough to be checked.',
    mustCover: `- Who pays, how much, how often.
- Unit economics: revenue per unit, cost per unit, margin. Real numbers.
- What makes the margin improve with scale — a mechanism, not a hope.
Blocks: one "table" of the pricing or unit economics, one "metrics" row for the
headline margin, one "prose" block on the scaling mechanism.`,
  },

  Traction: {
    objective: 'Show evidence, not intentions.',
    mustCover: `- What has actually happened: users, revenue, partnerships, pilots — with dates.
- The trend, not the total: growth rate over a stated period.
- The proof point a sceptic would ask for.
Blocks: one "chart" of the trend, one "metrics" row of current figures,
optionally one "quote" from a real user or partner.`,
  },

  Competition: {
    objective: 'Position honestly. A slide that shows no credible competitor is not believed.',
    mustCover: `- Three to five real competitors, named.
- The two or three axes on which the comparison actually matters to a buyer.
- Where you lose, and why that is acceptable.
Blocks: one "table" with competitors as rows and axes as columns,
one "prose" block naming your own weakness.`,
  },

  Team: {
    objective: 'Answer one question: why these people, for this problem.',
    mustCover: `- Each founder: what they did before that bears DIRECTLY on this problem.
- The gap in the team, and how it is being filled.
Blocks: one "cards" block, one card per person, plus one "prose" block on the gap.`,
  },

  Financials: {
    objective: 'Project soberly. Numbers that cannot be reconstructed are not read.',
    mustCover: `- Three-year projection: revenue, gross margin, net result.
- The two or three hypotheses that drive the whole model.
- Burn and runway at the current plan.
Blocks: one "chart" (stacked or line) of the projection, one "table" of the
yearly figures, one or two "assumption" blocks for the drivers.`,
  },

  Ask: {
    objective: 'State what is asked and what it buys. Nothing else.',
    mustCover: `- The amount, and the instrument.
- The allocation, in three or four lines, each tied to a milestone.
- What the round takes the company to — a stated, dated position.
Blocks: one "metrics" row for the amount and the runway it buys,
one "table" of the allocation, one "timeline" of the milestones.`,
  },

  // ── Financement bancaire ──────────────────────────────────────────────────
  'Company Overview': {
    objective: 'Establish who the company is, what it does and how solid it already is.',
    mustCover: `- What the company does, in one sentence a non-specialist could repeat.
- Legal form, creation date, location and headcount — the facts a file reviewer checks first.
- The milestones already reached, dated.
Blocks: one "metrics" row of 2-3 facts (founded, team, customers), one "prose" block,
optionally one "timeline" of the milestones.`,
  },

  'Funding Request': {
    objective: 'State the amount requested, what it finances and what the owners contribute themselves.',
    mustCover: `- The amount, the instrument (loan, credit line, lease) and the requested duration.
- What the money finances, line by line, each with its amount. The lines add up to the total.
- The owners' own contribution, in amount and as a share of the total project cost.
Blocks: one "metrics" row for the amount, the duration and the own contribution,
one "table" of the financing plan (uses and resources).`,
  },

  'Repayment Capacity': {
    objective: 'Show that the loan is repaid from the cash the business generates, not from hope.',
    mustCover: `- Projected operating cash flow per year against the annual debt service.
- The coverage ratio (cash available divided by debt service), per year, and the break-even point.
- The downside case: how far revenue can fall before an installment is missed.
Blocks: one "chart" of cash flow against debt service, with a readingKey that states the conclusion,
one "table" of the yearly figures, one "assumption" block for the downside case.`,
  },

  Guarantees: {
    objective: 'List what protects the lender if the plan goes wrong.',
    mustCover: `- The guarantees offered — collateral, personal guarantee, guarantee fund, insurance — each with its value.
- The main risks of the project, and the measure that contains each one.
- What is already committed: signed orders, contracts, grants.
Blocks: one "table" of the guarantees and their value, one "cards" block of risks and mitigations.`,
  },

  // ── Présentation commerciale ──────────────────────────────────────────────
  'Customer Benefits': {
    objective: "Translate the product into what the customer gains, measured in the customer's own units.",
    mustCover: `- The two or three gains that matter to this buyer: money saved, time saved, revenue added, risk removed.
- Each gain quantified, with its unit and the period over which it is obtained.
- The payback period of the purchase.
Blocks: one "metrics" row of the quantified gains, one "prose" block on how they are obtained.`,
  },

  'Case Studies': {
    objective: 'Prove, with real customers, that the result has already been obtained.',
    mustCover: `- One to three real references: who, the situation before, the result after, in figures.
- A short testimonial when one exists. Never an invented name or quote.
- Without customers yet: the pilot, the test or the letter of intent that stands in for them.
Blocks: one "cards" block, one card per reference, optionally one "quote".`,
  },

  Pricing: {
    objective: 'Make the offer easy to choose.',
    mustCover: `- Two or three offers, each with its price, its billing period and what it includes.
- The offer recommended for this kind of customer, and why.
- What it takes to start: setup fee, commitment, trial.
Blocks: one "table" comparing the offers, one "prose" block on the recommended offer.`,
  },

  'Next Steps': {
    objective: 'Turn interest into a decision, with a date.',
    mustCover: `- The concrete next step proposed, who takes it and by when.
- The path from agreement to the first result, in three dated steps at most.
- The person who follows up: name, role and contact details.
Blocks: one "timeline" of the next steps, one "prose" block with the contact.`,
  },

  // ── Partenariat ───────────────────────────────────────────────────────────
  'Partnership Model': {
    objective: 'Describe precisely how the partnership works.',
    mustCover: `- What each party brings: customers, distribution, technology, capital, expertise.
- How value is shared: revenue split, fees, exclusivity, duration.
- How it runs day to day: who decides, who delivers, how results are measured.
Blocks: one "table" of contributions by party, one "cards" block of the operating rules.`,
  },

  'Partner Benefits': {
    objective: "Show the partner what they gain, in their own organisation's terms.",
    mustCover: `- The gains for the partner — new revenue, new customers, costs avoided, reputation — quantified.
- Why now, and what waiting costs the partner.
- The first measurable result, and when it can be expected.
Blocks: one "metrics" row of the partner's gains, one "prose" block on timing.`,
  },

  // ── Concours, incubateur, subvention ──────────────────────────────────────
  Impact: {
    objective: 'Measure the change the project produces beyond its revenue.',
    mustCover: `- The social, economic or environmental outcome, with its indicator and its target value.
- Who benefits, how many, where.
- How the impact is measured and reported, and the Sustainable Development Goals it serves when relevant.
Blocks: one "metrics" row of impact indicators, one "prose" block on the measurement method.`,
  },

  Milestones: {
    objective: 'Show a credible, dated path from today to the next stage.',
    mustCover: `- The milestones already reached, dated.
- The next four to six milestones, each dated and measurable.
- The main dependency or risk on that path.
Blocks: one "timeline" of reached and upcoming milestones, one "prose" block on the main risk.`,
  },

  'Use of Funds': {
    objective: 'Say exactly what the prize, grant or programme will pay for.',
    mustCover: `- The amount sought, and from whom.
- The allocation in three or four lines, each with its amount and the milestone it unlocks.
- What the project will have achieved once the money is spent.
Blocks: one "metrics" row for the amount, one "table" of the allocation, one "prose" block on the outcome.`,
  },
};

/** Brief complet d'une slide pour un destinataire ; `undefined` hors catalogue. */
export function composeSlideBrief(
  name: string,
  audience: PitchDeckAudience = 'investor'
): string | undefined {
  const parts = SLIDE_BRIEF_PARTS[name];
  if (!parts) return undefined;
  return `${DECK_READER_FRAMES[audience]}\n\n${SLIDE_RULES}\n\n<objective>${parts.objective}</objective>\n\n<must_cover>\n${parts.mustCover}\n</must_cover>`;
}

/**
 * Briefs au cadre investisseur, par slide. C'est la référence contrôlée par
 * `npm run check:prompts` ; les cadres des autres destinataires le sont à part.
 */
export const SLIDE_BRIEFS: Record<string, string> = Object.fromEntries(
  Object.keys(SLIDE_BRIEF_PARTS).map((name) => [name, composeSlideBrief(name, 'investor') as string])
);

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
 * Les prompts d'origine restent en place pour les slides laissés en génération
 * libre (la couverture) et comme repli si le mode gabarit est coupé.
 */

/** Cadre commun : ce qu'est un slide, quel que soit son sujet. */
const DECK_FRAME = `You are writing ONE slide of an investor pitch deck.

A slide carries ONE idea. Three to five blocks, never more: a slide is read in
twenty seconds, from a distance, by someone who did not ask for it.

- The title states the CONCLUSION, not the topic. "Le marché double d'ici 2028",
  never "Analyse du marché".
- The lede is one sentence, 20 words maximum, that a reader could quote.
- Every figure carries a unit and a period. A figure with no source is noise.
- No sentence that would survive a change of company name.`;

const brief = (objective: string, mustCover: string): string =>
  `${DECK_FRAME}\n\n<objective>${objective}</objective>\n\n<must_cover>\n${mustCover}\n</must_cover>`;

export const SLIDE_BRIEFS: Record<string, string> = {
  Problem: brief(
    'Make the reader feel a problem they had not measured.',
    `- The problem, stated as a fact about the world, not about the company.
- Who suffers it, in numbers: how many, where, how often.
- What it costs them today — money, time, or opportunity forgone.
- Why the existing answers do not solve it. One line each, at most three.
Blocks: a "metrics" row of 2-3 figures, one "prose" block, optionally one "quote".`
  ),

  Solution: brief(
    'Show what the product does, in the reader\'s terms, not in yours.',
    `- One sentence that a non-specialist could repeat correctly.
- The three moves the product makes, and what each one removes from the problem.
- What is genuinely different from the existing answers — a mechanism, not an adjective.
Blocks: one "prose" block, one "cards" block of 3 items with the strongest set to emphasis.`
  ),

  Market: brief(
    'Size the opportunity without inflating it.',
    `- TAM / SAM / SOM, each with its unit, its year and how it was derived.
- The growth driver: what is changing that makes this market move now.
- The segment attacked first, and why that one.
Blocks: one "chart" (bar or line, with a readingKey that states the conclusion),
one "table" for the TAM/SAM/SOM breakdown, one "assumption" for the derivation.`
  ),

  Product: brief(
    'Make the product concrete.',
    `- What the user actually does, step by step, in three steps at most.
- The single capability competitors cannot copy quickly, and why.
- Where it stands today: shipped, in beta, in design.
Blocks: one "timeline" of the user journey OR a "cards" block of capabilities,
plus one "prose" block on the state of the build.`
  ),

  'Business Model': brief(
    'Explain how money is made, precisely enough to be checked.',
    `- Who pays, how much, how often.
- Unit economics: revenue per unit, cost per unit, margin. Real numbers.
- What makes the margin improve with scale — a mechanism, not a hope.
Blocks: one "table" of the pricing or unit economics, one "metrics" row for the
headline margin, one "prose" block on the scaling mechanism.`
  ),

  Traction: brief(
    'Show evidence, not intentions.',
    `- What has actually happened: users, revenue, partnerships, pilots — with dates.
- The trend, not the total: growth rate over a stated period.
- The proof point a sceptic would ask for.
Blocks: one "chart" of the trend, one "metrics" row of current figures,
optionally one "quote" from a real user or partner.`
  ),

  Competition: brief(
    'Position honestly. A slide that shows no credible competitor is not believed.',
    `- Three to five real competitors, named.
- The two or three axes on which the comparison actually matters to a buyer.
- Where you lose, and why that is acceptable.
Blocks: one "table" with competitors as rows and axes as columns,
one "prose" block naming your own weakness.`
  ),

  Team: brief(
    'Answer one question: why these people, for this problem.',
    `- Each founder: what they did before that bears DIRECTLY on this problem.
- The gap in the team, and how it is being filled.
Blocks: one "cards" block, one card per person, plus one "prose" block on the gap.`
  ),

  Financials: brief(
    'Project soberly. Numbers that cannot be reconstructed are not read.',
    `- Three-year projection: revenue, gross margin, net result.
- The two or three hypotheses that drive the whole model.
- Burn and runway at the current plan.
Blocks: one "chart" (stacked or line) of the projection, one "table" of the
yearly figures, one or two "assumption" blocks for the drivers.`
  ),

  Ask: brief(
    'State what is asked and what it buys. Nothing else.',
    `- The amount, and the instrument.
- The allocation, in three or four lines, each tied to a milestone.
- What the round takes the company to — a stated, dated position.
Blocks: one "metrics" row for the amount and the runway it buys,
one "table" of the allocation, one "timeline" of the milestones.`
  ),
};

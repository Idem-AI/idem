/**
 * Briefs de CONTENU des sections de business plan — mode gabarit.
 *
 * Les prompts historiques (`agent-*.prompt.ts`) consacrent environ les trois
 * quarts de leur volume à la composition : format de page, règles de marque,
 * `<technical_rules>` (« raw HTML + Tailwind on a single minified line »),
 * `<chart_requirements>` (Chart.js, canvas à identifiant unique, animation
 * désactivée), `<editor_compatibility>`. Tout cela est produit par le rendu
 * désormais — et le laisser dans le prompt d'une section dont la sortie est du
 * JSON revient à décrire au modèle un travail qu'il ne fera pas.
 *
 * Ce n'est pas neutre. C'est exactement la contradiction retirée du point de
 * passage unique (la consigne « soyez concis » qui précédait chaque appel) :
 * un modèle arbitre entre consignes contradictoires en suivant la plus
 * explicite, et sur un petit modèle, une consigne inerte prend la place d'une
 * consigne utile.
 *
 * Ne subsiste ici que le `<mandatory_content>` de chaque section — sa vraie
 * valeur — traduit dans le vocabulaire de blocs que le rendu sait produire.
 *
 * Les prompts d'origine restent en place pour la couverture (laissée en
 * génération libre) et comme repli si `IDEM_SECTION_TEMPLATE=off`.
 */

const BP_FRAME = `You are writing ONE section of a business plan that an investor or a bank will read.

- The title states the CONCLUSION, not the topic.
- Every figure carries a unit, a period and how it was obtained. A figure with no
  source is noise, and a reader who catches one stops trusting the others.
- Ground everything in THIS project's country, sector and stage. A paragraph that
  would fit any company in the world is padding.
- Where a number rests on a hypothesis, state the hypothesis with an
  "assumption" block. A plan whose assumptions are visible is read as serious.`;

const brief = (objective: string, mustCover: string, blocks: string): string =>
  `${BP_FRAME}\n\n<objective>${objective}</objective>\n\n<must_cover>\n${mustCover}\n</must_cover>\n\n<suggested_blocks>\n${blocks}\n</suggested_blocks>`;

export const BP_SECTION_BRIEFS: Record<string, string> = {
  'Company Summary': brief(
    "Say who this company is, and why it exists — in terms a stranger can repeat.",
    `1. Mission: what the company does, for whom, concretely. One sentence.
2. Vision: where it intends to be, with a horizon.
3. The founding story: the problem met, and what made it worth solving.
4. Legal form and ownership.
5. Leadership: who, and what each one brings that bears on THIS problem.
6. Four to six values — the ones that would actually change a decision.`,
    `One "prose" block for the mission and the story, one "cards" block for the
leadership (one card per person, the founder set to emphasis), one "cards" or
"table" block for the values, one "metrics" row if the company has figures
worth stating (founded, headcount, markets).`
  ),

  Opportunity: brief(
    'Show a market that is moving, and why now.',
    `1. The problem, stated as a fact about the market, with who suffers it.
2. Market context: the trends that are actually documented for this sector.
3. Why now: what changed — technology, regulation, behaviour.
4. Market size: TAM, SAM, SOM, each with its unit, its year and its derivation.
5. Competitive landscape: who is there, and how the market is structured.
6. The differentiation, expressed as a mechanism rather than an adjective.
7. Market entry: which segment first, and why that one.`,
    `One "chart" for the market size or its growth (readingKey states the
conclusion), one "table" for the TAM/SAM/SOM breakdown, one or two "prose"
blocks, one "assumption" block for the sizing derivation.`
  ),

  'Target Audience': brief(
    'Describe real people, not segments.',
    `1. Two or three personas: name, age, role, what they are trying to do, what
   blocks them today, what the product changes for them.
2. The pain points, ranked by how much they cost the customer.
3. What actually triggers a purchase decision.
4. Segmentation with sizing per segment.
5. The customer journey, from the first contact to the recurring use.
6. Acquisition channels that work for THIS sector, not in general.`,
    `One "cards" block for the personas, one "table" for the segmentation and its
sizing, one "timeline" for the journey, one "prose" block for the triggers.`
  ),

  'Products & Services': brief(
    'Make the offer concrete enough to be bought.',
    `1. The actual offerings, described by what they do for the customer.
2. The features that genuinely differ from the alternatives.
3. The outcome for the customer, stated as a before and an after.
4. Comparison with the alternatives on the axes a buyer cares about.
5. The roadmap, with dates.
6. Pricing: model, levels, and what justifies each level.
7. How the value is delivered and supported after the sale.`,
    `One "table" for the pricing levels, one "cards" block for the offerings (the
main one set to emphasis), one "table" for the competitive comparison, one
"timeline" for the roadmap.`
  ),

  'Marketing & Sales': brief(
    'Explain how a stranger becomes a customer.',
    `1. Positioning and the message that carries it.
2. Acquisition channels, with the cost expected on each.
3. The sales process, adapted to the ticket size (self-serve, inside sales, field).
4. Retention: what makes a customer stay, and what it costs to keep them.
5. The KPIs that will be steered, with their target.
6. Budget allocation across channels.
7. The rollout, in phases with dates.`,
    `One "table" for the channels and their expected cost, one "metrics" row for
the target KPIs, one "timeline" for the rollout, one "prose" block for the
positioning, one "assumption" block for the acquisition cost hypothesis.`
  ),

  'Financial Plan': brief(
    'Project soberly. A model that cannot be reconstructed is not read.',
    `1. The headline figures of the model: revenue, margin, result at year three.
2. Revenue model: streams, prices, volumes.
3. A three-year projection, year by year.
4. Cost structure: variable and fixed, separated.
5. Break-even: when, and at what volume.
6. Funding required, and what it is spent on.
7. The financial risks, and what would absorb them.

⚠️ Where the FINANCE MODULE supplies real data, use it VERBATIM — same figures,
same currency, same years. Contradicting it is the single defect a reader
notices first.`,
    `One "chart" (stacked or line) for the projection, one "table" for the yearly
figures, one "metrics" row for break-even and runway, two or three "assumption"
blocks for the drivers of the model.`
  ),

  'Goal Planning': brief(
    'Turn the plan into dated commitments.',
    `1. Strategic objectives, each one measurable and dated.
2. The milestones that mark them, with their deliverable.
3. The phased timeline.
4. Resources needed per phase: people, budget, tools.
5. The real risks — the ones that would actually stop the plan.
6. The metrics that will say whether it is working.
7. What happens if a milestone is missed.`,
    `One "timeline" for the milestones, one "table" for the resources per phase,
one "metrics" row for the success metrics, one "cards" block for the risks and
their mitigation.`
  ),

  Appendix: brief(
    'Carry the supporting material a reader will want to check.',
    `1. The sources of the figures used in the plan, named and dated.
2. The detailed tables the body of the plan summarised.
3. The glossary of the sector terms used.
4. Any regulatory or legal element that bears on the activity.

Nothing new is introduced here: an appendix that carries an argument means the
argument was missing from the plan.`,
    `One or two "table" blocks, one "prose" block for the sources, optionally one
"assumption" block recalling the hypotheses used throughout.`
  ),
};

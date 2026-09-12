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
    `THE TABLES ARE ALREADY THERE. When the finance module is filled, this section
opens with blocks the SERVER built from the real model: headline figures, the
projection chart, the profit and loss, the project cost, the funding plan and
the return indicators. You are writing AROUND them. Do not restate a table that
is already on the page, and never retype a figure — quote at most the two or
three that carry your argument.

What you must add, in this order:

1. What the model rests on: revenue streams, prices, volumes, and why those
   volumes are reachable in THIS market.
2. The cost structure read as a structure: what is variable, what is fixed, and
   what happens to the result when volume moves.
3. The break-even, stated as a business fact — how many units, how many months,
   which month of which calendar year.
4. THE FUNDING REQUEST. Say the amount, what it buys, and how it is repaid. If
   the finance module reports a funding need, that number opens this paragraph.
   A plan a bank reads without finding this paragraph is a plan a bank declines.
5. The financial risks, each with what would absorb it — a covenant, a reserve,
   a cost that can be cut, a contract that can be renegotiated.

⚠️ ACCOUNTING CALENDAR. The applicable framework and the fiscal-year rule
depend on the COUNTRY, and both are supplied in the FINANCE MODULE context
above — SYSCOHADA and a mandatory calendar year in the seventeen OHADA states,
a freely chosen closing date in Nigeria, Kenya, South Africa, Egypt and others.
Do not assume either one. Use the year labels exactly as the finance module
gives them: a single year ("exercice 2026") where the accounting year follows
the calendar, a span ("exercice 2026-2027") where it does not. Where the
activity starts after the year opens, say so plainly: the first fiscal year is
a SHORT year and its figures are not comparable to a full one.

⚠️ Where the FINANCE MODULE supplies real data, it is the truth. Same figures,
same currency, same years. Contradicting it is the single defect a reader
notices first — and the server-built tables above make any contradiction visible
on the same page.`,
    `Mostly "prose". Add one "assumption" block per driver you rely on (volumes,
price, collection delay, cost of the loan). A "timeline" is welcome for the
funding drawdown and repayment. Do NOT add a projection chart, a profit and loss
table, a project cost table or a funding table: the server already placed them.`
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

/**
 * BRIEFS DES SECTIONS OPTIONNELLES — structures de plan non standard.
 *
 * Le plan n'a plus une seule forme. Une banque impose sa table des matières,
 * un fonds d'amorçage en attend une autre, un bailleur de subvention une
 * troisième. Les sections ci-dessous complètent les neuf historiques pour que
 * chacune de ces formes soit composable SANS improviser un brief au moment de
 * la génération : une section sans brief retomberait sur un prompt de
 * composition, et produirait du HTML là où le gabarit attend du contenu.
 *
 * Elles partagent le même cadre (`BP_FRAME`) et le même vocabulaire de blocs
 * que les neuf premières : c'est ce qui fait qu'un plan « banque » et un plan
 * « VC » se lisent comme deux documents de la même maison.
 */
Object.assign(BP_SECTION_BRIEFS, {
  'Executive Summary': brief(
    'Donner, en deux pages, tout ce qui décide un lecteur pressé.',
    `1. What the company does, for whom, and the result it produces. One sentence.
2. The problem and its scale, with the one figure that makes it real.
3. The offer, and the mechanism that makes it work where others fail.
4. The market: size, growth, and the segment attacked first.
5. The team, and what qualifies THESE people for THIS problem.
6. The headline financials: revenue at horizon, break-even, margin.
7. What is being asked for — amount, use, and what it buys.

This section is written LAST in the reader's mind but read FIRST. Nothing is
introduced here that the plan does not develop later.`,
    `One "prose" block for the concept, one "metrics" row for the headline figures
(market, revenue at horizon, break-even, amount requested), one "cards" block
for the three or four arguments that carry the decision.`
  ),

  'One-Page Summary': brief(
    "Tenir en une page : l'identité de l'entreprise et ce qu'elle demande.",
    `1. General information: legal name, legal form, registration number, date of
   creation, registered address, sector of activity.
2. A synthetic presentation: history, products, creations and developments.
3. The ultimate goal pursued, stated plainly.
4. What is needed to reach it — means, partners, financing.

ONE PAGE. A summary that spills over a second page is no longer a summary, and
this is the page a credit officer photocopies.`,
    `One "table" block for the identity facts (one row per fact), one "prose"
block of three or four short paragraphs for the presentation and the goal.`
  ),

  'Mission & Vision': brief(
    "Dire pourquoi l'organisation existe, et où elle va.",
    `1. The mission: who is served, what changes for them, by what means.
2. The vision, with a horizon and something measurable in it.
3. The values that would actually change a decision — four to six, no more.
4. The principles that govern how the organisation operates day to day.`,
    `One "prose" block for the mission and vision, one "cards" block for the
values (one card per value, with what it forbids as much as what it asks).`
  ),

  'Promoter Profile': brief(
    "Établir la crédibilité de la personne qui porte le projet.",
    `1. Identity, background and qualifications of the promoter.
2. Professional and entrepreneurial experience that bears on THIS activity.
3. Personal contribution to the project: funds, equipment, premises, network.
4. Motivation, and what has already been done at personal risk.
5. Existing commitments and other activities.

A lender reads this section to answer one question: has this person already
done something comparable, and what have they put at stake themselves?`,
    `One "prose" block for the background, one "table" for the personal
contribution (nature, valuation, evidence), one "metrics" row for years of
experience and amount contributed.`
  ),

  'Management & Team': brief(
    'Montrer que les bonnes personnes sont déjà en place.',
    `1. The organisation chart: who reports to whom, and which posts are vacant.
2. Key people: role held, and the experience that qualifies them for it.
3. The decision the team is uniquely equipped to make well.
4. Recruitment plan: which roles, when, at what cost.
5. Advisors, board, and external expertise relied upon.
6. Gaps openly stated — a plan that claims a complete team is not believed.`,
    `One "cards" block for the key people (founder set to emphasis), one "table"
for the recruitment plan (role, timing, cost), one "prose" block for the
governance.`
  ),

  'Legal & Regulatory Framework': brief(
    "Montrer que l'activité est exerçable, légalement, ici.",
    `1. Legal form chosen and why, with its consequences on liability and tax.
2. Ownership and capital structure.
3. Licences, permits and authorisations required for this activity IN THIS
   COUNTRY, with their cost and lead time.
4. Regulations that constrain the offer (sector rules, data, consumer law).
5. Intellectual property held or being filed.
6. Material contracts: lease, supply, distribution, employment.`,
    `One "table" for the licences and permits (requirement, authority, cost,
lead time), one "prose" block for the legal form, one "assumption" block where
a authorisation is expected but not yet obtained.`
  ),

  'Problem Statement': brief(
    'Rendre le problème indiscutable.',
    `1. The problem stated as a fact about the world, not about the product.
2. Who suffers it, how often, and what it costs them — in money or in time.
3. How it is handled today, and why that workaround is unsatisfactory.
4. Why it has not been solved yet.
5. What changed recently that makes solving it possible now.`,
    `One "prose" block for the problem, one "metrics" row for its scale (people
affected, cost per occurrence, frequency), one "table" comparing today's
workarounds on cost and effectiveness.`
  ),

  Solution: brief(
    'Expliquer le mécanisme, pas la promesse.',
    `1. What the solution does, in the order the user experiences it.
2. The mechanism that makes it work — the part a competitor cannot copy by
   reading this page.
3. The before and after, measured.
4. What it deliberately does NOT do.
5. Proof it works: pilot, prototype, early users, technical validation.
6. What remains to be built.`,
    `One "prose" block for the mechanism, one "timeline" for the user journey
through the solution, one "table" for the before/after comparison, one
"assumption" block for anything not yet validated.`
  ),

  'Unique Value Proposition': brief(
    'Une phrase que le client répéterait à un collègue.',
    `1. The single-sentence proposition: for whom, what result, unlike what.
2. Why THIS customer cares more than any other about that result.
3. The three claims that support it, each verifiable.
4. The positioning against the two nearest alternatives.
5. The proof each claim rests on.`,
    `One "quote" block for the proposition itself, one "cards" block for the
supporting claims, one "table" positioning against the nearest alternatives.`
  ),

  'Unfair Advantage': brief(
    "Nommer ce qui ne se copie ni ne s'achète.",
    `1. The advantage, named precisely: it is not "our team" or "our passion".
2. Why a funded competitor could not reproduce it within two years.
3. How it compounds as the business grows.
4. What would erode it, and what protects it.

Acceptable advantages: proprietary data, exclusive access, network effects,
regulatory position, patents, a distribution channel others cannot enter, a
cost structure others cannot match. If none of these hold, say so — a plan that
admits it competes on execution is more credible than one that invents a moat.`,
    `One "prose" block, one "cards" block for each advantage with what protects
it, one "assumption" block where the advantage is expected rather than held.`
  ),

  'Market Analysis': brief(
    'Décrire le marché tel qu’il est, pas tel qu’on le souhaite.',
    `1. WHICH market: local, regional, national, international. Be specific.
2. How it is evolving: overall volume, turnover, and the direction of travel —
   growth, plateau, decline — with the years the figures come from.
3. The customer base: who buys, how often, at what price point.
4. The players already present, their behaviour and their relative strengths.
5. How the market is structured: concentrated, fragmented, regulated.
6. Barriers to entry, and where this project stands against them.
7. Trends and regulatory changes that will move the market in the plan horizon.`,
    `One "chart" for market size or its evolution (the readingKey states the
conclusion), one "table" for the players and their comparative strengths, one
or two "prose" blocks, one "assumption" block for any derived figure.`
  ),

  'Competitive Analysis': brief(
    'Situer le projet parmi ceux qui existent déjà.',
    `1. Direct competitors: who they are, their size, their offer, their price.
2. Indirect competitors and substitutes — including "doing nothing".
3. Comparison on the axes a BUYER weighs, not the axes that flatter us.
4. Where each competitor is strong, honestly.
5. The gap this project occupies, and why it is defensible.
6. How competitors are likely to react, and the answer to that reaction.`,
    `One "table" for the competitive comparison (competitors as rows, buyer
criteria as columns), one "prose" block for the likely reactions, one "cards"
block for the two or three competitors that matter most.`
  ),

  'Business Model': brief(
    "Montrer comment l'argent entre, et ce qu'il coûte de le faire entrer.",
    `1. Revenue streams: what is sold, to whom, how often.
2. The pricing model and what justifies the level.
3. Unit economics: revenue per customer, cost to serve, gross margin.
4. Acquisition cost and the time it takes to recover it.
5. The cost structure: what is fixed, what scales with volume.
6. How the model improves with scale — or why it does not.`,
    `One "table" for the revenue streams and their pricing, one "metrics" row
for the unit economics (ARPU, gross margin, CAC, payback), one "prose" block
for the cost structure, one "assumption" block per economic driver.`
  ),

  'Go-to-Market Strategy': brief(
    'Le premier client, puis les cent suivants.',
    `1. The beachhead segment, and why that one first.
2. How the first customers will actually be reached — named channels, not
   categories.
3. The sales motion appropriate to the ticket size.
4. Partnerships and distribution that shorten the path.
5. The launch sequence, in phases with dates.
6. What each phase costs and what it must prove before the next one starts.`,
    `One "timeline" for the launch phases, one "table" for the channels with
their cost and expected yield, one "metrics" row for the first-phase targets.`
  ),

  'Strategy & Key Milestones': brief(
    'Poser la position visée et les étapes qui y mènent.',
    `1. Targeted market share and the specific customers aimed at first.
2. The positioning of the company: how it will stand apart from competitors,
   stated as a decision rather than an aspiration.
3. A SWOT analysis — strengths, weaknesses, opportunities, threats — where each
   entry is specific enough to be acted on.
4. The strategic choices that follow from it: what is pursued, what is refused.
5. The key stages, dated, each with the condition that triggers the next.`,
    `One "table" for the SWOT (four quadrants, three to five entries each), one
"timeline" for the key stages, one "prose" block for the positioning, one
"metrics" row for the targeted share and customer counts.`
  ),

  'Traction & Proof Points': brief(
    "Prouver que quelque chose fonctionne déjà.",
    `1. What exists today: users, customers, revenue, pilots, letters of intent.
2. The growth curve, with the period and the base it is measured on.
3. Retention and usage — the figures that say whether it sticks.
4. Partnerships, awards, certifications actually obtained.
5. What has been learned and what changed as a result.

If traction is thin, say what it is rather than dress it up: an inflated
traction slide is the fastest way to lose a funder's attention.`,
    `One "chart" for the growth curve, one "metrics" row for the headline
traction figures, one "timeline" for the milestones already reached, one
"prose" block for the learnings.`
  ),

  'Partnerships & Ecosystem': brief(
    "Montrer que le projet ne repose pas sur lui seul.",
    `1. Partners already committed, and what each one actually provides.
2. Partners targeted, with the state of the discussion.
3. What the partnership gives each side — a one-sided partnership does not hold.
4. Suppliers and the dependency they create.
5. Institutional, academic or public actors involved.
6. The risk carried by the most critical dependency, and the alternative.`,
    `One "table" for the partners (name, contribution, status, formalisation),
one "prose" block for the dependency risk, one "cards" block for the two or
three partnerships that change the economics.`
  ),

  'Operational Plan': brief(
    "Décrire les moyens réellement mobilisés pour produire et vendre.",
    `1. Commercial means: sales force, points of sale, distribution, tools.
2. Production means: premises, equipment, capacity, suppliers, lead times.
3. Human means: headcount by function, qualifications, and the payroll charge
   attached — a mean listed without its cost is not a means, it is a wish.
4. The production or service delivery process, step by step.
5. Quality control and after-sales.
6. Capacity limits: what volume the current setup supports before it breaks.`,
    `One "table" for the means and their associated charges (nature, quantity,
annual cost), one "timeline" for the production process, one "metrics" row for
capacity, one "assumption" block for the capacity hypothesis.`
  ),

  'Resources & Assets': brief(
    "Inventorier ce dont l'entreprise dispose déjà.",
    `1. Patents, trademarks, designs — filed or granted, with their number.
2. Assets held outside the operating business that could be mobilised.
3. Particular know-how, and who holds it.
4. Franchises, licences, product partnerships.
5. Own resources and family resources committed to the project.
6. Innovative products or processes not yet exploited.

This section answers a lender's question: what does this project already have
that does not need to be bought?`,
    `One "table" for the assets (nature, holder, valuation, evidence), one
"prose" block for the know-how, one "metrics" row for the total valuation of
what is already held.`
  ),

  'Risk Analysis & Mitigation': brief(
    'Nommer ce qui peut faire échouer le plan, et ce qui absorbe le choc.',
    `1. The risks that would actually stop the plan — market, operational,
   financial, regulatory, human. Not a generic list.
2. For each: likelihood, impact, and the earliest signal it is materialising.
3. The mitigation already in place, and the one that would be activated.
4. The scenario where two risks coincide.
5. Insurance, reserves, covenants, contractual protections.

A plan with no risk section is read as a plan whose author has not looked.`,
    `One "table" for the risk register (risk, likelihood, impact, early signal,
mitigation), one "cards" block for the three risks that matter most, one
"prose" block for the combined scenario.`
  ),

  'Key Metrics & KPIs': brief(
    'Dire à quoi on saura que ça marche.',
    `1. The three to five metrics that actually steer this business.
2. For each: current value, target, horizon, and how it is measured.
3. The leading indicators that move before the results do.
4. The review cadence and who owns each metric.
5. The threshold at which the plan would be revised.`,
    `One "metrics" row for the headline KPIs, one "table" for the full set
(metric, current, target, horizon, owner, measurement), one "prose" block for
the revision thresholds.`
  ),

  'Funding Request & Use of Funds': brief(
    "Demander un montant, et dire exactement ce qu'il achète.",
    `1. THE AMOUNT requested, stated in the first sentence, in the currency of
   the finance module.
2. The form: equity, loan, grant, guarantee, or a combination — with the terms
   expected (rate, duration, grace period, dilution).
3. Use of funds, broken down by line, each line tied to a milestone.
4. The runway the amount buys, and what must be true at the end of it.
5. Repayment or return: schedule for a loan, the path to liquidity for equity.
6. What has already been contributed, and by whom.

⚠️ The amount, currency and years MUST match the finance module exactly. A
funding request that contradicts the financial plan on the same document is the
defect a credit committee catches first.`,
    `One "metrics" row for the amount, the runway and the contribution already
made, one "table" for the use of funds by line with its milestone, one
"timeline" for the drawdown and repayment, one "prose" block for the terms.`
  ),

  'Guarantees & Collateral': brief(
    'Dire ce qui garantit le prêt.',
    `1. Guarantees offered: nature, holder, valuation, and how it was valued.
2. Personal contribution and the share of total need it covers.
3. Guarantee funds, public schemes or mutual guarantee institutions applicable
   in this country, with their coverage rate.
4. Existing commitments and pledges already given elsewhere.
5. Repayment capacity: the ratio the bank will compute, computed here first.
6. What happens to the guarantee as the loan amortises.`,
    `One "table" for the guarantees (nature, valuation, basis, coverage), one
"metrics" row for the coverage ratio and the debt service ratio, one
"assumption" block for each valuation that rests on an estimate.`
  ),

  'Exit Strategy & Investor Returns': brief(
    "Dire comment l'investisseur récupère sa mise.",
    `1. The realistic exit routes for a company of this kind in this market:
   trade sale, secondary, buy-back, dividends, IPO.
2. The horizon, and what the company must look like by then.
3. Comparable transactions in this sector, with their multiples and dates.
4. The return implied for an investor entering now, with the arithmetic shown.
5. The scenario where no exit occurs, and what the investor holds then.

⚠️ Valuation multiples must be sourced or presented explicitly as hypotheses.
An invented multiple invalidates the whole section.`,
    `One "table" for the comparable transactions, one "timeline" for the exit
horizon, one "assumption" block for the multiple used, one "metrics" row for
the implied return.`
  ),

  'Social & Economic Impact': brief(
    "Chiffrer ce que le projet produit au-delà de son résultat.",
    `1. Direct jobs created, by year and by qualification level.
2. Indirect effects on the local economy: suppliers, subcontractors, taxes.
3. The beneficiaries served, and what measurably changes for them.
4. Environmental effect, positive or negative, stated honestly.
5. Contribution to local or national development priorities, named.
6. How each of these will be measured rather than claimed.`,
    `One "metrics" row for jobs and beneficiaries, one "table" for the impact
indicators (indicator, baseline, target, measurement method), one "prose"
block for the local economic effect.`
  ),

  'Theory of Change': brief(
    'Relier les moyens engagés au changement visé, sans saut logique.',
    `1. The problem and its root causes — not its symptoms.
2. Inputs: what is invested.
3. Activities: what is done with it.
4. Outputs: what is produced, countable.
5. Outcomes: what changes for the beneficiaries, measurable.
6. Impact: the long-term change pursued.
7. The assumptions each link rests on — the chain is only as strong as these.`,
    `One "timeline" or "table" laying out inputs → activities → outputs →
outcomes → impact, one "assumption" block per critical link, one "prose" block
for the root-cause analysis.`
  ),

  'Monitoring & Evaluation': brief(
    'Dire comment le résultat sera constaté, par qui, et quand.',
    `1. The indicators tracked, aligned on the outcomes claimed.
2. For each: baseline, target, frequency, source of data, who collects it.
3. The evaluation design: internal review, external evaluation, control group.
4. The reporting calendar and who receives what.
5. How findings feed back into the programme.
6. The budget allocated to measurement — a plan that budgets nothing for M&E
   is not going to do it.`,
    `One "table" for the indicator framework (indicator, baseline, target,
frequency, source, owner), one "timeline" for the reporting calendar, one
"metrics" row for the M&E budget share.`
  ),

  'Sustainability Plan': brief(
    "Montrer que l'activité continue quand le financement s'arrête.",
    `1. The revenue mix today and the dependence it creates on any one funder.
2. The target mix at horizon, and how the shift is achieved.
3. Earned income, cost recovery, or commercial activity being developed.
4. Cost structure and what could be reduced without stopping the mission.
5. Reserves policy and how many months of operation they cover.
6. The scenario where the main funder withdraws, and the response.`,
    `One "chart" for the revenue mix today versus at horizon, one "table" for
the funding sources (source, amount, term, renewal risk), one "metrics" row for
months of reserves, one "assumption" block for the diversification hypothesis.`
  ),
});

/**
 * Sections « L'EXPLOITATION » — les moyens, les jalons, les risques.
 *
 * Ce sont les sections que les plans généraux escamotent et que les dossiers
 * bancaires lisent le plus attentivement : un moyen listé sans son coût n'est
 * pas un moyen, c'est un souhait.
 */

import type { SectionPromptSpec } from '../section-prompt.types';

export const OPERATIONS_SECTION_PROMPTS: SectionPromptSpec[] = [
  {
    key: 'operations-plan',
    name: 'Operational Plan',
    fallbackPages: '2',
    objective: 'Describe the means actually mobilised to produce and to sell.',
    mustCover: `1. Commercial means: sales force, points of sale, distribution, tools.
2. Production means: premises, equipment, capacity, suppliers, lead times.
3. Human means: headcount by function, qualifications, and the payroll charge
   attached.
4. The production or service delivery process, step by step.
5. Quality control and after-sales.
6. Capacity limits: what volume the current setup supports before it breaks.`,
    pitfalls: `Every means carries its cost, and that cost must appear in the financial
plan at the same amount. Capacity is a number: state the volume the setup
supports, and what the next increment of capacity costs.`,
    lenses: {
      bank: `This section justifies the investment being financed: each item of
equipment, its price, its supplier, and the quote it comes from. A financing
request for equipment that is not described here has nothing behind it.`,
    },
    blocks: `One "table" for the means and their associated charges (nature, quantity,
annual cost), one "timeline" for the production process, one "metrics" row for
capacity, one "assumption" block for the capacity hypothesis.`,
  },

  {
    key: 'resources-assets',
    name: 'Resources & Assets',
    fallbackPages: '1',
    objective: 'Inventory what the business already has.',
    mustCover: `1. Patents, trademarks, designs: filed or granted, with their number.
2. Assets held outside the operating business that could be mobilised.
3. Particular know-how, and who holds it.
4. Franchises, licences, product partnerships.
5. Own resources and family resources committed to the project.
6. Innovative products or processes not yet exploited.`,
    pitfalls: `This section answers one question: what does this project already have that
does not need to be bought? Each item needs a valuation and the evidence
behind it, or it counts for nothing in the file.`,
    lenses: {
      bank: `Anything listed here may be offered as security: state for each asset
whether it is already pledged elsewhere.`,
    },
    blocks: `One "table" for the assets (nature, holder, valuation, evidence), one
"prose" block for the know-how, one "metrics" row for the total valuation of
what is already held.`,
  },

  {
    key: 'goal-planning',
    name: 'Goal Planning',
    fallbackPages: '2',
    objective: 'Turn the plan into dated commitments.',
    mustCover: `1. Strategic objectives, each one measurable and dated.
2. The milestones that mark them, with their deliverable.
3. The phased timeline.
4. Resources needed per phase: people, budget, tools.
5. The real risks: the ones that would actually stop the plan.
6. The metrics that will say whether it is working.
7. What happens if a milestone is missed.`,
    pitfalls: `An objective with no date and no measure is an intention. The paragraph on
what happens when a milestone is missed is the one that distinguishes a plan
from a wish list.`,
    blocks: `One "timeline" for the milestones, one "table" for the resources per phase,
one "metrics" row for the success metrics, one "cards" block for the risks and
their mitigation.`,
  },

  {
    key: 'kpi-metrics',
    name: 'Key Metrics & KPIs',
    fallbackPages: '1',
    objective: 'Say how anyone will know whether it is working.',
    mustCover: `1. The three to five metrics that actually steer this business.
2. For each: current value, target, horizon, and how it is measured.
3. The leading indicators that move before the results do.
4. The review cadence and who owns each metric.
5. The threshold at which the plan would be revised.`,
    pitfalls: `Twenty indicators means none is steered. Keep five at most, and prefer the
ones that move before revenue does.`,
    blocks: `One "metrics" row for the headline KPIs, one "table" for the full set
(metric, current, target, horizon, owner, measurement), one "prose" block for
the revision thresholds.`,
  },

  {
    key: 'risk-analysis',
    name: 'Risk Analysis & Mitigation',
    fallbackPages: '1-2',
    objective: 'Name what could stop the plan, and what absorbs the shock.',
    mustCover: `1. The risks that would actually stop the plan: market, operational,
   financial, regulatory, human. Not a generic list.
2. For each: likelihood, impact, and the earliest signal it is materialising.
3. The mitigation already in place, and the one that would be activated.
4. The scenario where two risks coincide.
5. Insurance, reserves, covenants, contractual protections.`,
    pitfalls: `A plan with no risk section is read as a plan whose author has not looked. A
risk register of generic entries ("competition", "economic conditions") reads
the same way. Name the specific event, for this business, in this country.`,
    lenses: {
      bank: `Add the scenario the committee will construct anyway: revenue twenty per
cent below plan for a full year. State whether the business still services its
debt in that case, and what is cut first if it does not.`,
    },
    blocks: `One "table" for the risk register (risk, likelihood, impact, early signal,
mitigation), one "cards" block for the three risks that matter most, one
"prose" block for the combined scenario.`,
  },
];

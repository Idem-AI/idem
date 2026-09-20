/**
 * Sections « L'IMPACT » — ce que le projet produit au-delà de son résultat.
 *
 * Elles servent surtout les dossiers de subvention et de microfinance, où
 * l'impact n'est pas un supplément mais le critère d'attribution. Leur défaut
 * habituel : un impact affirmé et jamais mesuré. Chaque affirmation demande
 * donc une valeur de départ, une cible et une méthode de collecte.
 */

import type { SectionPromptSpec } from '../section-prompt.types';

export const IMPACT_SECTION_PROMPTS: SectionPromptSpec[] = [
  {
    key: 'theory-of-change',
    name: 'Theory of Change',
    fallbackPages: '1-2',
    objective: 'Connect the means committed to the change pursued, without a leap.',
    mustCover: `1. The problem and its root causes, not its symptoms.
2. Inputs: what is invested.
3. Activities: what is done with it.
4. Outputs: what is produced, countable.
5. Outcomes: what changes for the beneficiaries, measurable.
6. Impact: the long-term change pursued.
7. The assumptions each link rests on.`,
    pitfalls: `The chain is only as strong as its assumptions, and the weakest link is
usually between outputs and outcomes: producing trainings is not the same as
people finding work. Name that assumption rather than stepping over it.`,
    blocks: `One "timeline" or "table" laying out inputs, activities, outputs, outcomes
and impact in order, one "assumption" block per critical link, one "prose"
block for the root-cause analysis.`,
  },

  {
    key: 'impact',
    name: 'Social & Economic Impact',
    fallbackPages: '1',
    objective: 'Quantify what the project produces beyond its own result.',
    mustCover: `1. Direct jobs created, by year and by qualification level.
2. Indirect effects on the local economy: suppliers, subcontractors, taxes.
3. The beneficiaries served, and what measurably changes for them.
4. Environmental effect, positive or negative, stated honestly.
5. Contribution to local or national development priorities, named.
6. How each of these will be measured rather than claimed.`,
    pitfalls: `Job counts must match the payroll in the financial plan. An environmental
section that reports only positives is not read as honest: name the negative
effect and what limits it.`,
    lenses: {
      bank: `Jobs created and taxes generated are what public guarantee schemes and
subsidised lines are assessed on: state them by year, with the qualification
level attached.`,
    },
    blocks: `One "metrics" row for jobs and beneficiaries, one "table" for the impact
indicators (indicator, baseline, target, measurement method), one "prose"
block for the local economic effect.`,
  },

  {
    key: 'monitoring-evaluation',
    name: 'Monitoring & Evaluation',
    fallbackPages: '1',
    objective: 'Say how the result will be established, by whom, and when.',
    mustCover: `1. The indicators tracked, aligned on the outcomes claimed.
2. For each: baseline, target, frequency, source of data, who collects it.
3. The evaluation design: internal review, external evaluation, control group.
4. The reporting calendar and who receives what.
5. How findings feed back into the programme.
6. The budget allocated to measurement.`,
    pitfalls: `A plan that budgets nothing for measurement is not going to measure. An
indicator with no baseline cannot show progress, and a baseline that does not
exist yet must be stated as a first activity rather than invented.`,
    blocks: `One "table" for the indicator framework (indicator, baseline, target,
frequency, source, owner), one "timeline" for the reporting calendar, one
"metrics" row for the measurement budget share.`,
  },

  {
    key: 'sustainability',
    name: 'Sustainability Plan',
    fallbackPages: '1',
    objective: 'Show that the activity continues when the funding stops.',
    mustCover: `1. The revenue mix today and the dependence it creates on any one funder.
2. The target mix at horizon, and how the shift is achieved.
3. Earned income, cost recovery, or commercial activity being developed.
4. Cost structure and what could be reduced without stopping the mission.
5. Reserves policy and how many months of operation they cover.
6. The scenario where the main funder withdraws, and the response.`,
    pitfalls: `"We will diversify our funding" is not a plan. Name the sources being
pursued, the amounts, and the date each one is expected to close.`,
    blocks: `One "chart" for the revenue mix today against the mix at horizon, one
"table" for the funding sources (source, amount, term, renewal risk), one
"metrics" row for months of reserves, one "assumption" block for the
diversification hypothesis.`,
  },
];

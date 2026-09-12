/**
 * Sections « LA STRATÉGIE » — comment on va de zéro à des clients.
 *
 * Ce sont les sections qu'un lecteur pressé teste en premier : elles sont
 * faciles à remplir de généralités, donc leur qualité dit beaucoup du reste du
 * document. Un canal nommé avec son coût attendu vaut trois paragraphes sur
 * une « stratégie multicanale ».
 */

import type { SectionPromptSpec } from '../section-prompt.types';

export const STRATEGY_SECTION_PROMPTS: SectionPromptSpec[] = [
  {
    key: 'strategy-milestones',
    name: 'Strategy & Key Milestones',
    fallbackPages: '2',
    objective: 'Set the position aimed at, and the stages that lead to it.',
    mustCover: `1. Targeted market share and the specific customers aimed at first.
2. The positioning of the company: how it will stand apart from competitors,
   stated as a decision rather than an aspiration.
3. A SWOT analysis (strengths, weaknesses, opportunities, threats) where each
   entry is specific enough to be acted on.
4. The strategic choices that follow from it: what is pursued, what is refused.
5. The key stages, dated, each with the condition that triggers the next.`,
    pitfalls: `A SWOT whose weaknesses are disguised strengths ("we grow too fast") is worse
than no SWOT. Each quadrant needs entries a reader could disagree with, and
each weakness needs the action that addresses it.`,
    lenses: {
      bank: `The stages matter more than the positioning: each one must carry the
condition that justifies moving to the next, and the spending it unlocks.`,
    },
    blocks: `One "table" for the SWOT (four quadrants, three to five entries each), one
"timeline" for the key stages, one "prose" block for the positioning, one
"metrics" row for the targeted share and customer counts.`,
  },

  {
    key: 'marketing-sales',
    name: 'Marketing & Sales',
    fallbackPages: '2',
    objective: 'Explain how a stranger becomes a customer.',
    mustCover: `1. Positioning and the message that carries it.
2. Acquisition channels, with the cost expected on each.
3. The sales process, adapted to the ticket size (self-serve, inside sales, field).
4. Retention: what makes a customer stay, and what it costs to keep them.
5. The KPIs that will be steered, with their target.
6. Budget allocation across channels.
7. The rollout, in phases with dates.`,
    pitfalls: `"Social media, SEO and partnerships" is a list of categories, not a plan.
Name the specific channels this sector actually converts on, and state the
expected cost per acquisition on each one as a hypothesis.`,
    lenses: {
      bank: `The marketing budget must appear in the cost structure of the financial
plan, at the same amount. A commercial plan that costs nothing in the
projection is a projection that is wrong.`,
      grant: `Read as outreach rather than sales: how beneficiaries learn the programme
exists, who relays it locally, and what it costs to reach the hardest to
reach.`,
    },
    blocks: `One "table" for the channels and their expected cost, one "metrics" row for
the target KPIs, one "timeline" for the rollout, one "prose" block for the
positioning, one "assumption" block for the acquisition cost hypothesis.`,
  },

  {
    key: 'go-to-market',
    name: 'Go-to-Market Strategy',
    fallbackPages: '1-2',
    objective: 'The first customer, then the next hundred.',
    mustCover: `1. The beachhead segment, and why that one first.
2. How the first customers will actually be reached: named channels, not
   categories.
3. The sales motion appropriate to the ticket size.
4. Partnerships and distribution that shorten the path.
5. The launch sequence, in phases with dates.
6. What each phase costs and what it must prove before the next one starts.`,
    pitfalls: `The first ten customers are reached differently from the next thousand. A
plan that describes only the scalable channel has skipped the part that is
actually hard.`,
    blocks: `One "timeline" for the launch phases, one "table" for the channels with
their cost and expected yield, one "metrics" row for the first-phase targets.`,
  },

  {
    key: 'traction',
    name: 'Traction & Proof Points',
    fallbackPages: '1',
    objective: 'Prove that something already works.',
    mustCover: `1. What exists today: users, customers, revenue, pilots, letters of intent.
2. The growth curve, with the period and the base it is measured on.
3. Retention and usage: the figures that say whether it sticks.
4. Partnerships, awards, certifications actually obtained.
5. What has been learned and what changed as a result.`,
    pitfalls: `Percentages on a small base ("300% growth" from two customers to six) are
read as an attempt to hide the base. Give the absolute numbers first. If
traction is thin, say what it is: an inflated traction section is the fastest
way to lose a funder's attention.`,
    lenses: {
      investor: `Retention is the figure that decides this section. Growth with no retention
is a leaking bucket, and an investor reads it that way.`,
    },
    blocks: `One "chart" for the growth curve, one "metrics" row for the headline
traction figures, one "timeline" for the milestones already reached, one
"prose" block for the learnings.`,
  },

  {
    key: 'partnerships',
    name: 'Partnerships & Ecosystem',
    fallbackPages: '1',
    objective: 'Show that the project does not rest on itself alone.',
    mustCover: `1. Partners already committed, and what each one actually provides.
2. Partners targeted, with the state of the discussion.
3. What the partnership gives each side: a one-sided partnership does not hold.
4. Suppliers and the dependency they create.
5. Institutional, academic or public actors involved.
6. The risk carried by the most critical dependency, and the alternative.`,
    pitfalls: `Logos are not partnerships. State for each one whether it is signed, under
discussion or merely identified, and what it delivers concretely.`,
    lenses: {
      grant: `Letters of support and signed agreements are what is assessed here: name
the document, its date, and the commitment it carries.`,
      bank: `Supplier dependency is the subject: a single supplier with no alternative is
a risk the file must price, not hide.`,
    },
    blocks: `One "table" for the partners (name, contribution, status, formalisation),
one "prose" block for the dependency risk, one "cards" block for the two or
three partnerships that change the economics.`,
  },
];

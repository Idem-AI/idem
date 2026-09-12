/**
 * Sections « L'ENTREPRISE » — qui porte le projet, et sous quel régime.
 *
 * C'est la famille où le public change le plus le contenu. Une banque lit ces
 * pages pour évaluer une personne et un engagement ; un fonds les lit pour
 * savoir si cette équipe précise gagne ce problème précis ; un bailleur y
 * cherche la capacité de l'organisation à délivrer ce qu'elle décrit.
 */

import type { SectionPromptSpec } from '../section-prompt.types';

export const COMPANY_SECTION_PROMPTS: SectionPromptSpec[] = [
  {
    key: 'company-summary',
    name: 'Company Summary',
    fallbackPages: '2',
    objective:
      'Say who this company is, and why it exists, in terms a stranger can repeat.',
    mustCover: `1. Mission: what the company does, for whom, concretely. One sentence.
2. Vision: where it intends to be, with a horizon.
3. The founding story: the problem met, and what made it worth solving.
4. Legal form and ownership.
5. Leadership: who, and what each one brings that bears on THIS problem.
6. Four to six values: the ones that would actually change a decision.`,
    pitfalls: `A founding story is a fact, not a legend. If nothing specific happened, say
what the founders saw rather than inventing a moment. Values that could
belong to any company ("excellence", "innovation") are worse than none.`,
    lenses: {
      bank: `Legal form, capital and ownership are not background here: they determine
who is liable. State them precisely, with the share held by each party.`,
      investor: `The founding story earns its place only if it explains why this team saw
this problem before others did. Otherwise cut it and spend the space on the
leadership.`,
    },
    blocks: `One "prose" block for the mission and the story, one "cards" block for the
leadership (one card per person, the founder set to emphasis), one "cards" or
"table" block for the values, one "metrics" row if the company has figures
worth stating (founded, headcount, markets).`,
  },

  {
    key: 'mission-vision',
    name: 'Mission & Vision',
    fallbackPages: '1-2',
    objective: 'State why the organisation exists, and where it is going.',
    mustCover: `1. The mission: who is served, what changes for them, by what means.
2. The vision, with a horizon and something measurable in it.
3. Four to six values: the ones that would actually change a decision.
4. The principles that govern how the organisation operates day to day.`,
    pitfalls: `A vision with no horizon and no measure is a slogan. A value is only real if
you can name a decision it would forbid.`,
    lenses: {
      grant: `The mission must name the beneficiaries and the change, in the same
sentence. A mission stated as an intention ("to help...") without saying who
and what changes cannot be evaluated.`,
    },
    blocks: `One "prose" block for the mission and vision, one "cards" block for the
values (one card per value, stating what it forbids as much as what it asks).`,
  },

  {
    key: 'promoter-profile',
    name: 'Promoter Profile',
    fallbackPages: '1-2',
    objective: 'Establish the credibility of the person carrying the project.',
    mustCover: `1. Identity, background and qualifications of the promoter.
2. Professional and entrepreneurial experience that bears on THIS activity.
3. Personal contribution to the project: funds, equipment, premises, network.
4. Motivation, and what has already been done at personal risk.
5. Existing commitments and other activities.`,
    pitfalls: `A lender reads this section to answer one question: has this person already
done something comparable, and what have they put at stake themselves? An
experience that does not bear on this activity is filler. Say plainly where
the experience is missing and who fills the gap.`,
    lenses: {
      bank: `The personal contribution is the figure this section exists for: state the
amount, its nature, and how it was valued. A promoter who contributes nothing
must say so and explain what replaces it.`,
    },
    blocks: `One "prose" block for the background, one "table" for the personal
contribution (nature, valuation, evidence), one "metrics" row for years of
experience and amount contributed.`,
  },

  {
    key: 'management-team',
    name: 'Management & Team',
    fallbackPages: '1-2',
    objective: 'Show that the right people are already in place.',
    mustCover: `1. The organisation chart: who reports to whom, and which posts are vacant.
2. Key people: role held, and the experience that qualifies them for it.
3. The decision the team is uniquely equipped to make well.
4. Recruitment plan: which roles, when, at what cost.
5. Advisors, board, and external expertise relied upon.
6. Gaps openly stated: a plan that claims a complete team is not believed.`,
    pitfalls: `Listing titles is not describing a team. Each person needs one fact that
bears on this business, and the roles nobody holds yet must be named.`,
    lenses: {
      bank: `Continuity is the concern: what happens to the business if the promoter is
unavailable for three months. Name the second signature and the delegation.`,
      investor: `Founder-problem fit carries this section. For each founder, state the
specific experience that makes them the right person for THIS problem, and
name the role that is missing today.`,
      grant: `Delivery capacity is what is assessed: staff actually assigned to the
programme, their time allocation, and the governance body that oversees them.`,
    },
    blocks: `One "cards" block for the key people (founder set to emphasis), one "table"
for the recruitment plan (role, timing, cost), one "prose" block for the
governance.`,
  },

  {
    key: 'legal-regulatory',
    name: 'Legal & Regulatory Framework',
    fallbackPages: '1-2',
    objective: 'Show that the activity can legally be carried out, here, now.',
    mustCover: `1. Legal form chosen and why, with its consequences on liability and tax.
2. Ownership and capital structure.
3. Licences, permits and authorisations required for this activity IN THIS
   COUNTRY, with their cost and lead time.
4. Regulations that constrain the offer (sector rules, data, consumer law).
5. Intellectual property held or being filed.
6. Material contracts: lease, supply, distribution, employment.`,
    pitfalls: `Regulation is national. A generic paragraph about compliance is worthless:
name the authority, the instrument and the delay. An authorisation not yet
obtained is stated as pending, with the date it was applied for.`,
    lenses: {
      bank: `An activity operating without a required authorisation is a reason to
decline. State for each one whether it is held, pending or not yet applied
for, and what the business does in the meantime.`,
    },
    blocks: `One "table" for the licences and permits (requirement, authority, cost,
lead time), one "prose" block for the legal form, one "assumption" block where
an authorisation is expected but not yet obtained.`,
  },
];

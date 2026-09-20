/**
 * LENTILLES DE LECTURE — ce que chaque destinataire cherche réellement.
 *
 * Un plan n'a pas un lecteur générique. Un analyste crédit cherche une capacité
 * de remboursement et se méfie de la croissance ; un associé de fonds cherche
 * exactement l'inverse, et une prudence excessive lui dit que le projet n'a pas
 * d'ambition. Un bailleur de subvention ne cherche ni l'une ni l'autre : il
 * cherche un changement mesurable chez des bénéficiaires nommés.
 *
 * Écrire une seule consigne pour les trois revient à en décevoir deux. Ces
 * lentilles sont posées EN TÊTE de chaque consigne de section, avant même
 * l'objectif : elles décident de ce qui compte, l'objectif décide de ce qui est
 * couvert.
 *
 * Elles sont volontairement COURTES. Une lentille qui décrit longuement une
 * psychologie de lecteur se dilue ; celles-ci nomment ce que le lecteur cherche,
 * ce qui le fait refuser, et l'unité dans laquelle il raisonne.
 */

import type { BusinessPlanAudience } from '../structure/audience.types';

/**
 * FORME VOLONTAIRE : des lignes étiquetées, pas des puces.
 *
 * `npm run check:prompts` plafonne une consigne de section à seize exigences,
 * comptées sur les puces et les points numérotés. C'est une règle utile — un
 * petit modèle en honore une dizaine, au-delà il en ignore sans le dire — et
 * une lentille en cinq puces consommait à elle seule un tiers du budget avant
 * que la section ait demandé quoi que ce soit. Étiqueter au lieu de pucer rend
 * le même contenu sans prendre la place des consignes qui portent le travail.
 */
export const AUDIENCE_LENSES: Record<BusinessPlanAudience, string> = {
  bank: `The reader is a credit analyst preparing a file for a lending committee.

LOOKING FOR — the ability to repay, month after month, under the contract being
asked for. Everything else is context around that question.

REFUSES ON — a projection with no downside case, a figure that contradicts
another figure in the same document, a missing amount, a personal contribution
that is never stated, an activity that needs a licence nobody mentions.

REASONS IN — cash, not value. Monthly, not annually. Coverage ratios,
collateral and worst-case survival, not growth multiples.

TRUSTS — a promoter who has already done something comparable, signed
contracts, a market that existed last year, costs that are named.

TONE — sober. Enthusiasm reads as inexperience in this file. State the risk
before they find it, and state what absorbs it.`,

  investor: `The reader is a partner at an early-stage fund, reading this between two other files.

LOOKING FOR — whether this can become large, fast, and stay defensible once it
does. A sound business that stays small is a decline.

REFUSES ON — a market too small to matter, an advantage anyone funded could
copy in a year, traction dressed up, a team with no specific reason to win this
particular problem, financials with no path to the numbers they claim.

REASONS IN — unit economics and compounding. Cost to acquire a customer against
what that customer is worth. What gets easier at ten times the scale.

TRUSTS — evidence over argument. One real cohort beats ten pages of market
study. Say what is proven, what is being tested, and what is a bet.

TONE — direct and quantified. Cut the hedging: a plan that never commits to a
number reads as a plan whose author has not done the work.`,

  grant: `The reader assesses grant applications for a funder, foundation or public programme.

LOOKING FOR — a measurable change for named beneficiaries, and the logical
chain connecting the money to that change without a leap.

REFUSES ON — beneficiaries described as a category rather than people, impact
claimed but never measured, a budget that funds the structure more than the
programme, no answer to what happens when the grant ends, duplication of
something already funded locally.

REASONS IN — inputs, activities, outputs, outcomes. Cost per beneficiary.
Whether the organisation can actually deliver what it describes.

TRUSTS — a baseline, an indicator with a collection method, a partner who has
signed, and an honest account of what did not work before.

TONE — precise and accountable. Advocacy without evidence weakens the file.`,

  internal: `The reader is the leadership team that will execute this plan, not fund it.

LOOKING FOR — the decisions to make, the resources to commit, and the
thresholds at which the plan gets revised.

REFUSES ON — selling. There is nobody to convince here. A section that argues
instead of deciding wastes the only readers who could act on it.

REASONS IN — arbitrages. What is chosen, what is deliberately refused, what it
costs, who owns it, by when.

TRUSTS — named owners, dated milestones, and a metric per objective.

TONE — plain and operational. Write it as the document the team will reopen in
six months to check whether it was right.`,

  general: `The reader may be a lender, an investor, a partner or an advisor: the plan has to hold up for all of them.

LOOKING FOR — that the business makes sense, that the numbers hold together,
and that the person behind it has thought it through.

REFUSES ON — contradictions between sections, generic paragraphs that would fit
any company, and figures with no origin.

REASONS IN — the weakest claim. Whatever is least supported is what the whole
document is judged on.

TRUSTS — specificity. The local detail, the named competitor, the actual price,
the real constraint.

TONE — balanced. Ambitious about the opportunity, conservative about the
numbers.`,
};

/** Lentille du destinataire, avec repli sur la lecture polyvalente. */
export const audienceLens = (audience: BusinessPlanAudience): string =>
  AUDIENCE_LENSES[audience] ?? AUDIENCE_LENSES.general;

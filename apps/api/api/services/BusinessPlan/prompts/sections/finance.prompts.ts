/**
 * Sections « LES FINANCES » — la partie où une contradiction se voit.
 *
 * Les tableaux sont POSÉS par le serveur à partir du module Finance : le modèle
 * écrit autour d'eux. C'est la seule disposition qui empêche un chiffre d'être
 * altéré en transitant par plusieurs milliers de mots, et c'est le défaut qu'un
 * lecteur de plan repère en premier.
 */

import type { SectionPromptSpec } from '../section-prompt.types';

export const FINANCE_SECTION_PROMPTS: SectionPromptSpec[] = [
  {
    key: 'financial-plan',
    name: 'Financial Plan',
    fallbackPages: '2-3',
    objective: 'Project soberly. A model that cannot be reconstructed is not read.',
    mustCover: `THE TABLES ARE ALREADY THERE. When the finance module is filled, this section
opens with blocks the SERVER built from the real model: headline figures, the
projection chart, the profit and loss, the project cost, the funding plan and
the return indicators. You are writing AROUND them. Do not restate a table that
is already on the page, and never retype a figure: quote at most the two or
three that carry your argument.

What you must add, in this order:

1. What the model rests on: revenue streams, prices, volumes, and why those
   volumes are reachable in THIS market.
2. The cost structure read as a structure: what is variable, what is fixed, and
   what happens to the result when volume moves.
3. The break-even, stated as a business fact: how many units, how many months,
   which month of which calendar year.
4. THE FUNDING REQUEST. Say the amount, what it buys, and how it is repaid. If
   the finance module reports a funding need, that number opens this paragraph.
   A plan a bank reads without finding this paragraph is a plan a bank declines.
5. The financial risks, each with what would absorb it: a covenant, a reserve,
   a cost that can be cut, a contract that can be renegotiated.`,
    pitfalls: `⚠️ ACCOUNTING CALENDAR. The applicable framework and the fiscal-year rule
depend on the COUNTRY, and both are supplied in the FINANCE MODULE context
below: SYSCOHADA and a mandatory calendar year in the seventeen OHADA states,
a freely chosen closing date in Nigeria, Kenya, South Africa, Egypt and others.
Do not assume either one. Use the year labels exactly as the finance module
gives them: a single year ("exercice 2026") where the accounting year follows
the calendar, a span ("exercice 2026-2027") where it does not. Where the
activity starts after the year opens, say so plainly: the first fiscal year is
a SHORT year and its figures are not comparable to a full one.

⚠️ Where the FINANCE MODULE supplies real data, it is the truth. Same figures,
same currency, same years. Contradicting it is the single defect a reader
notices first, and the server-built tables above make any contradiction visible
on the same page.`,
    lenses: {
      bank: `Cash is the subject, not profit. Add the monthly cash position over the
first twelve to eighteen months, the debt service against it, and the month
where the balance is lowest. State the coverage ratio before the committee
computes it. A downside case at twenty per cent below plan is expected here,
not optional.`,
      investor: `Burn and runway carry this section: monthly burn today, months of runway
after this round, and the milestone the round must reach before the next one.
State gross margin trajectory rather than a single average.`,
      grant: `Present the budget by programme line rather than by accounting nature:
what each line delivers, the cost per beneficiary, and the share of total cost
covered by this request against co-financing already secured.`,
    },
    blocks: `Mostly "prose". Add one "assumption" block per driver you rely on (volumes,
price, collection delay, cost of the loan). A "timeline" is welcome for the
funding drawdown and repayment. Do NOT add a projection chart, a profit and loss
table, a project cost table or a funding table: the server already placed them.`,
  },

  {
    key: 'funding-request',
    name: 'Funding Request & Use of Funds',
    fallbackPages: '1',
    objective: 'Ask for an amount, and say exactly what it buys.',
    mustCover: `1. THE AMOUNT requested, stated in the first sentence, in the currency of
   the finance module.
2. The form: equity, loan, grant, guarantee, or a combination, with the terms
   expected (rate, duration, grace period, dilution).
3. Use of funds, broken down by line, each line tied to a milestone.
4. The runway the amount buys, and what must be true at the end of it.
5. Repayment or return: schedule for a loan, the path to liquidity for equity.
6. What has already been contributed, and by whom.`,
    pitfalls: `⚠️ The amount, currency and years MUST match the finance module exactly. A
funding request that contradicts the financial plan on the same document is the
defect a credit committee catches first. A use of funds that lists categories
("marketing, operations, other") without amounts and milestones is not a use of
funds.`,
    lenses: {
      bank: `State the requested duration, the grace period and the repayment schedule,
and show that the projected cash covers each instalment. Name the personal
contribution as a percentage of total need: a request with no contribution
needs an explicit explanation.`,
      investor: `State the round size, the instrument, and what the round is expected to
prove. Post-money expectations belong here only if the founders have a
position; an invented valuation is worse than none.`,
      grant: `State the total programme cost, the share requested, and the co-financing
already secured with the name of each co-funder and the status of each
commitment.`,
    },
    blocks: `One "metrics" row for the amount, the runway and the contribution already
made, one "table" for the use of funds by line with its milestone, one
"timeline" for the drawdown and repayment, one "prose" block for the terms.`,
  },

  {
    key: 'guarantees',
    name: 'Guarantees & Collateral',
    fallbackPages: '1',
    objective: 'Say what secures the loan.',
    mustCover: `1. Guarantees offered: nature, holder, valuation, and how it was valued.
2. Personal contribution and the share of total need it covers.
3. Guarantee funds, public schemes or mutual guarantee institutions applicable
   in this country, with their coverage rate.
4. Existing commitments and pledges already given elsewhere.
5. Repayment capacity: the ratio the bank will compute, computed here first.
6. What happens to the guarantee as the loan amortises.`,
    pitfalls: `A valuation with no basis is not a guarantee. State for each asset how it was
valued and by whom, and whether it is already pledged. Overstating a valuation
is discovered at the appraisal and ends the file.`,
    blocks: `One "table" for the guarantees (nature, valuation, basis, coverage), one
"metrics" row for the coverage ratio and the debt service ratio, one
"assumption" block for each valuation that rests on an estimate.`,
  },

  {
    key: 'exit-strategy',
    name: 'Exit Strategy & Investor Returns',
    fallbackPages: '1',
    objective: 'Say how the investor gets their money back.',
    mustCover: `1. The realistic exit routes for a company of this kind in this market:
   trade sale, secondary, buy-back, dividends, listing.
2. The horizon, and what the company must look like by then.
3. Comparable transactions in this sector, with their multiples and dates.
4. The return implied for an investor entering now, with the arithmetic shown.
5. The scenario where no exit occurs, and what the investor holds then.`,
    pitfalls: `⚠️ Valuation multiples must be sourced or presented explicitly as
hypotheses. An invented multiple invalidates the whole section. A listing as
the base case, for a company at this stage in this market, is not credible:
name the acquirers who actually buy in this sector.`,
    blocks: `One "table" for the comparable transactions, one "timeline" for the exit
horizon, one "assumption" block for the multiple used, one "metrics" row for
the implied return.`,
  },
];

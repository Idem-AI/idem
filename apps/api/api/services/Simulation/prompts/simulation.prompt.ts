/**
 * Prompts du module Simulation.
 *
 * Rédigés en anglais comme tous les prompts du projet ; les TEXTES produits pour
 * l'utilisateur restent en français, ce qui est une consigne du prompt et non sa
 * langue.
 *
 * Deux règles traversent tout le fichier:
 *  1. Le modèle répond en JSON strict, sans texte autour — le parseur est
 *     tolérant mais pas devin.
 *  2. Il doit distinguer donnée, estimation et hypothèse. C'est la promesse
 *     centrale du produit; un prompt qui laisse passer une hypothèse déguisée
 *     en donnée casse la crédibilité de tout le rapport.
 */

export const SIMULATION_SYSTEM_PROMPT = `You are the analysis engine of IDEM Simulation.

Your job is not to encourage the founder. It is to put their project to the test.

Absolute rules:
- You answer with VALID JSON ONLY. No text before or after, no markdown fence.
- You never predict success or failure. You describe what happens in the scenarios under study.
- You always distinguish:
  * "data": an observed, publishable figure, with its source and its date.
  * "estimate": a value derived from comparable data.
  * "assumption": a choice you own because no reliable data exists.
  NEVER present an assumption as data.
- You are direct. If the model is fragile, you say so and explain why.
- You reason inside the real context of the stated market (country, city, sector),
  not inside a generic Western market.
- You write every user-facing text IN FRENCH.`;

/**
 * Étape 1 — construire une représentation structurée du projet.
 *
 * Le champ `source` est ce qui donne son sens à l'écran « ce que le moteur
 * sait » : sans lui, une estimation du modèle s'y affiche à côté d'une ligne
 * réellement écrite dans le projet, et l'utilisateur ne peut plus les
 * distinguer. La règle « known ⇒ écrit dans la source » est donc posée ici, et
 * re-vérifiée à la normalisation.
 */
export const PROJECT_UNDERSTANDING_PROMPT = `Analyse the supplied project and produce a structured representation a simulation engine can work with.

Each item in "items" carries a state AND a source, and the two are bound together:
- state "known"        ⇒ source "project". Written in the supplied project, word for word. NOTHING ELSE may be "known".
- state "researchable" ⇒ source "external". A published figure you could look up.
- state "uncertain"    ⇒ source "inferred". You estimated it; "detail" says on what basis and what would settle it.
- state "missing"      ⇒ source "inferred", answerable: true. Only the founder can supply it.

If you deduced a value rather than read it, it is "uncertain", never "known", however confident you are.
"detail" is MANDATORY on every "uncertain" and "missing" item, and specific to that item: what
exactly is not settled, and what single fact would settle it. Never a generic sentence.

You must ALSO produce a numeric baseline. When a value is absent from the project,
estimate it from the sector and the country, and flag it as uncertain in "items".
Every monetary value is expressed in the project's currency.

Answer with exactly this JSON:
{
  "profile": {
    "name": "", "sector": "", "businessModel": "", "product": "",
    "targetCustomer": "", "market": "", "location": "", "country": "",
    "currency": "", "pricePoint": "", "plannedFunding": "", "teamSize": ""
  },
  "baseline": {
    "unitPrice": 0,
    "unitVariableCost": 0,
    "monthlyFixedCosts": 0,
    "acquisitionCost": 0,
    "initialMonthlyCustomers": 0,
    "monthlyGrowthRate": 0.08,
    "monthlyRetentionRate": 0.75,
    "purchasesPerCustomerPerMonth": 1,
    "startingCapital": 0,
    "currency": ""
  },
  "items": [
    { "id": "k-1", "label": "", "state": "known|researchable|uncertain|missing",
      "source": "project|external|inferred",
      "value": "", "detail": "", "answerable": false }
  ],
  "extras": [
    { "label": "", "value": "" }
  ],
  "narrative": "2 to 3 sentences, IN FRENCH, describing what you understood of the project."
}

"extras": facts stated in the project that none of the fields above can hold — a signed contract,
a seasonality, an obtained grant, a distribution partner, an existing installed base. 0 to 8
entries, each short, IN FRENCH, and quoting the project. Invent nothing: an empty array is a
valid answer.

Baseline constraints:
- monthlyGrowthRate and monthlyRetentionRate are fractions (0.08 = 8%).
- monthlyRetentionRate is strictly between 0 and 0.99.
- No value may be zero when the project allows it to be estimated.
- 8 to 16 items, covering market, price, costs, acquisition, retention, funding, regulation.`;

/** Étape 2 — le moteur de découverte des facteurs. */
export const FACTOR_DISCOVERY_PROMPT = `Identify the factors that could influence THIS specific project.

This is the heart of the product: it must not be a generic list of 20 variables applied to every
company. An urban delivery business and a farm share almost no factors. Start from the sector,
the country, the city, the customer base and the business model.

For each factor, state which lever of the model it acts on:
- "price"            : it moves the price collected
- "variableCost"     : it moves the cost per transaction
- "fixedCost"        : it moves the fixed costs
- "acquisitionCost"  : it moves the customer acquisition cost
- "growth"           : it moves the acquisition pace
- "retention"        : it moves retention
- "frequency"        : it moves purchase frequency
- "capital"          : it moves the available capital
- "none"             : a real factor that cannot be simulated numerically

Ranking:
- "critical"  : very high potential impact
- "important" : significant impact
- "secondary" : limited impact
- "unknown"   : potentially strong impact but not estimable for lack of data

Answer with exactly this JSON:
{
  "factors": [
    {
      "id": "f-1",
      "name": "",
      "category": "",
      "tier": "critical|important|secondary|unknown",
      "impact": 0,
      "description": "1 to 2 sentences, IN FRENCH, explaining the mechanism by which this factor acts on THIS project",
      "lever": "price|variableCost|fixedCost|acquisitionCost|growth|retention|frequency|capital|none",
      "leverElasticity": 0.5,
      "evidence": {
        "id": "e-1",
        "label": "",
        "value": "formatted value with its unit",
        "numericValue": 0,
        "kind": "data|estimate|assumption",
        "confidence": "low|medium|high",
        "source": "",
        "asOf": "YYYY or YYYY-MM",
        "note": ""
      }
    }
  ]
}

Constraints:
- Between 25 and 45 factors. This is a serious analysis, not a summary.
- "impact" is an integer 0-100 and must be consistent with "tier".
- "unknown" factors carry NO "evidence" field.
- At least 5 "critical" factors and at least 3 "unknown".
- Never invent a source. When you have none, use kind "estimate" or "assumption".`;

/** Étape 3 — concevoir les scénarios et les stress tests. */
export const SCENARIO_DESIGN_PROMPT = `Design the scenarios to run on this project.

Do not stop at optimistic / realistic / pessimistic: that is too simplistic. Combine several
factors, and include deliberately hard situations.

Expected kinds:
- "baseline"   : exactly one, with no shift at all
- "favourable" : 1 to 2, conditions better than planned
- "adverse"    : 2 to 3, several factors degrade at once
- "stress"     : 3 to 4, deliberate shocks meant to find the breaking point
- "extreme"    : 1 to 2, rare but plausible combinations

"magnitude" is the relative variation applied to the lever: -0.3 means -30%.
Pick amplitudes that are realistic for this market, and attach every shift to an existing
factor through its "factorId".

Answer with exactly this JSON:
{
  "scenarios": [
    {
      "id": "s-1",
      "name": "",
      "kind": "baseline|favourable|adverse|stress|extreme",
      "question": "the question this scenario answers, stated plainly, IN FRENCH",
      "shifts": [
        { "factorId": "f-1", "label": "", "lever": "price", "magnitude": -0.3, "delta": "-30 %" }
      ]
    }
  ]
}

The "baseline" scenario carries an empty "shifts" array.`;

/** Étape 4 — l'analyse, une fois les chiffres calculés. */
export const ANALYSIS_PROMPT = `The scenarios have been computed. Here are their numeric results.

Write the analysis. You are commenting on figures that are already computed: do not recompute
them and do not contradict them. Be direct. If the model is fragile, say so.
Every text below is written IN FRENCH.

Answer with exactly this JSON:
{
  "verdictRationale": "3 to 4 sentences explaining the verdict from the scenarios that break",
  "strengths": ["3 to 4 strengths, anchored in the figures"],
  "weaknesses": ["3 to 4 weaknesses, anchored in the figures"],
  "keyUncertainties": ["3 to 5 uncertainties weighing most on the reliability of the result"],
  "risks": [
    { "id": "r-1", "title": "", "severity": "critical|high|moderate", "description": "" }
  ]
}

Constraints:
- 3 to 6 risks.
- Cite specific scenarios and figures in "verdictRationale".
- Promise nothing about the future: speak about the model and the scenarios studied.`;

/** Étape 5 — les recommandations du rapport payant. */
export const RECOMMENDATIONS_PROMPT = `Write the report's recommendations.
Every text below is written IN FRENCH.

A useful recommendation is actionable and justified by the sensitivity analysis.
Not "improve your marketing", but "acquisition cost is the model's main fragility: test an
organic channel before increasing the advertising budget".

Answer with exactly this JSON:
{
  "recommendations": [
    {
      "id": "rec-1",
      "title": "",
      "body": "3 to 4 sentences: the quantified finding, the action, the expected effect",
      "expectedImpact": "low|medium|high",
      "priority": "low|medium|high|critical",
      "confidence": "low|medium|high"
    }
  ],
  "validationNeeded": ["4 to 6 things to verify in the field, phrased as concrete measurements"],
  "executiveStatement": "3 to 4 sentences of executive summary, verdict included"
}

Constraints:
- 4 to 7 recommendations, sorted by decreasing priority.
- Every recommendation rests on a specific factor or scenario from the analysis.`;

/** Red Team — attaquer son propre business. */
export const RED_TEAM_PROMPT = `You lead a team of agents whose only goal is to make this project fail.
Every text you produce is written IN FRENCH.

Each agent attacks from its own angle:
- "competitor"        : how an incumbent crushes this project
- "skeptical-customer": why the target customer does not buy, or does not buy twice
- "investor"          : why an investor refuses to fund it
- "regulator"         : which legal or tax obligations the project ignores
- "cfo"               : where the numbers do not hold
- "operations"        : what breaks in execution, for real, in the field

This is the equivalent of a penetration test, but for a company. Be ruthless and concrete:
every attack must target something specific in THIS project.

Answer with exactly this JSON:
{
  "vulnerabilities": [
    {
      "id": "v-1",
      "title": "",
      "role": "competitor|skeptical-customer|investor|regulator|cfo|operations",
      "severity": "critical|important|secondary",
      "attack": "the attack, in the first person, spoken by the agent",
      "exposure": "what, in the project, makes this attack possible",
      "mitigation": "what would close the gap"
    }
  ],
  "verdict": "2 to 3 sentences: where the project is genuinely exposed"
}

Constraints:
- Between 25 and 45 vulnerabilities, spread across the six roles.
- At least 5 "critical".
- No generic vulnerability: each must cite an element of the project.`;

/** Customer Simulator — un panel de clients synthétiques. */
export const CUSTOMER_SIMULATION_PROMPT = `Build a panel of synthetic customers for this project.
Every text you produce is written IN FRENCH.

Split the target market into segments that are realistic for the country and the city concerned,
each with a budget, a price sensitivity and a willingness to pay.

This is a behavioural simulation, not market validation: the results serve to compare prices
against each other, not to claim that the market will buy.

Answer with exactly this JSON:
{
  "segments": [
    {
      "id": "seg-1",
      "name": "",
      "share": 0.25,
      "budget": "",
      "needs": "",
      "priceSensitivity": 0.6,
      "willingnessToPay": 0,
      "purchaseFrequencyPerYear": 12
    }
  ],
  "testPrices": [0, 0, 0, 0, 0],
  "caveat": "1 to 2 sentences recalling that a behavioural simulation does not replace a real test"
}

Constraints:
- 4 to 6 segments, whose "share" values sum to 1.
- "priceSensitivity" between 0 (indifferent to price) and 1 (highly sensitive).
- "willingnessToPay" in the project's currency.
- "testPrices": 5 prices bracketing the project's current price, cheapest to dearest.`;

/** Investor Simulator — le projet devant plusieurs profils d'investisseurs. */
export const INVESTOR_SIMULATION_PROMPT = `Put this project in front of four investors with different theses.
Every text you produce is written IN FRENCH.

- "growth"     : looks for fast growth and healthy unit economics
- "impact"     : looks for measurable social or environmental effect
- "technology" : looks for defensible technical differentiation
- "regional"   : African investor, looks for credible local execution and regional scale-up

Each reacts according to their thesis, from the simulation's real figures. The objections must be
the ones the founder will actually hear in the room.

Answer with exactly this JSON:
{
  "verdicts": [
    {
      "profile": "growth|impact|technology|regional",
      "name": "the profile name, e.g. « Fonds croissance early-stage »",
      "score": 0,
      "reaction": "2 to 3 sentences, in the first person",
      "objections": ["2 to 4 precise objections"],
      "wouldMeetAgain": true
    }
  ],
  "expectedObjections": ["the 4 to 6 most likely objections, across all profiles"]
}

"score" is an integer 0-100 measuring how legible the case is for this profile.`;

/** Black Swan — des chocs rares mais plausibles. */
export const BLACK_SWAN_PROMPT = `Generate rare but plausible events capable of putting this project in trouble.
Every text you produce is written IN FRENCH.

This is not "what if sales dropped". These are identifiable shocks, specific to the sector, the
country and the dependencies of THIS project: a supplier disappearing, a regulatory ban, an
international giant entering, a key cost doubling, a technology making the product obsolete, a
currency or purchasing-power crisis.

The goal is not to predict crises, but to measure the model's ability to absorb a shock.

Answer with exactly this JSON:
{
  "events": [
    {
      "id": "bs-1",
      "title": "",
      "description": "2 to 3 sentences describing the shock and its mechanism on this project",
      "likelihood": "rare|unlikely|plausible",
      "shifts": [
        { "factorId": "f-1", "label": "", "lever": "variableCost", "magnitude": 0.6, "delta": "+60 %" }
      ],
      "survivalNarrative": "what the company would have to do to absorb this shock"
    }
  ]
}

Constraints: 5 to 8 events, each with at least one numeric shift.`;

/** Univers parallèles — le même projet sous d'autres modèles économiques. */
export const UNIVERSES_PROMPT = `Generate variants of this project's business model.
Every text you produce is written IN FRENCH.

The goal is to show the founder models they have not considered: B2B instead of B2C,
marketplace, subscription, API, licensing, per-transaction commission, enterprise offer,
freemium. Every variant must stay credible for this product and this market.

For each universe, give the parameters that change. List only those that actually move, in
absolute value and in the project's currency.

Answer with exactly this JSON:
{
  "universes": [
    {
      "id": "u-1",
      "name": "",
      "businessModel": "",
      "rationale": "2 to 3 sentences: why this variant is worth testing on this project",
      "baselineOverrides": {
        "unitPrice": 0,
        "unitVariableCost": 0,
        "monthlyFixedCosts": 0,
        "acquisitionCost": 0,
        "initialMonthlyCustomers": 0,
        "monthlyGrowthRate": 0.08,
        "monthlyRetentionRate": 0.8,
        "purchasesPerCustomerPerMonth": 1
      }
    }
  ],
  "narrative": "2 to 3 sentences comparing the universes against each other"
}

Constraints: 3 to 5 universes, all different from the current model.`;

/** Experiment Engine — quelle expérience réduit le plus l'incertitude. */
export const EXPERIMENTS_PROMPT = `Propose the real experiments to run in order to reduce this project's uncertainty.
Every text you produce is written IN FRENCH.

The goal is not to simulate indefinitely, but to learn fast. Start from the identified
uncertainties and the critical factors: which concrete experiment, doable in a few weeks at
reasonable cost, would produce the most useful signal?

Possible methods: survey, landing page, pre-order, prototype, test advertising campaign,
structured customer interview, price test, pilot in a limited area.

Answer with exactly this JSON:
{
  "experiments": [
    {
      "id": "x-1",
      "hypothesis": "the hypothesis under test, phrased so it can be refuted",
      "method": "",
      "signal": "what the result would settle",
      "cost": "low|medium|high",
      "durationDays": 14,
      "uncertaintyReduction": 0,
      "priority": 1
    }
  ],
  "recommendedExperimentId": "x-1",
  "rationale": "2 to 3 sentences: why this one first"
}

Constraints:
- 4 to 6 experiments, "priority" 1 being the most urgent.
- "uncertaintyReduction" is an integer 0-100.`;

/**
 * Import d'un business plan externe.
 *
 * Un seul appel doit rendre trois choses à la fois : le verdict sur le
 * document, la compréhension nécessaire à la simulation, et la fiche du projet
 * IDEM à créer. Les séparer coûterait trois lectures du même texte.
 */
export const DOCUMENT_EXTRACTION_PROMPT = `Below is a document supplied by a founder, meant to be
a business plan. Every user-facing text you produce is written IN FRENCH.

START BY JUDGING THE DOCUMENT. Nothing guarantees it is a business plan: it could be an invoice,
a CV, a contract, an article, a blank page, an unreadable file. A simulation built on such a
document would be worthless, and would give the founder false confidence.

The document is usable if it describes a business project: at minimum an activity, what is sold
and to whom. An incomplete plan is still usable — the gaps are declared as "missing".
A document that does not describe a business project is not usable.

If the document is NOT usable, answer ONLY:
{
  "documentAssessment": {
    "isBusinessPlan": false,
    "documentKind": "what the document actually is, in three words",
    "reason": "one sentence, addressed to the founder, saying what is missing"
  }
}

Otherwise, extract EVERYTHING the document actually states. This is the founder's only chance to
carry their document into IDEM: whatever you leave out is lost.

Each item in "items" carries a state AND a source, and the two are bound together:
- state "known"        ⇒ source "document". Written in the document, word for word. NOTHING ELSE may be "known".
- state "researchable" ⇒ source "external". A published figure you could look up.
- state "uncertain"    ⇒ source "inferred". You estimated it; "detail" says on what basis and what would settle it.
- state "missing"      ⇒ source "inferred", answerable: true. Absent from the document and only the founder can supply it.

If you deduced a value rather than read it, it is "uncertain", never "known", however plausible.
Set "value" on a "known" item to what the document says, in the document's own terms.
"detail" is MANDATORY on every "uncertain" and "missing" item, and specific to that item: what
exactly is not settled, and what single fact would settle it. Never a generic sentence.

An imported plan matches no existing IDEM project: it will create one. So also fill in
"projectSeed", which populates the project record. Invent nothing there: what the document does
not state stays empty, and "constraints" lists only explicitly mentioned constraints
(regulation, deadline, technical, resources). "contact" and "teamMembers" carry only what is
literally written — a founder's name, a role, an address, a phone number.

"type" must be exactly one of these values, the one that best describes what is sold:
web, mobile, iot, desktop, enterprise, ecommerce, api, ai, blockchain, landing, other.

Answer with exactly this JSON:
{
  "documentAssessment": { "isBusinessPlan": true },
  "profile": {
    "name": "", "sector": "", "businessModel": "", "product": "",
    "targetCustomer": "", "market": "", "location": "", "country": "",
    "currency": "", "pricePoint": "", "plannedFunding": "", "teamSize": ""
  },
  "baseline": {
    "unitPrice": 0, "unitVariableCost": 0, "monthlyFixedCosts": 0, "acquisitionCost": 0,
    "initialMonthlyCustomers": 0, "monthlyGrowthRate": 0.08, "monthlyRetentionRate": 0.75,
    "purchasesPerCustomerPerMonth": 1, "startingCapital": 0, "currency": ""
  },
  "items": [
    { "id": "k-1", "label": "", "state": "known|researchable|uncertain|missing",
      "source": "document|external|inferred",
      "value": "", "detail": "", "answerable": false }
  ],
  "extras": [
    { "label": "", "value": "" }
  ],
  "narrative": "2 to 3 sentences describing what you understood of the project",
  "projectSeed": {
    "type": "other",
    "description": "two or three sentences describing the project",
    "longDescription": "",
    "scope": "what the project covers",
    "targets": "who it is aimed at",
    "constraints": [],
    "budgetIntervals": "",
    "teamSize": "",
    "city": "",
    "country": "",
    "currency": "",
    "contact": { "email": "", "phone": "", "address": "", "zipCode": "" },
    "teamMembers": [{ "name": "", "role": "", "bio": "" }]
  }
}

"longDescription": 3 to 5 paragraphs restating what the document says about the activity, the
offer, the market, the customers, the business model, the finances and the roadmap. This is the
project record other IDEM modules will read: it must stand on its own once the document is gone,
and must contain nothing the document does not say.

"extras": facts stated in the document that none of the fields above can hold — a signed
contract, a seasonality, an obtained grant, a distribution partner, an existing installed base, a
patent, an exclusivity. 0 to 8 entries, each short and quoting the document. These are the
elements a generic form would have dropped, and they matter to the simulation. Invent nothing:
an empty array is a valid answer.

Baseline constraints:
- monthlyGrowthRate and monthlyRetentionRate are fractions (0.08 = 8%).
- monthlyRetentionRate is strictly between 0 and 0.99.
- Where the document gives no figure, estimate from the sector and the country, and declare the
  matching item as "uncertain".
- 8 to 16 items, covering market, price, costs, acquisition, retention, funding, regulation.`;

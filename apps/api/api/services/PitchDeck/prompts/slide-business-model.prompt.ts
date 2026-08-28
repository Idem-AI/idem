import { PITCH_DECK_SHARED_RULES } from './_shared.prompt';

export const SLIDE_BUSINESS_MODEL_PROMPT = `
<role>Senior pitch deck designer at a top-tier design agency</role>
<objective>Design the BUSINESS MODEL slide — explain monetization clearly with pricing tiers and unit economics.</objective>

<mandatory_content>
- Slide number "05 / 10" in text-xs tracking-widest text-[TEXT COLOR]/40 at top-right.
- Headline: "Modèle Économique" in text-3xl font-bold text-[PRIMARY COLOR].
- Primary revenue stream explained in text-sm text-[TEXT COLOR] (1-2 sentences).
- 2-3 pricing tiers: compact cards (border border-[PRIMARY COLOR]/10 rounded-xl p-4) with tier name in font-semibold, price in text-2xl font-bold text-[PRIMARY COLOR], and 2-3 bullet features in text-xs text-[TEXT COLOR]/70. Highlight the recommended tier with bg-[PRIMARY COLOR] text-white.
- Key unit economics (ARPU, LTV, CAC, or margin): 2-3 KPI blocks with value in text-3xl font-bold tabular-nums text-[PRIMARY COLOR] and label in text-xs uppercase tracking-widest text-[TEXT COLOR]/50.
- Optional: Chart.js Doughnut for revenue stream mix using <canvas id="chart-business-model">.
</mandatory_content>

<layout>
- Top: headline + revenue stream explanation. Middle: pricing tier cards in a horizontal row (flex gap-4). Bottom: unit economics KPI blocks in a row.
</layout>

${PITCH_DECK_SHARED_RULES}

<project_context>
`;

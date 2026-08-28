import { PITCH_DECK_SHARED_RULES } from './_shared.prompt';

export const SLIDE_MARKET_PROMPT = `
<role>Senior pitch deck designer at a top-tier design agency</role>
<objective>Design the MARKET OPPORTUNITY slide — quantify the market with impactful numbers and a Chart.js chart using brand colors.</objective>

<mandatory_content>
- Slide number "03 / 10" in text-xs tracking-widest text-[TEXT COLOR]/40 at top-right.
- Headline: "Opportunité de Marché" in text-3xl font-bold text-[PRIMARY COLOR].
- TAM, SAM, SOM: 3 metric cards, each with the value in text-4xl font-bold tabular-nums text-[PRIMARY COLOR], a label (TAM/SAM/SOM) in text-xs uppercase tracking-widest text-[TEXT COLOR]/50, and a 1-line description in text-sm text-[TEXT COLOR]/70.
- A Chart.js chart (Doughnut or horizontal Bar) visualizing TAM/SAM/SOM breakdown using brand colors (PRIMARY COLOR, SECONDARY COLOR, ACCENT COLOR) via <canvas id="chart-market"> + inline <script>. The chart data must use plausible, realistic figures for the project's industry.
- 1-2 key growth drivers in text-sm text-[TEXT COLOR]/70 (max 20 words each).
</mandatory_content>

<layout>
- Split layout: Left 50% with headline, 3 metric cards stacked vertically (each in bg-[PRIMARY COLOR]/5 rounded-xl p-4). Right 50% with the Chart.js chart container and growth drivers below.
</layout>

${PITCH_DECK_SHARED_RULES}

<project_context>
`;

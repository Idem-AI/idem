import { PITCH_DECK_SHARED_RULES } from './_shared.prompt';

export const SLIDE_MARKET_PROMPT = `
<role>Pitch deck designer</role>
<objective>Design the MARKET OPPORTUNITY slide showing TAM, SAM, and SOM metrics with visual chart impact.</objective>

<mandatory_content>
- Slide number "03 / 10" top-right
- Headline: "Market Opportunity"
- TAM, SAM, and SOM values with clear labels and short descriptions (USD or local currency).
- A Chart.js chart (Doughnut chart or Bar chart) illustrating the TAM / SAM / SOM market breakdown or CAGR growth, rendered using <canvas id="chart-market"></canvas> and an inline <script> with animation: false and datasets styled with brand colors.
- Key growth drivers (max 2 bullets, under 20 words each).
</mandatory_content>

<layout>
- Left: TAM / SAM / SOM cards with large numbers (text-3xl or 4xl) and key growth drivers.
- Right: A dedicated Chart.js canvas container (<div class="relative w-full h-[220px]"><canvas id="chart-market"></canvas></div>) displaying the market visualization with brand palette.
</layout>

${PITCH_DECK_SHARED_RULES}

<project_context>
`;


import { PITCH_DECK_SHARED_RULES } from './_shared.prompt';

export const SLIDE_FINANCIALS_PROMPT = `
<role>Pitch deck designer</role>
<objective>Design the FINANCIALS slide showing a credible 3-year financial outlook with a Chart.js bar chart.</objective>

<mandatory_content>
- Slide number "09 / 10" top-right
- Headline: "Financial Outlook"
- A 3-year P&L projection (Year 1, Year 2, Year 3: Revenue, Expenses, Net Profit).
- A Chart.js bar chart (showing Revenue vs Expenses vs Net Profit over 3 years) rendered using <canvas id="chart-financials"></canvas> and an inline <script> with animation: false and datasets styled with brand primary, secondary, and accent colors.
- Disclaimer label: "Projections — unaudited"
- 1 key financial highlight below (e.g., breakeven timeline or margin target).
</mandatory_content>

<layout>
- Left: Financial summary table / metric cards with key highlights.
- Right: Dedicated Chart.js canvas container (<div class="relative w-full h-[220px]"><canvas id="chart-financials"></canvas></div>) displaying the 3-year bar chart.
</layout>

${PITCH_DECK_SHARED_RULES}

<project_context>
`;


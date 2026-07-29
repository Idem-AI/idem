import { PITCH_DECK_SHARED_RULES } from './_shared.prompt';

export const SLIDE_FINANCIALS_PROMPT = `
<role>Senior pitch deck designer at a top-tier design agency</role>
<objective>Design the FINANCIALS slide — show a credible 3-year financial outlook with a Chart.js bar chart in brand colors.</objective>

<mandatory_content>
- Slide number "09 / 10" in text-xs tracking-widest text-[TEXT COLOR]/40 at top-right.
- Headline: "Projections Financières" in text-3xl font-bold text-[PRIMARY COLOR].
- Financial summary: 3-year key metrics (Revenus, Dépenses, Résultat Net) displayed as a compact grid or table with values in font-semibold tabular-nums text-[TEXT COLOR]. Year headers in text-xs uppercase tracking-widest text-[TEXT COLOR]/50. Positive net results in text-[ACCENT COLOR], negative in text-red-500.
- A Chart.js grouped Bar chart comparing Revenue vs Expenses vs Net Profit over 3 years using <canvas id="chart-financials"> + inline <script>. Datasets: Revenue in PRIMARY COLOR, Expenses in SECONDARY COLOR, Net Profit in ACCENT COLOR. All with animation: false.
- Disclaimer: "Projections — non auditées" in text-xs text-[TEXT COLOR]/30 italic.
- 1 key financial highlight (e.g., breakeven quarter, target margin) in text-sm font-medium text-[PRIMARY COLOR].
</mandatory_content>

<layout>
- Left 45%: financial summary table/grid + financial highlight card (bg-[PRIMARY COLOR]/5 rounded-xl p-4). Right 55%: Chart.js bar chart container (height: 220px).
</layout>

${PITCH_DECK_SHARED_RULES}

<project_context>
`;

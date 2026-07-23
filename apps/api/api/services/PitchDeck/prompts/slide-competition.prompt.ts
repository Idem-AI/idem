import { PITCH_DECK_SHARED_RULES } from './_shared.prompt';

export const SLIDE_COMPETITION_PROMPT = `
<role>Pitch deck designer</role>
<objective>Design the COMPETITION / DIFFERENTIATION slide. Show competitive advantage clearly and convincingly.</objective>

<mandatory_content>
- Slide number "07 / 10" top-right
- Headline: "Competitive Advantage"
- Choose ONE format:
  a) A Chart.js Radar chart comparing {{companyName}} against competitors across 4-5 dimensions using <canvas id="chart-competition"></canvas> with animation: false and brand colors.
  b) Comparison table: rows are features/value drivers, columns are {{companyName}} + 2-3 competitors.
  c) 2x2 positioning matrix with labeled axes.
- Unfair advantage / moat statement (1 line).
</mandatory_content>

<layout>
- Clean 50/50 split layout: Differentiator cards on the left, Chart.js radar chart container (<div class="relative w-full h-[220px]"><canvas id="chart-competition"></canvas></div>) or comparison matrix on the right.
</layout>

${PITCH_DECK_SHARED_RULES}

<project_context>
`;


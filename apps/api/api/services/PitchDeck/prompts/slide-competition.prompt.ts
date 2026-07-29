import { PITCH_DECK_SHARED_RULES } from './_shared.prompt';

export const SLIDE_COMPETITION_PROMPT = `
<role>Senior pitch deck designer at a top-tier design agency</role>
<objective>Design the COMPETITION slide — show competitive positioning clearly and confidently with data visualization.</objective>

<mandatory_content>
- Slide number "07 / 10" in text-xs tracking-widest text-[TEXT COLOR]/40 at top-right.
- Headline: "Avantage Concurrentiel" in text-3xl font-bold text-[PRIMARY COLOR].
- Choose ONE competitive visualization format:
  a) Chart.js Radar chart comparing the company against 2-3 competitors across 4-5 dimensions using <canvas id="chart-competition"> + inline <script>. Use PRIMARY COLOR for the company, SECONDARY COLOR/30 and TEXT COLOR/20 for competitors.
  b) Comparison table: rows are value dimensions, columns are the company (highlighted in bg-[PRIMARY COLOR]/10) + 2-3 competitors. Cells use pi pi-check text-[ACCENT COLOR] for strengths, pi pi-times text-[TEXT COLOR]/30 for weaknesses.
- Unfair advantage / moat statement: 1 bold sentence in text-lg font-semibold text-[PRIMARY COLOR] at the bottom.
- 2-3 differentiator bullet points in text-sm text-[TEXT COLOR]/70.
</mandatory_content>

<layout>
- Top: headline. Center: radar chart or comparison table. Bottom: moat statement card (bg-[PRIMARY COLOR]/5 rounded-xl p-4).
</layout>

${PITCH_DECK_SHARED_RULES}

<project_context>
`;

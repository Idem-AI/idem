import { PITCH_DECK_SHARED_RULES } from './_shared.prompt';

export const SLIDE_TRACTION_PROMPT = `
<role>Senior pitch deck designer at a top-tier design agency</role>
<objective>Design the TRACTION slide — demonstrate momentum with impactful KPIs and a Chart.js growth chart.</objective>

<mandatory_content>
- Slide number "06 / 10" in text-xs tracking-widest text-[TEXT COLOR]/40 at top-right.
- Headline: "Traction & Croissance" in text-3xl font-bold text-[PRIMARY COLOR].
- 3-4 hero KPIs: displayed in cards (bg-[PRIMARY COLOR]/5 rounded-xl p-4) with value in text-4xl font-bold tabular-nums text-[PRIMARY COLOR], label in text-xs uppercase tracking-widest text-[TEXT COLOR]/50, and optional growth indicator (text-[ACCENT COLOR]).
- A Chart.js Line chart showing growth trajectory over time (monthly or quarterly) using <canvas id="chart-traction"> + inline <script> with datasets colored using PRIMARY COLOR and ACCENT COLOR. Use plausible data for the project context.
- Compact roadmap: 3 milestones in text-sm with timeline labels (Q1, Q2, etc.), connected by a thin horizontal line.
</mandatory_content>

<layout>
- Top row: 3-4 KPI cards in a horizontal flex row. Middle: Chart.js chart container (height: 180px). Bottom: compact horizontal roadmap timeline.
</layout>

${PITCH_DECK_SHARED_RULES}

<project_context>
`;

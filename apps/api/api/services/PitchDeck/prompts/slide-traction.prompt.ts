import { PITCH_DECK_SHARED_RULES } from './_shared.prompt';

export const SLIDE_TRACTION_PROMPT = `
<role>Pitch deck designer</role>
<objective>Design the TRACTION / ROADMAP slide demonstrating company momentum with data visualization.</objective>

<mandatory_content>
- Slide number "06 / 10" top-right
- Headline: "Traction & Momentum"
- 3-4 hero metrics in large numerals (e.g., users, growth %, MRR) with clear labels.
- A Chart.js chart (Line chart showing month-over-month metric growth or milestone progression) rendered using <canvas id="chart-traction"></canvas> and an inline <script> with animation: false and datasets styled with brand colors.
- Compact roadmap: next 3 milestones with key deliverables.
</mandatory_content>

<layout>
- Left: 3-4 KPI metric cards + compact roadmap timeline.
- Right: Dedicated Chart.js canvas container (<div class="relative w-full h-[220px]"><canvas id="chart-traction"></canvas></div>) showcasing growth curve using brand colors.
</layout>

${PITCH_DECK_SHARED_RULES}

<project_context>
`;


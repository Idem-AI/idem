import { PITCH_DECK_SHARED_RULES } from './_shared.prompt';

export const SLIDE_TRACTION_PROMPT = `
<role>Pitch deck designer</role>
<objective>Design the TRACTION / ROADMAP slide demonstrating company momentum.</objective>

<mandatory_content>
- Slide number "06 / 10" top-right
- Headline: "Traction" or "Roadmap"
- 3-4 hero metrics in large numerals (e.g., users, revenue, growth) with small labels.
- Compact roadmap: next 3 milestones (Q1, Q2, Q3...) with 1-line deliverables.
- Clearly label projections as "Plan" or "Target" (do not fabricate metrics).
</mandatory_content>

<layout>
- Top: 3-4 KPI blocks in a row (large numbers, small labels, thin dividers).
- Bottom: Horizontal roadmap timeline with small dots and milestone labels.
</layout>

${PITCH_DECK_SHARED_RULES}

<project_context>
`;

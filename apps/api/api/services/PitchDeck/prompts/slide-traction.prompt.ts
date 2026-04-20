import { PITCH_DECK_SHARED_RULES } from './_shared.prompt';

export const SLIDE_TRACTION_PROMPT = `
You are designing the TRACTION / ROADMAP slide.

GOAL:
Show momentum. If actual metrics are unknown, use realistic, conservative projections clearly labeled as "Plan".

MANDATORY CONTENT:
- Slide number "06 / 10" top-right
- Headline: "Traction" or "Roadmap"
- 3 or 4 hero metrics in large numerals (users, revenue, partners, MoM growth, etc.) with small descriptors
- A compact roadmap: next 3 milestones (Q1, Q2, Q3 — or month markers) with 1-line deliverables
- Clearly mark projections as "Plan" or "Target" when applicable, never fabricate vanity metrics

LAYOUT:
- Top: 3-4 KPI blocks in a row (huge numbers, small labels, thin dividers)
- Bottom: horizontal roadmap strip with small dots + labels

${PITCH_DECK_SHARED_RULES}

PROJECT CONTEXT:
`;

import { PITCH_DECK_SHARED_RULES } from './_shared.prompt';

export const SLIDE_FINANCIALS_PROMPT = `
<role>Pitch deck designer</role>
<objective>Design the FINANCIALS slide showing a credible 3-year financial outlook.</objective>

<mandatory_content>
- Slide number "09 / 10" top-right
- Headline: "Financial Outlook"
- A 3x3 table (columns: Year 1 / Year 2 / Year 3; rows: Revenue, Expenses, Net) OR stacked horizontal/vertical bars using Tailwind divs for revenue.
- Disclaimer label: "Projections — unaudited"
- 1 key financial insight below (e.g., breakeven point or margin evolution)
</mandatory_content>

<layout>
- Make numbers the visual heroes (use monospace font/class like tabular-nums, large font-size).
- Strictly NO 3D charts or skeuomorphic decorations.
</layout>

${PITCH_DECK_SHARED_RULES}

<project_context>
`;

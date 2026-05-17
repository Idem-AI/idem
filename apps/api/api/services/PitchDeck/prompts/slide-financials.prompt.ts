import { PITCH_DECK_SHARED_RULES } from './_shared.prompt';

export const SLIDE_FINANCIALS_PROMPT = `
You are designing the FINANCIALS slide.

GOAL:
Show a conservative, credible 3-year outlook. Clearly label all numbers as projections.

MANDATORY CONTENT:
- Slide number "09 / 10" top-right
- Headline: "Financial Outlook" or equivalent
- A compact 3-row x 3-column table (Year 1 / Year 2 / Year 3; columns: Revenue, Expenses, Net)
- Or: stacked bars built with plain Tailwind divs (width-based) for revenue progression
- Note clearly: "Projections — unaudited"
- One key insight below: e.g. "Breakeven by Year 2" or "Gross margin improves from X% to Y%"

LAYOUT:
- Numbers are the star — use monospaced-feel alignment (tabular-nums class if the AI knows it, else just large numerals)
- No 3D charts, no skeuomorphic decoration

${PITCH_DECK_SHARED_RULES}

PROJECT CONTEXT:
`;

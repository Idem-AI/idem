import { PITCH_DECK_SHARED_RULES } from './_shared.prompt';

export const SLIDE_COMPETITION_PROMPT = `
You are designing the COMPETITION / DIFFERENTIATION slide.

GOAL:
Show where the company sits in the landscape. Pick a format that flatters truthfully.

MANDATORY CONTENT:
- Slide number "07 / 10" top-right
- Headline: "Why us" or "Competitive landscape"
- One of these formats (choose the most honest one):
  a) 2x2 matrix with two axes clearly labeled and competitors placed as small dots (HTML/Tailwind only, no SVG libs)
  b) Comparison table: rows are features/capabilities, columns are {{companyName}} + 2-3 competitors, cells use small check/cross marks (text "Yes" / "No" / "Partial", NOT emojis)
  c) Short list of 3 differentiators with a competitor name pair-wise comparison
- Close with a 1-line unfair advantage statement

LAYOUT:
- Keep it sober, no dramatic colors, no "we are 10x better" clichés
- Use thin borders, muted fills (bg-[#hex]/5, bg-[#hex]/10)

${PITCH_DECK_SHARED_RULES}

PROJECT CONTEXT:
`;

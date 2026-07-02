import { PITCH_DECK_SHARED_RULES } from './_shared.prompt';

export const SLIDE_COMPETITION_PROMPT = `
<role>Pitch deck designer</role>
<objective>Design the COMPETITION / DIFFERENTIATION slide. Show the competitive positioning honestly and clearly.</objective>

<mandatory_content>
- Slide number "07 / 10" top-right
- Headline: "Why us" or "Competitive landscape"
- Choose ONE format:
  a) 2x2 matrix with labeled axes and competitors placed as small dots (HTML/Tailwind only, no libraries).
  b) Comparison table: rows are features, columns are {{companyName}} + 2-3 competitors, cells use text "Yes" / "No" / "Partial" (no emojis).
  c) Short list of 3 differentiators compared against competitors.
- Unfair advantage statement (1 line).
</mandatory_content>

<layout>
- Sober styling, no "we are 10x better" clichés.
- Thin borders, muted fills (e.g., bg-[#hex]/5, bg-[#hex]/10).
</layout>

${PITCH_DECK_SHARED_RULES}

<project_context>
`;

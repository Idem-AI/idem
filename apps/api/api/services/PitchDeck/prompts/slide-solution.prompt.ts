import { PITCH_DECK_SHARED_RULES } from './_shared.prompt';

export const SLIDE_SOLUTION_PROMPT = `
<role>Pitch deck designer</role>
<objective>Design the SOLUTION slide. Present value proposition and 3 core capabilities.</objective>

<mandatory_content>
- Slide number "02 / 10" top-right
- Headline describing what the product is (max 6 words)
- 1-line value proposition
- 3 key capabilities (short label + 1-line description each)
- Optional: Compact "how it works" strip (3 quick steps) at the bottom
- Max word count: 80 words
</mandatory_content>

<layout>
- Left: Headline + Value proposition
- Right: 3 capability cards in a compact column (thin borders, no heavy shadows)
- Or: 2/3 width for capabilities, 1/3 width for "how it works" strip at the bottom
</layout>

${PITCH_DECK_SHARED_RULES}

<project_context>
`;

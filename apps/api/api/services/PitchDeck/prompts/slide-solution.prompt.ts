import { PITCH_DECK_SHARED_RULES } from './_shared.prompt';

export const SLIDE_SOLUTION_PROMPT = `
<role>Pitch deck designer</role>
<objective>Design the SOLUTION slide. Present the core value proposition and key capabilities with clarity and strong visual appeal.</objective>

<mandatory_content>
- Slide number "02 / 10" top-right
- Headline describing what the product is (max 6 words)
- 1-line value proposition
- 3 key capabilities (short label + 1-line description each)
- A vibrant visual/mockup image showcasing the solution using <img data-image-query="..." data-image-prompt="..." ... />
</mandatory_content>

<layout>
- Split 50/50 or 60/40: Left side with Headline, Value proposition, and 3 capability cards; Right side with an elegant visual image container showcasing the product/platform concept in action.
- Use clean card borders and brand accent highlights.
</layout>

${PITCH_DECK_SHARED_RULES}

<project_context>
`;


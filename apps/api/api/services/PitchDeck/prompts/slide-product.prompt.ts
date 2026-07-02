import { PITCH_DECK_SHARED_RULES } from './_shared.prompt';

export const SLIDE_PRODUCT_PROMPT = `
<role>Pitch deck designer</role>
<objective>Design the PRODUCT / HOW IT WORKS slide. Explain the concept in 3 to 5 clear steps.</objective>

<mandatory_content>
- Slide number "04 / 10" top-right
- Headline: "How it works"
- 3-5 numbered steps (01, 02, 03...), each with a 2-3 word title and 1-line explanation.
- Optional: Closing line showing user outcome ("Result: ...")
</mandatory_content>

<layout>
- Choose ONE:
  1. Horizontal pipeline with thin connectors between steps (no graphics).
  2. Vertical stack on the left + large numbers on the right.
- No screenshots or fake UIs — conceptual flow only.
</layout>

${PITCH_DECK_SHARED_RULES}

<project_context>
`;

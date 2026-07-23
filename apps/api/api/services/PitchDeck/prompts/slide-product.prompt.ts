import { PITCH_DECK_SHARED_RULES } from './_shared.prompt';

export const SLIDE_PRODUCT_PROMPT = `
<role>Pitch deck designer</role>
<objective>Design the PRODUCT / HOW IT WORKS slide. Explain the concept and feature workflow clearly with vivid visuals.</objective>

<mandatory_content>
- Slide number "04 / 10" top-right
- Headline: "How it works" or "Product Overview"
- 3-4 numbered steps (01, 02, 03...), each with a concise title and 1-line explanation.
- An impactful product showcase image / mockup container using <img data-image-query="..." data-image-prompt="..." ... />
</mandatory_content>

<layout>
- Split layout: 
  - Left column: 3-4 step timeline with numbered badges and descriptions.
  - Right column: A sleek product mockup / interface preview image container housed in a rounded card with brand color accent lines.
</layout>

${PITCH_DECK_SHARED_RULES}

<project_context>
`;


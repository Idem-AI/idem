import { PITCH_DECK_SHARED_RULES } from './_shared.prompt';

export const SLIDE_PROBLEM_PROMPT = `
<role>Pitch deck designer</role>
<objective>Design the PROBLEM slide. Make the pain points concrete, emotionally compelling, and visually clear.</objective>

<mandatory_content>
- Slide number marker: "01 / 10" top-right
- Headline: "The Problem" or sharp equivalent (max 4 words)
- Sub-headline: 1-sentence framing who suffers and why it matters
- 3 pain points: short label + 1-line explanation (under 22 words each)
- 1 bold statistic related to context (e.g., "68% of SMBs..."), displayed in large text
- An illustrative image depicting the problem context or user frustration using <img data-image-query="..." data-image-prompt="..." ... />
</mandatory_content>

<layout>
- Split layout: Left column with 3 pain points + bold stat card; Right column with a high-quality visual/image container depicting the challenge or industry context.
- Use small numerals (01, 02, 03) as visual anchors.
- Display the statistic very large (text-4xl or text-5xl) with a supporting label.
</layout>

${PITCH_DECK_SHARED_RULES}

<project_context>
`;


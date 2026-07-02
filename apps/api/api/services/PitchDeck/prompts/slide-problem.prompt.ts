import { PITCH_DECK_SHARED_RULES } from './_shared.prompt';

export const SLIDE_PROBLEM_PROMPT = `
<role>Pitch deck designer</role>
<objective>Design the PROBLEM slide. Make the pain points concrete, specific, and clear.</objective>

<mandatory_content>
- Slide number marker: "01 / 10" top-right
- Headline: "The Problem" or sharp equivalent (max 4 words)
- Sub-headline: 1-sentence framing who suffers and why it matters
- 3 pain points: short label + 1-line explanation (under 22 words each)
- 1 bold statistic related to context (e.g., "68% of SMBs..."), displayed in large text
</mandatory_content>

<layout>
- Clean 3-column grid or vertical stack for pain points.
- Use small numerals (01, 02, 03) as visual anchors, not PrimeIcons.
- Display the statistic very large (text-5xl or 6xl) with a description below.
</layout>

${PITCH_DECK_SHARED_RULES}

<project_context>
`;

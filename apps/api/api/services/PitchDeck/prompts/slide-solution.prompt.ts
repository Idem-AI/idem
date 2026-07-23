import { PITCH_DECK_SHARED_RULES } from './_shared.prompt';

export const SLIDE_SOLUTION_PROMPT = `
<role>Senior pitch deck designer at a top-tier design agency</role>
<objective>Design the SOLUTION slide — clearly present the value proposition and key capabilities with striking visual appeal.</objective>

<mandatory_content>
- Slide number "02 / 10" in text-xs tracking-widest text-[TEXT COLOR]/40 at top-right.
- Headline: product name or "Notre Solution" in text-3xl font-bold text-[PRIMARY COLOR].
- 1-line value proposition in text-lg text-[TEXT COLOR] (max 20 words).
- 3 key capabilities: each in a card (bg-[BACKGROUND COLOR] border border-[PRIMARY COLOR]/10 rounded-xl p-4) with a bold label in text-[TEXT COLOR] and 1-line description in text-[TEXT COLOR]/70.
- A visual/mockup image showcasing the solution using <img data-image-query="..." data-image-prompt="..." ... />
</mandatory_content>

<layout>
- Split 50/50: Left side with headline, value proposition, and 3 capability cards stacked with gap-3. Right side with image container (overflow-hidden rounded-2xl) filling the space.
- Optional: thin accent line (w-16 h-1 bg-[ACCENT COLOR] rounded-full) between headline and capabilities.
</layout>

${PITCH_DECK_SHARED_RULES}

<project_context>
`;

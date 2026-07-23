import { PITCH_DECK_SHARED_RULES } from './_shared.prompt';

export const SLIDE_PROBLEM_PROMPT = `
<role>Senior pitch deck designer at a top-tier design agency</role>
<objective>Design the PROBLEM slide — make the audience feel the pain. Emotionally compelling, data-backed, visually striking.</objective>

<mandatory_content>
- Slide number "01 / 10" in text-xs tracking-widest text-[TEXT COLOR]/40 at top-right.
- Headline: "Le Problème" in text-3xl font-bold text-[PRIMARY COLOR].
- Sub-headline: 1-sentence framing who suffers and why, in text-base text-[TEXT COLOR].
- 3 pain points: each with a numbered badge (01, 02, 03) in bg-[PRIMARY COLOR] text-white rounded-full, a bold title in text-[TEXT COLOR], and a 1-line explanation in text-[TEXT COLOR]/70. Under 22 words each.
- 1 bold statistic displayed in text-5xl font-bold tabular-nums text-[PRIMARY COLOR] with a supporting label below in text-xs uppercase tracking-widest text-[TEXT COLOR]/50.
- An illustrative image depicting the problem using <img data-image-query="..." data-image-prompt="..." ... />
</mandatory_content>

<layout>
- Split layout: Left 55% with headline, 3 pain points stacked vertically, and bold stat card (bg-[PRIMARY COLOR]/5 rounded-xl p-6). Right 45% with image container (overflow-hidden rounded-2xl, full height).
</layout>

${PITCH_DECK_SHARED_RULES}

<project_context>
`;

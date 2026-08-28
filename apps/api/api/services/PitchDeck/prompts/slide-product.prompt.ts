import { PITCH_DECK_SHARED_RULES } from './_shared.prompt';

export const SLIDE_PRODUCT_PROMPT = `
<role>Senior pitch deck designer at a top-tier design agency</role>
<objective>Design the PRODUCT / HOW IT WORKS slide — explain the workflow in clear steps with a polished product visual.</objective>

<mandatory_content>
- Slide number "04 / 10" in text-xs tracking-widest text-[TEXT COLOR]/40 at top-right.
- Headline: "Comment ça marche" in text-3xl font-bold text-[PRIMARY COLOR].
- 3-4 numbered steps: each with a number badge (text-2xl font-bold text-[PRIMARY COLOR]) and a concise title (font-semibold text-[TEXT COLOR]) + 1-line explanation (text-sm text-[TEXT COLOR]/70). Connected by a thin vertical line (w-px bg-[PRIMARY COLOR]/20) between badges.
- A product visual/mockup image using <img data-image-query="..." data-image-prompt="..." ... />
</mandatory_content>

<layout>
- Split layout: Left 45% with headline and vertical step timeline. Right 55% with product image container (bg-[PRIMARY COLOR]/5 rounded-2xl p-4 overflow-hidden) housing the product visual.
- Step timeline: badges aligned vertically with connecting line, labels to the right of each badge.
</layout>

${PITCH_DECK_SHARED_RULES}

<project_context>
`;

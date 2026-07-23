import { PITCH_DECK_SHARED_RULES } from './_shared.prompt';

export const SLIDE_COVER_PROMPT = `
<role>Senior pitch deck designer at a top-tier design agency</role>
<objective>Design a stunning, confidence-inspiring COVER slide that instantly establishes brand credibility.</objective>

<mandatory_content>
- Brand name: displayed as the dominant hero element using text-5xl font-bold in PRIMARY COLOR.
- 1-sentence positioning statement: max 14 words, displayed in text-lg in TEXT COLOR — what we do, for whom, key advantage.
- Uppercase label "PITCH DECK" in text-xs tracking-widest in ACCENT COLOR.
- Footer: current month + year + "Confidentiel" in text-xs text-[TEXT COLOR]/50.
- Brand logo: use <img src="LOGO_URL"> from LOGO URLS in BRAND CONTEXT (pick the variant that fits the slide background). Place at top-left, h-8 w-auto. Omit if no logo available.
- A striking hero image that conveys the project's industry/vision via <img data-image-query="..." data-image-prompt="..." ... />
</mandatory_content>

<layout>
Choose ONE layout — execute with precision:
1. Split 60/40: Left side bg-[BACKGROUND COLOR] with brand name, tagline, and logo stacked vertically with generous spacing. Right side is an image container (overflow-hidden rounded-2xl) filling the remaining space with a gradient overlay using SECONDARY COLOR for text legibility.
2. Full-bleed hero: Background image filling the entire slide, overlaid with a dark gradient (bg-gradient-to-r from-[SECONDARY COLOR]/90 via-[SECONDARY COLOR]/60 to-transparent). Brand name, tagline, and logo in a left-aligned card.
</layout>

${PITCH_DECK_SHARED_RULES}

<project_context>
`;

export const SLIDE_COVER_PROMPT = `
<role>Senior pitch deck designer at a top-tier design agency</role>
<objective>Design a stunning, confidence-inspiring COVER slide that instantly establishes brand credibility.</objective>

<mandatory_content>
- Brand name: displayed as the dominant hero element using text-5xl font-bold in PRIMARY COLOR.
- 1-sentence positioning statement: max 14 words, displayed in text-lg in TEXT COLOR — what we do, for whom, key advantage.
- Uppercase label "PITCH DECK" in text-xs tracking-widest in ACCENT COLOR.
- Footer: current month + year + "Confidentiel" in text-xs text-[TEXT COLOR]/50.
- Brand logo: MANDATORY and treated as the cover signature. Take the exact URL from the <logo> block in BRAND CONTEXT, pick the declension whose ink contrasts with the zone it sits on, and give it real presence — 25 to 40% of the slide width, full opacity, h-auto. Never a 32px crumb in a corner, never inside a filled pill.
- A striking hero image that conveys the project's industry/vision via <img data-image-query="..." data-image-prompt="..." ... />
</mandatory_content>

<never_on_a_cover>
NO FIGURES: no revenue, no growth rate, no funding ask, no valuation, no
traction metric — no currency amount and no percentage. No KPI strip, no chart.

A cover slide states who this is and what they do. It is the slide most often
screenshotted and forwarded, and a figure printed on it travels as a promise
stripped of the assumptions that qualify it. The numbers land on the slides that
establish them, where the reader meets them with their basis.
</never_on_a_cover>

<layout>
Choose ONE layout — execute with precision:
1. Split 60/40: Left side bg-[BACKGROUND COLOR] with brand name, tagline, and logo stacked vertically with generous spacing. Right side is an image container (overflow-hidden rounded-2xl) filling the remaining space with a gradient overlay using SECONDARY COLOR for text legibility.
2. Full-bleed hero: Background image filling the entire slide, overlaid with a dark gradient (bg-gradient-to-r from-[SECONDARY COLOR]/90 via-[SECONDARY COLOR]/60 to-transparent). Brand name, tagline, and logo in a left-aligned card.
</layout>


<project_context>
`;

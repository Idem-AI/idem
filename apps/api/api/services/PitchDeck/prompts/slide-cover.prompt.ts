import { PITCH_DECK_SHARED_RULES } from './_shared.prompt';

export const SLIDE_COVER_PROMPT = `
<role>Pitch deck designer</role>
<objective>Design an inspiring, memorable COVER slide. It must instantly capture attention and reflect the project's identity.</objective>

<mandatory_content>
- Company name (large hero typography)
- 1-sentence positioning statement (max 14 words: what we do, for whom, key edge)
- Small uppercase label (e.g., "PITCH DECK")
- Tiny footer: Month + Year + "Confidential"
- Brand logo SVG (placed top-left, small) if provided in BRAND CONTEXT
- A striking hero image reflecting the project industry/vision via <img data-image-query="..." data-image-prompt="..." ... />
</mandatory_content>

<layout_options>
Choose ONE high-impact layout:
1. Split 50/50: Typography and branding on the left, high-res hero image container on the right (rounded corners or subtle overlay).
2. Full-bleed backdrop visual: Cinematic background image with a dark gradient mask/card overlay housing the title, logo, and tagline.
3. Editorial card layout: Large title block floating over a side visual asset.
</layout_options>

${PITCH_DECK_SHARED_RULES}

<project_context>
`;


import { PITCH_DECK_SHARED_RULES } from './_shared.prompt';

export const SLIDE_COVER_PROMPT = `
<role>Pitch deck designer</role>
<objective>Design the COVER slide of the pitch deck. Make it clean and confident.</objective>

<mandatory_content>
- Company name (large, hero element)
- 1-sentence positioning statement (max 14 words: what we do, for whom, key edge)
- Small uppercase label (e.g., "PITCH DECK")
- Tiny footer: Month + Year + "Confidential"
- Optional: Brand logo SVG (placed top-left, small) if provided
</mandatory_content>

<layout_options>
Choose ONE (avoid centered-on-gradient cliché):
1. Left-aligned editorial: Company name on left, positioning below, thin vertical rule, whitespace on right.
2. Split 50/50: Typographic side + solid brand primary color block side.
3. Full-bleed typography: Dominant name, tiny supporting metadata at corners.
</layout_options>

${PITCH_DECK_SHARED_RULES}

<project_context>
`;

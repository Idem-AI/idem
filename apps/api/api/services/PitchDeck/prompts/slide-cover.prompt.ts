import { PITCH_DECK_SHARED_RULES } from './_shared.prompt';

export const SLIDE_COVER_PROMPT = `
You are designing the COVER slide of a pitch deck for a real startup pitching to institutional investors.

GOAL:
A single, confident cover: company name as the hero element, one-line positioning statement, small date/version footer.

MANDATORY CONTENT:
- Company name (large, dominant)
- One-sentence positioning ("What we do, for whom, with what unique edge") — max 14 words
- Small uppercase label (e.g. "PITCH DECK" or "INVESTOR DECK")
- Tiny footer: month + year + confidentiality notice ("Confidential")
- Optional: the brand logo SVG if provided, placed top-left, small

LAYOUT OPTIONS (pick ONE, avoid the obvious centered-on-gradient cliche):
- Left-aligned editorial: company name on left, positioning below, thin vertical rule, whitespace on right
- Split 50/50: typographic side + solid color block side (brand primary)
- Full-bleed typography: name dominates, tiny supporting metadata at corners

${PITCH_DECK_SHARED_RULES}

PROJECT CONTEXT:
`;

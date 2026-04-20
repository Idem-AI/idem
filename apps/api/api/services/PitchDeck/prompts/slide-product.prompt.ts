import { PITCH_DECK_SHARED_RULES } from './_shared.prompt';

export const SLIDE_PRODUCT_PROMPT = `
You are designing the PRODUCT / HOW IT WORKS slide.

GOAL:
Explain how the solution works in 3 to 5 clear steps. The investor should grasp the mechanic in under 10 seconds.

MANDATORY CONTENT:
- Slide number "04 / 10" top-right
- Headline: "How it works" or equivalent
- 3 to 5 numbered steps (01, 02, 03, ...), each with a 2-3 word title and a 1-line explanation
- Optional closing line: outcome for the user ("Result: ...")

LAYOUT:
- Horizontal pipeline with thin connectors between steps (plain borders, no illustrations)
- Or: vertical stack on the left + large numeral on the right
- No screenshots, no fake UIs — this is a conceptual flow, not a product demo

${PITCH_DECK_SHARED_RULES}

PROJECT CONTEXT:
`;

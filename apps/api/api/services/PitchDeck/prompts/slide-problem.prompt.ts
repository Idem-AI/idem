import { PITCH_DECK_SHARED_RULES } from './_shared.prompt';

export const SLIDE_PROBLEM_PROMPT = `
You are designing the PROBLEM slide of a pitch deck.

GOAL:
Make the reader feel the pain. Concrete, specific, verifiable.

MANDATORY CONTENT:
- Slide number marker (top-right, small): "01 / 10"
- Headline: "The Problem" or a sharper equivalent (max 4 words)
- Sub-headline: 1 sentence framing WHO suffers and WHY it matters
- 3 concrete pain points, each with a short label + 1-line explanation
- If possible: ONE bold statistic pulled from or consistent with the project context (e.g. "68% of SMBs in West Africa still operate without...")

LAYOUT:
- Clean 3-column grid for pain points OR a vertical stack with numbered markers
- Use small numerals (01, 02, 03) as visual anchors, not PrimeIcons
- Keep each pain point under 22 words
- One statistic displayed large (text-5xl or text-6xl) with a thin descriptor below

${PITCH_DECK_SHARED_RULES}

PROJECT CONTEXT:
`;

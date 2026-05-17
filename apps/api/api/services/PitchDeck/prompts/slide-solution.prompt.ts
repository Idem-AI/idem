import { PITCH_DECK_SHARED_RULES } from './_shared.prompt';

export const SLIDE_SOLUTION_PROMPT = `
You are designing the SOLUTION slide.

GOAL:
Show — in one glance — what the company does and why it is the right answer to the stated problem.

MANDATORY CONTENT:
- Slide number "02 / 10" top-right
- Headline: what the product is (max 6 words)
- One-line value proposition
- 3 key capabilities / pillars (short label + one-line description each)
- Optional: a small "how it works" strip (3 numbered steps, compact)

LAYOUT:
- Left side: headline + value proposition
- Right side: 3 capability cards in a compact column (use thin borders, no heavy shadows)
- Or: 2/3 for capabilities, 1/3 for the how-it-works strip at the bottom
- Keep total word count under ~80 words

${PITCH_DECK_SHARED_RULES}

PROJECT CONTEXT:
`;

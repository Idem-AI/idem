import { PITCH_DECK_SHARED_RULES } from './_shared.prompt';

export const SLIDE_ASK_PROMPT = `
You are designing the ASK / CLOSING slide.

GOAL:
State exactly what is being asked and what it will fund. End with a clean contact block.

MANDATORY CONTENT:
- Slide number "10 / 10" top-right
- Headline: "The Ask" or "Let's build this together"
- Amount raising (e.g. "Seed round — $500K") if the project context supports it; otherwise propose a sensible ask based on scope/targets
- Use-of-funds breakdown (3 buckets with percentages summing to 100: e.g. Product 45% / GTM 35% / Ops 20%)
- Short closing statement (1 sentence)
- Contact block: founder name, email, optional phone/website — pull from project additionalInfos if available

LAYOUT:
- Left half: the ask + use of funds (small horizontal bars per bucket)
- Right half: closing line + contact block, right-aligned

${PITCH_DECK_SHARED_RULES}

PROJECT CONTEXT:
`;

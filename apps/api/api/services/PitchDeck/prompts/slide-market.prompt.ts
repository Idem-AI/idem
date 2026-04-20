import { PITCH_DECK_SHARED_RULES } from './_shared.prompt';

export const SLIDE_MARKET_PROMPT = `
You are designing the MARKET OPPORTUNITY slide.

GOAL:
Prove the market is large, growing, and reachable. Use TAM / SAM / SOM or a comparable framework.

MANDATORY CONTENT:
- Slide number "03 / 10" top-right
- Headline: "Market Opportunity" or equivalent
- TAM, SAM, SOM values with short explanation (adapt to geography — sub-Saharan Africa / OHADA / CFA zone is a plausible default for African startups)
- Key growth trends (2 bullets max, each under 20 words)
- Consistent currency (USD or local) clearly labeled

LAYOUT:
- Three stacked or horizontal "cards" (TAM / SAM / SOM) with very large figures and a short descriptor under each
- Use thin outlines or subtle background tints (bg-[#hex]/10 or similar) — no heavy shadows
- Optional: a minimal horizontal bar chart built with plain Tailwind divs (width percentages) — no Chart.js

${PITCH_DECK_SHARED_RULES}

PROJECT CONTEXT:
`;

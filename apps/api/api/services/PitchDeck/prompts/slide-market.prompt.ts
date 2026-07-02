import { PITCH_DECK_SHARED_RULES } from './_shared.prompt';

export const SLIDE_MARKET_PROMPT = `
<role>Pitch deck designer</role>
<objective>Design the MARKET OPPORTUNITY slide showing TAM, SAM, and SOM numbers.</objective>

<mandatory_content>
- Slide number "03 / 10" top-right
- Headline: "Market Opportunity"
- TAM, SAM, and SOM values with a short description (use USD or local currency consistently).
- Key growth trends (max 2 bullets, under 20 words each).
</mandatory_content>

<layout>
- Display TAM / SAM / SOM as 3 horizontal or vertical cards with huge numbers and tiny descriptors.
- Use thin borders or light fills (e.g., bg-[#hex]/10) without heavy shadows.
- Optional: A simple horizontal bar chart built with Tailwind divs (no external JS libraries).
</layout>

${PITCH_DECK_SHARED_RULES}

<project_context>
`;

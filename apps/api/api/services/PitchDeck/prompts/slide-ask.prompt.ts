import { PITCH_DECK_SHARED_RULES } from './_shared.prompt';

export const SLIDE_ASK_PROMPT = `
<role>Pitch deck designer</role>
<objective>Design the ASK / CLOSING slide. State funding target, use of funds, and contact details.</objective>

<mandatory_content>
- Slide number "10 / 10" top-right
- Headline: "The Ask" or "Let's build this together"
- Funding target (e.g., "Seed round — $500K" or sensible projection based on project context)
- Use of funds (3 buckets summing to 100%, e.g., Product 45% / GTM 35% / Ops 20%)
- Short closing sentence
- Contact info: Founder name, email, website (from project details)
</mandatory_content>

<layout>
- Left: Ask + Use of funds (using small horizontal bars per bucket)
- Right: Closing line + Contact details (right-aligned)
</layout>

${PITCH_DECK_SHARED_RULES}

<project_context>
`;

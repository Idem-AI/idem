import { PITCH_DECK_SHARED_RULES } from './_shared.prompt';

export const SLIDE_BUSINESS_MODEL_PROMPT = `
<role>Pitch deck designer</role>
<objective>Design the BUSINESS MODEL slide. Clearly explain monetization: pricing, tiers, and unit economics.</objective>

<mandatory_content>
- Slide number "05 / 10" top-right
- Headline: "Business Model"
- Primary revenue stream (subscription, transaction fee, commission, licensing, etc.)
- Pricing points (2-3 tiers) with tier name + price + 1-line description (max 2-3 features per tier, no emojis)
- Key unit economics (at least one of: ARPU, LTV, CAC, margin, take rate), displayed prominently.
</mandatory_content>

<layout>
- Left: Short explanation of model (max 40 words)
- Right: Pricing tiers as minimal cards (thin border, no checkmarks mania)
- Bottom: 3 small KPI blocks showing unit economics
</layout>

${PITCH_DECK_SHARED_RULES}

<project_context>
`;

import { PITCH_DECK_SHARED_RULES } from './_shared.prompt';

export const SLIDE_BUSINESS_MODEL_PROMPT = `
You are designing the BUSINESS MODEL slide.

GOAL:
Make the monetization crystal clear: who pays, for what, how much, with what recurrence.

MANDATORY CONTENT:
- Slide number "05 / 10" top-right
- Headline: "Business Model" or equivalent
- Primary revenue stream clearly stated (subscription / transaction fee / commission / licensing / ...)
- Pricing points (2 to 3) with tier name + price + one-line description
- Key unit economics: at least ONE of ARPU, LTV, CAC, gross margin, or take rate — grounded in the project context. Display prominently.

LAYOUT:
- Left: short prose explaining the model (max 40 words)
- Right: pricing tiers as minimal cards (thin border, no emojis, no checkmarks-mania — 2-3 features per tier max)
- Bottom strip: 3 small KPI blocks with the unit economics

${PITCH_DECK_SHARED_RULES}

PROJECT CONTEXT:
`;

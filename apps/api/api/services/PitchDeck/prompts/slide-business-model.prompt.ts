import { PITCH_DECK_SHARED_RULES } from './_shared.prompt';

export const SLIDE_BUSINESS_MODEL_PROMPT = `
<role>Pitch deck designer</role>
<objective>Design the BUSINESS MODEL slide explaining monetization, pricing tiers, and unit economics with clarity.</objective>

<mandatory_content>
- Slide number "05 / 10" top-right
- Headline: "Business Model"
- Primary revenue stream (subscription, commission, transaction fee, etc.)
- Pricing tiers (2-3 tiers) with tier name + price + core highlights.
- Key unit economics (ARPU, LTV, CAC, or gross margin) displayed prominently.
- Optional: A Chart.js chart (Doughnut or Bar) illustrating revenue stream mix rendered using <canvas id="chart-business-model"></canvas> with animation: false.
</mandatory_content>

<layout>
- Split layout: Pricing tier cards on one side, unit economics & revenue stream chart container (<div class="relative w-full h-[200px]"><canvas id="chart-business-model"></canvas></div>) on the other.
</layout>

${PITCH_DECK_SHARED_RULES}

<project_context>
`;


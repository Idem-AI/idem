import { PITCH_DECK_SHARED_RULES } from './_shared.prompt';

export const SLIDE_ASK_PROMPT = `
<role>Senior pitch deck designer at a top-tier design agency</role>
<objective>Design the ASK / CLOSING slide — state the funding target, use of funds, and leave a confident, professional impression.</objective>

<mandatory_content>
- Slide number "10 / 10" in text-xs tracking-widest text-[TEXT COLOR]/40 at top-right.
- Headline: "Construisons ensemble" or "Notre Demande" in text-3xl font-bold text-[PRIMARY COLOR].
- Funding target: prominently displayed (e.g., "Seed — 500K€") in text-4xl font-bold text-[PRIMARY COLOR].
- Use of funds: 3 allocation buckets summing to 100% (e.g., Produit 45%, Acquisition 35%, Opérations 20%). Display as horizontal progress bars with bg-[PRIMARY COLOR] for the filled portion and bg-[PRIMARY COLOR]/10 for the track, with labels.
- Closing sentence in text-lg font-medium text-[TEXT COLOR] (max 15 words, inspiring).
- Contact info: founder name, email, website in text-sm text-[TEXT COLOR]/70.
- Brand logo SVG embedded at the bottom or beside contact info if available.
</mandatory_content>

<layout>
- Split layout: Left 55% with headline, funding target, and use-of-funds bars. Right 45% with closing sentence, contact card (bg-[PRIMARY COLOR]/5 rounded-xl p-6), and logo.
</layout>

${PITCH_DECK_SHARED_RULES}

<project_context>
`;

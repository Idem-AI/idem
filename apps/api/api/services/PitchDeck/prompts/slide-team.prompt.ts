import { PITCH_DECK_SHARED_RULES } from './_shared.prompt';

export const SLIDE_TEAM_PROMPT = `
You are designing the TEAM slide.

GOAL:
Make the team look credible and relevant to the problem at hand.

MANDATORY CONTENT:
- Slide number "08 / 10" top-right
- Headline: "Team" or "Meet the team"
- 3 to 5 team member cards — use the actual team members provided in the project additionalInfos if available; otherwise, propose realistic placeholder roles clearly marked "TBD"
- Each card: name, role, 1-line credibility signal (past experience, domain expertise)
- Optional: bottom line with advisors/partners if relevant

LAYOUT:
- Grid of compact cards, thin borders, no photos generated (if no real picture URL exists, use a plain initial-letters avatar: a small circle with their initials)
- Do NOT invent stock photos
- Keep each card under 30 words

${PITCH_DECK_SHARED_RULES}

PROJECT CONTEXT:
`;

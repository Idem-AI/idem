import { PITCH_DECK_SHARED_RULES } from './_shared.prompt';

export const SLIDE_TEAM_PROMPT = `
<role>Pitch deck designer</role>
<objective>Design the TEAM slide. Highlight core team members, their roles, and credibility.</objective>

<mandatory_content>
- Slide number "08 / 10" top-right
- Headline: "Team" or "Meet the team"
- 3-5 team member cards (from project details if available, otherwise realistic placeholder roles marked "TBD").
- Each card: name, role, and 1-line credibility statement (experience, expertise). Max 30 words per card.
- Optional: Advisors/partners row at the bottom.
</mandatory_content>

<layout>
- Grid of compact cards with thin borders.
- No stock photos. If no photo URL exists, use initials inside a small colored circle as an avatar.
</layout>

${PITCH_DECK_SHARED_RULES}

<project_context>
`;

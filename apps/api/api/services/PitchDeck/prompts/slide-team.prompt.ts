import { PITCH_DECK_SHARED_RULES } from './_shared.prompt';

export const SLIDE_TEAM_PROMPT = `
<role>Pitch deck designer</role>
<objective>Design the TEAM slide. Highlight core team members, their roles, and credibility with professional portraits.</objective>

<mandatory_content>
- Slide number "08 / 10" top-right
- Headline: "Meet the Team"
- 3-4 key team member cards (from project details or realistic domain roles).
- Each card: Name, Role, 1-line background/credibility statement, and a professional avatar image using <img data-image-query="professional business avatar headshot" data-image-prompt="Professional corporate portrait photo" ... class="w-14 h-14 rounded-full object-cover" />.
- Optional: Key advisors or partner logos at the bottom.
</mandatory_content>

<layout>
- Grid of 3-4 team member cards featuring rounded avatar photos, brand accent badges, and clean typography.
</layout>

${PITCH_DECK_SHARED_RULES}

<project_context>
`;


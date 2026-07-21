export const AGENT_EDITORIAL_CALENDAR_PROMPT = `<role>Senior content planner</role>
<objective>Produce an editorial calendar ({{horizonWeeks}} weeks, rhythm={{rhythm}}) for the brand. All items must be publish-ready.</objective>

<output_schema>
{
  "rhythm": "weekly" | "biweekly" | "monthly",
  "horizonWeeks": number,
  "items": [
    {
      "id": "slug-unique",
      "title": "Title (max 80 chars)",
      "hook": "Hook (max 160 chars)",
      "description": "Angle (max 280 chars)",
      "format": "post" | "carousel" | "short-video" | "article" | "newsletter" | "story" | "reel",
      "channel": "instagram" | "linkedin" | "facebook" | "tiktok" | "x" | "youtube" | "blog" | "email" | "other",
      "scheduledFor": "YYYY-MM-DD (ISO date sequential from {{startDate}})",
      "week": number,
      "hashtags": ["3-6 tags, no #"],
      "callToAction": "CTA (max 60 chars)",
      "status": "idea"
    }
  ]
}
</output_schema>

<rules>
- Output ONLY valid JSON. No backticks, code fences, or commentary.
- Generate 3 to 5 items per week. Vary formats and channels.
- Respect channels prioritized in the strategy.
- Use language matching context.language.
- Focus on textual angles; do NOT describe visuals in detail.
</rules>

<project_context>
`;

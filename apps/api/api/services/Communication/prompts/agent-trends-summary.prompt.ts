export const AGENT_TRENDS_SUMMARY_PROMPT = `<role>Market analyst</role>
<objective>Given the project context, produce 3 to 5 current, short industry trend signals for communication planning.</objective>

<output_schema>
{
  "signals": [
    {
      "id": "short-slug-unique",
      "label": "Title (max 60 chars)",
      "description": "Short explanation (max 180 chars)",
      "relevance": 0.0 to 1.0
    }
  ]
}
</output_schema>

<rules>
- Output ONLY valid JSON. No backticks, code fences, or commentary.
- Do not speculate on unverifiable numbers.
- Prefer evergreen structural trends unless context indicates a narrow niche.
</rules>
`;

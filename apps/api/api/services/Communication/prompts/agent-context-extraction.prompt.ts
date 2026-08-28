export const AGENT_CONTEXT_EXTRACTION_PROMPT = `<role>Senior brand strategist</role>
<objective>Extract a compact, structured communication context from the project information, ignoring boilerplate or long paragraphs.</objective>

<output_schema>
{
  "brandName": "Brand Name",
  "businessType": "e.g. B2B SaaS, DTC wellness brand",
  "valueProposition": "one-sentence customer promise",
  "targetAudience": "age, role, pains, desires",
  "objectives": ["3-5 objectives"],
  "tone": "e.g. confident, warm, pragmatic",
  "keywords": ["5-10 SEO keywords"],
  "channels": ["primary channels"],
  "language": "ISO language code (en, fr...)"
}
</output_schema>

<rules>
- Output ONLY valid JSON. No backticks, "json" prefix, or commentary.
- Keep every string under 240 characters (dense, not verbose).
- Infer missing fields reasonably. Never invent brand name; use the project name.
</rules>

<project_context>
`;

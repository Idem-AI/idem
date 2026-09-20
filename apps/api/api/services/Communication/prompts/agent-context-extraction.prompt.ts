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
  "channels": ["2-4 values from the channel list below, lowercase, nothing else"],
  "language": "ISO language code (en, fr...)"
}
</output_schema>

<channels>
"channels" is a CLOSED list. Use these exact lowercase values and no others:
instagram · linkedin · facebook · tiktok · x · youtube · blog · email

Write "x" for Twitter/X, "blog" for a website or articles, "email" for a
newsletter. Never write a display name ("Instagram"), a generic term ("social
media"), a combination ("instagram & facebook") or a value outside this list:
they are discarded downstream, and the brand loses the channel you meant.
Pick the 2 to 4 where this audience actually is — not every channel that exists.
</channels>

<rules>
- Output ONLY valid JSON. No backticks, "json" prefix, or commentary.
- Keep every string under 240 characters (dense, not verbose).
- Infer missing fields reasonably. Never invent brand name; use the project name.
</rules>

<project_context>
`;

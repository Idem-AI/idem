/**
 * Lightweight "trend signals" summariser.
 *
 * By default the service serves cached signals derived from periodic jobs or
 * external APIs. If none are cached, we ask the LLM to produce a SHORT list
 * of plausible industry signals from the context. This is intentionally
 * minimal to keep token usage low.
 */
export const AGENT_TRENDS_SUMMARY_PROMPT = `
You are a market analyst.

TASK
Given the CONTEXT, produce 3 to 5 current industry trend signals relevant for
communication planning. Keep each signal SHORT.

OUTPUT FORMAT (STRICT JSON — NO PROSE, NO MARKDOWN, NO CODE FENCES)
{
  "signals": [
    {
      "id": string,               // short slug, unique
      "label": string,             // <= 60 chars
      "description": string,       // <= 180 chars
      "relevance": number          // 0..1
    }
  ]
}

RULES
- Output ONLY valid JSON. No backticks, no commentary.
- Avoid speculation about numbers you cannot verify.
- Prefer evergreen structural trends (e.g., "short-form video dominates reach")
  unless the context clearly implies a narrow niche.
`;

/**
 * Step 1 - Communication Strategy.
 *
 * Receives the compact CommunicationContext + lightweight trend signals and
 * produces a structured, editable strategy.
 */
export const AGENT_COMMUNICATION_STRATEGY_PROMPT = `
You are a world-class communication strategist.

TASK
Produce a clear, structured communication strategy for the brand described
in CONTEXT below. Keep it actionable — no fluff.

OUTPUT FORMAT (STRICT JSON — NO PROSE, NO MARKDOWN, NO CODE FENCES)
{
  "summary": string,                               // 2-3 sentences
  "blocks": [
    {
      "id": string,                                // short slug, unique
      "kind": "positioning" | "pillars" | "messaging" | "channels" | "cadence" | "kpis" | "tone" | "custom",
      "title": string,
      "body": string                               // markdown allowed, <= 900 chars
    }
  ]
}

MANDATORY BLOCKS (in this order)
1. kind="positioning"  — unique angle vs competitors
2. kind="pillars"      — 3-5 content pillars with 1-line rationale each
3. kind="messaging"    — headline message + 2-3 supporting messages
4. kind="channels"     — prioritized list of channels with a rationale
5. kind="cadence"      — posting frequency per channel (weekly)
6. kind="kpis"         — 3-5 measurable KPIs
7. kind="tone"         — voice & tone rules (do / don't)

RULES
- Output ONLY valid JSON. No backticks, no commentary.
- Leverage the CONTEXT as the single source of truth.
- If TRENDS are provided, reflect 1-2 of them inside "pillars" or "messaging",
  never fabricate trend data.
- Keep language consistent with context.language.
`;

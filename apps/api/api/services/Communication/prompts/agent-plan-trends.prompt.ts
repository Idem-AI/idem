/**
 * Tendances ACTUELLES d'un projet, lues sur le web (appel fondé) avant de planifier.
 * Un seul appel : la recherche ET la mise en forme JSON.
 */
export const AGENT_PLAN_TRENDS_PROMPT = `<role>Social media analyst, with web search</role>
<objective>Find what is working RIGHT NOW (this month) in social communication for this kind of business and market: content formats, topics, hooks, hashtags, seasonal themes, platform behaviours. Period to plan: {{PERIOD_START}} → {{PERIOD_END}}.</objective>
<rules>
- Use only what the search results show; each trend must come from a result. Never invent a statistic.
- Prefer trends that a small business of this kind can act on this period; ignore generic advice ("post regularly").
- Give 4 to 5 trends. Output ONLY valid JSON: { "trends": [ { "label": "max 60 chars", "description": "max 180 chars: what it is and how this brand can use it" } ] }. Write in the language given by context.language.
- Favour the country and language of the market when the context gives them.
</rules>
`;


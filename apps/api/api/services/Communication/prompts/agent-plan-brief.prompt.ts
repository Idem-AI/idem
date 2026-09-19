/**
 * Brief éditorial d'UNE période.
 *
 * Ce n'est pas une stratégie : la stratégie (la « boussole ») existe déjà au
 * niveau de la marque et coûte 40 crédits. Ici on DÉRIVE d'elle l'angle d'une
 * fenêtre de temps précise — cinq champs courts, pas sept blocs de prose.
 *
 * La contrainte de forme est délibérée : un brief qu'on ne lit pas ne pilote
 * rien, et c'est le brief qui nourrit ensuite la génération des contenus.
 */
export const AGENT_PLAN_BRIEF_PROMPT = `<role>Communication lead briefing a period of activity</role>
<objective>Derive, from the brand compass and the user's objective, the editorial line of ONE specific period. Short, decided, actionable.</objective>

<output_schema>
{
  "angle": "1-2 sentences: the angle of THIS period. What makes these weeks different from the rest of the year.",
  "keyMessage": "ONE sentence the audience should remember by the end of the period. Max 140 chars.",
  "themes": [
    { "label": "Theme name (max 40 chars)", "why": "Why it serves the objective (max 140 chars)" }
  ],
  "successSignals": ["1 to 3 concrete, observable indicators — no vanity metric"],
  "occasions": [ { "label": "Occasion name", "date": "YYYY-MM-DD" } ]
}
</output_schema>

<rules>
- Output ONLY valid JSON. No backticks, no code fences, no commentary.
- 2 to 4 themes. Each must be usable as a content bucket, not a slogan.
- The angle must be SPECIFIC to the period dates and the stated objective. "Increase visibility" is not an angle.
- Respect the brand compass: never contradict its positioning, its tone or its prioritised channels.
- OCCASIONS: only keep those that fall INSIDE the period AND make sense for this brand. Copy the dates verbatim from the provided list. Empty array if none fits — an irrelevant occasion costs more credibility than it earns reach.
- successSignals must be checkable by a small business owner without an analytics tool (e.g. "20 replies in DM", "5 shop visits mentioning the post"), unless the brand clearly operates online.
- Write in the language given by context.language.
</rules>

<period>
Name: {{PLAN_NAME}}
From {{PERIOD_START}} to {{PERIOD_END}} ({{PERIOD_WEEKS}} weeks, {{PERIOD_DAYS}} days)
Kind: {{PLAN_KIND}}
User objective: {{PLAN_OBJECTIVE}}
Channels retained: {{PLAN_CHANNELS}}
Occasions falling in this window (candidates): {{PERIOD_OCCASIONS}}
</period>
`;

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
  "audience": "The ONE main audience of this period and the tension it lives (max 160 chars). Name real situations, not demographics.",
  "franchises": [
    { "name": "Short memorable name of a weekly rendez-vous (max 30 chars)", "role": "participation | identification | teaching | behind", "weekday": 1-7 (1 = Monday), "mechanisms": ["3 to 5 different ways to run it, rotated from one week to the next"] }
  ],
  "successSignals": ["1 to 3 concrete, observable indicators — no vanity metric"],
  "occasions": [ { "label": "Occasion name", "date": "YYYY-MM-DD" } ]
}
</output_schema>

{{PRINCIPLES}}

<rules>
- FRANCHISES: 0 to 2 weekly rendez-vous that make the brand recognisable by their form, not by repeating the same sentence. Typically ONE of role "participation" (a playful, quick-to-solve mechanism the audience answers: a riddle, a code, a poll, a challenge, a quiz — doable on a phone in under a minute, with the answer revealed the SAME day) and ONE of role "identification" (a recurring humorous or touching everyday situation of the audience, ending on the brand's help — laugh WITH the person, never AT them). Pick them from what this brand and its audience really are (a restaurant is not a software company); return [] when the period is under 3 weeks or nothing fits. Two franchises never share a weekday; the other contents of the week are the "main" posts.
- audience: ONE main audience per period; if the brand has several, choose the one this objective serves.
- Output ONLY valid JSON. No backticks, no code fences, no commentary.
- 2 to 4 themes. Each must be usable as a content bucket, not a slogan.
- The angle must be SPECIFIC to the period dates and the stated objective. "Increase visibility" is not an angle.
- Respect the brand compass: never contradict its positioning, its tone or its prioritised channels.
- OCCASIONS: only keep those that fall INSIDE the period AND make sense for this brand. Copy the dates verbatim from the provided list. Empty array if none fits — an irrelevant occasion costs more credibility than it earns reach.
- TRENDS: build the angle and the themes so that at least one of them rides a trend from the list, adapted to the brand. Never invent a trend.
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
Current trends found on the web for this market: {{PERIOD_TRENDS}}
</period>
`;

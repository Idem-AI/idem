/**
 * Contenus datés d'une période.
 *
 * Écart décisif avec l'ancien `agent-editorial-calendar.prompt.ts` : le modèle
 * reçoit des BORNES RÉELLES (`{{PERIOD_START}}` → `{{PERIOD_END}}`) et non
 * « aujourd'hui + N semaines ». C'est ce qui permet de préparer décembre en
 * novembre, ou une campagne qui démarre dans trois semaines.
 *
 * Le nombre de contenus n'est pas demandé à l'utilisateur : il se déduit de la
 * cadence et de la durée, et arrive ici déjà calculé (`{{ITEM_COUNT}}`).
 */
export const AGENT_PLAN_CONTENT_PROMPT = `<role>Senior content planner</role>
<objective>Produce exactly {{ITEM_COUNT}} publish-ready content ideas, dated between {{CHUNK_START}} and {{CHUNK_END}} (a slice of the period {{PERIOD_START}} → {{PERIOD_END}}), executing the period brief.</objective>

<output_schema>
{
  "items": [
    {
      "id": "slug-unique",
      "title": "Title (max 80 chars)",
      "hook": "Hook (max 160 chars)",
      "description": "Angle (max 280 chars)",
      "format": "post" | "carousel" | "short-video" | "article" | "newsletter" | "story" | "reel",
      "channel": {{CHANNEL_ENUM}},
      "scheduledFor": "YYYY-MM-DD — MUST be between {{CHUNK_START}} and {{CHUNK_END}} inclusive",
      "pillar": "reality-education | demonstration | proof | culture | vision | activation",
      "franchise": "name of the weekly rendez-vous this content belongs to — ONLY when it does, else omit",
      "mechanism": "what makes it memorable in max 80 chars: the riddle, the contrast, the scene, the demonstration, the angle (never 'engaging content')",
      "anchor": "ONE sentence (max 160 chars) that carries the brand name, what the brand is, its concrete role in THIS content and the benefit for the audience",
      "kpi": "the one indicator to read for this content (shares, saves, replies, link clicks, messages…) — max 40 chars",
      "trend": "label of the brief trend this content rides — ONLY when it does, else omit",
      "audience": "ONLY when it differs from the period's main audience, else omit (max 80 chars)",
      "visualBrief": "Posts, carousels, stories (NOT videos): what the image must SHOW — one concrete subject in its setting (who/what/where), the mood, and the ONE message to read on it in at most 8 words. Max 220 chars. Never a generic stock scene.",
      "hashtags": ["3 to 5 tags that serve discovery, no # sign, none decorative"],
      "callToAction": "CTA for the post CAPTION, never printed on the visual (max 60 chars)",
      "intent": "awareness" | "celebration" | "promotion" | "recruitment" | "announcement",
      "videoType": "ONLY when format is reel or short-video: kinetic (typography) | product (product photos) | promo (offer, price) | footage (real-life clips) | showcase3d (3D object) | illustrated (animated illustrations) | slideshow (photo series) | logo (logo reveal) | mix (combines several, for richer stories)",
      "videoDurationSec": "ONLY when format is reel or short-video: 60 | 90 | 120 | 180 (seconds)",
      "theme": "label of the brief theme this content serves",
      "occasion": "occasion name — ONLY for contents tied to one, omit otherwise",
      "status": "idea"
    }
  ]
}
</output_schema>

<dating_rules>
These rules are arithmetic, not style — a date outside the period makes the content unusable.
- Every scheduledFor falls within [{{CHUNK_START}}, {{CHUNK_END}}].
- Spread the contents EVENLY across the period: about {{POSTS_PER_WEEK}} per week, never two on the same day unless they target different channels.
- A content tied to an occasion is dated ON the occasion date, or 1 to 2 days BEFORE it — never after: a birthday wish that arrives late is worse than none.
- Occasions to place: {{PERIOD_OCCASIONS}}
</dating_rules>

{{PRINCIPLES}}

<method>
- PERIOD ARC for this slice (follow it: each week moves the audience's understanding forward): {{ARC_LINE}}
- PILLAR QUOTA for this slice (exactly): {{PILLAR_QUOTA}}. Pillars: reality-education (real blockers and practical teaching useful even without the brand), demonstration (the brand in action, a real deliverable, a before/after), proof (what is verifiable and the limits — never invented), culture (humour and situations the audience recognises), vision (why the brand exists, community), activation (a direct, explicit invitation).
- WEEKLY FRANCHISES (rendez-vous): {{FRANCHISES}}. Each franchise content is dated ON its weekday; its mechanism differs from the previous one of the same franchise (rotate the list). A "participation" content states the challenge in the visual/hook and puts the REVEAL (the answer + the link with the brand) in its description so it can be published the same day. An "identification" content is built as situation → tension → punchline → the brand's concrete help.
- Each content has ONE audience tension, ONE idea, ONE call to action. The caption must give a reason to share ("this is exactly him", "this can help her", "I want to see if he solves it").
</method>

<editorial_rules>
- Output ONLY valid JSON. No backticks, no code fences, no commentary.
- Each content must serve one of the brief's themes, and the set must cover ALL of them.
- Other slices of the period are written in parallel by other planners: {{SLICE_NOTE}}
- Vary formats, channels and mechanisms: never two consecutive contents with the same construction.
- Adapt to the channel: the same idea is written differently for a professional network (credibility, point of view, proof), a family network (warm, conversational, a question) and a short-text network (one punchy observation). Never the same caption everywhere.
- Vary formats and channels. Only use the channels listed in the enum above — they are the ones the user retained.
- Video performs best on social networks: at least one content in three is a video (format "reel" or "short-video") on the networks that favour it (TikTok, Instagram, Facebook, YouTube, LinkedIn). Give each video the videoType that fits its angle and what the brand can show.
- Every video lasts BETWEEN 1 AND 3 MINUTES — never a 15-second clip. Set videoDurationSec to 60, 90, 120 or 180 and VARY it across the videos of the period: a quick teaser or announcement ≈ 60, a story or product demo ≈ 90, a tutorial or behind-the-scenes ≈ 120, a testimonial or deep dive ≈ 180. Never give all videos the same duration.
- No two contents may share the same angle reworded. If you catch yourself writing "discover our…" twice, one of the two is filler.
- For posts, carousels and stories: give a visualBrief — the subject and the message only. Layout, colours, fonts and logo are NOT yours: another agent composes them from the brand charter.
- Videos: only give their videoType and videoDurationSec — their production plan is written afterwards by another agent.
- TRENDS: the brief carries trends found on the web, each with its creative MECHANISM and an observation date. At least one third of the contents rides one of them by reusing the mechanism with the brand's own subject (set the "trend" field). Never invent a trend that is not in the brief; never copy a meme, sound or format as is.
- Write in the language given by context.language.
</editorial_rules>

<period_brief>
{{PLAN_BRIEF}}
</period_brief>
`;

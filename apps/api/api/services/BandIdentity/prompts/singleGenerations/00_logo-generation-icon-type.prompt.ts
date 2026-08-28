import { LOGO_SYSTEM_BASE } from "./00_logo-system-base.prompt";

/**
 * Type ICON = icône + nom de marque.
 *
 * Le modèle ne dessine QUE l'icône, sur un carré. Le nom est ensuite composé
 * par le serveur (logoLockup.service) avec les métriques réelles de la police
 * choisie par l'utilisateur, puis vectorisé. Raison : un LLM ne connaît ni la
 * largeur d'encre d'un mot, ni sa hauteur de capitale, ni sa ligne de base — il
 * les estimait, d'où un texte tantôt décalé, tantôt rogné, et une typographie
 * qui retombait sur une police système au moment du rendu.
 */
export const LOGO_GENERATION_ICON_TYPE_PROMPT = `
${LOGO_SYSTEM_BASE}

<module_icon_based_logo>
This is the ICON + WORDMARK logo type. YOU DRAW THE ICON ONLY.

PIPELINE — READ THIS FIRST (it overrides every wordmark instruction above):
- The brand name is NOT your job. It is typeset by the rendering pipeline, in the
  exact DESIGN PALETTE font, with real font metrics, and locked to the icon with
  exact optical alignment.
- Therefore: the SVG you return contains ZERO <text>, ZERO <tspan>, ZERO letterforms
  and ZERO lockup. Any text you add is deleted before rendering — adding some only
  wastes your budget.
- You describe the wordmark's STYLE through JSON fields (color, tracking, weight,
  arrangement). Nothing else about the text is yours to decide.

ICON RULES:
- Max 2 shapes (aim for 2, accept 3 only if structurally necessary).
- Must communicate the brand's primary value in under 1s — by evocation, never by
  literal product depiction.
- Must satisfy the chosen SYMMETRY MODE standalone on a square canvas (symmetry by
  construction: build one half/unit, derive the twin mathematically).
- Must work as a standalone app icon (min 40x40px) AND remain distinctive as a pure
  silhouette.
- Must pass the BLACK-AND-WHITE TEST on its own: with all fills set to #111111, the
  icon still reads perfectly.

ICON CONSTRUCTION (square canvas, viewBox="0 0 100 100"):
- u = 100 / 8 = 12.5 (modular grid). Every coordinate is a multiple of u/2 = 6.25,
  then optically corrected.
- The mark is centered on (50, 50) and fills 76 to 92 units of the canvas in its
  dominant dimension — no cramped mark, no mark touching the edges.
- Keep ≥ 4 units of empty margin on every side. The pipeline measures the real ink
  box and re-scales the icon, so DO NOT pad asymmetrically to "fake" a balance.
- Snap coordinates to u/2. Ratios follow Golden or Rational scale. Overshoot: 2% of
  the canvas.
- All angles canonical {0°, 15°, 30°, 45°, 60°, 90°}; one stroke width (two max)
  from the modular set.
- Negative space inside and around the icon is designed on the same grid —
  counters ≥ 1.5u.

WORDMARK STYLE (JSON fields only — you never draw it):
- "wordmarkColor": one DESIGN PALETTE color, or a rich near-black (#0B1220 - #1A1A2E).
  Pick the value that reads best next to the icon on a white background; contrast
  with white must be ≥ 4.5:1.
- "wordmarkTracking" (letter-spacing in em):
  * tech_precision / finance_trust / luxury_heritage => 0.08
  * tech_human / health_care / creative_studio => 0
  * energy_motion => -0.02
- "wordmarkWeight": 600 or 700.
- "lockupArrangement": "horizontal" (name to the right of the icon — default) or
  "stacked" (name centered under the icon, for very long names or tall icons).
  The pipeline switches to "stacked" on its own if the name is too wide.

ICON QUALITY GATES:
- No text of any kind in the SVG; viewBox is exactly "0 0 100 100".
- Icon works standalone and passes the black-and-white + silhouette tests.
- Icon satisfies its symmetry mode on the square canvas (computed twins, not eyeballed).
- One corner language, ≤ 2 stroke widths, canonical angles only.
- Only DESIGN PALETTE colors.

OUTPUT — the JSON object of the base prompt, where:
- "svg" = the ICON ONLY, viewBox="0 0 100 100".
- "layout" = { "textPosition": "right", "spacing": 0, "totalWidth": 100, "totalHeight": 100 }
- plus the four wordmark style fields:
  "wordmarkColor": "#HEX",
  "wordmarkTracking": <number>,
  "wordmarkWeight": <600|700>,
  "lockupArrangement": "horizontal" | "stacked"
</module_icon_based_logo>
`;

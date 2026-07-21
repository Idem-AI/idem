import { LOGO_SYSTEM_BASE } from "./00_logo-system-base.prompt";

export const LOGO_GENERATION_PROMPT = `
${LOGO_SYSTEM_BASE}

<module_universal_logo_generator>
No specific logo type is pre-determined. Select the best format based on constraints (Mollerup taxonomy: pictorial/abstract mark + wordmark, monogram, or logotype).

TYPE SELECTION LOGIC:
- If user specified a preference -> honor it.
- If brand name is 1-3 letters / acronym -> INITIAL type (80x80).
- If brand name is 4-12 letters, simple -> ICON type (80px tall, variable width).
- If brand name is long / typography-centric -> NAME type (60px tall, variable width).

ICON TYPE RULES (if selected):
- Icon: max 2 shapes, 48x48px box, grid u=6, symmetric by construction (one half/unit computed, twin derived), optical center: (24, totalHeight/2 - 1).
- Canonical angles only; one stroke width; negative space drawn on the grid; evocation, never literal product depiction.
- Wordmark: real <text> with palette font, right of icon, gap=12, font-size=28, weight=700.
- Width: W = 48 + 12 + (chars * 28 * 0.62 * 1.12), rounded up to nearest 4px.
- viewBox="0 0 [W] 80", layout.textPosition = "right".

INITIAL TYPE RULES (if selected):
- 2-3 initials only. No full name, no icon. Letters are real type or grid-constructed paths — never freehand.
- viewBox="0 0 80 80", container centered on (40,40), clear-space ring ≥ 12px empty.
- 2 letters: x=26.5 and 53.5 (computed twins across x=40), shifted 1px up.
- Container: circle (r=36), square/rounded (72x72 at 4,4), or none.
- font-size: 30-34px, weight: 700-800, exactly one advanced technique.
- layout.textPosition = "center".

NAME TYPE RULES (if selected):
- Full name, real typography only, no icon, no freehand glyphs.
- viewBox="0 0 [W] 60", baseline y=38 (descenders inside).
- Width: W = ceil((chars * font_size * 0.62 * 1.12 + 40) / 10) * 10 — side margins are the clear space.
- Exactly one typographic technique, optical kerning (tight pairs adjusted). Font-size: 30-42px.
- layout.textPosition = "center".

QUALITY GATES:
- Correct type choice.
- Black-and-white test passed (design carried by shape, not color); silhouette distinctive.
- No clipped text; clear space respected.
- Only DESIGN PALETTE colors; ≤ 2 stroke widths; canonical angles.
- layout dimensions match viewBox.
</module_universal_logo_generator>
`;

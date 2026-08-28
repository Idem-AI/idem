import { LOGO_SYSTEM_BASE } from "./00_logo-system-base.prompt";

export const LOGO_GENERATION_INITIAL_TYPE_PROMPT = `
${LOGO_SYSTEM_BASE}

<module_initial_based_logo>
Initials-only logo (monogram, Mollerup taxonomy). The LETTERS themselves are the mark.

THIS IS NOT AN ICON LOGO AND NOT A WORDMARK. Hard constraints (auto-reject on violation):
- The mark is 2 (preferred) or 3 UPPERCASE INITIALS, optionally sitting inside ONE
  simple geometric container (circle/square/rounded). The letters MUST be visible,
  dominant, and readable AS LETTERS — a viewer instantly reads "AB", not a picture.
- FORBIDDEN: pictorial/abstract symbols, illustrations, mascots, or any shape that
  reads as an icon rather than a letter. The container is a plain frame ONLY — never a
  pictogram, never a symbol with meaning of its own.
- FORBIDDEN: the full brand name or any word. Initials only.
- FORBIDDEN: icon-left + text-right lockups. There is NO wordmark here.
- viewBox is exactly "0 0 80 80" (square). If your draft looks like a symbol with a
  word beside it, or a picture inside a circle, it is WRONG — restart as pure letters.
- Distinctiveness comes from HOW the initials are drawn (weight, overlap, cutout,
  color split), never from adding a graphic next to them.

LETTER RULES (Bringhurst — letterforms are typography, not drawings):
- Max 2 initials (preferred) or 3 initials maximum. No full words. UPPERCASE unless specified.
- Letters come from a real font (<text> with palette font stack) OR from <path> letterforms constructed on the grid with canonical angles — never freehand-approximated glyph outlines.
- The monogram must pass the BLACK-AND-WHITE TEST on its own: container + letters in #111111 and white must remain perfectly readable and hierarchical.

CONTAINERS (Choose one based on archetype — parametric, computed geometry only):
- circle_container: cx=40, cy=40, r=36.
- square_container: 72x72 rect at (4,4), rx=8.
- rounded_container: 72x72 rect at (4,4), rx=20.
- no_container: letters only, no background shape.
- custom_shape: shape derived from letters, built from primitives on the grid (regular polygon vertices computed, arcs via kappa).
Container is ALWAYS centered on (40, 40). Container stroke (if any) uses the mark's single stroke width.

CONSTRUCTION GRID (80x80 ViewBox, Müller-Brockmann):
- viewBox: "0 0 80 80", u = 10, snap to u/2 (5).
- Letter zone: 56x56 centered at (40, 40). Padding ≥ 12px — this ring is the CLEAR SPACE, nothing enters it.
- 2 letters: optical centers at (26.5, 40) and (53.5, 40) (axial_vertical symmetry — the two centers are computed twins across x=40).
- 3 letters: centers at (40 - zone/3, 40), (40, 40), (40 + zone/3, 40).
- Optical vertical center: shift 1px upward.
- Overshoot circles/pointed letter parts 2%.
- All angles canonical {0°, 15°, 30°, 45°, 60°, 90°}; radii and gaps from the modular set (u/2, u, 1.5u, 2u).

SIZING & COLORS (constrained palette — never invent hex):
- 2-letter: font-size 30-34px. 3-letter: font-size 22-26px. Bold (700-800 weight).
- Wide/narrow pairs (e.g. "MI"): shift 1-2px toward narrow letter to balance optical center.
- Colored container -> white letters; light container -> colored letters. Letter/container contrast must survive grayscale conversion.
- Colors come ONLY from the DESIGN PALETTE + white + near-black (#0B1220-#1A1A2E).

ADVANCED TECHNIQUES (Apply exactly ONE — the single deliberate idea that makes the mark distinctive):
- OVERLAP: overlap zones use opacity 0.85 (no filters).
- CUTOUT: negative space is drawn as consciously as the fill — use fill-rule="evenodd" (reversed inner path direction, no background-colored shapes).
- WEIGHT CONTRAST: one letter Bold (700+), the other Light (300).
- COLOR SPLIT: each letter in different brand color (equal luminance — hierarchy must still read in grayscale).
- ROTATION: rotate one letter by a canonical angle (±15°) and balance the other letter's mass.
- MONOGRAM LOCK: letters share one stroke joint on symmetry axis (x=40), same stroke width on both sides.

TECHNICAL:
- individual <text> elements (text-anchor="middle", dominant-baseline="central", font-size in px) or <path> for perfect control.

LAYOUT JSON (copy verbatim — always 80×80):
"layout": {
  "textPosition": "center",
  "spacing": 0,
  "totalWidth": 80,
  "totalHeight": 80
}

CONCRETE OUTPUT EXAMPLE (structure to imitate — NOT the colors/initials to copy; two
initials "LN" in a circle container, WEIGHT CONTRAST technique, viewBox 80×80):
{
  "id": "concept01",
  "archetype": "finance_trust",
  "seed": "seed_A",
  "name": "Lumina Monogram",
  "concept": "Two initials locked in a calm circle; the bold L grounds the mark while the light N adds lift, a weight contrast that signals stability with a modern edge.",
  "colors": ["#1A1A2E", "#FFFFFF"],
  "fonts": ["Helvetica Neue"],
  "svg": "<svg viewBox=\\"0 0 80 80\\" xmlns=\\"http://www.w3.org/2000/svg\\"><circle cx=\\"40\\" cy=\\"40\\" r=\\"36\\" fill=\\"#1A1A2E\\"/><text x=\\"26.5\\" y=\\"39\\" text-anchor=\\"middle\\" dominant-baseline=\\"central\\" font-family=\\"Helvetica Neue, Arial, sans-serif\\" font-size=\\"32\\" font-weight=\\"800\\" fill=\\"#FFFFFF\\">L</text><text x=\\"53.5\\" y=\\"39\\" text-anchor=\\"middle\\" dominant-baseline=\\"central\\" font-family=\\"Helvetica Neue, Arial, sans-serif\\" font-size=\\"32\\" font-weight=\\"300\\" fill=\\"#FFFFFF\\">N</text></svg>",
  "layout": { "textPosition": "center", "spacing": 0, "totalWidth": 80, "totalHeight": 80 }
}
Note: only a container + readable letters. No pictogram, no word, viewBox "0 0 80 80".

QUALITY GATES:
- No full name present.
- Combined letter mass optically centered at (40, 39).
- Container centered; clear-space ring empty.
- Exactly one advanced technique used.
- Black-and-white test passed; silhouette recognizable; legible at 16x16px.
- ≤ 2 stroke widths; only palette colors.
</module_initial_based_logo>
`;

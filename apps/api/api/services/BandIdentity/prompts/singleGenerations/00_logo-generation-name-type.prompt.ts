// ─────────────────────────────────────────────────────────────────────────────
// LOGO_GENERATION_NAME_TYPE_PROMPT.ts
// Logo typographique pur — pas d'icône (Coca-Cola, Google, FedEx, Sony style)
// Injecte LOGO_SYSTEM_BASE + module différentiel NAME
// ─────────────────────────────────────────────────────────────────────────────

import { LOGO_SYSTEM_BASE } from "./00_logo-system-base.prompt";


export const LOGO_GENERATION_NAME_TYPE_PROMPT = `
${LOGO_SYSTEM_BASE}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MODULE — NAME-BASED LOGO (WORDMARK)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This is a WORDMARK logo. Typography IS the complete logo. No icon, no symbol.
The letterforms must carry the entire brand identity.

THE WORDMARK IMPERATIVE
A wordmark is not "just text". It is a precision typographic object where:
- Every letter is optically adjusted
- Spacing is manually kerned (not auto-kerned)
- Weight, case, and tracking communicate the brand personality
- One letter or letterform pair may contain a hidden meaning (FedEx arrow principle)
For a wordmark, the symmetry mode is almost always balanced_asym: the text block
itself is centered on x = W/2 and its left/right visual masses must balance.

TYPOGRAPHIC STRATEGY — pick one based on archetype:
  WEIGHT_STATEMENT   → single weight, extreme bold or extreme thin (Sony, Vogue)
  COLOR_SEQUENCE     → each letter in a different brand color (Google, eBay)
  TRACKING_PLAY      → extreme letter-spacing for luxury or openness (BOSE, IKEA)
  CASE_CONTRAST      → mix of upper and lowercase for personality (adidas, iPhone)
  LETTERFORM_HACK    → one letter is modified (extended arm, cut, custom shape)
  BASELINE_RHYTHM    → alternating baseline shifts for dynamism
  WEIGHT_CONTRAST    → some letters bold, others light (Pandora style)
  HIDDEN_ELEMENT     → negative space between letters creates a shape (FedEx arrow)

CONSTRUCTION GRID
  viewBox: "0 0 [W] 60" · u = 60/8 = 7.5
  Baseline: y = 38 (leaves optical room above; descenders of g/y/p/q stay inside —
    descender depth ≈ 0.22 × font-size must remain above y = 60)
  For centered marks: text-anchor="middle", x = W/2
  For left-aligned marks: text-anchor="start", x = 20

  WIDTH MATH (strict — prevents clipping):
    text_width = char_count × font_size × 0.62 + (char_count − 1) × tracking_px
    totalWidth = ceil((text_width × 1.12 + 40) / 10) × 10   (12% margin + 20px each side)

  Standard dimensions by name length (sanity check your math against this table):
    4 chars  → totalWidth ≈ 160,  font-size: 42
    5 chars  → totalWidth ≈ 200,  font-size: 40
    6 chars  → totalWidth ≈ 220,  font-size: 38
    7 chars  → totalWidth ≈ 250,  font-size: 36
    8 chars  → totalWidth ≈ 280,  font-size: 34
    9+ chars → totalWidth ≈ 320+, font-size: 30

OPTICAL KERNING SYSTEM
  Use individual <tspan> or <text> elements with explicit x positions when custom
  kerning is needed. Standard letter-spacing:
    - Normal brands: letter-spacing="0"
    - Luxury/open: letter-spacing="0.15em"
    - Compact/tech: letter-spacing="-0.03em"
  Optical kerning corrections (apply manually):
    - Tight pairs (AV, VA, WA, AW, TO, LT, LY, To, Yo): reduce gap by 1-2px
    - Round-round pairs (OO, OC, GO): reduce gap by 1px
    - Straight-straight pairs (HI, IL, NM): add 0.5-1px — verticals crowd each other
  Round letters (O, C, G, Q, S) overshoot baseline and cap-height by ~1.5% of
  font-size — when drawing letters as paths, include this overshoot.

COLOR WORDMARK TECHNIQUES

  SINGLE COLOR (professional default)
    All letters same color. Weight and form carry the brand.

  MULTI-COLOR SEQUENCE (brand with multiple values)
    Assign each letter a color from the brand palette.
    Use individual <text> or <tspan fill="..."> per letter.
    Colors must follow a logical sequence (not random) and have matched luminance
    (±10%) so no letter visually "drops out".
    Works best for 4-8 letter names.

  GRADIENT WORDMARK (premium, linear)
    One linearGradient from primary to secondary color.
    Horizontal (x1=0, x2=1, y1=0, y2=0) for motion · vertical for depth.
    Use only when the gradient adds conceptual meaning.

LETTERFORM MODIFICATION TECHNIQUES
  EXTENDED ARM: extend a horizontal stroke 4-8px beyond normal (the modified letter's
    extension must align with the grid: multiple of u/2)
  CROSSBAR CUT: remove the crossbar of an H or A for minimalism (verify the letter
    stays readable at 16px — if ambiguous, choose another technique)
  JOINED STROKE: connect two adjacent letters at one shared stroke point
  CUSTOM TERMINAL: replace a rounded terminal with a geometric cut or angle
  ASCENDER PLAY: extend or reduce an ascender to create visual interest
  Apply at most ONE modification per wordmark, drawn as <path> for that letter only.
  Name the modified letter in the concept field.

HIDDEN ELEMENT TECHNIQUE (seed_C or seed_D only)
  1. Identify two adjacent letters that create natural negative space
  2. Embed a relevant symbol in that space (arrow, star, leaf, spark…)
  3. The symbol must be discoverable but not immediately obvious
  4. The negative shape must survive the 16px test (≥ 1.5u wide)
  5. Describe the hidden element in the concept field

CASE RULES BY ARCHETYPE
  tech_precision / finance_trust     → UPPERCASE, tight tracking
  tech_human / health_care           → lowercase or Title Case, normal tracking
  luxury_heritage                    → UPPERCASE, wide tracking, light weight
  energy_motion                      → UPPERCASE, compressed tracking, bold
  creative_studio                    → Mixed case, custom spacing
  sustainability                     → lowercase, natural spacing

SVG WORDMARK QUALITY RULES
  - Never use a single <text> element for multi-color wordmarks → <tspan fill="...">
  - Modified letterforms → <path> for that specific letter only
  - All letters on the same y baseline (dominant-baseline="auto"); BASELINE_RHYTHM
    shifts are explicit ±2-4px offsets, identical for all shifted letters
  - text-anchor consistency: all letters anchor from the same reference point
  - UPPERCASE marks: letter-spacing ≥ 0.05em for optical breathing

LAYOUT JSON FOR NAME TYPE
  "layout": {
    "textPosition": "center",
    "spacing": 0,
    "totalWidth": <calculated>,
    "totalHeight": 60
  }

NAME QUALITY GATES (additional, run after base gates)
  [ ] NO icon or symbol is present in the SVG
  [ ] One intentional typographic technique is applied and described in concept
  [ ] Optical kerning applied: tight pairs closed, straight pairs opened
  [ ] text_width × 1.12 + margins ≤ totalWidth — nothing clips left or right
  [ ] Descenders stay inside the viewBox (baseline math verified)
  [ ] The wordmark reads correctly at 16px height
  [ ] If multi-color: logical sequence + matched luminance (±10%)
  [ ] If hidden element: relevant to the brand and ≥ 1.5u wide
`;

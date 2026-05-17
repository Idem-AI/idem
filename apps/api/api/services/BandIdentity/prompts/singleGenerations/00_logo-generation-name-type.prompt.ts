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
  viewBox: "0 0 [W] 60"
  Baseline: y = 38 (leaves optical room above and below)
  For centered marks: text-anchor="middle", x = W/2
  For left-aligned marks: text-anchor="start", x = 20
  Width = brand_name.length × font_size × 0.65, rounded up to nearest 10px, + 40px margin

  Standard dimensions by name length:
    4 chars  → totalWidth: 160,  font-size: 42
    5 chars  → totalWidth: 200,  font-size: 40
    6 chars  → totalWidth: 220,  font-size: 38
    7 chars  → totalWidth: 250,  font-size: 36
    8 chars  → totalWidth: 280,  font-size: 34
    9+ chars → totalWidth: 320+, font-size: 30

OPTICAL KERNING SYSTEM
  In SVG, use individual <tspan> or <text> elements per letter with explicit x positions
  when you need to apply custom kerning. Standard letter-spacing:
    - Normal brands: letter-spacing="0"
    - Luxury/open: letter-spacing="0.15em"
    - Compact/tech: letter-spacing="-0.03em"
  For specific tight pairs (AV, WA, TO, LY): reduce gap by 1-2px manually

COLOR WORDMARK TECHNIQUES

  SINGLE COLOR (professional default)
    All letters same color. Weight and form carry the brand.

  MULTI-COLOR SEQUENCE (brand with multiple values)
    Assign each letter a color from the brand palette.
    Use individual <text> or <tspan fill="..."> per letter.
    Colors must follow a logical sequence (not random).
    Works best for 4-8 letter names.

  GRADIENT WORDMARK (premium, linear)
    Apply linearGradient from primary to secondary color.
    Horizontal gradient (x1=0, x2=1, y1=0, y2=0) for motion feeling.
    Vertical gradient (x1=0, x2=0, y1=0, y2=1) for depth feeling.
    Use sparingly — only when gradient adds conceptual meaning.

LETTERFORM MODIFICATION TECHNIQUES
  EXTENDED ARM: extend a horizontal stroke 4-8px beyond normal (e.g., the E in FedEx)
  CROSSBAR CUT: remove the crossbar of an H or A for minimalism
  JOINED STROKE: connect two adjacent letters at a shared stroke point
  CUSTOM TERMINAL: replace a rounded terminal with a geometric cut or angle
  ASCENDER PLAY: extend or reduce an ascender to create visual interest
  Apply at most ONE modification per wordmark. Mark which letter is modified in the concept field.

HIDDEN ELEMENT TECHNIQUE (seed_C or seed_D only)
  If applying the FedEx-arrow principle:
  1. Identify two adjacent letters that create natural negative space
  2. Use that space to embed a relevant symbol (arrow, star, leaf, number, etc.)
  3. The symbol must be discoverable but not immediately obvious
  4. Describe the hidden element in the concept field

CASE RULES BY ARCHETYPE
  tech_precision / finance_trust     → UPPERCASE, tight tracking
  tech_human / health_care           → lowercase or Title Case, normal tracking
  luxury_heritage                    → UPPERCASE, wide tracking, light weight
  energy_motion                      → UPPERCASE, compressed tracking, bold
  creative_studio                    → Mixed case, custom spacing
  sustainability                     → lowercase, natural spacing

SVG WORDMARK QUALITY RULES
  - Never use a single <text> element for multi-color wordmarks → use <tspan fill="...">
  - For modified letterforms → use <path> for that specific letter only
  - Baseline alignment: all letters on the same y baseline (dominant-baseline="auto")
  - Ensure text-anchor consistency: all letters anchor from the same reference point
  - For UPPERCASE marks: add letter-spacing="0.05em" minimum for optical breathing

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
  [ ] Optical kerning is applied (not default auto-kerning)
  [ ] The wordmark reads correctly at 16px height
  [ ] If multi-color: the color sequence follows a logical brand rationale
  [ ] If hidden element: the element is relevant to the brand, not arbitrary
`;
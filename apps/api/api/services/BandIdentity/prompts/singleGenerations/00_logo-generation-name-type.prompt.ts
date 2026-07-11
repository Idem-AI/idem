import { LOGO_SYSTEM_BASE } from "./00_logo-system-base.prompt";

export const LOGO_GENERATION_NAME_TYPE_PROMPT = `
${LOGO_SYSTEM_BASE}

<module_name_based_logo>
Wordmark logo (logotype, Mollerup taxonomy). Typography IS the complete logo. No icon/symbol.

TYPOGRAPHY DOCTRINE (Bringhurst — this is where amateur logos fail most):
- Letterforms are NEVER invented or distorted freehand. The wordmark is real type: a <text> element with a DESIGN PALETTE font (or fallback stack), correct kerning, one consistent baseline.
- Exactly ONE deliberate typographic idea makes the mark distinctive (choose ONE strategy below). Zero ideas = generic; two or more = noise.
- The wordmark must pass the BLACK-AND-WHITE TEST: set every fill to #111111 — the strategy must still be visible through FORM (weight, spacing, case, letterform), never through color alone. COLOR_SEQUENCE is the single exception and must still read as a mark in monochrome.

TYPOGRAPHIC STRATEGIES (apply exactly ONE):
- WEIGHT_STATEMENT: single weight, extreme bold or thin.
- COLOR_SEQUENCE: each letter in a different brand color (Google style) — palette colors only, equal luminance.
- TRACKING_PLAY: extreme letter-spacing for luxury (e.g. 0.15em).
- CASE_CONTRAST: mix of upper and lowercase (adidas style).
- LETTERFORM_HACK: modify ONE letter with a geometric operation on the grid (extended arm, canonical-angle cut, computed custom path). All other letters stay untouched.
- BASELINE_RHYTHM: alternating baseline shifts of a fixed step (±2-4px, same step everywhere).
- WEIGHT_CONTRAST: some letters bold, others light (two weights max — stroke discipline).
- HIDDEN_ELEMENT: the negative space between two letters is DRAWN as a shape (FedEx arrow principle) — the gap geometry is computed on the grid, not accidental.

CONSTRUCTION GRID (ViewBox: 0 0 W 60):
- Baseline: y = 38 (leaves optical room above; descenders of g/y/p/q stay inside).
- Centered: text-anchor="middle", x = W/2. Left-aligned: text-anchor="start", x = 20.
- Width Math (computed, never improvised):
  * text_width = char_count * font_size * 0.62 + (char_count - 1) * tracking_px.
  * totalWidth = ceil((text_width * 1.12 + 40) / 10) * 10.
  * The resulting side margins are the CLEAR SPACE — nothing enters them.
- Sizing Reference Table:
  * 4 chars => W ≈ 160, font-size: 42.
  * 5 chars => W ≈ 200, font-size: 40.
  * 6 chars => W ≈ 220, font-size: 38.
  * 7 chars => W ≈ 250, font-size: 36.
  * 8 chars => W ≈ 280, font-size: 34.
  * 9+ chars => W ≈ 320+, font-size: 30.

OPTICAL KERNING (Bringhurst):
- Normal: letter-spacing="0". Luxury: letter-spacing="0.15em". Compact/tech: letter-spacing="-0.03em".
- Tight pairs (AV, VA, WA, AW, TO, LT, LY, To, Yo): reduce gap by 1-2px.
- Round-round pairs (OO, OC, GO): reduce gap by 1px.
- Straight-straight pairs (HI, IL, NM): add 0.5-1px.
- Round letters overshoot baseline/cap-height by ~1.5% of font-size.

CASE RULES BY ARCHETYPE:
- tech_precision / finance_trust => UPPERCASE, tight tracking.
- tech_human / health_care => lowercase or Title Case, normal tracking.
- luxury_heritage => UPPERCASE, wide tracking, light weight.
- energy_motion => UPPERCASE, compressed tracking, bold.
- creative_studio => Mixed case, custom spacing.
- sustainability => lowercase, natural spacing.

SVG QUALITY RULES:
- Use <tspan fill="..."> for multi-color wordmarks — palette colors only.
- Use <path> ONLY for the single LETTERFORM_HACK letter, constructed on the grid.
- All letters on same baseline (unless BASELINE_RHYTHM with its fixed step).
- UpperCase: letter-spacing ≥ 0.05em.
- The wordmark must remain legible at 16px height (favicon test) and scale to a facade unchanged.

LAYOUT JSON:
"layout": {
  "textPosition": "center",
  "spacing": 0,
  "totalWidth": <calculated>,
  "totalHeight": 60
}

QUALITY GATES:
- No icon or symbol present.
- Exactly one typographic strategy, visible in monochrome.
- Descenders stay inside viewBox; text_width fits inside totalWidth; clear space respected.
- Real type only — no freehand glyph approximations outside the single LETTERFORM_HACK.
- Only palette colors; hierarchy survives grayscale.
</module_name_based_logo>
`;

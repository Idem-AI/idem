import { LOGO_SYSTEM_BASE } from "./00_logo-system-base.prompt";

export const LOGO_GENERATION_NAME_TYPE_PROMPT = `
${LOGO_SYSTEM_BASE}

<module_name_based_logo>
Wordmark logo. Typography is the complete logo. No icon/symbol.

TYPOGRAPHIC STRATEGIES:
- WEIGHT_STATEMENT: single weight, extreme bold or thin.
- COLOR_SEQUENCE: each letter in different brand color (Google style).
- TRACKING_PLAY: extreme letter-spacing for luxury (e.g. 0.15em).
- CASE_CONTRAST: mix of upper and lowercase (adidas style).
- LETTERFORM_HACK: modify one letter (extended arm, cut, custom shape).
- BASELINE_RHYTHM: alternating baseline shifts.
- WEIGHT_CONTRAST: some letters bold, others light.
- HIDDEN_ELEMENT: negative space between letters creates a shape (FedEx arrow style).

CONSTRUCTION GRID (ViewBox: 0 0 W 60):
- Baseline: y = 38 (leaves optical room above; descenders of g/y/p/q stay inside).
- Centered: text-anchor="middle", x = W/2. Left-aligned: text-anchor="start", x = 20.
- Width Math:
  * text_width = char_count * font_size * 0.62 + (char_count - 1) * tracking_px.
  * totalWidth = ceil((text_width * 1.12 + 40) / 10) * 10.
- Sizing Reference Table:
  * 4 chars => W ≈ 160, font-size: 42.
  * 5 chars => W ≈ 200, font-size: 40.
  * 6 chars => W ≈ 220, font-size: 38.
  * 7 chars => W ≈ 250, font-size: 36.
  * 8 chars => W ≈ 280, font-size: 34.
  * 9+ chars => W ≈ 320+, font-size: 30.

OPTICAL KERNING:
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
- Use <tspan fill="..."> for multi-color wordmarks.
- Use <path> for modified letterforms.
- All letters on same baseline (unless BASELINE_RHYTHM shift of ±2-4px).
- UpperCase: letter-spacing ≥ 0.05em.

LAYOUT JSON:
"layout": {
  "textPosition": "center",
  "spacing": 0,
  "totalWidth": <calculated>,
  "totalHeight": 60
}

QUALITY GATES:
- No icon or symbol present.
- Descenders stay inside viewBox.
- text_width fits inside totalWidth.
</module_name_based_logo>
`;

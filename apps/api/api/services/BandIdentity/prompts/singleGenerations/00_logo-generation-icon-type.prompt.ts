import { LOGO_SYSTEM_BASE } from "./00_logo-system-base.prompt";

export const LOGO_GENERATION_ICON_TYPE_PROMPT = `
${LOGO_SYSTEM_BASE}

<module_icon_based_logo>
This is an ICON + WORDMARK logo. Two distinct elements forming one system.

ICON RULES:
- Max 2 shapes (aim for 2, accept 3 only if structurally necessary).
- Must communicate brand's primary value in under 1s.
- Must satisfy the chosen SYMMETRY MODE standalone on a square canvas.
- Must work as a standalone app icon (min 40x40px).
- Bounding box: icon_size x icon_size.
- Positioned LEFT of the brand name.

ICON CONSTRUCTION:
- icon_size = totalHeight * 0.6.
- icon_unit = icon_size / 8.
- icon_cx = icon_size / 2.
- icon_cy = totalHeight / 2 - totalHeight * 0.015 (optical center: 1.5% above mathematical center).
- Snap coordinates to icon_unit/2. Ratios follow Golden or Rational scale. Overshoot: 2% of icon_size.

WORDMARK RULES:
- Full brand name, complete spelling.
- Positioned RIGHT of the icon: left edge = icon_size + spacing (min 12px spacing).
- Vertically centered: y = totalHeight / 2, dominant-baseline="central".
- Font size: totalHeight * 0.35.
- Weight: 600 or 700.
- Letter-spacing:
  * tech_precision / finance_trust / luxury_heritage => 0.08em
  * tech_human / health_care / creative_studio => 0em
  * energy_motion => -0.02em

PROPORTION SYSTEM:
- totalHeight: 80px (standard) or 64px (compact).
- icon_size: 48px (standard) or 40px (compact).
- spacing: 12px.
- text_width: char_count * font_size * 0.62 + tracking, plus 12% safety margin.
- totalWidth: icon_size + spacing + text_width, rounded up to nearest 4px.
- Text must end ≥ 8px before right boundary (W).

ALIGNMENT & RELATIONSHIP:
- Align icon's optical mass center with wordmark's cap-height midline.
- Shared visual language (corner radii, weight, curves).
- Main logo color = wordmark color OR icon in primary, wordmark in near-black (#0B1220 - #1A1A2E).

LAYOUT JSON:
"layout": {
  "textPosition": "right",
  "spacing": 12,
  "totalWidth": <calculated>,
  "totalHeight": 80
}

ICON QUALITY GATES:
- Icon works standalone.
- Icon satisfies symmetry mode on square canvas.
- Icon and wordmark share visual language.
- text_width fits inside totalWidth.
</module_icon_based_logo>
`;

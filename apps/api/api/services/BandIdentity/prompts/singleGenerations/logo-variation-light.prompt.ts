export const LOGO_VARIATION_LIGHT_PROMPT = `<role>Senior brand system engineer</role>
<objective>Adapt an existing logo icon for light backgrounds (geometry frozen, only colors change).</objective>

<rules>
1. Inventory original SVG: shapes, coordinates.
2. Icon Extraction: REMOVE all <text>/<tspan> elements. Center icon mathematically in viewBox="0 0 80 80". Bounding box: S = 56 / max(bw, bh), TX = 40 - S*(bx + bw/2), TY = 40 - S*(by + bh/2) - 1. Apply on root <g> transform.
3. Light Background Color Rules (target contrast ≥ 4.5:1 on #FFFFFF, preserve hue ±5°):
   - Primary: If dark (L < 0.4) -> keep/darken 10%; medium (0.4-0.65) -> darken 25-35%; light (L > 0.65) -> darken 40-55%.
   - Secondary/Accent: Same darkening logic. Must not become darker than primary.
   - White/near-white: Replace with a subtle 12% tint of primary hue.
   - Transparent areas: Keep transparent.
   - Strokes/Gradients: Recolor with same rules.
</rules>

<output_format>
Return STRICT JSON only.
{
  "variation": {
    "lightBackground": "<complete modified SVG string centered in 80x80>"
  }
}
</output_format>
`;

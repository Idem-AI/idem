export const LOGO_VARIATION_DARK_PROMPT = `<role>Senior brand system engineer</role>
<objective>Adapt an existing logo icon for dark backgrounds (geometry frozen, only colors change).</objective>

<rules>
1. Inventory original SVG: shapes, coordinates.
2. Icon Extraction: REMOVE all <text>/<tspan> elements. Center icon mathematically in viewBox="0 0 80 80". Bounding box: S = 56 / max(bw, bh), TX = 40 - S*(bx + bw/2), TY = 40 - S*(by + bh/2) - 1. Apply on root <g> transform.
3. Dark Background Color Rules (target contrast ≥ 4.5:1 on #111827, preserve hue ±5°):
   - Primary: If light (L > 0.6) -> keep/brighten 10%; medium (0.35-0.6) -> brighten 30-45%, sat +10%; dark (L < 0.35) -> brighten 50-70%, sat +15%.
   - Secondary/Accent: Same brightening logic. Must not become brighter than primary.
   - White/near-white: Keep white (#FFFFFF).
   - Dark fills (#111-#333): Invert to white or light primary tint.
   - Transparent areas: Keep transparent.
   - Strokes/Gradients: Recolor with same rules. Saturation cap +20% (no neon, HSL sat ≤ 85%).
</rules>

<output_format>
Return STRICT JSON only.
{
  "variation": {
    "darkBackground": "<complete modified SVG string centered in 80x80>"
  }
}
</output_format>
`;

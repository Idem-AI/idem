export const LOGO_VARIATION_MONOCHROME_PROMPT = `<role>Senior brand system engineer</role>
<objective>Convert an existing logo icon to a sophisticated monochrome version (embossing, stamp, watermark) with colors mapped to a grayscale tonal palette.</objective>

<rules>
1. Inventory original SVG: shapes, coordinates.
2. Icon Extraction: REMOVE all <text>/<tspan> elements. Center icon mathematically in viewBox="0 0 80 80". Bounding box: S = 56 / max(bw, bh), TX = 40 - S*(bx + bw/2), TY = 40 - S*(by + bh/2) - 1. Apply on root <g> transform.
3. Monochrome Conversion:
   - Calculate color luminance: L = 0.2126*R + 0.7152*G + 0.0722*B (R,G,B in 0-1).
   - Map L to these tones (LIGHT stays light, DARK stays dark):
     * L > 0.75 -> #F3F4F6 (very light)
     * L 0.55-0.75 -> #9CA3AF (medium light)
     * L 0.35-0.55 -> #6B7280 (medium)
     * L 0.15-0.35 -> #374151 (medium dark)
     * L < 0.15 -> #111827 (near black)
   - Primary/dominant shape MUST map to darkest used tone (#111827 or #374151) so the mark keeps its anchor.
   - Secondary shapes sit at least 2 tonal steps lighter than primary.
   - Strokes on very light fills use #6B7280 for visibility.
   - Gradients: flatten each gradient to the tone of its average luminance.
   - Forbidden: Flat single #000000 for everything, or pure B&W with no mid-tone. No chromatic colors.
</rules>

<output_format>
Return STRICT JSON only.
{
  "variation": {
    "monochrome": "<complete modified SVG string centered in 80x80>"
  }
}
</output_format>
`;

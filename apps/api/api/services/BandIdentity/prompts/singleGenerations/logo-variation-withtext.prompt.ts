// ─────────────────────────────────────────────────────────────────────────────
// LOGO_VARIATION_*_WITHTEXT_PROMPT
// Déclinaisons "avec texte" : on recolore le LOGO COMPLET (icône + wordmark)
// pour chaque contexte de fond, en CONSERVANT le texte et la mise en page
// d'origine. Pendant du fichier icon-only (logo-variation-{light,dark,mono}.prompt.ts)
// qui, lui, SUPPRIME le texte. Ici la règle est inverse : le nom de marque
// DOIT rester présent, identique (même chaîne, même police), seule la couleur
// change — sinon le vérificateur (logo-variation-critique) échoue à trouver le nom.
// ─────────────────────────────────────────────────────────────────────────────

const WITHTEXT_COMMON = `
CRITICAL — THIS IS A "WITH TEXT" VARIATION:
- KEEP every <text> and <tspan> element. The brand name / wordmark MUST remain,
  with the EXACT same string, font-family, font-size, font-weight, letter-spacing,
  x/y coordinates and text-anchor as the original. Never drop, translate, shorten
  or re-typeset the text.
- KEEP the original viewBox EXACTLY as written (do NOT force "0 0 80 80", do NOT
  re-center, do NOT change the aspect ratio). Geometry is frozen — only COLOR
  values (fill / stroke / gradient stop-color) may change, on BOTH the shapes AND
  the text.
- Copy every geometric attribute exactly (d, cx, cy, r, rx, ry, x, y, width,
  height, transform, stroke-width, opacity). Only colors differ.
- FORBIDDEN: adding filters, shadows, outlines or background rectangles; removing
  text; changing the layout.
`;

export const LOGO_VARIATION_LIGHT_WITHTEXT_PROMPT = `<role>Senior brand system engineer</role>
<objective>Adapt a COMPLETE logo (icon + wordmark) for light backgrounds. Geometry and text frozen, only colors change.</objective>
${WITHTEXT_COMMON}
<rules>
1. Inventory original SVG: shapes, text, coordinates, colors, viewBox.
2. Light Background Color Rules (target contrast ≥ 4.5:1 on #FFFFFF, preserve hue ±5°) — apply to BOTH shape fills AND text fills:
   - Primary: If dark (L < 0.4) -> keep/darken 10%; medium (0.4-0.65) -> darken 25-35%; light (L > 0.65) -> darken 40-55%.
   - Secondary/Accent: Same darkening logic. Must not become darker than primary.
   - White/near-white fills: Replace with a subtle 12% tint of primary hue (pure white is invisible on white).
   - Text: recolor with the same rule as the primary shape so the wordmark reads clearly on white.
   - Transparent areas: Keep transparent. Strokes/Gradients: recolor with same rules.
</rules>
<output_format>
Return STRICT JSON only. No markdown, no prose.
{
  "variation": {
    "lightBackground": "<complete modified SVG string, original viewBox kept, text kept>"
  }
}
</output_format>
`;

export const LOGO_VARIATION_DARK_WITHTEXT_PROMPT = `<role>Senior brand system engineer</role>
<objective>Adapt a COMPLETE logo (icon + wordmark) for dark backgrounds. Geometry and text frozen, only colors change.</objective>
${WITHTEXT_COMMON}
<rules>
1. Inventory original SVG: shapes, text, coordinates, colors, viewBox.
2. Dark Background Color Rules (target contrast ≥ 4.5:1 on #111827, preserve hue ±5°) — apply to BOTH shape fills AND text fills:
   - Primary: If light (L > 0.6) -> keep/brighten 10%; medium (0.35-0.6) -> brighten 30-45%, sat +10%; dark (L < 0.35) -> brighten 50-70%, sat +15%.
   - Secondary/Accent: Same brightening logic. Must not become brighter than primary.
   - White/near-white fills: Keep white (#FFFFFF).
   - Dark fills (#111-#333): Invert to white or a light primary tint.
   - Text: recolor so the wordmark is clearly readable on dark (dark text -> white or light tint).
   - Transparent areas: Keep transparent. Strokes/Gradients: recolor with same rules. Saturation cap +20% (no neon, HSL sat ≤ 85%).
</rules>
<output_format>
Return STRICT JSON only. No markdown, no prose.
{
  "variation": {
    "darkBackground": "<complete modified SVG string, original viewBox kept, text kept>"
  }
}
</output_format>
`;

export const LOGO_VARIATION_MONOCHROME_WITHTEXT_PROMPT = `<role>Senior brand system engineer</role>
<objective>Convert a COMPLETE logo (icon + wordmark) to a sophisticated monochrome version. Geometry and text frozen, colors mapped to a grayscale tonal palette.</objective>
${WITHTEXT_COMMON}
<rules>
1. Inventory original SVG: shapes, text, coordinates, colors, viewBox.
2. Monochrome Conversion — apply to BOTH shape fills AND text fills:
   - Calculate color luminance: L = 0.2126*R + 0.7152*G + 0.0722*B (R,G,B in 0-1).
   - Map L to these tones (LIGHT stays light, DARK stays dark):
     * L > 0.75 -> #F3F4F6 (very light)
     * L 0.55-0.75 -> #9CA3AF (medium light)
     * L 0.35-0.55 -> #6B7280 (medium)
     * L 0.15-0.35 -> #374151 (medium dark)
     * L < 0.15 -> #111827 (near black)
   - Primary/dominant shape MUST map to the darkest used tone (#111827 or #374151).
   - Text: map to a dark tone (#111827 or #374151) so the wordmark stays legible.
   - Secondary shapes sit at least 2 tonal steps lighter than primary.
   - Strokes on very light fills use #6B7280. Gradients: flatten to the tone of average luminance.
   - Forbidden: flat single #000000 for everything, or pure B&W with no mid-tone. No chromatic colors.
</rules>
<output_format>
Return STRICT JSON only. No markdown, no prose.
{
  "variation": {
    "monochrome": "<complete modified SVG string, original viewBox kept, text kept>"
  }
}
</output_format>
`;

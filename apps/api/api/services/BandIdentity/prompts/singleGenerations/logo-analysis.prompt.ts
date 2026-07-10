/**
 * Vision analysis of a user-imported logo.
 * The output feeds the existing idem logo generation pipeline: logoType maps to
 * LogoPreferences.type and improvementBrief becomes the "Custom Design
 * Requirements" (HIGH PRIORITY in LOGO_SYSTEM_BASE), so the generator produces
 * concepts that look like the original logo but more professional.
 */
export const LOGO_ANALYSIS_PROMPT = `<role>Senior brand identity consultant performing a professional logo audit.</role>
<objective>Analyze the attached logo image and produce a structured redesign brief so a geometric logo system can recreate it in a more professional form while keeping it recognizable.</objective>

<analysis_steps>
1. CLASSIFY the logo type:
   - "icon": a symbol/pictorial mark accompanied by (or dominating) the brand name.
   - "name": the full brand name IS the logo (wordmark), no separate symbol.
   - "initial": stylized initials/monogram are the main element.
2. DESCRIBE the geometry: dominant shapes, symmetry, construction, layout (icon left/top of text, etc.).
3. EXTRACT the color palette (hex estimates) and how each color is used.
4. DESCRIBE the typography style if text is visible (serif/sans, weight, case, spacing).
5. IDENTIFY the symbolism: what the mark evokes or represents.
6. AUDIT the weaknesses: alignment issues, inconsistent stroke widths, muddy colors,
   excessive detail that breaks at small sizes, dated effects (gradients, shadows, 3D), poor kerning.
7. WRITE the improvement brief: concrete design requirements to regenerate this logo
   in a cleaner, more professional geometric style. It MUST list what to KEEP for
   recognizability (core shape, hue family, symbol meaning, initials/name) and what
   to FIX (each weakness), phrased as instructions for a logo designer.
</analysis_steps>

<rules>
- Be specific and visual: "a rounded orange hexagon containing a white lightning bolt", not "a nice shape".
- The improvementBrief must be self-contained: a designer who has never seen the image must be able to recreate a faithful, improved version from it alone.
- The improvementBrief must be 60-120 words, written in English.
- Estimate colors as 6-digit hex values.
</rules>

<output_format>
Output ONLY valid JSON. No markdown fences, no prose.
{
  "logoType": "icon" | "name" | "initial",
  "style": "<overall style in a few words>",
  "shapes": "<geometric description of the mark>",
  "colors": ["#HEX1", "#HEX2"],
  "typographyStyle": "<typography description or 'none'>",
  "symbolism": "<what the mark evokes>",
  "weaknesses": "<audit of the current logo's flaws>",
  "improvementBrief": "<self-contained redesign requirements>"
}
</output_format>
`;

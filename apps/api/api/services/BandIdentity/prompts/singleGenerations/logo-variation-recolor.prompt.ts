/**
 * Bounded AI fallback for logo variation generation.
 * Used ONLY when the deterministic OKLCH engine + QA render still produce an
 * unreadable variation. The model returns a color mapping — never new geometry —
 * so the user's logo shapes are guaranteed to stay intact.
 */
export const LOGO_VARIATION_RECOLOR_PROMPT = `<role>Senior brand designer specialized in logo color systems.</role>
<objective>Fix the readability of a logo variation by remapping ONLY its colors.</objective>

<context>
The SVG below is a "{{VARIANT}}" variation of a user-imported logo, meant to be
displayed on the background color {{BACKGROUND}}.
Detected problem: {{ISSUE}}.
</context>

<rules>
- Analyze the colors present in the SVG (fill, stroke, stop-color values).
- Propose a replacement ONLY for colors that hurt readability on {{BACKGROUND}}.
- Preserve the brand identity: keep hues recognizable, adjust lightness first.
- For the monochrome variant, output only grayscale colors.
- Never invent new shapes, never modify geometry — colors only.
- Every key and value must be a 6-digit hex color (e.g. "#1a2b3c").
</rules>

<output_format>
Output ONLY valid JSON. No markdown fences, no prose.
{
  "mapping": {
    "#oldcolor": "#newcolor"
  }
}
</output_format>

<svg_to_fix>
{{SVG}}
</svg_to_fix>
`;

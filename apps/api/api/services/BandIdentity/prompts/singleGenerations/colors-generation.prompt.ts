export const COLORS_GENERATION_PROMPT = `<role>Senior brand identity color expert (Pantone-institute level)</role>
<objective>Generate 3 premium color palettes reflecting the project's industry, values, and target audience using color theory.</objective>

<context>
PROJECT DESCRIPTION: {{PROJECT_DESCRIPTION}}
</context>

<construction_method>
1. PRIMARY: Hue derived from industry psychology (blue=trust/tech, green=growth/health, navy=finance, violet=innovation, terracotta/orange=energy, gold/black=luxury, teal=clarity). Saturation 55-85%, lightness 35-55% (rich, not neon).
2. SECONDARY: Pick one scheme (analogous, complementary, split-complementary, triadic). Lower saturation 10-20 points OR shift lightness ≥ 15 points from primary so it supports, not competes.
3. ACCENT: Attention color (CTAs). Saturation ≥ primary, used for ≤ 10% of composition (60-30-10 rule).
4. BACKGROUND: Light: near-white tinted 2-4% with primary hue (e.g. #FAFBFC family). Dark: rich near-black #0B1220 - #16161D (never #000000).
5. TEXT: Near-black with primary undertone on light backgrounds; light gray/white on dark backgrounds.
</construction_method>

<accessibility_rules>
- text vs background contrast: ≥ 7:1 (minimum 4.5:1).
- primary/accent vs background: ≥ 3:1.
</accessibility_rules>

<diversity_rules>
- Palette 1: professional/confident.
- Palette 2: warmer or cooler mood shift.
- Palette 3: bold/contrasting (can use a dark background, accent more daring).
- The 3 primary hues must differ by ≥ 25° of hue or clearly different saturation/lightness.
</diversity_rules>

<output_format>
Return STRICT JSON only.
{
  "colors": [
    {
      "id": "color-scheme-1",
      "name": "Descriptive French name based on industry/values",
      "url": "palette/[url-slug]",
      "colors": {
        "primary": "#...",
        "secondary": "#...",
        "accent": "#...",
        "background": "#...",
        "text": "#..."
      }
    }
    // ... 2 more unique palettes
  ]
}
</output_format>
`;

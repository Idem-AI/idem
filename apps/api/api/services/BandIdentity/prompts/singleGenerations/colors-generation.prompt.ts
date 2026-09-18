export const COLORS_GENERATION_PROMPT = `<role>Senior brand identity color expert (Pantone-institute level)</role>
<objective>Generate 3 premium color palettes reflecting the project's industry, values, and target audience using color theory.</objective>

<context>
PROJECT DESCRIPTION: {{PROJECT_DESCRIPTION}}
</context>

<construction_method>
1. PRIMARY: Hue derived from industry psychology (blue=trust/tech, green=growth/health, navy=finance, violet=innovation, terracotta/orange=energy, gold/black=luxury, teal=clarity). Saturation 55-85%, lightness 35-55% (rich, not neon).
2. SECONDARY: Pick one scheme (analogous, complementary, split-complementary, triadic). Lower saturation 10-20 points OR shift lightness ≥ 15 points from primary so it supports, not competes.
3. ACCENT: Attention color (CTAs). Saturation ≥ primary, used for ≤ 10% of composition (60-30-10 rule).
4. BACKGROUND: ALWAYS LIGHT — near-white tinted 2-4% with the primary hue (e.g. #FAFBFC family), HSL lightness ≥ 94%. Never a dark, black or mid-tone background: these palettes drive printed deliverables and generated websites, which are light-surface by policy. The brand's boldness is carried by the primary and the accent, never by a dark ground.
5. TEXT: Near-black with a primary undertone (HSL lightness ≤ 20%). Never light gray or white.
</construction_method>

<accessibility_rules>
- text vs background contrast: ≥ 7:1 (minimum 4.5:1).
- primary/accent vs background: ≥ 3:1.
</accessibility_rules>

<diversity_rules>
- Palette 1: professional/confident.
- Palette 2: warmer or cooler mood shift.
- Palette 3: bold/contrasting (more daring accent, higher saturation on the primary — on a light background like the other two).
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

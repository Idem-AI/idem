export const COLORS_FROM_LOGO_PROMPT = `<role>Senior brand identity color expert</role>
<objective>Generate 3 premium color palettes complementing the colors from the user's imported logo.</objective>

<logo_context>
LOGO COLORS: {{LOGO_COLORS}}
PRIMARY (LOCKED): {{PRIMARY_FROM_LOGO}}
SECONDARY (LOCKED): {{SECONDARY_FROM_LOGO}}
PROJECT DESCRIPTION: {{PROJECT_DESCRIPTION}}
</logo_context>

<accent_construction>
- Palette 1: analogous (primary hue ±30°) or deeper tone of secondary (cohesive, safe).
- Palette 2: split-complementary (hue +150° or +210°) (temperature shift).
- Palette 3: complementary (hue +180°) or triadic (±120°) (bold contrast).
- Accent saturation: 60-90%. Accent must read against background (≥ 3:1 contrast) and not clash with secondary (≥ 20° hue distance).
</accent_construction>

<background_and_text>
- Light background (at least 2 palettes): near-white tinted 2-4% with primary hue.
- Dark background (max 1 palette): near-black #0B1220 - #16161D. Locked colors must be visible on it (≥ 3:1 contrast).
- Text: ≥ 7:1 contrast on background. Near-black on light backgrounds, light gray on dark.
</background_and_text>

<output_format>
Return STRICT JSON only.
{
  "colors": [
    {
      "id": "color-scheme-1",
      "name": "French descriptive name",
      "url": "palette/[url-slug]",
      "colors": {
        "primary": "{{PRIMARY_FROM_LOGO}}",
        "secondary": "{{SECONDARY_FROM_LOGO}}",
        "accent": "#...",
        "background": "#...",
        "text": "#..."
      }
    }
    // ... 2 more unique palettes
  ]
}
Primary and secondary values in all 3 palettes MUST be exactly "{{PRIMARY_FROM_LOGO}}" and "{{SECONDARY_FROM_LOGO}}".
</output_format>
`;

export const TYPOGRAPHY_FROM_LOGO_PROMPT = `<role>Senior brand typography expert</role>
<objective>Generate 3 Google Fonts typography sets that complement the logo's visual style and project identity.</objective>

<context>
PROJECT DESCRIPTION: {{PROJECT_DESCRIPTION}}
LOGO COLORS: {{LOGO_COLORS}}
STYLE SUGGESTION: {{STYLE_HINT}}
</context>

<matching_rules>
- Vivid logo -> geometric sans (Space Grotesk, Manrope, Sora, Outfit, Plus Jakarta Sans).
- Deep/corporate -> refined serif + sans body (Fraunces or Playfair Display + humanist sans).
- Organic/soft -> rounded humanist (DM Sans, Nunito Sans, Albert Sans).
- Heading weight matches the logo's weight.
- primaryFont: headings, carries personality.
- secondaryFont: body text, highly readable at 14-16px (Inter, Source Sans 3, Open Sans, etc.).
- Max 2 families per set. No dated fonts (Lobster, Pacifico, Comfortaa). All must be on Google Fonts.
</matching_rules>

<output_format>
Return STRICT JSON only.
{
  "typography": [
    {
      "id": "typography-set-1",
      "name": "Descriptive French Name",
      "url": "typography/[url-slug]",
      "primaryFont": "...",
      "secondaryFont": "..."
    }
    // ... 2 more sets
  ]
}
</output_format>
`;

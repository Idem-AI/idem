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

export const TYPOGRAPHY_FROM_LOGO_PROMPT = `<role>Senior brand typographer</role>
<objective>Propose 3 typography systems that complement the logo's visual style and the project identity. Output: strict JSON.</objective>

<context>
PROJECT DESCRIPTION: {{PROJECT_DESCRIPTION}}
LOGO COLORS: {{LOGO_COLORS}}
STYLE SUGGESTION: {{STYLE_HINT}}
</context>

<matching_rules>
- Read the logo first: its letterforms, its weight, its geometry. The text family must extend that language, not fight it.
- Vivid, geometric logo -> a geometric or grotesque display (Archivo, Chivo, Syne, Sora).
- Deep, institutional logo -> a refined serif display plus a humanist sans for text (Fraunces or Playfair Display + IBM Plex Sans).
- Organic, soft logo -> a humanist display with open curves (Bricolage Grotesque, Epilogue, Young Serif).
- Condensed or stencil logo -> a condensed display (Bebas Neue, Big Shoulders Display, Anton).
- The display weight matches the visual weight of the logo.
- primaryFont carries the personality; secondaryFont must stay readable at 14-16px.
- WEIGHT RANGE: the display family must offer at least three weights far apart. Typographic hierarchy is what replaces decoration.
- Two families per set, both on Google Fonts, exact family names.
</matching_rules>

<banned_fonts>
Never propose these — they are the typefaces that make a brand read as machine-generated:
Inter, Roboto, Open Sans, Lato, Montserrat, Poppins, Nunito, Raleway, Ubuntu, Oswald, Space Grotesk, Arial, Helvetica.
Also banned as dated: Lobster, Pacifico, Comfortaa, Bangers, Righteous.
</banned_fonts>

<curated_register>
- Editorial / press: Playfair Display, Instrument Serif, Fraunces, Newsreader, Young Serif, Gloock, Literata + text: Source Serif 4, Crimson Pro, Lora, Spectral.
- Swiss / objective / institutional: Archivo, Schibsted Grotesk, Hanken Grotesk, Libre Franklin, Public Sans + text: IBM Plex Sans, Work Sans, Karla.
- Bold / expressive / cultural: Anton, Bebas Neue, Archivo Black, Syne, Big Shoulders Display + text: Work Sans, Figtree, Karla.
- Technical / precise: Chivo, Sora, Unbounded, Geist + text: IBM Plex Sans, Instrument Sans, Public Sans.
- Warm / craft / hospitality: Fraunces, Young Serif, Bitter, Zilla Slab, DM Serif Display + text: Karla, Asap, Figtree.
- Human / accessible: Bricolage Grotesque, Epilogue, Lexend, Onest + text: Atkinson Hyperlegible, Figtree, Hanken Grotesk.
</curated_register>

<diversity_rules>
The 3 sets must belong to 3 DIFFERENT registers. All three must work with the logo; they must not be variations of one another.
</diversity_rules>

<output_format>
Return STRICT JSON only.
{
  "typography": [
    {
      "id": "typography-set-1",
      "name": "a short descriptive French name",
      "url": "typography/[url-slug]",
      "primaryFont": "exact Google Fonts family name",
      "secondaryFont": "exact Google Fonts family name",
      "rationale": "one sentence, in French: how this pairing extends the logo"
    }
    // ... 2 more sets, in different registers
  ]
}
</output_format>
`;

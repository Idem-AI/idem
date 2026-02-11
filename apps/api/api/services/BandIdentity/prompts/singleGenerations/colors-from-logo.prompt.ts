/**
 * Prompt for generating color palettes based on colors extracted from an imported logo.
 * Primary and secondary colors are LOCKED from the logo. AI only proposes accent, background, text.
 */
export const COLORS_FROM_LOGO_PROMPT = `
You are a senior brand identity color expert. The user has imported a logo with specific colors.
Your job is to generate 3 premium color palettes. The PRIMARY and SECONDARY colors are LOCKED — they come directly from the logo and MUST NOT be changed.
You only propose the accent, background, and text colors that complement the logo's locked colors.

LOGO COLORS (extracted from the imported logo, sorted by dominance):
{{LOGO_COLORS}}

The FIRST logo color is the PRIMARY: {{PRIMARY_FROM_LOGO}}
The SECOND logo color is the SECONDARY: {{SECONDARY_FROM_LOGO}}

PROJECT DESCRIPTION:
{{PROJECT_DESCRIPTION}}

Return JSON only:

{
  "colors": [
    {
      "id": "color-scheme-1",
      "name": "Logo Harmony",
      "url": "palette/logo-harmony",
      "colors": {
        "primary": "{{PRIMARY_FROM_LOGO}}",
        "secondary": "{{SECONDARY_FROM_LOGO}}",
        "accent": "#...",
        "background": "#ffffff",
        "text": "#1a1a2e"
      }
    }
    // ... 2 more unique palettes
  ]
}

Rules:
- "primary" in ALL 3 palettes MUST be exactly "{{PRIMARY_FROM_LOGO}}" — never change it
- "secondary" in ALL 3 palettes MUST be exactly "{{SECONDARY_FROM_LOGO}}" — never change it
- You ONLY propose "accent", "background", and "text" colors
- First palette: accent that complements primary+secondary, light background
- Second palette: different accent mood (warmer or cooler), light background
- Third palette: bold/contrasting accent, can use a dark background
- Accent must harmonize with primary and secondary (use color theory: complementary, analogous, triadic)
- Background should be light (#ffffff or near-white) for at least 2 palettes
- Text color must have WCAG AA contrast ratio against the background
- Valid hex codes, descriptive French names
- Single line JSON, no explanations
`;

/**
 * Prompt for generating typography sets based on the project context and imported logo style.
 */
export const TYPOGRAPHY_FROM_LOGO_PROMPT = `
You are a senior brand typography expert. The user has imported a logo for their project.
Generate 3 typography sets that complement the logo's visual style and the project's identity.

PROJECT DESCRIPTION:
{{PROJECT_DESCRIPTION}}

LOGO STYLE CONTEXT:
The logo uses these colors: {{LOGO_COLORS}}
This suggests a {{STYLE_HINT}} brand aesthetic.

Return JSON only:

{
  "typography": [
    {
      "id": "typography-set-1",
      "name": "Logo Complement",
      "url": "typography/logo-complement",
      "primaryFont": "...",
      "secondaryFont": "..."
    }
    // ... 2 more unique sets
  ]
}

Rules:
- All fonts must be available on Google Fonts
- Primary font: for headings, should match the logo's visual weight and style
- Secondary font: for body text, must be highly readable
- 3 distinct pairings with different personalities (modern, classic, bold)
- Descriptive French names and URLs
- Single line JSON, no explanations
`;

export const COLORS_GENERATION_PROMPT = `
You are a senior brand identity color expert. Generate 3 premium color palettes that reflect the project's industry, values, and target audience.

PROJECT CONTEXT:
{{PROJECT_DESCRIPTION}}

Return JSON only:

{
  "colors": [
    {
      "id": "color-scheme-1",
      "name": "[Descriptive name based on project industry/values]",
      "url": "palette/[url-slug]",
      "colors": {
        "primary": "#...",
        "secondary": "#...",
        "accent": "#...",
        "background": "#ffffff",
        "text": "#1a1a2e"
      }
    }
    // ... 2 more unique palettes with different moods
  ]
}

Rules:
- Generate 3 UNIQUE palettes with different color moods (e.g., vibrant, professional, elegant)
- Names should reflect the project's industry and values (e.g., "Tech Innovation", "Santé Moderne", "Énergie Créative")
- Each palette should have distinct primary, secondary, and accent colors
- At least 2 palettes should have light backgrounds (#ffffff or near-white)
- One palette can have a dark background for variety
- All colors must have good contrast (WCAG AA)
- Valid hex codes, descriptive French names
- Single line JSON, no explanations
`;

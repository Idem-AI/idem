export const COLORS_GENERATION_PROMPT = `
Generate 3 premium color palettes. Return JSON only:

{
  "colors": [
    {
      "id": "color-scheme-1",
      "name": "Dégradé Premium",
      "url": "palette/degrade-premium",
      "colors": {
        "primary": "#6a11cb",
        "secondary": "#2575fc",
        "accent": "#ff5858",
        "background": "#ffffff",
        "text": "#191970"
      }
    }
    // ... 2 more unique palettes
  ]
}

Rules:
- First palette: exactly "Dégradé Premium" with colors above
- 2 more unique premium tech palettes
- Valid hex codes, descriptive names
- Single line JSON, no explanations
`;

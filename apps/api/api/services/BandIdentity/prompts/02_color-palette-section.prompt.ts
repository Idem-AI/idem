export const COLOR_PALETTE_SECTION_PROMPT = `<role>World-class color strategist and editorial designer</role>
<objective>Create a FULL-PAGE color palette presentation that feels like a premium design magazine spread, unique to this brand's personality.</objective>

<concept_ideas>
- Paint studio: colors as large swatches or brushstrokes.
- Pantone: vertical strips with specs.
- Landscape: horizontal bands.
- Material samples: textured material cards.
</concept_ideas>

<page_content>
1. Section title: "Palette de Couleurs".
2. Colors displayed with actual hex values: Primary, Secondary, Accent, Background, Text.
3. Each color shows: visual swatch, name & role, HEX code, and brief usage note (1 sentence in French).
4. Color harmony composition demonstrating how colors work together.
</page_content>

<page_format>
- Outermost container: w-[297mm] h-[167mm] overflow-hidden relative (Landscape 16:9, exactly h-[167mm], no min-h-screen).
- Internal safe padding: p-[12mm] (no content overflow).
</page_format>

<technical_rules>
- Output ONLY raw HTML + Tailwind CSS utilities in a single minified line.
- PrimeIcons (pi pi-icon-name) are preloaded.
- Use brand colors (bg-[#hex]) and actual fonts.
- All text in French. Ensure WCAG AA contrast.
- Do NOT output markdown code blocks (e.g., \`\`\`html) or prefix with "html".
</technical_rules>

<project_context>
`;

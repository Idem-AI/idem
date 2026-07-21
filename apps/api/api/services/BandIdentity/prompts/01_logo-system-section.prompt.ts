export const LOGO_SYSTEM_SECTION_PROMPT = `<role>Senior brand identity art director</role>
<objective>Create a FULL-PAGE presentation of the PRIMARY LOGO, dedicated to showcasing it as the hero of the page in French.</objective>

<concept_ideas>
- Museum: Centered on a vast clean field with subtle accents.
- Editorial: Logo large on one side, brand story elegantly placed on the other.
- Architectural: Logo within geometric frames / structural elements.
- Immersive: Logo floating over full-page background in primary color.
- Minimal luxury: Whitespace, logo at golden-ratio position, tiny elegant caption.
</concept_ideas>

<page_content>
1. Section title: "Logo Principal" (styled to match brand personality).
2. Primary logo <img> (use the exact URL specified in **SPECIFIC LOGO URL FOR THIS PAGE**).
3. Concept explanation (2-3 sentences max, in French).
4. Color codes (hex codes extracted from logo).
5. "Zone de protection" diagram: the clear space is PROPORTIONAL to the logo itself
   (Wheeler) — margin = 25% of the logo height on all four sides, visualized with
   thin dashed guides and labeled "x = 25% de la hauteur du logo". Never an
   arbitrary pixel value.
</page_content>

<page_format>
- Outermost container: w-[297mm] h-[167mm] overflow-hidden relative (exactly h-[167mm], no min-h-screen).
- Internal safe padding: p-[12mm] (no content overflow).
</page_format>

<technical_rules>
- Output ONLY raw HTML + Tailwind CSS utilities in a single minified line.
- PrimeIcons (pi pi-icon-name) are preloaded, no external CDN.
- All text in French. Ensure WCAG AA contrast.
- Logo <img> displayed with object-contain.
- Do NOT output markdown code blocks (e.g., \`\`\`html) or prefix with "html".
</technical_rules>

<project_context>
`;

export const LOGO_VARIATION_PAGE_PROMPT = `<role>Senior brand identity designer</role>
<objective>Create a DEDICATED FULL-PAGE presentation for a single logo variation on its intended background in French.</objective>

<background_rules>
- "Fond clair": clean white or very light background.
- "Fond sombre": brand's dark color or rich dark tone (#1a1a2e).
- "Monochrome": neutral gray background (#f5f5f5 or #e5e5e5).
</background_rules>

<page_content>
1. Elegant variation label (e.g. "Déclinaison — Fond Clair").
2. Logo variation displayed large and centered (at least 40-50% page area).
3. intended background color (bg-[#hex]) for this variation.
4. Caption explaining when to use it (1-2 sentences in French).
5. Color references of background and logo colors.
</page_content>

<page_format>
- Outermost container: w-[297mm] h-[167mm] overflow-hidden relative (exactly h-[167mm], no min-h-screen).
- Internal safe padding: p-[12mm] (no content overflow).
</page_format>

<technical_rules>
- Output ONLY raw HTML + Tailwind CSS utilities in a single minified line.
- Logo via <img> (use the exact URL specified in **SPECIFIC LOGO URL FOR THIS PAGE**).
- All text in French. Ensure WCAG AA contrast.
- Do NOT output markdown code blocks (e.g., \`\`\`html) or prefix with "html".
</technical_rules>

<variation_context>
`;

export const LOGO_BEST_PRACTICES_PAGE_PROMPT = `<role>Brand standards expert</role>
<objective>Create a DEDICATED FULL-PAGE infographic for logo best practices ("Bonnes Pratiques") in French.</objective>

<page_content>
1. Page title: "Bonnes Pratiques — Utilisation du Logo".
2. "À FAIRE" (Do's) - 4-6 rules drawn from professional brand standards:
   respect proportions, use official versions only, maintain the proportional
   clear space (25% of logo height), check contrast on every background,
   pick the right variant per background (clair / sombre / monochrome),
   verify the logo still reads in pure black and white (test noir et blanc).
3. "À ÉVITER" (Don'ts) - 4-6 rules: no stretching or rotating, no color changes
   outside the palette, no busy/photographic backgrounds without the right variant,
   no added shadows, gradients, outlines or effects, no sizing below the minimum,
   no recreating or redrawing the logo.
4. Minimum size specs (digital: 24px height, print: 12mm height) — below these,
   details close up and legibility fails.
5. File formats (SVG for digital, PDF for print, PNG for web).
</page_content>

<design_principles>
- Two-column layout: Do's on the left (green accents), Don'ts on the right (red accents).
- Rule illustrations using Tailwind shapes/transforms.
- Scannable, clean, infographics layout.
</design_principles>

<page_format>
- Outermost container: w-[297mm] h-[167mm] overflow-hidden relative (exactly h-[167mm], no min-h-screen).
- Internal safe padding: p-[12mm] (no content overflow).
</page_format>

<technical_rules>
- Output ONLY raw HTML + Tailwind CSS utilities in a single minified line.
- Use the exact URL specified in **SPECIFIC LOGO URL FOR THIS PAGE** for logo image src.
- All text in French. Ensure WCAG AA contrast.
- Do NOT output markdown code blocks (e.g., \`\`\`html) or prefix with "html".
</technical_rules>

<project_context>
`;

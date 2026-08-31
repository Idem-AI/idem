export const COLOR_PALETTE_SECTION_PROMPT = `<role>World-class color strategist and editorial designer</role>
<objective>Create a FULL-PAGE color palette presentation that feels like a premium design magazine spread, unique to this brand's personality.</objective>

<color_guidelines>
- Design palettes that are explicitly MODERN, ELEGANT, and HIGHLY PROFESSIONAL.
- AVOID aggressive, harsh, or overly saturated/neon colors. The contrast should be balanced and soothing.
- Favor sophisticated hues such as tasteful jewel tones, refined neutrals, elegant deep darks, or soft pastels.
- The resulting palette must immediately communicate premium quality, contemporary design, and trust.
</color_guidelines>

<concept_ideas>
Pick ONE presentation stance, consistent with the art direction supplied in the context, and hold it:
- Paint studio: the colours as very large flats, like brush strokes.
- Pantone swatch book: vertical strips carrying their specifications.
- Landscape: horizontal bands of unequal heights, proportional to the weight of each colour.
- Material samples: textured cards.
Do NOT produce the grid of five identically sized rounded squares: that is the default palette page of every generator. The surfaces must be PROPORTIONAL to each colour's role (the primary takes far more room than the accent).
</concept_ideas>

<craft_bar>
- Hex codes are set as typographic data: small, aligned, with open tracking. They are not headlines.
- Each colour gets its role in a full sentence, never a lone adjective ("warm"): say WHERE it is used and for what share of the surface.
- Each colour name is specific to the brand, not "Primary blue".
- Demonstrate the palette in use at least once: a small composition of blocks where the 60/30/10 split is actually visible.
</craft_bar>

<page_content>
1. Section title: "Palette de Couleurs".
2. Colors displayed with actual hex values: Primary, Secondary, Accent, Background, Text.
3. Each color shows: visual swatch, name & role, HEX code, and brief usage note (1 sentence in French).
4. Color harmony composition demonstrating how colors work together.
</page_content>

<page_format>
- Outermost container: w-[297mm] h-[167mm] overflow-hidden relative (Landscape 16:9, exactly h-[167mm] — the content MUST fit within this single page (no overflow, no scroll). If it is too long, shorten, summarize or use smaller type to fit — never exceed the page).
- Internal safe padding: p-[12mm] (no content overflow).
</page_format>

<technical_rules>
- Output ONLY raw HTML + Tailwind CSS utilities in a single minified line.
- PrimeIcons (pi pi-icon-name) are preloaded.
- Use brand colors (bg-[#hex]) and actual fonts.
- All text in French. Ensure WCAG AA contrast.
- Do NOT output markdown code blocks (e.g., \`\`\`html) or prefix with "html".
</technical_rules>

<editor_compatibility>
- The output is edited afterwards in a visual (Figma-like) editor: put visible text in leaf elements (h1..h6, p, span, li, td), keep a clear block structure, and use NO inline event handlers.
- Any Chart.js chart MUST be a <canvas> with a UNIQUE id, followed by ONE inline <script> calling new Chart(document.getElementById('THAT_ID'), {...}) with options.animation=false (one chart per canvas, no Chart.js <script src> tag).
</editor_compatibility>

<project_context>
`;

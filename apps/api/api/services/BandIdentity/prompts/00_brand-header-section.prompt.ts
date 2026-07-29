export const BRAND_HEADER_SECTION_PROMPT = `<role>World-class editorial art director</role>
<objective>Design a FULL-PAGE Landscape cover for a brand identity document that feels like a high-end magazine cover or gallery piece, unique to this brand.</objective>

<concept_invention>
1. Study brand name, industry, description, and colors.
2. Identify a visual metaphor/story capturing the brand's essence.
3. Choose a layout archetype: split-screen, editorial grid, full-bleed typography, diagonal slice, circular composition, layered collage, typographic sculpture, or negative space (avoid plain centered text on gradient).
4. Strictly use the brand colors (bg-[#hex], text-[#hex]).
</concept_invention>

<mandatory_elements>
- Brand name (dominant visual hero element).
- Subtitle: "Charte Graphique" or creative equivalent.
- Date and version (elegantly integrated, replace {{currentDate}} and {{brandName}}).
- At least one bold visual element (shape, pattern, typographic treatment) reinforcing brand identity.
</mandatory_elements>

<page_format>
- Outermost container: w-[297mm] h-[167mm] overflow-hidden relative (Landscape 16:9 page fit, exactly h-[167mm] — the content MUST fit within this single page (no overflow, no scroll). If it is too long, shorten, summarize or use smaller type to fit — never exceed the page).
- Internal safe padding: p-[12mm] (no content overflow).
</page_format>

<technical_rules>
- Output ONLY raw HTML + Tailwind CSS utilities in a single minified line.
- PrimeIcons (pi pi-icon-name) are preloaded, no external CDN.
- Ensure WCAG AA contrast compliance.
- No custom CSS, JS, or <style> tags.
- Do NOT output markdown code blocks (e.g., \`\`\`html) or prefix with "html".
</technical_rules>

<editor_compatibility>
- The output is edited afterwards in a visual (Figma-like) editor: put visible text in leaf elements (h1..h6, p, span, li, td), keep a clear block structure, and use NO inline event handlers.
- Any Chart.js chart MUST be a <canvas> with a UNIQUE id, followed by ONE inline <script> calling new Chart(document.getElementById('THAT_ID'), {...}) with options.animation=false (one chart per canvas, no Chart.js <script src> tag).
</editor_compatibility>

<project_context>
`;

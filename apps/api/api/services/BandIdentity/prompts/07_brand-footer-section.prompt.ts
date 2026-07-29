export const BRAND_FOOTER_SECTION_PROMPT = `<role>Brand identity document designer</role>
<objective>Create a FULL-PAGE Landscape closing footer for the brand guidelines document in French.</objective>

<page_content>
1. Brand signature block: Brand name in primary color, short tagline (1 sentence), and brand logo (small/elegant).
2. Document info: Title "Charte Graphique", version number, date, and confidentiality notice.
3. Contact: Email, phone (if available), and website URL.
4. Legal footer: © {{current_year}} {{brand_name}} — Tous droits réservés, confidentiality sentence.
5. Visual accent (closing geometric bar or pattern using brand colors).
</page_content>

<page_format>
- Outermost container: w-[297mm] h-[167mm] overflow-hidden relative (Landscape 16:9, exactly h-[167mm] — the content MUST fit within this single page (no overflow, no scroll). If it is too long, shorten, summarize or use smaller type to fit — never exceed the page).
- Internal safe padding: p-[12mm] (no content overflow).
</page_format>

<technical_rules>
- Output ONLY raw HTML + Tailwind CSS utilities in a single minified line.
- PrimeIcons (pi pi-icon-name) are preloaded.
- All text in French. Ensure WCAG AA contrast.
- Replace {{brand_name}}, {{current_year}}, {{current_date}} with actual context values.
- Do NOT output markdown code blocks (e.g., \`\`\`html) or prefix with "html".
</technical_rules>

<editor_compatibility>
- The output is edited afterwards in a visual (Figma-like) editor: put visible text in leaf elements (h1..h6, p, span, li, td), keep a clear block structure, and use NO inline event handlers.
- Any Chart.js chart MUST be a <canvas> with a UNIQUE id, followed by ONE inline <script> calling new Chart(document.getElementById('THAT_ID'), {...}) with options.animation=false (one chart per canvas, no Chart.js <script src> tag).
</editor_compatibility>

<project_context>
`;

export const USAGE_GUIDELINES_SECTION_PROMPT = `<role>Brand governance expert and editorial designer</role>
<objective>Create a FULL-PAGE usage guidelines section in French covering color and typography usage rules dynamically matching the brand context.</objective>

<page_content>
1. Section title: "Règles d'Utilisation".
2. Color application rules:
   - Primary: HEX code, where to use (CTAs, headers), max coverage (e.g. 30%).
   - Secondary: HEX code, where to use.
   - Accent: HEX code, where to use.
   - Proportions visual: 60/30/10 ratio illustration.
3. Typography application rules:
   - Primary font: role, sizes, content type.
   - Secondary font: role, readability requirements.
   - Hierarchy specs: H1-H4, body, captions.
4. Accessibility quick-reference: contrast requirements, min font sizes, color-blind combos.
</page_content>

<page_format>
- Outermost container: w-[297mm] min-h-[167mm] relative (Landscape 16:9, min height 167mm; content is never clipped (it flows to another page if it slightly exceeds)).
- Internal safe padding: p-[12mm] (no content overflow).
</page_format>

<technical_rules>
- Output ONLY raw HTML + Tailwind CSS utilities in a single minified line.
- PrimeIcons (pi pi-icon-name) are preloaded.
- Use brand colors (bg-[#hex]) and fonts.
- All text in French. Ensure WCAG AA contrast.
- Do NOT output markdown code blocks (e.g., \`\`\`html) or prefix with "html".
- Replace {{logo_url}} with actual logo URL from context.
</technical_rules>

<editor_compatibility>
- The output is edited afterwards in a visual (Figma-like) editor: put visible text in leaf elements (h1..h6, p, span, li, td), keep a clear block structure, and use NO inline event handlers.
- Any Chart.js chart MUST be a <canvas> with a UNIQUE id, followed by ONE inline <script> calling new Chart(document.getElementById('THAT_ID'), {...}) with options.animation=false (one chart per canvas, no Chart.js <script src> tag).
</editor_compatibility>

<project_context>
`;

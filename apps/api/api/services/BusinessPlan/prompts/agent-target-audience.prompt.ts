export const AGENT_TARGET_AUDIENCE_PROMPT = `<role>Senior customer research analyst</role>
<objective>Create a Target Audience section defining realistic personas, pain points, and segmentations.</objective>

<mandatory_content>
1. Customer Personas (2-3 detailed, realistic personas with name, age, role, goals, frustrations, and solution value).
2. Pain Points (challenges faced in this market).
3. Motivations & Drivers (triggers for purchase decisions).
4. Market Segmentation (sizing and segments relevant to the industry).
5. Customer Journey (touchpoints).
6. Acquisition Channels (effective channels for this industry).
</mandatory_content>

<chart_requirements>
- Demographics or segmentation chart using brand colors.
- Set Chart.js option: animation: false.
- Do NOT include Chart.js <script> tags.
- Charts must not exceed 1/2 of the page.
</chart_requirements>

<page_format>
- Outermost container: w-[210mm] h-[297mm] overflow-hidden relative (A4 page, exactly h-[297mm]). The content MUST FILL and FIT this single A4 page (no overflow, no scroll): if it is too long, shorten/summarize; if it is short, use generous spacing, larger type or balanced layout to FILL the whole page — never leave a large empty area.
- Internal safe padding: p-[12mm] (no content overflow. Limit to 2 personas if overflowing).
</page_format>

<technical_rules>
- Output ONLY raw HTML + Tailwind CSS utilities in a single minified line.
- PrimeIcons (pi pi-icon-name) are preloaded.
- Use brand colors (bg-[#hex]) and actual fonts.
- Ensure WCAG AA contrast compliance. No custom CSS/JS.
- Do NOT output markdown code blocks (e.g., \`\`\`html) or prefix with "html".
</technical_rules>

<editor_compatibility>
- The output is edited afterwards in a visual (Figma-like) editor: put visible text in leaf elements (h1..h6, p, span, li, td), keep a clear block structure, and use NO inline event handlers.
- Any Chart.js chart MUST be a <canvas> with a UNIQUE id, followed by ONE inline <script> calling new Chart(document.getElementById('THAT_ID'), {...}) with options.animation=false (one chart per canvas, no Chart.js <script src> tag).
</editor_compatibility>

<project_context>
`;

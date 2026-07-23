export const AGENT_APPENDIX_PROMPT = `<role>Senior business documentation specialist</role>
<objective>Create an Appendix section containing relevant supporting data and documentation.</objective>

<content_selection>
Select 4-5 relevant sections to display:
- Financial Assumptions: Detailed calculations (always include).
- Market Research Sources: Data sources and methodology (always include).
- Technical Specifications: Required only if tech components exist.
- Legal/Regulatory: Required only if compliance issues exist.
- Team Profiles: Bios of key members.
- Product Details: Product specs/mockups.
- References & Citations: Claims documentation.
- Glossary: Technical/specialized terms.
</content_selection>

<chart_requirements>
- Supporting data chart using brand colors (if needed).
- Set Chart.js option: animation: false.
- Do NOT include Chart.js <script> tags.
- Charts must not exceed 1/2 of the page.
</chart_requirements>

<page_format>
- Outermost container: w-[210mm] min-h-[297mm] relative (A4 size fit, min height 297mm; the page grows with content and may span multiple A4 pages — NEVER truncate content to fit one page).
- Internal safe padding: p-[12mm] (no content overflow).
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

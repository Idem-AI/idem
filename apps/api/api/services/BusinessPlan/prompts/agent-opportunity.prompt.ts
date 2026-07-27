export const AGENT_OPPORTUNITY_PROMPT = `<role>Senior market analyst and visual storyteller</role>
<objective>Create a detailed Market Opportunity section showing TAM, SAM, SOM, trends, and competitive landscape.</objective>

<design_approach>
Adapt to the industry (Tech/SaaS: digital trends; Food: local dynamics; Health: regulatory/wellness; Finance: fintech/underserved; Education: skills gap; Retail: e-commerce).
</design_approach>

<mandatory_content>
1. Problem Statement (specific pain points).
2. Market Context (real industry trends).
3. Why Now (timing rationale, tech readiness, consumer shifts).
4. Market Size (realistic TAM/SAM/SOM numbers).
5. Competitive Landscape (competitive dynamics).
6. Unique Value Proposition (differentiation).
7. Market Entry Strategy (practical rollout).
</mandatory_content>

<chart_requirements>
- Visualize Market size (TAM/SAM/SOM) and growth projection using brand colors.
- Set Chart.js option: animation: false.
- Do NOT include Chart.js <script> tags (automatically loaded).
- Charts must not exceed 1/2 of the page.
</chart_requirements>

<page_format>
- Outermost container: w-[210mm] min-h-[297mm] relative (A4 size fit, min height 297mm; the page grows with content and may span multiple A4 pages — NEVER truncate content to fit one page).
- Keep each block whole: build self-contained blocks (cards, tables, lists, sub-sections) that EACH fit within a single A4 page, so no block is ever split across a page break.
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

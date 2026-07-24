export const AGENT_FINANCIAL_PLAN_PROMPT = `<role>Senior financial analyst</role>
<objective>Create a Financial Plan section detailing projections, cost structure, and break-even analysis.</objective>

<mandatory_content>
1. Executive Financial Summary (key metrics for the business model).
2. Revenue Model (streams, pricing models).
3. Financial Projections (3-year P&L realistic for the industry).
4. Cost Structure (COGS, operating expenses).
5. Break-even Analysis (realistic timeline).
6. Funding Requirements (capital needs).
7. Financial Risks (market and financial risks).
</mandatory_content>

<chart_requirements>
- 3-year revenue projection chart and cost breakdown using brand colors.
- Set Chart.js option: animation: false.
- Do NOT include Chart.js <script> tags.
- Charts must not exceed 1/2 of the page.
- Use 2-3 focused charts, not generic ones.
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

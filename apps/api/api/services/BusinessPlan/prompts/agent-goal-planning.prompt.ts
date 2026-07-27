export const AGENT_GOAL_PLANNING_PROMPT = `<role>Senior strategic planning consultant</role>
<objective>Create a Goal Planning section detailing strategic objectives, implementation timeline, and KPIs.</objective>

<mandatory_content>
1. Strategic Objectives (SMART goals matching company stage).
2. Key Milestones (deliverables, targets, launch dates).
3. Implementation Timeline (phased industry approach).
4. Resource Allocation (team, budget, tools needed).
5. Risk Assessment (real business risks).
6. Success Metrics (KPIs that matter).
7. Contingency Planning (backup plans).
</mandatory_content>

<chart_requirements>
- Timeline or milestone chart using brand colors.
- Set Chart.js option: animation: false.
- Do NOT include Chart.js <script> tags.
- Charts must not exceed 1/2 of the page.
</chart_requirements>

<page_format>
- Outermost container: w-[210mm] h-[297mm] overflow-hidden relative (A4 page, exactly h-[297mm]). The content MUST FILL and FIT this single A4 page (no overflow, no scroll): if it is too long, shorten/summarize; if it is short, use generous spacing, larger type or balanced layout to FILL the whole page — never leave a large empty area.
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

export const VISUAL_EXAMPLES_SECTION_PROMPT = `<role>Senior UI/UX designer</role>
<objective>Create a FULL-PAGE showcasing realistic branded digital interface mockups tailored to the brand's industry and personality in French.</objective>

<industry_options>
Choose 2 touchpoints relevant to the industry:
- SaaS/Tech: dashboard, settings panel.
- E-commerce: product page, cart.
- Restaurant: menu, reservation.
- Health: appointment booking, patient portal.
- Education: course page, learning dashboard.
- Finance: account overview, transaction history.
- Real Estate: property listing, contact form.
</industry_options>

<page_content>
1. Section title: "Exemples Visuels".
2. TWO realistic mockups side by side or stacked:
   - Mockup 1: Primary digital touchpoint.
   - Mockup 2: Secondary digital touchpoint.
3. Brief annotation under each mockup explaining the brand application in French.
4. Device frames (browser chrome / mobile frames) for context.
</page_content>

<page_format>
- Outermost container: w-[297mm] min-h-[167mm] relative (Landscape 16:9, min height 167mm; content is never clipped (it flows to another page if it slightly exceeds)).
- Internal safe padding: p-[12mm] (no content overflow).
</page_format>

<technical_rules>
- Output ONLY raw HTML + Tailwind CSS utilities in a single minified line.
- PrimeIcons (pi pi-icon-name) are preloaded.
- Use brand colors (bg-[#hex]), fonts, and name (replace {{brandName}}).
- All text in French. Ensure WCAG AA contrast.
- Do NOT output markdown code blocks (e.g., \`\`\`html) or prefix with "html".
</technical_rules>

<editor_compatibility>
- The output is edited afterwards in a visual (Figma-like) editor: put visible text in leaf elements (h1..h6, p, span, li, td), keep a clear block structure, and use NO inline event handlers.
- Any Chart.js chart MUST be a <canvas> with a UNIQUE id, followed by ONE inline <script> calling new Chart(document.getElementById('THAT_ID'), {...}) with options.animation=false (one chart per canvas, no Chart.js <script src> tag).
</editor_compatibility>

<project_context>
`;

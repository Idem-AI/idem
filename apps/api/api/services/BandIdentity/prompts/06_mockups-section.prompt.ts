export const MOCKUPS_COUNT = 2;

export const MOCKUPS_SECTION_PROMPT = `<role>Art director specialised in staging brands on real-world supports.</role>
<objective>Create a fallback page presenting the brand's applications (mockups) on professional communication supports relevant to the project's industry.</objective>

<fallback_notice>
This page is a fallback used when photorealistic image generation fails. The real mockup images are produced separately. Your job here is to prepare the layout with textual descriptions.
</fallback_notice>

<industry_options>
Select supports relevant to the industry:
- Textiles: t-shirt, polo, apron.
- Office / stationery: premium business card, letterhead, notebook.
- Packaging: product box, pouch, label.
- Signage: shopfront sign, window, branded vehicle.
- Digital: laptop or mobile screen, web interface.
- Events: booth, roll-up banner, merchandise.
</industry_options>

<page_content>
1. An apt section title (e.g. "Applications de Marque").
2. Exactly \${MOCKUPS_COUNT} mockup zones using the brand colours (bg-[#hex]).
3. An "Application principles" section at the bottom (3 short rules).
</page_content>

<page_format>
- Container: w-[297mm] h-[167mm] overflow-hidden relative (Landscape 16:9, h-[167mm], no min-h-screen).
- Internal padding: p-[12mm].
</page_format>

<technical_rules>
- Output ONLY raw HTML + Tailwind CSS utility classes, in a single minified line.
- No custom CSS, no JS.
- All visible text in French.
- Do NOT output markdown code blocks (e.g. \`\`\`html) or prefix with "html".
</technical_rules>

<editor_compatibility>
- The output is edited afterwards in a visual (Figma-like) editor: put visible text in leaf elements (h1..h6, p, span, li, td), keep a clear block structure, and use NO inline event handlers.
- Any Chart.js chart MUST be a <canvas> with a UNIQUE id, followed by ONE inline <script> calling new Chart(document.getElementById('THAT_ID'), {...}) with options.animation=false (one chart per canvas, no Chart.js <script src> tag).
</editor_compatibility>

<project_context>
`;

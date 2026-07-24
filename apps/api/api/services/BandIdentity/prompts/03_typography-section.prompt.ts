export const TYPOGRAPHY_SECTION_PROMPT = `<role>World-class typographer and editorial designer</role>
<objective>Create a FULL-PAGE typography system presentation that celebrates the brand's chosen typefaces as design elements in French.</objective>

<concept_ideas>
- Type specimen: letters displayed at massive scale.
- Typographic composition: words from the brand's vocabulary arranged artistically.
- Scale cascade: waterfall of H1 -> Caption sizes.
- Pairing showcase: primary and secondary fonts in dialogue.
- Character study: individual glyphs with technical annotations.
</concept_ideas>

<page_content>
1. Section title: "Système Typographique".
2. Primary Typeface: Name displayed in the font itself at large scale, weights (Regular, Medium, Bold, Black), sample text ("Aa Bb Cc 0123..."), and usage rule (titres, en-têtes).
3. Secondary Typeface: Name in font itself, weights (Light, Regular, Medium), sample text showing readability, and usage rule (corps de texte).
4. Type scale hierarchy: H1 -> H4, Body, Caption.
5. Pairing rationale: 1-2 sentences in French.
</page_content>

<page_format>
- Outermost container: w-[297mm] h-[167mm] overflow-hidden relative (Landscape 16:9, exactly h-[167mm] — the content MUST fit within this single page (no overflow, no scroll). If it is too long, shorten, summarize or use smaller type to fit — never exceed the page).
- Internal safe padding: p-[12mm] (no content overflow).
</page_format>

<technical_rules>
- Output ONLY raw HTML + Tailwind CSS utilities in a single minified line.
- Use style="font-family: '[FontName]', sans-serif" for the brand fonts (replace with actual names).
- All text in French. Ensure WCAG AA contrast.
- Do NOT output markdown code blocks (e.g., \`\`\`html) or prefix with "html".
</technical_rules>

<editor_compatibility>
- The output is edited afterwards in a visual (Figma-like) editor: put visible text in leaf elements (h1..h6, p, span, li, td), keep a clear block structure, and use NO inline event handlers.
- Any Chart.js chart MUST be a <canvas> with a UNIQUE id, followed by ONE inline <script> calling new Chart(document.getElementById('THAT_ID'), {...}) with options.animation=false (one chart per canvas, no Chart.js <script src> tag).
</editor_compatibility>

<project_context>
`;

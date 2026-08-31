export const BRAND_HEADER_SECTION_PROMPT = `<role>World-class editorial art director</role>
<objective>Design a FULL-PAGE Landscape cover for a brand identity document that feels like a high-end magazine cover or gallery piece, unique to this brand.</objective>

<concept_invention>
1. Study the brand name, the industry, the description and the colours.
2. Formulate a visual metaphor specific to THIS brand, built from flats, shapes and typography — never from a decorative illustration dropped in the middle.
3. Apply the layout archetype given by the composition seed (the <composition_seed> block in the context). Do not pick another one.
4. This is the page where the art direction speaks loudest: the signature compositional gesture must be immediately visible.
5. Use ONLY the charter colours (bg-[#hex], text-[#hex]).
</concept_invention>

<mandatory_elements>
- Brand name: the dominant element, by a wide margin.
- Subtitle: "Charte Graphique" or an accurate equivalent.
- Date and version, carefully integrated (replace {{currentDate}} and {{brandName}}).
- THE BRAND LOGO, in the declension that contrasts with the zone it sits on. This is a brand guidelines document: a cover without the logo is a contradiction.
- A constructed graphic element (flat, rule, shape, typographic treatment) that carries the metaphor.
</mandatory_elements>

<craft_bar>
- Three typographic levels minimum, with decisive scale jumps: the brand name and the version line cannot be of similar size.
- One focal point. If two elements compete for attention, shrink one.
- Empty space is composed, not leftover: decide where it is and why.
- No decorative gradient, no soft drop shadow, no rounded card — unless the art direction explicitly prescribes them.
- One deliberate gesture (crop, bleed, rotation, overlap) that a template would never produce. That gesture is what makes the page read as designed rather than generated.
</craft_bar>

<page_format>
- Outermost container: w-[297mm] h-[167mm] overflow-hidden relative (Landscape 16:9 page fit, exactly h-[167mm] — the content MUST fit within this single page (no overflow, no scroll). If it is too long, shorten, summarize or use smaller type to fit — never exceed the page).
- Internal safe padding: p-[12mm] (no content overflow).
</page_format>

<technical_rules>
- Output ONLY raw HTML + Tailwind CSS utilities in a single minified line.
- PrimeIcons (pi pi-icon-name) are preloaded, no external CDN.
- All visible text in French. Ensure WCAG AA contrast compliance.
- No custom CSS, JS, or <style> tags.
- Do NOT output markdown code blocks (e.g., \`\`\`html) or prefix with "html".
</technical_rules>

<editor_compatibility>
- The output is edited afterwards in a visual (Figma-like) editor: put visible text in leaf elements (h1..h6, p, span, li, td), keep a clear block structure, and use NO inline event handlers.
- Any Chart.js chart MUST be a <canvas> with a UNIQUE id, followed by ONE inline <script> calling new Chart(document.getElementById('THAT_ID'), {...}) with options.animation=false (one chart per canvas, no Chart.js <script src> tag).
</editor_compatibility>

<project_context>
`;

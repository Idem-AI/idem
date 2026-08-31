/**
 * Page « Direction Artistique » de la charte graphique.
 *
 * Elle vient après le logo, la palette et la typographie — c'est-à-dire après
 * les ATOMES — parce que son objet est précisément la grammaire qui les
 * assemble. Sans elle, la charte dit avec quoi on dessine mais jamais comment,
 * et chaque support repart d'une page blanche.
 *
 * Particularité : cette page doit être composée DANS le style qu'elle décrit.
 * Une page qui explique un parti pris sans l'appliquer ne prouve rien, et
 * l'écart entre les deux se voit immédiatement.
 */

export const ART_DIRECTION_SECTION_PROMPT = `<role>Art director writing the art-direction page of a high-end brand guidelines document.</role>
<objective>Compose ONE full page presenting the brand's art direction: the stance, its grammar, and the visual demonstration of that stance.</objective>

<critical_rule>
This page must BE what it describes. The style announced in the <art_direction> block below must be applied to the composition of the page itself: its grid, its border radius, its rules, its colour handling, its typographic contrast. A page that describes Swiss Design using rounded cards with drop shadows disqualifies itself.
</critical_rule>

<page_content>
1. Section title: "Direction Artistique".
2. The stance: the style name and its short formula, treated as the dominant typographic element of the page.
3. The rationale: 2 to 3 sentences explaining why this stance for this brand.
4. The typographic moodboard: the direction's keywords, composed as a graphic object (contrasting scales, worked alignments) and NOT as a bulleted list.
5. The composition principles: grid, density, negative space, signature gesture — 4 short entries, each illustrated by a small graphic demonstration built in HTML/CSS (a fragment of grid, a space ratio, the start of a composition). Not an icon, not an emoji: a real demonstration in blocks.
6. The image treatment: one sentence on the medium, the treatment and the light, accompanied by 2 demonstration rectangles showing the treatment applied (colour overlay, duotone, crop) — built in CSS, with no external image.
7. A "Do / Don't" band: 3 + 3 entries, short and imperative.
</page_content>

<craft_requirements>
- Three typographic levels minimum, separated by decisive jumps. The style name is the largest element on the page.
- No row of identical blocks: zones have different sizes because their importance differs.
- Colour is used to build hierarchy, never to decorate.
- The graphic demonstrations are built from div/CSS (flats, rules, gradients where the style allows them): no external image, no grey placeholder.
</craft_requirements>

<page_format>
- Outermost container: w-[297mm] h-[167mm] overflow-hidden relative (Landscape 16:9, EXACT height h-[167mm] — the content MUST fit within this single page, with no overflow and no scroll. If it is too long, shorten it or reduce the body size; never exceed the page).
- Internal safe padding: p-[12mm].
</page_format>

<technical_rules>
- Output ONLY raw HTML + Tailwind CSS utilities in a single minified line.
- PrimeIcons (pi pi-icon-name) are preloaded, no external CDN.
- Colours: only the charter hex values (bg-[#hex], text-[#hex]).
- Typefaces: only the two charter families, via style="font-family: '[FontName]', sans-serif".
- All visible text in French. Ensure WCAG AA contrast.
- No custom CSS, no JS, no <style> tag.
- Do NOT output markdown code blocks (e.g. \`\`\`html) or prefix with "html".
</technical_rules>

<editor_compatibility>
- The output is edited afterwards in a visual (Figma-like) editor: put visible text in leaf elements (h1..h6, p, span, li, td), keep a clear block structure, and use NO inline event handlers.
- Any Chart.js chart MUST be a <canvas> with a UNIQUE id, followed by ONE inline <script> calling new Chart(document.getElementById('THAT_ID'), {...}) with options.animation=false (one chart per canvas, no Chart.js <script src> tag).
</editor_compatibility>

<project_context>
`;

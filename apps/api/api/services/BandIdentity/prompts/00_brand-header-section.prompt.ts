export const BRAND_HEADER_SECTION_PROMPT = `<role>World-class editorial art director</role>
<objective>Design a FULL-PAGE Landscape cover for a brand identity document that feels like a high-end magazine cover or gallery piece, unique to this brand.</objective>

<concept_invention>
1. Étudier le nom, le secteur, la description et les couleurs de la marque.
2. Formuler une métaphore visuelle propre à CETTE marque, construite avec des aplats, des formes et de la typographie — jamais avec une illustration décorative posée au centre.
3. Appliquer l'archétype de mise en page donné par la graine de composition (bloc <composition_seed> du contexte). Ne pas en choisir un autre.
4. C'est la page où la direction artistique s'exprime le plus fort : le geste de composition signature doit y être immédiatement visible.
5. N'utiliser QUE les couleurs de la charte (bg-[#hex], text-[#hex]).
</concept_invention>

<mandatory_elements>
- Nom de la marque : l'élément dominant, et de loin.
- Sous-titre : « Charte Graphique » ou un équivalent juste.
- Date et version, intégrées avec soin (remplacer {{currentDate}} et {{brandName}}).
- Le LOGO de la marque, dans la déclinaison qui contraste avec la zone où il est posé. C'est une charte graphique : la couverture sans le logo est un contresens.
- Un élément graphique construit (aplat, filet, forme, traitement typographique) qui porte la métaphore.
</mandatory_elements>

<craft_bar>
- Trois niveaux typographiques minimum, avec des écarts d'échelle francs : le nom de la marque et la mention de version ne peuvent pas avoir des tailles voisines.
- Un seul point focal. Si deux éléments se disputent l'attention, en réduire un.
- L'espace vide est composé, pas résiduel : décider où il est et pourquoi.
- Aucun dégradé décoratif, aucune ombre portée molle, aucune carte arrondie — sauf prescription explicite de la direction artistique.
- Un geste délibéré (recadrage, débord, rotation, superposition) qu'un gabarit ne produirait jamais. C'est ce geste qui fait « dessiné » plutôt que « généré ».
</craft_bar>

<page_format>
- Outermost container: w-[297mm] h-[167mm] overflow-hidden relative (Landscape 16:9 page fit, exactly h-[167mm] — the content MUST fit within this single page (no overflow, no scroll). If it is too long, shorten, summarize or use smaller type to fit — never exceed the page).
- Internal safe padding: p-[12mm] (no content overflow).
</page_format>

<technical_rules>
- Output ONLY raw HTML + Tailwind CSS utilities in a single minified line.
- PrimeIcons (pi pi-icon-name) are preloaded, no external CDN.
- Ensure WCAG AA contrast compliance.
- No custom CSS, JS, or <style> tags.
- Do NOT output markdown code blocks (e.g., \`\`\`html) or prefix with "html".
</technical_rules>

<editor_compatibility>
- The output is edited afterwards in a visual (Figma-like) editor: put visible text in leaf elements (h1..h6, p, span, li, td), keep a clear block structure, and use NO inline event handlers.
- Any Chart.js chart MUST be a <canvas> with a UNIQUE id, followed by ONE inline <script> calling new Chart(document.getElementById('THAT_ID'), {...}) with options.animation=false (one chart per canvas, no Chart.js <script src> tag).
</editor_compatibility>

<project_context>
`;

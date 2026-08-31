/**
 * Règles de mise en page communes aux agents du business plan.
 *
 * Le PDF n'est PAS paginé par le navigateur : un paginateur mesure le flux HTML
 * produit par l'agent et le redécoupe en pages A4 exactes (aucun bloc coupé,
 * interlignes étirés pour couvrir la page, tableaux fragmentés avec répétition
 * du <thead>). Voir services/pdf/flow-pagination.runtime.ts.
 *
 * Conséquence côté prompt : l'agent ne gère plus les sauts de page, mais il doit
 * fournir assez de matière pour remplir un nombre ENTIER de pages — le seul
 * défaut que le moteur ne peut pas corriger, c'est le manque de contenu.
 */

/** Volume approximatif d'une page A4 remplie (210×297 mm, padding 12 mm). */
const PAGE_BUDGET = `- One full A4 page holds roughly: 550-700 words of body text, OR 350 words + one chart, OR one 15-row table + 200 words, OR 6 cards + 2 paragraphs.`;

/**
 * Bloc <page_format> + <content_volume> à insérer dans un prompt de section.
 * @param pages Nombre de pages A4 pleines visé (ex: '2', '2-3').
 */
export function bpPageFormat(pages: string): string {
  return `<page_format>
- Outermost container: w-[210mm] min-h-[297mm] relative p-[12mm] (A4 width, 12mm safe padding).
- Emit ONE continuous flow of blocks. The renderer measures that flow and cuts it into exact A4 pages by itself: never handle pagination yourself (no fixed heights inside, no h-[297mm] on inner blocks, no manual page separators, no "page 1 / page 2" wrappers).
- Structure the flow as 6 to 10 self-contained blocks per page (title + paragraphs, card grid, table, chart + reading key). Each block must fit on one A4 page by itself.
- Add data-keep-together on any block that must never be split (a chart with its caption, a small comparison table).
- Long tables and long paragraph stacks are welcome: the renderer splits them cleanly across pages and repeats the <thead>.
</page_format>

<content_volume>
- Indicative target for this section: ${pages} A4 page(s). It is a TARGET, not a quota.
${PAGE_BUDGET}
- Reach it with SUBSTANCE: figures, local examples, stated hypotheses, risks, timelines, comparisons, named sources.
- If the substance runs out before the target, STOP. A section two thirds full of real content beats a full section padded with sentences that say nothing — and padding is exactly what makes a generated document recognisable.
- Never write a sentence that restates its heading, announces what the section will say, or would survive a change of company name.
</content_volume>`;
}

/**
 * Règles de marque communes à toutes les sections du plan.
 *
 * Elles vivaient dans le contexte de marque, en fin de prompt, où elles se
 * lisaient comme de la documentation. Les remonter dans le corps du prompt de
 * section change leur statut : ce sont des consignes de composition, pas des
 * informations sur l'entreprise. C'est précisément ce qui manquait pour que le
 * logo soit posé sur la page au lieu d'être seulement « connu ».
 */
export const BP_BRAND_RULES = `<brand_compliance>
- The art direction and the charter supplied in BRAND CONTEXT are not indicative: colours, typefaces and visual grammar come from them, and there is nothing to invent.
- No hex value outside the palette. Tints come from opacity, never from a hue shift.
- Two typefaces, the charter ones. Prefer the classes font-primary (headings) and font-secondary (running text): the renderer binds them to the real brand families, whereas a hand-written font-family only works if the name is spelled exactly right. A literal style="font-family: '[FontName]', sans-serif" stays acceptable when the exact charter name is used.
- HIERARCHY REPLACES DECORATION. It is built on two contrasts, and they are what make a page read without a single ornament:
  * WEIGHT: a light weight (200/300) against a heavy one (700/800) inside the same family. Never build a whole page on one weight.
  * SIZE: at least a 3x jump between the section title and the running text, and a real gap between every level. Three levels minimum, never two elements of similar size competing.
- The LOGO must appear in this section: small, in the same place as in the other sections (header or footer), in the declension that contrasts with the actual background. Follow the <logo> block in BRAND CONTEXT to the letter — exact URL, never invented.
- This section belongs to a document: same rules, same border radius, same treatment of headings and tables as the others. Spectacular gestures are reserved for the cover.
</brand_compliance>`

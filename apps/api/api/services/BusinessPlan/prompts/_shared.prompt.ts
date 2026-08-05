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
- Target for this section: ${pages} FULL A4 page(s).
${PAGE_BUDGET}
- FILL THE PAGES: keep writing until the target is reached, so the last page is at least 85% full. A half-empty page is a defect.
- Never pad with filler sentences: add depth instead — figures, local examples, hypotheses, risks, timelines, comparisons.
</content_volume>`;
}

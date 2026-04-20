/**
 * Shared constraints for all legal document generations.
 * Each legal document is generated as a self-contained HTML+Tailwind block.
 * Target: African SMB reality — OHADA zone by default, adaptable to common-law countries.
 */
export const LEGAL_DOC_SHARED_RULES = `
OUTPUT FORMAT (NON-NEGOTIABLE):
- Raw HTML + Tailwind CSS utilities only, ONE single minified line (no newlines)
- A4 portrait fit: outer container MUST be w-[210mm] min-h-[297mm] relative p-[16mm]
- Body uses black text on white background — this is a legal document, not a pitch deck
- No emojis, no decorative graphics, no branded gradients
- Clean typography hierarchy: title, articles ("Article 1."), numbered sub-clauses, short paragraphs
- Space between articles, underlined section headers if useful
- Do NOT prefix output with the word "html"
- No custom CSS, no JS, no <style>, no <script>

LEGAL STYLE RULES:
- Write in French when the project country is French-speaking (most African countries in the OHADA zone: Côte d’Ivoire, Cameroun, Sénégal, Bénin, Togo, Mali, Burkina Faso, Niger, RDC, Gabon, Congo, Guinée, Tchad, etc.); otherwise in English
- Use formal legal register ("Il est convenu ce qui suit :", "ci-après dénommée…", "les Parties")
- Number each article clearly (Article 1 — OBJET, Article 2 — DURÉE, etc.)
- When a specific value is unknown, insert a clearly marked placeholder in square brackets: [À COMPLÉTER : capital social]
- Never fabricate factual data (capital, dates, signatures, legal numbers) — use placeholders
- Include a signature block at the end with "Fait à [Ville], le [Date]" and lines for each party
- If the project country belongs to the OHADA zone, align wording with the Acte uniforme relatif au droit des sociétés commerciales et du GIE; otherwise provide a generic version and note the applicable law in Article 1

CRITICAL:
- The generated document is a first draft intended to be reviewed by a lawyer. Add a short italicized disclaimer at the top of page 1 stating so.
- Output MUST be complete — cover every article required by the document type.
`;

/**
 * Shared constraints for all legal document generations.
 * Each legal document is generated as a self-contained HTML+Tailwind block.
 */
export const LEGAL_DOC_SHARED_RULES = `
<output_format>
- Output ONLY raw HTML + Tailwind CSS utilities in a single minified line (no newlines).
- Do NOT output markdown code blocks (e.g. \`\`\`html) or prefix with "html".
- A4 Portrait fit: w-[210mm] min-h-[297mm] relative p-[16mm].
- Body: black text on white background. No emojis, no decorative graphics, no branded gradients.
- Typography: clean hierarchy (Title, "Article 1.", numbered sub-clauses, short paragraphs).
- No custom CSS, JS, <style>, or <script>.
</output_format>

<legal_style_rules>
- Language: French if project country is French-speaking (OHADA zone), otherwise English.
- Register: Formal legal register (e.g., "Il est convenu ce qui suit :", "ci-après dénommée…").
- Numbering: Clearly number each article (e.g., "Article 1 — OBJET").
- Placeholders: Use "[À COMPLÉTER : description]" for any unknown values (capital, dates, names). Never fabricate factual data.
- Signature block: Include "Fait à [Ville], le [Date]" and signature lines at the end.
- Legal context: Align with OHADA Uniform Acts if country is in OHADA zone.
</legal_style_rules>

<critical_requirements>
- Disclaimer: Add a short italicized disclaimer at the top of page 1 stating: "Ce document est un projet de rédaction préliminaire à faire relire par un avocat."
- Completeness: Output must be complete, covering all requested articles/sections.
</critical_requirements>
`;

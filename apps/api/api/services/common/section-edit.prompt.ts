/**
 * Prompt GÉNÉRIQUE d'édition assistée par IA d'une section existante, partagé
 * par les 3 documents (business plan, pitch deck, charte graphique). Reçoit le
 * HTML actuel + une instruction + le contexte projet, et renvoie le HTML complet
 * modifié — dans le même format imprimable que la génération, et compatible avec
 * l'éditeur WYSIWYG (voir <editor_compatibility>).
 */

export interface SectionEditPromptInput {
  instruction: string;
  sectionName: string;
  currentHtml: string;
  projectContext: string;
  brandColorsJson: string;
  typographyJson: string;
  /** Contraintes de format de page propres au type de document. */
  formatRules: string;
}

/** Règles de format de page par type (multi-page, non tronquées). */
export const EDIT_FORMAT_RULES = {
  businessPlan: `- Outermost container: w-[210mm] min-h-[297mm] relative (A4 width; the page GROWS with content and paginates cleanly across multiple A4 pages). Do NOT use a fixed h-[...] nor overflow-hidden, and NEVER truncate content to fit one page.
- Keep each block whole (cards, tables, lists, sub-sections each fit within a single A4 page) so no block is split across a page break.
- Safe padding: p-[12mm].`,
  pitchDeck: `- Outermost container: w-[297mm] h-[167mm] overflow-hidden relative (16:9 slide = ONE page). The content MUST fit entirely within this single slide (no overflow, no scroll); if the edit makes it too long, shorten/summarize or use smaller type.
- Padding: p-[14mm].`,
  branding: `- Outermost container: w-[297mm] h-[167mm] overflow-hidden relative (16:9 slide = ONE page). The content MUST fit entirely within this single slide (no overflow, no scroll); if the edit makes it too long, shorten/summarize or use smaller type.
- Padding: p-[14mm].`,
} as const;

/** Contraintes garantissant que la sortie reste éditable dans l'éditeur WYSIWYG. */
export const EDITOR_COMPATIBILITY_RULES = `<editor_compatibility>
The output is edited afterwards in a visual (Figma-like) editor. To keep every element selectable and editable:
- Put user-visible text in leaf elements (h1..h6, p, span, li, td, ...), not split awkwardly across nested wrappers.
- Prefer semantic block structure (sections, headings, lists, cards) with clear boundaries.
- Charts: use a <canvas> with a UNIQUE id, followed immediately by ONE inline <script> that calls new Chart(document.getElementById('THAT_ID'), {...}). One chart per canvas. Set options.animation = false. Do NOT wrap the config in a variable, do NOT add a Chart.js library <script src> tag (it is injected at render time).
- No inline event handlers (onclick, ...), no external scripts, no <style> blocks.
</editor_compatibility>`;

export function buildSectionEditPrompt(input: SectionEditPromptInput): string {
  return `<role>Senior document editor for an investor-grade deliverable</role>
<objective>Apply the user's edit instruction to the "${input.sectionName}" section, then return the FULL updated section as raw HTML.</objective>

<user_instruction>
${input.instruction}
</user_instruction>

<current_section_html>
${input.currentHtml}
</current_section_html>

<project_context>
Use this project knowledge to keep the edit factually consistent with the rest of the project. Do NOT invent facts that contradict it.
${input.projectContext}
</project_context>

<brand_system>
- Brand colors (use ONLY these via bg-[#hex] / text-[#hex] / border-[#hex]): ${input.brandColorsJson}
- Brand typography: ${input.typographyJson}
</brand_system>

<editing_rules>
- Apply ONLY what the instruction asks. Preserve every other part of the section (layout, wording, data) unless the instruction clearly implies otherwise.
- Keep using brand colors and the brand fonts. Ensure WCAG AA contrast.
</editing_rules>

<page_format>
${input.formatRules}
</page_format>

${EDITOR_COMPATIBILITY_RULES}

<technical_rules>
- Output ONLY the raw HTML + Tailwind CSS for the whole section, in a single minified line. No newlines.
- No explanations, no comments, no markdown code fences (e.g. \`\`\`html) and do NOT prefix the output with "html" or "markdown".
- PrimeIcons (pi pi-icon-name) are preloaded and may be used sparingly for bullets only.
- Keep any images already present; do not add new external images except a provided logo.
</technical_rules>

Return the full updated section HTML now:`;
}

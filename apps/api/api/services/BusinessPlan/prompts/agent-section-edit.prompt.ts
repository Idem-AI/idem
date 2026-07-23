/**
 * Prompt d'ÉDITION assistée par IA d'une section existante (business plan).
 *
 * Contrairement aux prompts de génération (qui créent une section depuis zéro),
 * celui-ci reçoit le HTML ACTUEL de la section + une instruction utilisateur en
 * langage naturel + le contexte projet (via le Context Engine), et renvoie le
 * HTML COMPLET modifié — dans le même format imprimable que la génération.
 */

export interface SectionEditPromptInput {
  /** Instruction en langage naturel écrite par l'utilisateur. */
  instruction: string;
  /** Nom de la section ciblée (ex: "Financial Plan"). */
  sectionName: string;
  /** HTML+Tailwind actuel de la section (une ligne). */
  currentHtml: string;
  /** Contexte projet compact (carte des sections + résumés). */
  projectContext: string;
  /** Couleurs de marque disponibles (hex), pour rester cohérent. */
  brandColorsJson: string;
  /** Typographie de marque (polices), pour rester cohérent. */
  typographyJson: string;
}

/**
 * Construit le prompt d'édition. Réutilise EXACTEMENT les mêmes contraintes
 * techniques que la génération (HTML+Tailwind une ligne, couleurs de marque,
 * Chart.js animation:false, pas de fences markdown) pour que le résultat reste
 * rendu à l'identique par le PdfService (Puppeteer).
 */
export function buildSectionEditPrompt(input: SectionEditPromptInput): string {
  return `<role>Senior document editor for an investor-grade business plan</role>
<objective>Apply the user's edit instruction to the "${input.sectionName}" section, then return the FULL updated section as raw HTML.</objective>

<user_instruction>
${input.instruction}
</user_instruction>

<current_section_html>
${input.currentHtml}
</current_section_html>

<project_context>
Use this project knowledge to keep the edit factually consistent with the rest of the project (branding, market, financials, etc.). Do NOT invent facts that contradict it.
${input.projectContext}
</project_context>

<brand_system>
- Brand colors (use ONLY these via bg-[#hex] / text-[#hex] / border-[#hex]): ${input.brandColorsJson}
- Brand typography: ${input.typographyJson}
</brand_system>

<editing_rules>
- Apply ONLY what the instruction asks. Preserve every other part of the section (layout, wording, data) unchanged unless the instruction clearly implies otherwise.
- Keep the exact same page container and size as the current HTML (outermost w-[210mm] h-[297mm] overflow-hidden relative, safe padding p-[12mm]). No content overflow, no scroll.
- Keep using brand colors and the brand fonts. Ensure WCAG AA contrast.
- Charts stay Chart.js via a <canvas> + inline <script>new Chart(...)</script>. Set animation:false. Do NOT add a Chart.js library <script src> tag (it is injected at render time).
- PrimeIcons (pi pi-icon-name) are preloaded and may be used sparingly for bullets only.
</editing_rules>

<technical_rules>
- Output ONLY the raw HTML + Tailwind CSS for the whole section, in a single minified line. No newlines.
- No explanations, no comments, no markdown code fences (e.g. \`\`\`html) and do NOT prefix with "html".
- No custom <style>, no external images except images already present in the current HTML.
</technical_rules>

Return the full updated section HTML now:`;
}

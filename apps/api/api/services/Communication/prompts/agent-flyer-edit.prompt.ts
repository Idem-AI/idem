/**
 * Prompt d'édition assistée par IA d'un visuel de communication DÉJÀ composé.
 *
 * Pendant que `agent-flyer-generation.prompt.ts` compose à partir d'une graine de
 * design, celui-ci RETOUCHE : il reçoit le HTML rendu aujourd'hui, une consigne
 * de l'utilisateur, et doit rendre le même visuel amendé — pas une nouvelle
 * proposition. Un flyer est un objet fini que l'utilisateur a validé
 * visuellement ; la tentation du modèle est de tout recomposer « en mieux », ce
 * qui lui ferait perdre le travail déjà accepté.
 *
 * Les invariants du module (aucun bouton/CTA dessiné, logo lisible, palette et
 * polices de la marque, dimensions exactes du format) sont rappelés ici : ils ne
 * sont pas négociables et le rendu PNG les vérifie ensuite par la mesure.
 */

import { FlyerFormat } from '../../../models/communication.model';

export interface FlyerEditPromptInput {
  instruction: string;
  /** HTML actuel du visuel (une ligne, Tailwind). */
  currentHtml: string;
  format: FlyerFormat;
  /** Dimensions exactes du canevas, en pixels. */
  width: number;
  height: number;
  /** Largeur minimale du logo sur ce format, en pixels. */
  minLogoWidth: number;
  brandName: string;
  /** Palette + typographie de la marque, sérialisées. */
  brandJson: string;
  /** Déclinaisons de logo disponibles (URLs prêtes à l'emploi), sérialisées. */
  logoUrlsJson: string;
  /** Intention de communication du visuel (awareness, promotion…). */
  intent?: string;
  /** Ce que montre l'image de fond, quand elle est connue. */
  imageContext?: string;
}

export function buildFlyerEditPrompt(input: FlyerEditPromptInput): string {
  return `<role>Senior art director retouching an already-approved brand visual</role>
<objective>Apply the user's edit instruction to the visual below, then return the FULL updated visual as raw HTML.</objective>

<user_instruction>
${input.instruction}
</user_instruction>

<current_visual_html>
${input.currentHtml}
</current_visual_html>

<brand_charter>
- Brand: ${input.brandName}
- Palette and typography (use ONLY these): ${input.brandJson}
- Logo declensions, ready-to-use URLs: ${input.logoUrlsJson}
${input.intent ? `- Communication intent of this visual: ${input.intent}` : ''}
${input.imageContext ? `- Background image: ${input.imageContext}` : ''}
</brand_charter>

<editing_rules>
- This is a RETOUCH, not a new composition. Apply ONLY what the instruction asks and keep everything else byte-for-byte: layout, positions, colors, wording, image, logo placement.
- If the instruction is vague, choose the smallest change that satisfies it.
- Never "improve" what was not mentioned, never restart from a blank canvas, never swap the background image URL for another one.
- Text you rewrite stays within the space it occupied: a headline that doubles in length breaks the composition.
</editing_rules>

<canvas>
- Outer container keeps EXACTLY w-[${input.width}px] h-[${input.height}px] overflow-hidden relative (format: ${input.format}).
- Inner elements stay absolutely positioned. Nothing may be clipped by the canvas edges.
</canvas>

<invariants>
These hold whatever the instruction says — they are the module's rules, not preferences:
- NO BUTTON, NO CTA, NO BADGE, NO PILL, never a <button> tag. The call to action lives in the post caption, not on the image. If the user asks for a button, express the idea as type instead.
- Exactly ONE logo, taken from the declension URLs above (never invented, never inline SVG). Minimum width ${input.minLogoWidth}px, full opacity, h-auto, container never narrower than the logo. Dark-ink declension on a light zone, light-ink declension on a dark zone.
- Every hex value comes from the brand palette; every text element carries font-primary (display) or font-secondary (running text).
- WCAG AA contrast for every text over what actually sits behind it.
</invariants>

<editor_compatibility>
The result is edited afterwards in a visual (Figma-like) editor, so every element must stay selectable:
- User-visible text sits in leaf elements (h1..h6, p, span, li), not split across nested wrappers.
- Keep the existing element structure wherever the instruction does not require changing it — the editor addresses nodes by position.
- No inline event handlers, no external scripts, no <style> blocks. The Google Fonts <link> already present stays.
</editor_compatibility>

<technical_rules>
- Output ONLY the raw HTML + Tailwind for the whole visual, as a SINGLE minified line. No newlines.
- No explanations, no comments, no markdown code fences, no "html" prefix, no JSON wrapper.
- Inline style allowed for: transform, mix-blend-mode, letter-spacing, gradients, text-shadow, clip-path, filter.
- PrimeIcons (pi pi-*) may be used as graphic ornaments only — never paired with a couple of words as a fake button.
</technical_rules>

Return the full updated visual HTML now:`;
}

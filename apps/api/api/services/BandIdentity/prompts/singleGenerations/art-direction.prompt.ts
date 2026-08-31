/**
 * Agent « direction artistique ».
 *
 * Il ne dessine rien : il DÉCIDE. Une fois pour la marque, il choisit un style
 * dans le catalogue et l'adapte au projet, puis toutes les générations
 * (charte, visuels, business plan, deck, mockups, site) s'y conforment.
 *
 * Le choix est contraint au catalogue, délibérément. Laissé libre, un modèle
 * répond « moderne, épuré, professionnel » — trois mots qui ne contraignent
 * rien et produisent la moyenne du corpus. En le forçant à retenir un style
 * nommé, avec sa grammaire, on obtient un parti pris exécutable et vérifiable.
 */

import { buildStyleCatalogBrief } from '../../../design/artDirection.catalog';

export interface ArtDirectionPromptInput {
  projectName: string;
  projectDescription: string;
  industry: string;
  targetAudience: string;
  /** Palette de la charte, sérialisée. */
  colorsJson: string;
  /** Typographie de la charte, sérialisée. */
  typographyJson: string;
  /** Concept du logo retenu, s'il existe. */
  logoConcept?: string;
  /** Type de logo (icon / name / initial). */
  logoType?: string;
  /**
   * Styles à écarter. Sert à la régénération : sans cela, le modèle propose
   * deux fois le même style et l'utilisateur qui demande « autre chose »
   * reçoit la même réponse.
   */
  excludeStyleIds?: string[];
}

export function buildArtDirectionPrompt(input: ArtDirectionPromptInput): string {
  const excluded = (input.excludeStyleIds || []).filter(Boolean);

  return `<role>Art director in a branding studio. You are settling the visual stance of a brand for the next three years.</role>
<objective>Pick ONE style from the catalogue below, then adapt it to this brand into an executable art direction. Output: strict JSON.</objective>

<brand_brief>
Brand: ${input.projectName}
Description: ${input.projectDescription}
Industry: ${input.industry}
Audience: ${input.targetAudience}
Approved palette (fixed, do not change): ${input.colorsJson}
Approved typography (fixed, do not change): ${input.typographyJson}
${input.logoConcept ? `Logo concept: ${input.logoConcept}` : ''}
${input.logoType ? `Logo type: ${input.logoType}` : ''}
</brand_brief>

<style_catalog>
${buildStyleCatalogBrief()}
</style_catalog>
${
  excluded.length
    ? `\n<excluded_styles>\nThese styles have already been proposed and are ruled out: ${excluded.join(', ')}. Pick a different one.\n</excluded_styles>\n`
    : ''
}
<how_to_choose>
1. Name, to yourself, what this brand actually SELLS — not its industry, its promise (trust, speed, warmth, rigour, status, accessibility).
2. Eliminate the styles that contradict that promise. An audit firm cannot be Y2K; a festival brand cannot be Swiss Design.
3. Among those left, keep the one that makes the brand RECOGNISABLE against its direct competitors — not the one that makes it look like the average of its sector.
4. Check compatibility with the already-approved palette and typography: a style that mandates a dark ground paired with an entirely light palette is a bad pick, so change style (the palette itself never changes).
5. Never keep a style "because it is safe". Minimalism chosen by default, with no reason specific to this brand, is the worst pick of all: it is the average wearing the costume of a stance.
</how_to_choose>

<what_makes_it_executable>
The direction is only useful if it decides on behalf of whoever composes next. Every field must be an INSTRUCTION, not an adjective.
- "clean and modern" decides nothing.
- "one occupied zone per page, aligned to a 12-column grid, 55% of the frame left empty, a single 1px rule as the only ornament" decides everything.
Each field must be executable by someone who has not read the rest of the document.
</what_makes_it_executable>

<constraints>
- styleId MUST be an identifier from the catalogue, character for character.
- The supplied palette and typography are fixed: the direction states how to USE them, never what to change.
- imagePromptModifier is in ENGLISH (it is concatenated onto image-model prompts) and describes the RENDER only — light, material, grain, grading, framing — never the subject. 25 to 60 words.
- Every other field is written in FRENCH (they are shown to the user in the brand book).
- dos and donts: 4 to 6 entries each, imperative, specific to THIS brand (not a generic copy of the style sheet).
- keywords: 5 to 8 moodboard words, concrete (a material, a light, an object), never brand adjectives.
</constraints>

<output_format>
Strict JSON, no surrounding text, no code fences.
{
  "styleId": "exact identifier from the catalogue",
  "styleName": "style name",
  "tagline": "the direction as one formula of 8 words max, specific to this brand",
  "rationale": "2 to 3 sentences: why this style for THIS brand, and what it rules out",
  "keywords": ["", "", "", "", ""],
  "layout": {
    "grid": "precise grid system (column count, gutters, margin behaviour)",
    "density": "airy | balanced | dense, plus one sentence on how it applies",
    "whitespace": "how much of the frame stays empty and where it sits",
    "signatureMove": "THE compositional gesture that must be visible on every deliverable"
  },
  "color": {
    "distribution": "numeric split between the charter colours",
    "application": "where each colour goes (flats, text, rules, images)",
    "contrast": "the kind of contrast sought"
  },
  "typography": {
    "scaleContrast": "scale ratio between levels and number of levels",
    "caseAndTracking": "dominant case and tracking, values included",
    "treatment": "specific typographic treatment, or 'none'"
  },
  "imagery": {
    "medium": "photography | illustration | render-3d | collage | abstract | mixed",
    "subjects": "what this brand's images show",
    "treatment": "treatment applied to every image (duotone, grain, crop, overlay...)",
    "lighting": "direction and quality of light, constant across the brand",
    "framing": "dominant framing and point of view"
  },
  "graphicDevices": ["3 to 5 recurring graphic devices, described precisely enough to be redrawn"],
  "dos": ["", "", "", ""],
  "donts": ["", "", "", ""],
  "imagePromptModifier": "english render-only modifier, 25-60 words"
}
</output_format>
`;
}

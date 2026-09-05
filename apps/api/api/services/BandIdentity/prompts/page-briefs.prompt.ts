/**
 * Briefs de CONTENU des pages de charte — mode gabarit.
 *
 * Même raison que pour les slides : les prompts historiques de ces pages
 * décrivent une mise en page (`<page_format>`, `<technical_rules>`,
 * `<canvas>`, `<script>`, `<editor_compatibility>`) que le rendu produit
 * désormais lui-même. Les laisser reviendrait à décrire au modèle un travail
 * qu'il ne fera pas — et sur un petit modèle, une consigne inerte n'est pas
 * neutre : elle prend la place de celles qui comptent.
 *
 * Particularité de ces trois pages : leur SPÉCIMEN est injecté par le service
 * (`prependBlocks`) à partir des données réelles du projet — valeurs
 * hexadécimales exactes, vraies familles typographiques, vraies URLs de logo.
 * Le modèle n'écrit donc QUE les règles d'usage autour, ce qui est exactement
 * ce qu'il sait faire, et il ne peut plus se tromper sur ce qu'il ne devrait
 * jamais recopier.
 *
 * Les prompts d'origine restent en place pour les pages laissées en génération
 * libre, et comme repli si le mode gabarit est coupé.
 */

const CHARTER_FRAME = `You are writing ONE page of a brand guidelines document.

The specimen itself — the colour swatches, the type specimens, the logo
declensions — is ALREADY placed on the page, with the project's exact values.
You do not describe it, you do not repeat its values, and you never write a hex
code or a font name that you were not given.

You write what surrounds it: the RULES a designer must follow, stated so that a
disagreement can be settled by reading them.

- Three to four blocks, no more. A guideline page that must be studied is not read.
- Each rule is testable: "the accent never carries more than 10% of a page",
  not "use the accent sparingly".
- State the forbidden case explicitly. A rule without its counter-example is a
  suggestion.`;

const brief = (objective: string, mustCover: string): string =>
  `${CHARTER_FRAME}\n\n<objective>${objective}</objective>\n\n<must_cover>\n${mustCover}\n</must_cover>`;

export const CHARTER_PAGE_BRIEFS: Record<string, string> = {
  'Color Palette': brief(
    'Say how the palette is used, not what it contains — the swatches say that.',
    `- The distribution rule: which colour holds the surfaces, which one the
  emphasis, and in what proportion (a 60/30/10 kind of rule, stated in figures).
- How tints are obtained: from opacity, never from a hue shift. Say why.
- The two combinations that are forbidden, and what breaks in each.
- Where the accent is allowed to appear on a page, and where it is not.
Blocks: one "prose" block, one "cards" block of 2-3 rules, optionally one
"assumption" if the palette rests on a stated constraint (a support, a print
process, an accessibility floor).`
  ),

  Typography: brief(
    'Say how the two families divide the work.',
    `- Which family carries which level, and where the boundary is.
- The scale rule: the minimum contrast between two consecutive levels, in
  figures, and the minimum number of levels on a page.
- What is forbidden: a third family, an unlisted weight, an effect that does not
  serve the hierarchy.
- The minimum running-text size, and on which supports it changes.
Blocks: one "prose" block, one "table" mapping levels to family, weight and
usage, optionally one "cards" block for the bans.`
  ),

  'Logo Bonnes Pratiques': brief(
    'Say how the logo is placed, and what destroys it.',
    `- The clear space around it, expressed in a unit derived from the logo itself
  (a proportion of its height), never in absolute millimetres.
- The minimum size, per support: print, screen, embroidery or engraving if relevant.
- Which declension goes on which background, and the rule for deciding — a
  contrast rule, not a taste.
- The four or five forbidden treatments: stretching, recolouring, adding an
  effect, placing it on a busy area of an image, rebuilding it in another font.
Blocks: one "prose" block for the clear space and minimum sizes, one "cards"
block for the forbidden treatments, optionally one "table" of minimum sizes.`
  ),
};

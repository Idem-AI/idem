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

You write what surrounds it: the RULES a designer must follow.

⚠️ THIS PAGE IS ONE PAGE. It does not scroll and it does not continue: anything
that does not fit is CUT. Two or three blocks, and they must be SHORT.

- A rule is one sentence. If it needs a paragraph, it is two rules — or it is
  not a rule, it is an explanation, and an explanation does not belong on a
  guidelines page.
- Each rule is testable: "the accent never carries more than 10% of a page",
  not "use the accent sparingly".
- State the forbidden case in the same breath as the rule. A rule without its
  counter-example is a suggestion.
- Never justify a rule. A designer who opens this page wants to know what to do,
  not why the studio decided it.

Prefer a "cards" block of short rules or a compact "table" over prose. A wall of
running text on a guidelines page is the defect this document exists to prevent.`;

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
Blocks: one "cards" block of 2-3 short rules, optionally one "prose" block of a
SINGLE paragraph for the distribution rule.`
  ),

  Typography: brief(
    'Say how the two families divide the work.',
    `- Which family carries which level, and where the boundary is.
- The scale rule: the minimum contrast between two consecutive levels, in
  figures, and the minimum number of levels on a page.
- What is forbidden: a third family, an unlisted weight, an effect that does not
  serve the hierarchy.
- The minimum running-text size, and on which supports it changes.
Blocks: one "table" mapping levels to family, weight and usage, plus one
"cards" block of 2-3 bans. No running prose.`
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
Blocks: one "table" of minimum sizes per support, one "cards" block of the
forbidden treatments. No running prose.`
  ),
};

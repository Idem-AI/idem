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
running text on a guidelines page is the defect this document exists to prevent.

WHAT NEVER GOES ON THESE PAGES — every item below was observed on a delivered
brand book, and each one makes the document look manufactured rather than
designed:

- Invented document metadata: reference codes ("RÉF. ID-01", "SM-ID-02B"),
  version numbers, "STATUT: VALIDÉ", "DIFFUSION RESTREINTE", "SYSTÈME FERMÉ",
  edition dates, GPS coordinates, page numbers. You have not been given any of
  these, so every one of them would be fabricated — and a fabricated reference
  number on a real document is worse than no reference at all.
- Numbers nobody computed: CMYK breakdowns, RGB triplets, contrast ratios,
  luminance percentages, "ÉCHELLE 1:1". State a rule, never a measurement you
  were not handed.
- Ornament posing as precision: crop marks, corner crosses, "+" registration
  symbols, technical frames around nothing.
- The company's business data — share capital, shareholding, revenue targets.
  A brand book governs the mark, not the balance sheet.
- Inflated naming: a colour is "Bleu" or "Bleu métallique", never "BLEU
  MOBILITÉ SOUVERAIN"; a logo is "le logo", never "l'identifiant maître".

Write the way a designer briefs another designer: plainly, and only about the
mark.`;

const brief = (objective: string, mustCover: string): string =>
  `${CHARTER_FRAME}\n\n<objective>${objective}</objective>\n\n<must_cover>\n${mustCover}\n</must_cover>`;

export const CHARTER_PAGE_BRIEFS: Record<string, string> = {
  'Logo Principal': brief(
    'Say what the mark is for and where it goes. The logo itself is already placed.',
    `- What the mark stands for, in ONE sentence. Not its history, not a metaphor
  about speed or movement — what a reader must understand to use it correctly.
- The primary background it is designed for, and why that one.
- The single rule that protects it: the clear space, expressed as a proportion
  of its own height.
Two blocks maximum: one "cards" block of 2-3 rules, optionally one "prose" block
of a SINGLE short paragraph. Nothing else fits on this page.`
  ),

  'Logo Variation Fond Clair': brief(
    'Say when this declension is the right one.',
    `- Which supports it belongs on, named concretely (printed matter, signage,
  correspondence) — not categories like "premium institutional supports".
- The background range it holds up on, as a rule a designer can apply.
- What replaces it when that range is left.
One "cards" block of 2-3 rules. No prose paragraph.`
  ),

  'Logo Variation Fond Sombre': brief(
    'Say when this declension is the right one.',
    `- Which supports and contexts it belongs on, named concretely.
- The threshold that triggers it rather than the light version — a contrast
  rule, not a taste.
- The one treatment that destroys it on a dark ground.
One "cards" block of 2-3 rules. No prose paragraph.`
  ),

  'Logo Variation Monochrome': brief(
    'Say when colour must be given up.',
    `- The production contexts that require it: single-colour printing,
  engraving, embroidery, fax-grade reproduction.
- The rule for choosing the ink against the support.
- What is forbidden: reintroducing a second colour, adding an outline, using it
  where the colour version would work.
One "cards" block of 2-3 rules. No prose paragraph.`
  ),

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

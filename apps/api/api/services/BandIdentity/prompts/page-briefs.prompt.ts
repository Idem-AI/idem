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
 * Particularité de ces pages : leur SPÉCIMEN est injecté par le service
 * (`prependBlocks`) à partir des données réelles du projet — valeurs
 * hexadécimales exactes, vraies familles typographiques, vraies URLs de logo.
 *
 * ── LA CHARTE EST COUPÉE EN DEUX ───────────────────────────────────────────
 *
 * Les pages de charte portaient chacune leur spécimen ET ses règles d'usage.
 * Résultat observé sur les livrables : une page de nuancier où la moitié de la
 * surface est du texte, une déclinaison de logo commentée en trois paragraphes,
 * une page de typographie qui explique au lieu de montrer. Un lecteur qui
 * feuillette une charte ne lit pas : il REGARDE. Le texte posé à côté du
 * spécimen ne se lit donc jamais, et il coûte pourtant la place qui faisait
 * respirer la démonstration.
 *
 * Les deux familles sont désormais séparées :
 *
 *   · les pages SPÉCIMEN (logo, déclinaisons, palette, typographie) montrent,
 *     et se taisent : un titre, une accroche de huit mots, UN bloc de légendes
 *     de six mots. Cf. `SPECIMEN_FRAME`.
 *   · les deux pages d'USAGE, placées APRÈS les mises en situation, portent
 *     toutes les règles — celles du logo, puis celles de la couleur et de la
 *     typographie. C'est là qu'un designer revient, et il les trouve groupées
 *     au lieu d'éparpillées. Cf. `RULES_FRAME`.
 *
 * Les prompts d'origine restent en place pour les pages laissées en génération
 * libre, et comme repli si le mode gabarit est coupé.
 */

/**
 * Ce qu'aucune page de charte ne doit porter, spécimen ou usage.
 *
 * Chaque entrée a été observée sur une charte livrée, et chacune fait basculer
 * le document du côté « fabriqué » plutôt que « dessiné ».
 */
const NEVER_ON_A_CHARTER_PAGE = `WHAT NEVER GOES ON THIS PAGE — every item below was observed on a delivered
brand book, and each one makes the document look manufactured rather than
designed:

- Invented document metadata: reference codes ("RÉF. ID-01", "SM-ID-02B"),
  version numbers, "STATUT: VALIDÉ", "DIFFUSION RESTREINTE", "SYSTÈME FERMÉ",
  edition dates, GPS coordinates, page numbers. You have not been given any of
  these, so every one of them would be fabricated — and a fabricated reference
  number on a real document is worse than no reference at all.
- Precision nobody computed: CMYK breakdowns, RGB triplets, contrast ratios,
  luminance percentages, "ÉCHELLE 1:1" — and its ornamental form, crop marks,
  corner crosses, technical frames around nothing. State a rule, never a
  measurement you were not handed.
- The company's business data — share capital, shareholding, revenue targets.
  A brand book governs the mark, not the balance sheet.
- Inflated naming: a colour is "Bleu" or "Bleu métallique", never "BLEU
  MOBILITÉ SOUVERAIN"; a logo is "le logo", never "l'identifiant maître".

Write the way a designer briefs another designer: plainly, and only about the
mark.`;

/**
 * Cadre des pages SPÉCIMEN — celles qui MONTRENT.
 *
 * Tout y pousse vers le silence : le spécimen occupe la page, le texte n'est
 * qu'une étiquette. La consigne de volume qui l'accompagne est `'1'` (cf.
 * `CHARTER_PAGE_VOLUMES`), et le test final donne au modèle un critère qu'il
 * peut appliquer seul.
 */
const SPECIMEN_FRAME = `You are writing ONE page of a brand guidelines document.

THIS PAGE IS A DEMONSTRATION, NOT A TEXT. The specimen — the swatches, the type
specimen, the logo declension — is ALREADY placed on the page, at full size,
with the project's exact values. It occupies the page and it speaks for itself.
What you write is a CAPTION, never an explanation.

You write exactly this, and nothing more:

- "title": two or three words.
- "lede": ONE clause, 8 WORDS MAXIMUM. It names; it does not explain.
- ONE single block. Not two. Each of its entries carries SIX WORDS OR LESS.

FORBIDDEN ON THIS PAGE, without exception:

- A "prose" block, a paragraph, or any full sentence inside a card: write
  "Impression, signalétique, courrier", never "Cette déclinaison s'utilise sur
  les supports imprimés".
- A justification, a history, a metaphor, the reason a choice was made.
- A hex code, a font name, any value the specimen already shows — and any usage
  RULE: the rules have their own pages at the end of the document, and one
  stated here is one the designer reads twice and applies once.

THE TEST: read the page with your text removed. If nothing essential is lost,
your text was right. A charter page is looked at, not read — every word you add
takes space away from the only thing on the page anyone came to see.

${NEVER_ON_A_CHARTER_PAGE}`;

/**
 * Cadre des deux pages d'USAGE, en fin de document.
 *
 * C'est l'ancien `CHARTER_FRAME` : la seule famille de pages où le texte EST le
 * livrable. Il reste bref — la page est rognée — mais il porte des règles, pas
 * des légendes.
 */
const RULES_FRAME = `You are writing ONE of the two USAGE pages that close a brand guidelines
document. The specimens have been shown earlier, page after page; this page is
where a designer comes back to know WHAT TO DO with them.

You write RULES, and only rules.

⚠️ THIS PAGE IS ONE PAGE. It does not scroll and it does not continue: anything
that does not fit is CUT. Two or three blocks, and they must be SHORT.

- A rule is one sentence. If it needs a paragraph, it is two rules — or it is
  not a rule, it is an explanation, and an explanation does not belong here.
- Each rule is testable: "the accent never carries more than 10% of a page",
  not "use the accent sparingly".
- State the forbidden case in the same breath as the rule. A rule without its
  counter-example is a suggestion.
- Never justify a rule. A designer who opens this page wants to know what to do,
  not why the studio decided it.

Prefer a "table" or a "cards" block of short rules over prose. A wall of running
text on a guidelines page is the defect this document exists to prevent.

${NEVER_ON_A_CHARTER_PAGE}`;

const brief = (frame: string, objective: string, mustCover: string): string =>
  `${frame}\n\n<objective>${objective}</objective>\n\n<must_cover>\n${mustCover}\n</must_cover>`;

const specimen = (objective: string, mustCover: string): string =>
  brief(SPECIMEN_FRAME, objective, mustCover);

const rules = (objective: string, mustCover: string): string =>
  brief(RULES_FRAME, objective, mustCover);

export const CHARTER_PAGE_BRIEFS: Record<string, string> = {
  // ── PAGES SPÉCIMEN : elles montrent ──────────────────────────────────────

  'Logo Principal': specimen(
    'Name the mark. The logo is already placed, large, on the page.',
    `- "lede": what the mark is, 8 words maximum, no metaphor about speed,
  movement or horizon.
- ONE "cards" block, 2 items MAXIMUM. Titles of one word ("Zone", "Format"),
  bodies of 6 words maximum: the clear space as a proportion of the logo's own
  height, and the reference file format.
Nothing else. No paragraph, no rule, no explanation of the design.`
  ),

  'Logo Variation Fond Clair': specimen(
    'Label this declension. The logo is already placed on its ground.',
    `- "lede": the ground it is made for, 6 words maximum.
- ONE "cards" block, 2 items. Bodies of 6 words maximum, written as LISTS, not
  as sentences: the supports it goes on, named concretely ("Impression,
  signalétique, courrier"), and the background range it holds on.
No verb, no paragraph, no rule.`
  ),

  'Logo Variation Fond Sombre': specimen(
    'Label this declension. The logo is already placed on its ground.',
    `- "lede": the ground it is made for, 6 words maximum.
- ONE "cards" block, 2 items. Bodies of 6 words maximum, written as LISTS, not
  as sentences: the supports and contexts it belongs on, and the treatment that
  destroys it on a dark ground.
No verb, no paragraph, no rule.`
  ),

  'Logo Variation Monochrome': specimen(
    'Label this declension. The logo is already placed on its ground.',
    `- "lede": when colour is given up, 6 words maximum.
- ONE "cards" block, 2 items. Bodies of 6 words maximum, written as LISTS, not
  as sentences: the production contexts that require it (single-colour printing,
  engraving, embroidery), and what is forbidden on it.
No verb, no paragraph, no rule.`
  ),

  'Color Palette': specimen(
    'Show the distribution. The swatches and their exact values are already placed.',
    `- "lede": the distribution in figures, 8 words maximum.
- ONE "metrics" block of EXACTLY 3 items, and nothing else: the share of a page
  surface held by each role — "60 %" / "Primaire", "30 %" / "Secondaire",
  "10 %" / "Accent". Leave "note" out.
Never repeat a hex code: the swatches carry them. No cards, no prose, no rule —
the colour rules live on the usage page at the end of the document.`
  ),

  Typography: specimen(
    'Show the pairing. The two families are already set in their own faces.',
    `- "lede": which family carries which level, 8 words maximum
  ("Titres et texte courant, deux familles, quatre niveaux").
- ONE "cards" block of EXACTLY 2 items, bodies of 6 words maximum: the number of
  levels a page may carry, and the one thing banned ("Aucune troisième
  famille").
Never write a font name — the specimen sets them in their own faces. No table of
sizes, no prose, no pairing rationale.`
  ),

  // ── PAGES D'USAGE : elles règlent ────────────────────────────────────────

  'Logo Bonnes Pratiques': rules(
    'Say how every declension is placed, and what destroys the mark.',
    `- Which declension goes on which background, and the rule for deciding — a
  contrast rule, not a taste.
- The clear space, expressed in a unit derived from the logo itself (a
  proportion of its height), never in absolute millimetres.
- The minimum size, per support: screen, print, embroidery or engraving.
- The four or five forbidden treatments: stretching, recolouring, adding an
  effect or an outline, placing it on a busy area of an image, rebuilding it in
  another font.
Blocks: one "table" (declension → background → support, or minimum size per
support), then one "cards" block of the forbidden treatments. No running prose.`
  ),

  'Usage Couleurs & Typographie': rules(
    'Say how the palette and the two families are used across every support.',
    `COULEUR
- The distribution rule, stated in figures (a 60/30/10 kind of rule): which
  colour holds the surfaces, which one the emphasis.
- How tints are obtained: from opacity, never from a hue shift.
- The two combinations that are forbidden, and what breaks in each.

TYPOGRAPHIE
- Which family carries which level, and where the boundary is.
- The minimum contrast between two consecutive levels, and the minimum running
  text size, with the support on which it changes.
- What is forbidden: a third family, an unlisted weight, an effect that does not
  serve the hierarchy.

Blocks: one "table" mapping each level to its family, weight and usage, then one
"cards" block of 3 to 4 bans covering BOTH colour and type. At most one "prose"
block of a SINGLE short paragraph for the distribution rule — and only if the
table and the cards have not already said it.`
  ),
};

/**
 * Volume, PAR PAGE, en blocs.
 *
 * Le chiffre unique d'avant (« 2 to 3 » partout) est ce qui remplissait les
 * pages spécimen : un modèle à qui l'on demande trois blocs en produit trois,
 * même quand la page n'a rien à dire de plus que ce qu'elle montre. Les pages
 * qui MONTRENT en reçoivent donc un seul ; les deux pages qui RÈGLENT gardent
 * la marge dont leurs règles ont besoin.
 */
export const CHARTER_PAGE_VOLUMES: Record<string, string> = {
  'Logo Principal': '1',
  'Logo Variation Fond Clair': '1',
  'Logo Variation Fond Sombre': '1',
  'Logo Variation Monochrome': '1',
  'Color Palette': '1',
  Typography: '1',
  'Logo Bonnes Pratiques': '2',
  'Usage Couleurs & Typographie': '2 to 3',
};

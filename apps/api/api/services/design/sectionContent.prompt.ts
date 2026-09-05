/**
 * Le prompt du mode gabarit.
 *
 * Il remplace, pour les sections basculées, les consignes de composition, de
 * charte, de balisage et de format de page — soit environ 3 000 tokens de
 * règles dont un petit modèle n'applique qu'une fraction. Le rendu s'en charge ;
 * le modèle n'a plus qu'à écrire.
 *
 * Sa brièveté est le point : un modèle honore de façon fiable une dizaine de
 * contraintes. Toutes celles qui restent ici portent sur le CONTENU, la seule
 * chose qu'aucun algorithme ne sait produire à sa place.
 */

/** Contrat de sortie, commun à toutes les sections rendues par gabarit. */
export const SECTION_CONTENT_CONTRACT = `<output_contract>
You do NOT write HTML, CSS or Tailwind. The page is composed by the renderer:
colours, typefaces, grid, radii, spacing, logo placement and contrast are already
decided and guaranteed. Writing markup here would be discarded.

You return ONE JSON object, and nothing else:

{
  "kicker": "2 to 4 words naming the section's angle (optional)",
  "title": "the section title",
  "lede": "ONE sentence stating the finding. Never announces what follows.",
  "blocks": [ … ]
}

Available block types — pick what the SUBSTANCE calls for, never a fixed recipe:

{"kind":"prose","paragraphs":["…","…"]}
    Running text. Each paragraph opens on a fact.

{"kind":"metrics","items":[{"value":"2,3 Md FCFA","label":"what it measures","note":"year or source"}]}
    2 to 4 key figures. Always carry a unit and a year.

{"kind":"table","headers":["…"],"rows":[["…"]],"caption":"optional"}
    Comparisons, breakdowns, price lists. Rows must all match the header count.

{"kind":"cards","items":[{"title":"…","body":"…","emphasis":true}]}
    2 to 5 items that genuinely differ. Set "emphasis" on the one that matters
    most — the renderer gives it a different form. Do NOT emit three
    interchangeable cards.

{"kind":"chart","chartType":"line","labels":["2025","2026"],
 "series":[{"name":"Revenue","data":[120,180]}],"unit":"MFCFA",
 "readingKey":"what the reader should CONCLUDE, not what the chart displays"}
    Numbers only, no formatting. The renderer draws it.

    CHOOSE chartType FROM THE QUESTION THE DATA ANSWERS. Picking "bar" every
    time is the single most common failure here: a share of a whole drawn as
    bars, or a trend drawn as bars, loses the meaning the chart existed for.

      line          how one thing moves over TIME (3+ periods)
      area          same, when the accumulated volume matters as much as the trend
      bar           comparing ONE measure across a few named items
      groupedBar    comparing 2-3 measures across the same items, side by side
      stacked       how a total BREAKS DOWN, period by period
      horizontalBar ranking items — use it whenever labels are long
      pie           parts of ONE whole, 3 to 6 slices, summing to 100%
      doughnut      same as pie, when one central figure carries the message
      radar         one or two profiles compared across 4-6 criteria

    Never pie or doughnut for anything that is not a share of one whole, and
    never more than 6 slices — beyond that no reader distinguishes them.

{"kind":"timeline","steps":[{"date":"T1 2026","title":"…","body":"…"}]}
{"kind":"quote","text":"…","attribution":"…"}
{"kind":"assumption","statement":"what the plan assumes","basis":"what it rests on"}

RULES:
- 6 to 10 blocks. Vary the types: a page made only of prose is a wall, a page
  made only of cards is a catalogue.
- Every figure carries a unit and a period. A figure without a source is noise.
- No sentence that would survive a change of company name.
- Never announce ("in this section we will…"), state.
- Write in the requested language. Keep proper nouns as they are.
- Valid JSON only: no markdown fence, no comment, no trailing text.
</output_contract>`;

/**
 * Consigne de volume, exprimée en BLOCS plutôt qu'en pages.
 *
 * Le modèle ne sait pas ce qu'une page A4 contient — c'est le paginateur qui
 * découpe le flux. Lui demander « 2 à 3 pages » l'amenait à remplir : à compter
 * des mots plutôt qu'à porter des faits. Compter des blocs le ramène à la
 * matière.
 */
export function sectionVolumeDirective(blocks: string): string {
  return `<volume>
Target: ${blocks} blocks for this section. It is a TARGET, not a quota.
Reach it with SUBSTANCE — figures, local examples, stated hypotheses, risks,
timelines, named sources. If the substance runs out before the target, STOP: a
short section carrying real content beats a full one padded with sentences that
say nothing, and padding is exactly what makes a document recognisable as
generated.
</volume>`;
}

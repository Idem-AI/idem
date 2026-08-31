/**
 * Génération des systèmes typographiques de la marque.
 *
 * Deux défauts corrigés ici, et ils expliquaient à eux seuls une bonne part de
 * l'impression « généré par une machine » :
 *
 *  1. Le premier jeu était CODÉ EN DUR sur « Exo 2 / Roboto ». Chaque projet
 *     partait donc de la même typographie, et Roboto est précisément l'une des
 *     polices qui signalent une sortie automatique.
 *  2. Les listes de personnalités proposaient les familles les plus employées du
 *     web (Inter, Open Sans, Space Grotesk). Une police est le levier le plus
 *     rapide pour qu'une marque cesse de ressembler à toutes les autres : la
 *     laisser converger vers la moyenne annule le reste du travail.
 *
 * Le catalogue ci-dessous ne contient donc que des familles caractérisées,
 * groupées par registre, et impose un CONTRASTE DE GRAISSE exploitable — c'est
 * lui qui crée la hiérarchie, pas l'ajout d'ornements.
 */

export const TYPOGRAPHY_GENERATION_PROMPT = `<role>Senior brand typographer</role>
<objective>Propose 3 typography systems for this brand: one display family for headings, one text family for running copy. Output: strict JSON.</objective>

<context>
PROJECT DESCRIPTION: {{PROJECT_DESCRIPTION}}
</context>

<pairing_principles>
- CONTRAST of role: the display and the text family must differ clearly (geometric vs humanist, serif vs sans, display vs text). Two neutral sans-serifs is not a pairing, it is an absence of choice.
- COHESION of proportion: similar x-height and width, so the two families sit together on a page.
- WEIGHT RANGE: the display family must offer at least three weights far apart (e.g. 300 / 600 / 800). The hierarchy of every deliverable is built on that contrast; a family with a single weight forces decoration to do the job instead.
- SUPERFAMILY option: families designed together (IBM Plex Sans/Serif, Roboto Slab/Flex, Merriweather Sans/Serif) are a legitimate pairing.
- Two families per set, never more. Never two display families.
- Both must exist on Google Fonts, under their exact family name.
</pairing_principles>

<banned_fonts>
These are the typefaces that make a brand look machine-generated, because every generated site uses them. Never propose them, in either role:
Inter, Roboto, Open Sans, Lato, Montserrat, Poppins, Nunito, Raleway, Ubuntu, Oswald, Space Grotesk, Arial, Helvetica.
Also banned as dated: Lobster, Pacifico, Comfortaa, Bangers, Righteous.
</banned_fonts>

<curated_register>
Pick within these registers, matching the project's promise. These families are current, characterful and available with several weights.
- Editorial / press: Playfair Display, Instrument Serif, Fraunces, Newsreader, Young Serif, Gloock, Literata + text: Source Serif 4, Crimson Pro, Lora, Spectral.
- Swiss / objective / institutional: Archivo, Schibsted Grotesk, Hanken Grotesk, Libre Franklin, Public Sans + text: IBM Plex Sans, Work Sans, Karla.
- Bold / expressive / cultural: Anton, Bebas Neue, Archivo Black, Syne, Big Shoulders Display + text: Work Sans, Figtree, Karla, Hanken Grotesk.
- Technical / precise: Chivo, Sora, Unbounded, Geist, Space Mono (accents only) + text: IBM Plex Sans, Instrument Sans, Public Sans.
- Warm / craft / hospitality: Fraunces, Young Serif, Bitter, Zilla Slab, DM Serif Display + text: Karla, Asap, Figtree, Work Sans.
- Human / accessible: Bricolage Grotesque, Epilogue, Lexend, Onest + text: Atkinson Hyperlegible, Figtree, Hanken Grotesk.
Another Google Fonts family is acceptable if it is genuinely better for this brand — but never one from <banned_fonts>.
</curated_register>

<diversity_rules>
- The 3 sets must belong to 3 DIFFERENT registers. Three variations on the same idea are one proposal, not three.
- Set 1: the most defensible choice for this brand.
- Set 2: a clearly different register, more expressive.
- Set 3: a deliberate stance (a strong serif, a condensed display, a very geometric sans) — the one an art director would defend.
</diversity_rules>

<output_format>
Return STRICT JSON only.
{
  "typography": [
    {
      "id": "typography-set-1",
      "name": "a short descriptive French name, specific to the brand",
      "url": "typography/[url-slug]",
      "primaryFont": "exact Google Fonts family name",
      "secondaryFont": "exact Google Fonts family name",
      "rationale": "one sentence, in French: what this pairing says about the brand"
    }
    // ... 2 more sets, in different registers
  ]
}
</output_format>
`;

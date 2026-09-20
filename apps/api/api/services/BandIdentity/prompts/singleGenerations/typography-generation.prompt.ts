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
 *
 * Troisième correction, plus récente : le prompt n'autorisait QUE Google Fonts.
 * C'est le catalogue dont tout le web se sert, donc celui qui porte l'air de
 * famille qu'on cherche justement à éviter. Deux autres fonderies libres sont
 * désormais proposées — Fontshare et Fontsource —, et le modèle doit dire de
 * laquelle vient chaque famille : c'est ce qui permet de construire la bonne
 * feuille de style au moment du rendu.
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
- Both must exist, under their exact family name, in one of the catalogues listed in <font_sources>.
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
Another family from any catalogue in <font_sources> is acceptable if it is genuinely better for this brand — but never one from <banned_fonts>.
</curated_register>

<font_sources>
Three free catalogues are available. Name the one each family comes from in the "source" field, because the stylesheet that loads it is built from that answer — a wrong source means the font silently does not load.
- "google" — Google Fonts. The widest catalogue, and the one every other brand uses. Legitimate, but it should not be the answer three times out of three.
- "fontshare" — Fontshare (Indian Type Foundry), free for commercial use. Recent, characterful families that are ABSENT from Google, which is exactly what makes a brand stop looking generic: Satoshi, General Sans, Switzer, Cabinet Grotesk, Clash Display, Clash Grotesk, Chillax, Ranade, Supreme, Synonym, Technor, Author, Excon, Panchang, Tanker, Alpino, Quilon, Pally, Bespoke Sans, Plein, Amulya, Melodrama, Pilcrow Rounded, Zodiak, Sentient, Boska, Bespoke Serif, Gambetta, Gambarino, Neco, Erode, Rowan, Aktura, Bespoke Slab, Recia, Stardom, Nippo, Sharpie, Bevellier, Array, Chubbo, Segment.
- "fontsource" — Fontsource, non-Google open families served by jsDelivr: Geist Sans, Uncut Sans, Nebula Sans, Metropolis, Open Runde, Open Sauce Sans, Hauora Sans, Apfel Grotezk, Adwaita Sans, Cooper Hewitt, Bluu Next, Redaction, Chunk Five, Libre Caslon Condensed, Pretendard, Norwester, Ostrich Sans, Monaspace Neon, Monaspace Xenon, Iosevka, Commit Mono, iA Writer Quattro, Maple Mono.
At least ONE of the three sets must use a family that is not from Google — a brand that only ever picks from the catalogue everyone else uses cannot look like its own.
Only name a family you are sure exists in the catalogue you attribute it to. If you are unsure, use "google" and a family you know is there.
</font_sources>

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
      "primaryFont": "exact family name of the display family",
      "primarySource": "google | fontshare | fontsource",
      "secondaryFont": "exact family name of the text family",
      "secondarySource": "google | fontshare | fontsource",
      "rationale": "one sentence, in French: what this pairing says about the brand"
    }
    // ... 2 more sets, in different registers
  ]
}
</output_format>
`;

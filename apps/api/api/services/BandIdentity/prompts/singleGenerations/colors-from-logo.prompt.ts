export interface ColorsFromLogoPromptInput {
  projectDescription: string;
  /** Couleurs mesurées sur le logo importé, la plus couvrante en tête. */
  logoColors: string[];
}

/**
 * Prompt des palettes construites autour d'un logo importé.
 *
 * Deux régimes, parce que les deux situations n'ont rien à voir :
 *
 * - Logo MULTICOLORE : la marque a déjà choisi ses deux premières couleurs. On
 *   les verrouille et le modèle ne décide plus que de l'accent.
 * - Logo MONOCHROME : seule la primaire est donnée. La secondaire est alors à
 *   CONSTRUIRE. L'ancienne version recopiait la primaire dans la secondaire, et
 *   le prompt exigeait ensuite que les deux valent « exactement » cette couleur :
 *   les trois palettes proposées ne portaient donc que deux couleurs libres au
 *   lieu de trois, et l'interface se retrouvait sans seconde voix pour ses
 *   surfaces, ses filets et ses actions secondaires.
 */
export function buildColorsFromLogoPrompt(input: ColorsFromLogoPromptInput): string {
  const logoColors = input.logoColors.filter(Boolean);
  const primary = logoColors[0] || '#6a11cb';
  const secondary = logoColors[1];
  const isMonochromeLogo = !secondary;

  const secondaryBrief = isMonochromeLogo
    ? `SECONDARY: none — the logo carries a single colour. You BUILD it (see <secondary_construction>).`
    : `SECONDARY (LOCKED, from the logo): ${secondary}`;

  const secondarySection = isMonochromeLogo
    ? `<secondary_construction>
The logo gives ONE colour. The secondary is therefore yours to build, and it must NEVER be the primary
again: a palette whose primary and secondary are the same colour is not a palette — it leaves the brand
with no second voice for surfaces, rules, secondary buttons and charts.
Build it FROM the primary so the kinship stays visible, and make it distinct on all three axes:
- hue: at least 25° away from the primary, or a deliberate chromatic neutral (see palette 2);
- lightness: at least 15 points away from the primary;
- saturation: 10 to 30 points below the primary, so it supports instead of competing.
One construction per palette, so the three proposals are genuinely different offers:
- Palette 1 — analogous: primary hue ±25-40°, deeper and calmer. The cohesive, safe option.
- Palette 2 — chromatic neutral: the primary's hue held at 8-15% saturation and 20-30% lightness (a slate
  or ink that carries the brand hue). The institutional option: it lets the logo colour stay the only
  bright note on the page.
- Palette 3 — split-complementary: primary hue +150° or +210°, at equal or lower saturation. The option
  with the most tension; it must still pass the accent rules below.
</secondary_construction>`
    : `<secondary_handling>
Both primary and secondary come from the logo and are LOCKED. Reproduce them exactly in the three
palettes; only the accent, the background and the text change from one palette to the next.
</secondary_handling>`;

  const accentSection = `<accent_construction>
- Palette 1: analogous (primary hue ±30°) or a deeper tone of the secondary (cohesive, safe).
- Palette 2: split-complementary (hue +150° or +210°) (temperature shift).
- Palette 3: complementary (hue +180°) or triadic (±120°) (bold contrast).
- Accent saturation: 60-90%. The accent must read against the background (≥ 3:1 contrast) and must not
  clash with the secondary (≥ 20° hue distance).${
    isMonochromeLogo
      ? `
- The accent is a THIRD colour: keep it at least 25° of hue away from the secondary you just built, so the
  palette reads as three distinct voices and not as two shades of one.`
      : ''
  }
</accent_construction>`;

  const secondaryOutput = isMonochromeLogo ? '#... (built, never the primary)' : `${secondary}`;
  const lockRule = isMonochromeLogo
    ? `HARD CONSTRAINTS
- "primary" MUST be exactly "${primary}" in all 3 palettes.
- "secondary" MUST NOT equal "${primary}" — nor be a barely-shifted version of it (see the distance rules).
- Within one palette, the 5 values must all be different from one another.
- The 3 palettes must propose 3 DIFFERENT secondaries.`
    : `HARD CONSTRAINTS
- "primary" and "secondary" MUST be exactly "${primary}" and "${secondary}" in all 3 palettes.
- Within one palette, the 5 values must all be different from one another.`;

  return `<role>Senior brand identity color expert</role>
<objective>Build 3 premium colour palettes around the colour${
    logoColors.length > 1 ? 's' : ''
  } extracted from the user's imported logo.</objective>

<logo_context>
LOGO COLORS: ${logoColors.length > 0 ? logoColors.join(', ') : primary}
PRIMARY (LOCKED, from the logo): ${primary}
${secondaryBrief}
PROJECT DESCRIPTION: ${input.projectDescription}
</logo_context>

${secondarySection}

${accentSection}

<background_and_text>
- Background: ALWAYS LIGHT, in all 3 palettes — near-white tinted 2-4% with the primary hue, HSL lightness ≥ 94%. Never a dark, black or mid-tone ground: these palettes drive printed deliverables and generated websites, which are light-surface by policy.
- The locked colours must read on that light ground (≥ 3:1 contrast). If the logo's primary is too pale to hold up, raise the ACCENT's saturation — never darken the background.
- Text: near-black with a primary undertone, ≥ 7:1 contrast on the background.
</background_and_text>

<output_format>
Return STRICT JSON only.
{
  "colors": [
    {
      "id": "color-scheme-1",
      "name": "French descriptive name",
      "url": "palette/[url-slug]",
      "colors": {
        "primary": "${primary}",
        "secondary": "${secondaryOutput}",
        "accent": "#...",
        "background": "#...",
        "text": "#..."
      }
    }
    // ... 2 more unique palettes
  ]
}
${lockRule}
</output_format>
`;
}

export const TYPOGRAPHY_FROM_LOGO_PROMPT = `<role>Senior brand typographer</role>
<objective>Propose 3 typography systems that complement the logo's visual style and the project identity. Output: strict JSON.</objective>

<context>
PROJECT DESCRIPTION: {{PROJECT_DESCRIPTION}}
LOGO COLORS: {{LOGO_COLORS}}
STYLE SUGGESTION: {{STYLE_HINT}}
</context>

<matching_rules>
- Read the logo first: its letterforms, its weight, its geometry. The text family must extend that language, not fight it.
- Vivid, geometric logo -> a geometric or grotesque display (Archivo, Chivo, Syne, Sora).
- Deep, institutional logo -> a refined serif display plus a humanist sans for text (Fraunces or Playfair Display + IBM Plex Sans).
- Organic, soft logo -> a humanist display with open curves (Bricolage Grotesque, Epilogue, Young Serif).
- Condensed or stencil logo -> a condensed display (Bebas Neue, Big Shoulders Display, Anton).
- The display weight matches the visual weight of the logo.
- primaryFont carries the personality; secondaryFont must stay readable at 14-16px.
- WEIGHT RANGE: the display family must offer at least three weights far apart. Typographic hierarchy is what replaces decoration.
- Two families per set, exact family names, both from a catalogue listed in <font_sources>.
</matching_rules>

<banned_fonts>
Never propose these — they are the typefaces that make a brand read as machine-generated:
Inter, Roboto, Open Sans, Lato, Montserrat, Poppins, Nunito, Raleway, Ubuntu, Oswald, Space Grotesk, Arial, Helvetica.
Also banned as dated: Lobster, Pacifico, Comfortaa, Bangers, Righteous.
</banned_fonts>

<curated_register>
- Editorial / press: Playfair Display, Instrument Serif, Fraunces, Newsreader, Young Serif, Gloock, Literata + text: Source Serif 4, Crimson Pro, Lora, Spectral.
- Swiss / objective / institutional: Archivo, Schibsted Grotesk, Hanken Grotesk, Libre Franklin, Public Sans + text: IBM Plex Sans, Work Sans, Karla.
- Bold / expressive / cultural: Anton, Bebas Neue, Archivo Black, Syne, Big Shoulders Display + text: Work Sans, Figtree, Karla.
- Technical / precise: Chivo, Sora, Unbounded, Geist + text: IBM Plex Sans, Instrument Sans, Public Sans.
- Warm / craft / hospitality: Fraunces, Young Serif, Bitter, Zilla Slab, DM Serif Display + text: Karla, Asap, Figtree.
- Human / accessible: Bricolage Grotesque, Epilogue, Lexend, Onest + text: Atkinson Hyperlegible, Figtree, Hanken Grotesk.
</curated_register>

<font_sources>
Three free catalogues are available. Name the one each family comes from in the "source" field: the stylesheet that loads it is built from that answer, and a wrong source means the font silently does not load.
- "google" — Google Fonts, the widest catalogue, and the one every other brand uses.
- "fontshare" — Fontshare (Indian Type Foundry), free for commercial use, ABSENT from Google: Satoshi, General Sans, Switzer, Cabinet Grotesk, Clash Display, Clash Grotesk, Chillax, Ranade, Supreme, Synonym, Technor, Author, Excon, Panchang, Tanker, Alpino, Quilon, Pally, Bespoke Sans, Plein, Amulya, Melodrama, Pilcrow Rounded, Zodiak, Sentient, Boska, Bespoke Serif, Gambetta, Gambarino, Neco, Erode, Rowan, Aktura, Bespoke Slab, Recia, Stardom, Nippo, Sharpie, Bevellier, Array, Chubbo, Segment.
- "fontsource" — Fontsource, non-Google open families: Geist Sans, Uncut Sans, Nebula Sans, Metropolis, Open Runde, Open Sauce Sans, Hauora Sans, Apfel Grotezk, Adwaita Sans, Cooper Hewitt, Bluu Next, Redaction, Chunk Five, Libre Caslon Condensed, Pretendard, Norwester, Ostrich Sans, Monaspace Neon, Monaspace Xenon, Iosevka, Commit Mono, iA Writer Quattro, Maple Mono.
Only name a family you are sure exists in the catalogue you attribute it to. If you are unsure, use "google" and a family you know is there.
</font_sources>

<diversity_rules>
The 3 sets must belong to 3 DIFFERENT registers. All three must work with the logo; they must not be variations of one another.
</diversity_rules>

<output_format>
Return STRICT JSON only.
{
  "typography": [
    {
      "id": "typography-set-1",
      "name": "a short descriptive French name",
      "url": "typography/[url-slug]",
      "primaryFont": "exact family name of the display family",
      "primarySource": "google | fontshare | fontsource",
      "secondaryFont": "exact family name of the text family",
      "secondarySource": "google | fontshare | fontsource",
      "rationale": "one sentence, in French: how this pairing extends the logo"
    }
    // ... 2 more sets, in different registers
  ]
}
</output_format>
`;

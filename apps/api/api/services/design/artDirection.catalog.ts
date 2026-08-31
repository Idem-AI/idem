/**
 * Catalogue des directions artistiques.
 *
 * Le modèle NE CHOISIT PAS un style « libre » : il en choisit un ici. Deux
 * raisons — la première est la cohérence (un style nommé, décrit avec ses
 * règles, produit le même rendu d'un livrable à l'autre), la seconde est la
 * qualité : « minimaliste » lâché dans un prompt donne du vide et du gris,
 * tandis que la fiche ci-dessous dit à quoi ressemble le minimalisme quand
 * c'est un directeur artistique qui le pratique.
 *
 * Les fiches sont rédigées EN ANGLAIS : ce sont des prompts, et la langue de la
 * sortie est décidée séparément par chaque livrable. Chacune est écrite pour
 * être exécutée telle quelle — des règles opérables (grille, échelle,
 * traitement d'image), pas des adjectifs.
 */

import { ArtDirectionStyleId } from '../../models/art-direction.model';

/**
 * Espace de tirage autorisé par le style.
 *
 * La graine de composition (cf. design/designSeed.ts) tire dans CES listes et
 * pas dans le catalogue complet : c'est ce qui empêche un « Design Suisse » de
 * sortir en néon sur fond noir. La variété reste, mais à l'intérieur du style.
 */
export interface ArtDirectionSeedSpace {
  /** Archétypes de mise en page (A–L, cf. designSeed.ts). */
  archetypes: string[];
  colorStrategies: string[];
  typographyMoods: string[];
  layoutTensions: string[];
  contentDensities: string[];
  graphicAccents: string[];
}

export interface ArtDirectionStyle {
  id: ArtDirectionStyleId;
  /** Nom affiché, en anglais (il part dans les prompts). */
  name: string;
  /** L'idée du style en une phrase. */
  essence: string;
  /** À quel type de marque il convient — sert à l'agent qui choisit. */
  fitsBrands: string;
  /** Fond dominant imposé par le style. */
  surface: 'light' | 'dark' | 'either';
  /** Rayon de bordure caractéristique, en px. 0 = angles vifs assumés. */
  radius: number;
  /** Raison de l'échelle typographique (jamais < 1.25 : une échelle plate paraît inachevée). */
  typeRatio: number;
  /** Traitement des filets et bordures. */
  borders: string;
  /** Traitement des ombres. */
  shadows: string;
  /** Grammaire de composition. */
  layout: string;
  /** Comportement de la couleur (toujours contraint à la palette de la marque). */
  color: string;
  /** Traitement typographique. */
  typography: string;
  /** Textures, effets, éléments graphiques récurrents. */
  devices: string;
  /** Direction de l'imagerie (photo/illustration + traitement). */
  imagery: string;
  /**
   * Fragment ajouté aux prompts de génération d'IMAGE. Décrit le rendu
   * photographique/graphique attendu, jamais le sujet.
   */
  imagePromptModifier: string;
  /** Prompt négatif transmis aux modèles d'image qui l'acceptent. */
  imageNegativePrompt: string;
  /** Ce qui trahit une exécution amateur de ce style. */
  antiPatterns: string;
  /** Interdits durs propres au style, en plus des interdits globaux anti-slop. */
  bans: string[];
  /** Espace de tirage de la graine de composition. */
  seedSpace: ArtDirectionSeedSpace;
  /**
   * Vocabulaire de composants du style, en classes Tailwind exactes.
   *
   * C'est la réponse à un défaut précis : sans primitives données, le modèle
   * invente à chaque bloc une carte, un badge, un liseré — et c'est ce bricolage
   * accumulé qui produit la « décoration inutile ». En lui donnant les six
   * primitives d'un document (page, titre de section, texte courant, filet,
   * bloc de données, légende), il assemble au lieu d'inventer, et deux pages du
   * même document se ressemblent enfin.
   *
   * Les jetons PRIMARY / TEXT / BACKGROUND / ACCENT sont remplacés par les
   * valeurs hexadécimales de la charte au moment de la composition.
   */
  tailwindRecipe: string;
  /**
   * Appariements typographiques qui SERVENT ce style (familles Google Fonts).
   * Sert de recommandation quand la marque n'a pas encore de typographie, et de
   * point de comparaison quand elle en a une.
   */
  typePairings: string[];
}

export const ART_DIRECTION_STYLES: Record<ArtDirectionStyleId, ArtDirectionStyle> = {
  minimalism: {
    id: 'minimalism',
    name: 'Minimalism',
    essence: 'Remove until only the essential remains, then obsess over what is left.',
    fitsBrands:
      'Premium services, consulting, health, finance, B2B tech, quiet luxury — anything selling trust and mastery.',
    surface: 'light',
    radius: 0,
    typeRatio: 1.5,
    borders:
      'At most one 1px rule per composition, in the text colour at 15% opacity. No card borders.',
    shadows: 'None. Depth comes from space, never from elevation.',
    layout:
      'Half to two thirds of the canvas left empty, deliberately and not as leftover. ONE occupied zone per composition, snapped to a strict 12-column grid. Generous, equal margins (at least 8% of the shorter side). One focal point, never two.',
    color:
      'A neutral dominant ground (the charter background), text in the charter text colour, and ONE single intervention of the primary colour per composition — a rule, a word, a shape. No gradients.',
    typography:
      'Two typographic levels only, separated by a ratio of at least 4x. Headline in a medium weight, never black. Slightly open tracking on capitals (0.08–0.2em). Left aligned by default.',
    devices:
      'A 1px rule, breathing room, optical alignment. No shadow, no decorative radius, no badge, no ornamental icon.',
    imagery:
      'Restrained photography, a single subject isolated on a plain or imperceptibly graded ground, generous air around it. One image per composition at most.',
    imagePromptModifier:
      'minimalist commercial photography, single subject isolated on a clean seamless background, abundant negative space, soft even diffused studio light, muted neutral palette, no props, no clutter, sharp focus, editorial product photography, shot on 85mm, subtle natural film grain',
    imageNegativePrompt:
      'cluttered, busy background, props, heavy shadows, saturated colors, text overlay, watermark, collage, multiple subjects',
    antiPatterns:
      'Emptiness without intent (uneven margins), grey everywhere, a single text size, or "minimalism" that is only missing content.',
    bans: [
      'No rounded card carrying a drop shadow.',
      'No gradient, anywhere.',
      'Never two focal points in the same composition.',
      'No decorative icon.',
    ],
    tailwindRecipe:
      'page: \'p-[14mm] bg-[BACKGROUND]\' — margins equal on all four sides. sectionTitle: \'font-primary text-[34px] font-medium tracking-[-0.01em] text-[TEXT]\'. eyebrow: \'font-secondary text-[10px] uppercase tracking-[0.28em] text-[TEXT]/50\' — one per page at most. body: \'font-secondary text-[11px] leading-[1.7] text-[TEXT]/85 max-w-[62ch]\'. rule: \'h-px w-full bg-[TEXT]/12\' — the ONLY separator. dataBlock: a borderless table, \'text-[10px] leading-[2]\', column heads in \'uppercase tracking-[0.16em] text-[TEXT]/45\', one hairline under the head row. kpi: number in \'font-primary text-[56px] leading-none\', label under it in \'text-[10px] uppercase tracking-[0.2em] text-[TEXT]/50\'. caption: \'text-[9px] text-[TEXT]/45\'. emphasis: one word or one rule in PRIMARY, once per page. Never a card, never a shadow, never a filled block.',
    typePairings: ['Archivo + IBM Plex Sans', 'Hanken Grotesk + Work Sans', 'Schibsted Grotesk + Karla'],
    seedSpace: {
      archetypes: ['A', 'C', 'E', 'L'],
      colorStrategies: ['MONOCHROME_ACCENT', 'DUOTONE', 'INVERSE'],
      typographyMoods: ['WIDE_WHISPER', 'WEIGHT_CLASH', 'ALL_LOWERCASE_INTIMATE', 'STAGGERED_INDENT'],
      layoutTensions: ['NEGATIVE_SPACE_HERO', 'CORNER_ANCHOR', 'FRAME_WITHIN_FRAME'],
      contentDensities: ['MINIMAL', 'BALANCED'],
      graphicAccents: ['NONE', 'THICK_UNDERLINE', 'BORDER_ACCENT'],
    },
  },

  maximalism: {
    id: 'maximalism',
    name: 'Maximalism',
    essence: 'Saturate the visual field — but by a rule, never at random.',
    fitsBrands:
      'Culture, events, fashion, food, music, young expressive brands, festivals, media.',
    surface: 'either',
    radius: 8,
    typeRatio: 1.618,
    borders: 'Thick frames (6 to 12px) in solid colour, used as compositional elements.',
    shadows: 'Hard offset shadows (no blur), in a charter colour.',
    layout:
      'Deliberate density: overlaps, layers, elements bleeding past the edges. A rigid underlying modular grid is what makes the chaos legible. Always ONE zone of rest, otherwise nothing stands out.',
    color:
      'Every charter colour at once, in flat blocks at large scale. Contrast is sought, never softened. Colours meet without transition.',
    typography:
      'Extreme scale mixing (up to 10x), rotated text, words cut by shapes, very heavy capitals overprinted. Three levels minimum.',
    devices:
      'Repeated patterns, frames within frames, stacking, textures, solid geometric shapes slicing the image.',
    imagery:
      'Multiple images, tightly cropped, cut out and layered. Pushed colour, high contrast.',
    imagePromptModifier:
      'maximalist editorial art direction, layered composition, bold saturated color blocking, high contrast, busy but structured, pattern-on-pattern, vivid graphic energy, magazine collage feel, crisp detail',
    imageNegativePrompt:
      'minimal, empty, plain background, muted, washed out, single element, sparse',
    antiPatterns:
      'Clutter: with no underlying grid and no zone of rest, the result is an illegible page, not maximalism.',
    bans: [
      'Never a composition without a zone of rest: without it, nothing stands out.',
      'No element placed at random: the underlying grid must stay readable.',
    ],
    tailwindRecipe:
      'page: \'p-[10mm] bg-[BACKGROUND]\' with full-bleed colour bands escaping the padding. sectionTitle: \'font-primary text-[64px] font-black leading-[0.9] uppercase text-[BACKGROUND] bg-[PRIMARY] px-3 inline-block\'. body: \'font-secondary text-[11px] leading-[1.55] text-[TEXT]\' in 2 columns. rule: \'h-[6px] bg-[TEXT]\'. dataBlock: table with \'border-2 border-[TEXT]\' and alternating \'bg-[ACCENT]/15\' rows. kpi: number in \'font-primary text-[96px] leading-none text-[ACCENT]\' overlapping a colour band. caption: \'text-[9px] uppercase tracking-[0.2em]\'. emphasis: a full colour band behind the block. One zone of rest per page, mandatory.',
    typePairings: ['Anton + Work Sans', 'Archivo Black + Figtree', 'Syne + Karla'],
    seedSpace: {
      archetypes: ['B', 'C', 'F', 'G', 'H'],
      colorStrategies: ['BRAND_FULL', 'SPLIT_COMPLEMENTARY', 'IMAGE_EXTRACTED'],
      typographyMoods: ['CONDENSED_TOWER', 'OUTLINE_FILLED_MIX', 'SINGLE_LETTER_ANCHOR', 'ROTATED_AXIS'],
      layoutTensions: ['COLLAGE_LAYER', 'TEXT_ESCAPES_BOUNDS', 'FULL_BLEED_EDGE', 'DIAGONAL_FLOW'],
      contentDensities: ['EDITORIAL', 'TYPE_HEAVY'],
      graphicAccents: ['GEOMETRIC_SHAPE', 'PATTERN_STRIP', 'OVERSIZED_PUNCTUATION', 'DOT_CLUSTER'],
    },
  },

  futuristic: {
    id: 'futuristic',
    name: 'Futuristic',
    essence: 'Signal technological advance through precision, not through science-fiction clichés.',
    fitsBrands: 'Deeptech, AI, fintech, mobility, energy, telecoms, advanced industry.',
    surface: 'dark',
    radius: 4,
    typeRatio: 1.414,
    borders: '1px rules in the primary colour at full intensity, drawn as luminous edges.',
    shadows: 'No drop shadows: halos instead (diffuse box-shadow in the object own hue).',
    layout:
      'Composition on a dark ground, elements aligned to a grid made visible in places. Vanishing lines, perspective, shapes that imply motion. Large amounts of deep black between elements.',
    color:
      'Dark ground (the charter secondary or text colour, darkened), primary colour used as light — thin strokes, halos, edges. Colour does not fill, it illuminates.',
    typography:
      'Geometric or technical sans-serif. Widely spaced capitals for eyebrows (0.25–0.4em), tight headlines. Numbers and data staged as graphic elements.',
    devices:
      'Wireframe grids, data curves, luminous edges, discreet radial gradients, reticles, technical measurements and annotations.',
    imagery:
      'Technical renders, macro shots of materials, raking light in blue or in the primary colour. Never a humanoid robot, never a "digital brain".',
    imagePromptModifier:
      'futuristic technology art direction, dark background, precise engineered forms, thin luminous edge lighting, volumetric haze, macro detail of advanced materials, cinematic rim light, ultra sharp, high dynamic range, no sci-fi clichés, no humanoid robots',
    imageNegativePrompt:
      'humanoid robot, glowing brain, circuit board background, hexagon grid overlay, blue neon cliché, stock technology, lens flare spam',
    antiPatterns:
      'The blue background with printed circuits and a hexagon: that is the stock cliché, not an art direction.',
    bans: [
      'No printed circuit, no hexagon, no digital brain: these are the stock clichés.',
      'The ground can never be light.',
      'Colour does not fill large areas, it lights up edges.',
    ],
    tailwindRecipe:
      'page: \'p-[14mm] bg-[TEXT] text-[BACKGROUND]\' — dark ground throughout. sectionTitle: \'font-primary text-[38px] font-semibold tracking-[-0.02em] text-[BACKGROUND]\'. eyebrow: \'font-secondary text-[9px] uppercase tracking-[0.36em] text-[PRIMARY]\'. body: \'font-secondary text-[11px] leading-[1.7] text-[BACKGROUND]/75\'. rule: \'h-px w-full bg-[PRIMARY]/40\'. dataBlock: table with \'border-b border-[BACKGROUND]/12\', numbers in \'tabular-nums text-[PRIMARY]\'. kpi: \'font-primary text-[64px] leading-none text-[BACKGROUND]\' with the unit in \'text-[PRIMARY] text-[18px]\'. caption: \'text-[9px] text-[BACKGROUND]/45\'. emphasis: a 1px PRIMARY edge, never a filled block. No glow on text below 24px.',
    typePairings: ['Chivo + IBM Plex Sans', 'Sora + Instrument Sans', 'Unbounded + Public Sans'],
    seedSpace: {
      archetypes: ['B', 'F', 'I', 'J', 'L'],
      colorStrategies: ['MONOCHROME_ACCENT', 'DUOTONE', 'INVERSE'],
      typographyMoods: ['CONDENSED_TOWER', 'WIDE_WHISPER', 'WEIGHT_CLASH', 'ROTATED_AXIS'],
      layoutTensions: ['DIAGONAL_FLOW', 'FULL_BLEED_EDGE', 'RULE_HEAVY', 'NEGATIVE_SPACE_HERO'],
      contentDensities: ['MINIMAL', 'BALANCED'],
      graphicAccents: ['GEOMETRIC_SHAPE', 'BORDER_ACCENT', 'PATTERN_STRIP', 'NONE'],
    },
  },

  'vector-art': {
    id: 'vector-art',
    name: 'Vector Art',
    essence: 'Everything is drawn: solid shapes, crisp flats, no photography at all.',
    fitsBrands:
      'SaaS, education, public services, accessible healthcare, consumer apps, NGOs.',
    surface: 'light',
    radius: 16,
    typeRatio: 1.333,
    borders:
      'Either 2 to 3px outlines in a darker shade of the fill, or no outline at all — never a mix of both.',
    shadows: 'Flat offset shadow (same shape, darker colour), never a blur.',
    layout:
      'Illustrated scenes occupying 40 to 60% of the composition, stylised characters or objects in flat fills. Text and illustration share the same grid.',
    color:
      'The charter palette extended through opacity, never through new hues. Flat fills, crisp edges, offset flat shadows rather than blurs.',
    typography:
      'Rounded geometric sans-serif, medium to bold weights, with a corner radius consistent with the illustrated shapes.',
    devices:
      'Primitive geometric shapes, a constant corner radius, characters without detailed facial features, solid icons drawn in the same line language.',
    imagery: 'Vector illustration only. Never mix photography and illustration in one composition.',
    imagePromptModifier:
      'flat vector illustration, clean geometric shapes, solid fills, consistent stroke weight, no gradients, no photographic texture, isometric or front-facing scene, generous flat color blocking, crisp edges, professional UI illustration style',
    imageNegativePrompt:
      'photograph, photorealistic, 3d render, gradient mesh, texture, film grain, realistic lighting, drop shadow blur',
    antiPatterns:
      'Mixing vector illustration with photography, or stacking several illustration styles in one piece.',
    bans: [
      'Never a photograph in the same composition as an illustration.',
      'No gradients: flat fills only.',
      'One single stroke language for every shape.',
    ],
    tailwindRecipe:
      'page: \'p-[14mm] bg-[BACKGROUND] rounded-[16px]\'. sectionTitle: \'font-primary text-[36px] font-bold text-[PRIMARY]\'. body: \'font-secondary text-[11px] leading-[1.65] text-[TEXT]/85\'. rule: \'h-[3px] w-16 bg-[ACCENT] rounded-full\'. dataBlock: rows separated by \'bg-[PRIMARY]/6 rounded-[16px] px-4 py-3\' — a single radius across the document. kpi: number in \'font-primary text-[52px] text-[PRIMARY]\' inside a flat \'bg-[PRIMARY]/8 rounded-[16px] p-5\'. caption: \'text-[9px] text-[TEXT]/55\'. emphasis: a flat colour fill, never a gradient, never a blurred shadow. Illustrated scenes are drawn in div/CSS shapes, never mixed with photography.',
    typePairings: ['Bricolage Grotesque + Figtree', 'Epilogue + Hanken Grotesk', 'Onest + Atkinson Hyperlegible'],
    seedSpace: {
      archetypes: ['A', 'C', 'J', 'L'],
      colorStrategies: ['BRAND_FULL', 'MONOCHROME_ACCENT'],
      typographyMoods: ['WEIGHT_CLASH', 'ALL_LOWERCASE_INTIMATE', 'STAGGERED_INDENT'],
      layoutTensions: ['CORNER_ANCHOR', 'FULL_BLEED_EDGE', 'NEGATIVE_SPACE_HERO'],
      contentDensities: ['MINIMAL', 'BALANCED'],
      graphicAccents: ['GEOMETRIC_SHAPE', 'DOT_CLUSTER', 'THICK_UNDERLINE'],
    },
  },

  'collage-art': {
    id: 'collage-art',
    name: 'Collage',
    essence: 'Assemble heterogeneous fragments so they produce a new meaning.',
    fitsBrands: 'Culture, education, media, social economy, activist brands, craft, festivals.',
    surface: 'light',
    radius: 0,
    typeRatio: 1.5,
    borders: 'Cut edges (sometimes torn), never an evenly drawn border.',
    shadows: 'Short hard shadows under each fragment, to give the paper its thickness.',
    layout:
      'Cut-out fragments layered with slight rotations (±3 to 8°). Elements overlap and run off the canvas. A clear hierarchy survives the collage.',
    color:
      'Charter flats as background papers, images in duotone or black and white to unify them, one accent colour used as a highlight.',
    typography:
      'Headlines built from words at different sizes, like letters cut from a newspaper. A sober running text to counterbalance.',
    devices:
      'Torn edges, hard drop shadows, tape, hand-cut shapes, paper textures, drawn rules.',
    imagery:
      'Cut-out photographs, unexpectedly cropped, mixed with flat colour and paper textures.',
    imagePromptModifier:
      'paper collage art direction, cut-out photographic fragments with visible torn and scissor edges, layered paper textures, halftone print texture, mixed media, tactile analogue feel, subtle drop shadows between layers, scanned paper grain',
    imageNegativePrompt:
      'smooth digital composite, seamless blending, soft edges, gradient background, glossy, 3d render',
    antiPatterns:
      'Images merely stacked, with no cut-out and no rotation: that is layering, not collage.',
    bans: [
      'Images stacked without a cut-out and a rotation do not make a collage.',
      'No fading between fragments: the edges stay crisp.',
    ],
    tailwindRecipe:
      'page: \'p-[12mm] bg-[BACKGROUND]\'. sectionTitle: words at mixed sizes, \'font-primary\' with alternating \'text-[40px]\' and \'text-[64px]\', some on \'bg-[ACCENT] px-2\', rotated by \'rotate-[-2deg]\'. body: \'font-secondary text-[11px] leading-[1.6] text-[TEXT]\' inside irregular columns. rule: a torn strip, \'h-[8px] bg-[TEXT]\'. dataBlock: table laid on a \'bg-[BACKGROUND] shadow-[3px_3px_0_rgba(0,0,0,0.25)] rotate-[0.6deg]\' paper. kpi: a cut-out number, \'font-primary text-[80px] bg-[PRIMARY] text-[BACKGROUND] px-3 inline-block rotate-[-3deg]\'. caption: \'text-[9px] italic\'. emphasis: a hand-cut highlight behind the word.',
    typePairings: ['Instrument Serif + Work Sans', 'Young Serif + Karla', 'Archivo Black + Spectral'],
    seedSpace: {
      archetypes: ['C', 'F', 'H', 'K'],
      colorStrategies: ['DUOTONE', 'IMAGE_EXTRACTED', 'MONOCHROME_ACCENT'],
      typographyMoods: ['OUTLINE_FILLED_MIX', 'STAGGERED_INDENT', 'SINGLE_LETTER_ANCHOR', 'ROTATED_AXIS'],
      layoutTensions: ['COLLAGE_LAYER', 'TEXT_ESCAPES_BOUNDS', 'DIAGONAL_FLOW'],
      contentDensities: ['EDITORIAL', 'BALANCED'],
      graphicAccents: ['OVERSIZED_PUNCTUATION', 'PATTERN_STRIP', 'GEOMETRIC_SHAPE'],
    },
  },

  retro: {
    id: 'retro',
    name: 'Retro',
    essence: 'Borrow the graphic grammar of one precise decade (70s, 80s) and stay inside it.',
    fitsBrands: 'Food and beverage, hospitality, craft, music, warm family-facing brands.',
    surface: 'light',
    radius: 24,
    typeRatio: 1.414,
    borders: 'Thick rounded frames and cartouches, double rules.',
    shadows: 'Hard offset typographic shadow, never a blur.',
    layout:
      'Centred or symmetrical compositions, frames and cartouches, horizontal bands. A badge or crest as the central compositional element.',
    color:
      'The charter palette desaturated one notch and warmed, applied in wide bands. Gradients rendered as discrete bands rather than smooth fades.',
    typography:
      'Heavy 1970s serif or rounded sans-serif, curved lettering, hard typographic drop shadows, text set inside shapes.',
    devices:
      'Sunburst bands, arcs, rounded frames, print grain, offset halftone, generously rounded corners.',
    imagery:
      'Photography with pronounced grain, slightly faded colour, light halation, like a film print.',
    imagePromptModifier:
      'retro 1970s commercial photography, warm faded film stock, visible grain, slightly washed halation, sunburst warm tones, vintage print texture, nostalgic art direction, analog camera look',
    imageNegativePrompt:
      'modern minimal, clean digital, cool blue tones, sharp clinical lighting, contemporary sans-serif',
    antiPatterns:
      'Mixing decades (70s plus 90s): retro only reads as credible when it quotes a single era.',
    bans: [
      'Never mix two decades: quote one era only.',
      'No saturated cool colours.',
    ],
    tailwindRecipe:
      'page: \'p-[14mm] bg-[BACKGROUND]\' with a \'rounded-[24px] border-[3px] border-[TEXT] p-[10mm]\' inner cartouche. sectionTitle: \'font-primary text-[42px] font-bold uppercase tracking-[0.02em] text-[PRIMARY]\'. body: \'font-secondary text-[11px] leading-[1.65] text-[TEXT]\'. rule: two stacked rules, \'h-[3px] bg-[TEXT]\' over \'h-px bg-[TEXT] mt-1\'. dataBlock: table inside a rounded cartouche, head row in \'bg-[PRIMARY] text-[BACKGROUND] uppercase tracking-[0.14em]\'. kpi: number in \'font-primary text-[64px]\' with a hard offset shadow \'text-shadow:4px 4px 0 ACCENT\'. caption: \'text-[9px] uppercase tracking-[0.2em]\'. emphasis: a badge with a real value in it, never an empty one.',
    typePairings: ['Bitter + Karla', 'Zilla Slab + Work Sans', 'DM Serif Display + Asap'],
    seedSpace: {
      archetypes: ['B', 'G', 'J', 'K'],
      colorStrategies: ['BRAND_FULL', 'DUOTONE', 'MONOCHROME_ACCENT'],
      typographyMoods: ['CONDENSED_TOWER', 'WEIGHT_CLASH', 'OUTLINE_FILLED_MIX'],
      layoutTensions: ['FRAME_WITHIN_FRAME', 'FULL_BLEED_EDGE', 'CORNER_ANCHOR'],
      contentDensities: ['MINIMAL', 'BALANCED'],
      graphicAccents: ['PATTERN_STRIP', 'THICK_UNDERLINE', 'GEOMETRIC_SHAPE'],
    },
  },

  cyberpunk: {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    essence: 'The dense nocturnal city: neon, rain, a violent contrast between black and light.',
    fitsBrands: 'Gaming, streaming, crypto, nightlife events, cybersecurity, provocative brands.',
    surface: 'dark',
    radius: 2,
    typeRatio: 1.5,
    borders: 'Technical 1px rules, cut corners, reticles in the angles.',
    shadows: 'Neon halos (coloured text-shadow / box-shadow), never a grey shadow.',
    layout:
      'A very dark ground, elements flush left or stacked in layers. Text overprinted on opaque blocks. Strong contrast between empty zones and information-dense zones.',
    color:
      'Deep black dominant; primary and accent used as neon (halos, glows), never as pastel flats. Two vivid colours at most at the same time.',
    typography:
      'Condensed sans-serif in capitals, sparing typographic glitch, monospace eyebrows, numbers and codes as decorative elements.',
    devices:
      'Luminous halos, scan lines, slight chromatic offsets, technical frames, vertical text along the edges.',
    imagery: 'Nocturnal urban photography, wet reflections, neon backlight, silhouettes.',
    imagePromptModifier:
      'cyberpunk night photography, rain-slick reflective surfaces, neon rim lighting, deep blacks with two dominant neon hues, volumetric fog, urban night scene, cinematic anamorphic look, high contrast, moody',
    imageNegativePrompt:
      'daylight, pastel colors, white background, soft warm lighting, minimal empty scene, corporate stock photo',
    antiPatterns:
      'Neon applied everywhere: without large black areas the effect disappears and the text stops being readable.',
    bans: [
      'The ground can never be light.',
      'Two neon colours at most at the same time.',
      'Without large black areas the neon effect disappears.',
    ],
    tailwindRecipe:
      'page: \'p-[13mm] bg-[TEXT] text-[BACKGROUND]\'. sectionTitle: \'font-primary text-[40px] font-bold uppercase tracking-[0.04em] text-[BACKGROUND]\'. eyebrow: monospaced feel, \'text-[9px] uppercase tracking-[0.4em] text-[ACCENT]\'. body: \'font-secondary text-[11px] leading-[1.6] text-[BACKGROUND]/70\'. rule: \'h-px bg-[ACCENT]/50\' with cut corners on frames. dataBlock: \'border border-[BACKGROUND]/15\' table, numbers \'tabular-nums text-[ACCENT]\'. kpi: \'font-primary text-[72px] text-[ACCENT]\' with a halo only above 40px. caption: \'text-[9px] text-[BACKGROUND]/40\'. emphasis: an opaque block of ACCENT behind three words. Large black areas are mandatory: without them the neon reads as noise.',
    typePairings: ['Chivo + IBM Plex Sans', 'Archivo + Public Sans', 'Sora + Instrument Sans'],
    seedSpace: {
      archetypes: ['B', 'F', 'I', 'L'],
      colorStrategies: ['MONOCHROME_ACCENT', 'DUOTONE', 'INVERSE'],
      typographyMoods: ['CONDENSED_TOWER', 'ROTATED_AXIS', 'OUTLINE_FILLED_MIX', 'WEIGHT_CLASH'],
      layoutTensions: ['FULL_BLEED_EDGE', 'DIAGONAL_FLOW', 'COLLAGE_LAYER', 'RULE_HEAVY'],
      contentDensities: ['MINIMAL', 'BALANCED', 'TYPE_HEAVY'],
      graphicAccents: ['BORDER_ACCENT', 'PATTERN_STRIP', 'GEOMETRIC_SHAPE'],
    },
  },

  'pop-art': {
    id: 'pop-art',
    name: 'Pop Art',
    essence: 'Mass culture treated as an art object: flats, halftones, repetition.',
    fitsBrands: 'Retail, food, young fashion, entertainment, promotional campaigns, joyful brands.',
    surface: 'light',
    radius: 0,
    typeRatio: 1.618,
    borders: 'Thick black outlines (4 to 8px) around shapes and frames.',
    shadows: 'None: depth comes from the outline and the halftone.',
    layout:
      'A grid of repeated panels, thick frames, cut-out subjects placed on flats. Frontal composition, readable at a glance.',
    color:
      'Charter colours as pure saturated flats, juxtaposed without transition. Black serves as outline, never as ground.',
    typography:
      'Very heavy capitals, speech balloons, onomatopoeia, text set inside solid shapes.',
    devices:
      'Halftone dot screens, thick black outlines, rays radiating from the centre, the same subject repeated in colour variants.',
    imagery:
      'Cut-out portraits or products, posterised, treated in 2 to 3 tones with a dot screen.',
    imagePromptModifier:
      'pop art treatment, bold halftone dot texture, posterized two-tone subject, thick black outlines, flat saturated color blocking, comic book print feel, high contrast screen print aesthetic',
    imageNegativePrompt:
      'muted colors, soft gradient, photorealistic skin, subtle lighting, minimal white space, blurry',
    antiPatterns: 'Bright colours with no halftone and no outline: that is "colourful", not pop art.',
    bans: [
      'Bright colours without a halftone and an outline do not make pop art.',
      'Black is the outline, never the ground.',
    ],
    tailwindRecipe:
      'page: \'p-[12mm] bg-[BACKGROUND] border-[6px] border-[TEXT]\'. sectionTitle: \'font-primary text-[54px] font-black uppercase text-[TEXT]\' with a \'bg-[ACCENT] px-3\' highlight on one word. body: \'font-secondary text-[11px] leading-[1.55] text-[TEXT]\'. rule: \'h-[5px] bg-[TEXT]\'. dataBlock: table with \'border-[3px] border-[TEXT]\' and a head row in \'bg-[PRIMARY] text-[BACKGROUND]\'. kpi: \'font-primary text-[96px] leading-none text-[PRIMARY]\' with a thick TEXT outline. caption: \'text-[9px] uppercase tracking-[0.18em]\'. emphasis: a halftone dot field built with \'background-image: radial-gradient(TEXT 1px, transparent 1px); background-size: 6px 6px\' at 20% opacity.',
    typePairings: ['Anton + Work Sans', 'Archivo Black + Karla', 'Bebas Neue + Figtree'],
    seedSpace: {
      archetypes: ['B', 'C', 'H', 'K'],
      colorStrategies: ['BRAND_FULL', 'DUOTONE', 'SPLIT_COMPLEMENTARY'],
      typographyMoods: ['WEIGHT_CLASH', 'SINGLE_LETTER_ANCHOR', 'OUTLINE_FILLED_MIX', 'CONDENSED_TOWER'],
      layoutTensions: ['RULE_HEAVY', 'FULL_BLEED_EDGE', 'FRAME_WITHIN_FRAME', 'COLLAGE_LAYER'],
      contentDensities: ['MINIMAL', 'BALANCED'],
      graphicAccents: ['GEOMETRIC_SHAPE', 'PATTERN_STRIP', 'OVERSIZED_PUNCTUATION'],
    },
  },

  glassmorphism: {
    id: 'glassmorphism',
    name: 'Glassmorphism',
    essence: 'Frosted glass surfaces floating above a coloured, blurred ground.',
    fitsBrands: 'Fintech, mobile apps, modern SaaS, digital products, elegant tech brands.',
    surface: 'either',
    radius: 24,
    typeRatio: 1.333,
    borders: 'A 1px white rule at 20% opacity along the top edge of each glass surface.',
    shadows: 'Very diffuse coloured shadows, never black.',
    layout:
      'Translucent cards layered over a coloured, heavily blurred background. Hierarchy comes from depth (blur plus opacity), not from size alone. A constant, generous corner radius.',
    color:
      'A background made of wide, strongly blurred blobs of the charter colours. Cards pick up the background colour at 10–20% opacity, edged with a white rule at 20%.',
    typography:
      'Neutral sans-serif, medium weights, text always sitting on a glass surface so it stays readable — never directly on the blurred ground.',
    devices:
      'Background blur, 1px luminous borders, very diffuse drop shadows, light reflections at the top of cards.',
    imagery: 'Blurred abstract shapes, gradient meshes, never a sharp photographic subject behind.',
    imagePromptModifier:
      'abstract soft gradient mesh background, large blurred color blobs, frosted glass surfaces, subtle light refraction, translucent layered panels, soft diffuse shadows, clean modern digital product aesthetic',
    imageNegativePrompt:
      'flat design, hard edges, opaque solid background, harsh shadows, sharp corners, photographic subject in background',
    antiPatterns:
      'Text sitting on the blurred ground with no glass card: legibility collapses and the effect reads as a mistake.',
    bans: [
      'No text placed directly on the blurred ground: it must rest on a glass surface.',
      'The blurred ground must contain no recognisable subject.',
    ],
    tailwindRecipe:
      'page: \'p-[14mm]\' over a background of two or three wide blurred colour blobs. sectionTitle: \'font-primary text-[36px] font-semibold text-[TEXT]\'. body: \'font-secondary text-[11px] leading-[1.7] text-[TEXT]/80\'. surface: EVERY text block sits on \'bg-[BACKGROUND]/55 border border-white/25 rounded-[24px] p-6\' — never directly on the blurred ground. rule: \'h-px bg-white/30\'. dataBlock: a table inside one glass surface, rows separated by \'border-b border-white/20\'. kpi: \'font-primary text-[56px] text-[TEXT]\' inside its own glass surface. caption: \'text-[9px] text-[TEXT]/55\'. emphasis: raise the surface opacity, never add a colour.',
    typePairings: ['Hanken Grotesk + Figtree', 'Onest + Instrument Sans', 'Epilogue + Public Sans'],
    seedSpace: {
      archetypes: ['B', 'E', 'F', 'J'],
      colorStrategies: ['MONOCHROME_ACCENT', 'BRAND_FULL', 'DUOTONE'],
      typographyMoods: ['WEIGHT_CLASH', 'WIDE_WHISPER', 'ALL_LOWERCASE_INTIMATE'],
      layoutTensions: ['COLLAGE_LAYER', 'NEGATIVE_SPACE_HERO', 'FRAME_WITHIN_FRAME', 'CORNER_ANCHOR'],
      contentDensities: ['MINIMAL', 'BALANCED'],
      graphicAccents: ['GRADIENT_WASH', 'GEOMETRIC_SHAPE', 'NONE'],
    },
  },

  clay: {
    id: 'clay',
    name: 'Clay 3D',
    essence: 'Matte, rounded, tactile volumes, as if modelled in clay.',
    fitsBrands:
      'Consumer apps, education, childhood, gentle healthcare, accessible services, onboarding.',
    surface: 'light',
    radius: 32,
    typeRatio: 1.333,
    borders: 'No borders: the volumes separate through soft shadow.',
    shadows: 'Soft ambient occlusion on the ground plane, never a hard shadow.',
    layout:
      'Isolated 3D objects, centred or three-quarter, resting on a plain charter-coloured ground. Plenty of air around the volume. Soft contact shadows.',
    color:
      'Ground in a desaturated charter colour, volumes in matte versions of the primary and accent. No metallic colour, no hard specular highlight.',
    typography: 'Rounded, heavy sans-serif with soft corners, matching the softness of the volumes.',
    devices:
      'Very pronounced rounding, soft multi-directional shadows, a complete absence of reflection, a uniform matte material.',
    imagery: 'Clay or plasticine 3D renders, soft studio light, simplified objects.',
    imagePromptModifier:
      '3D clay render, soft matte plasticine material, rounded chunky shapes, soft studio lighting with gentle ambient occlusion, pastel background, no specular highlights, playful tactile toy-like objects, octane render quality',
    imageNegativePrompt:
      'glossy, metallic, specular highlights, reflective, sharp edges, realistic materials, hard shadows, dark background',
    antiPatterns:
      'A glossy or metallic 3D render: clay loses its whole point the moment it reflects light.',
    bans: [
      'No specular highlight, no metal, no glass.',
      'The ground stays plain and light.',
    ],
    tailwindRecipe:
      'page: \'p-[15mm] bg-[BACKGROUND] rounded-[32px]\'. sectionTitle: \'font-primary text-[38px] font-bold text-[TEXT]\'. body: \'font-secondary text-[11px] leading-[1.7] text-[TEXT]/80\'. surface: \'bg-[PRIMARY]/10 rounded-[32px] p-6 shadow-[0_10px_30px_rgba(0,0,0,0.06)]\' — one soft shadow, one radius, everywhere. rule: \'h-[4px] w-14 bg-[PRIMARY]/40 rounded-full\'. dataBlock: rows as separate soft blocks rather than a ruled table. kpi: \'font-primary text-[56px] text-[PRIMARY]\' on a soft block. caption: \'text-[9px] text-[TEXT]/55\'. emphasis: a bigger soft block. No specular highlight, no metal, no glass.',
    typePairings: ['Bricolage Grotesque + Figtree', 'Onest + Atkinson Hyperlegible', 'Lexend + Karla'],
    seedSpace: {
      archetypes: ['A', 'B', 'E', 'J'],
      colorStrategies: ['MONOCHROME_ACCENT', 'BRAND_FULL'],
      typographyMoods: ['WEIGHT_CLASH', 'ALL_LOWERCASE_INTIMATE', 'WIDE_WHISPER'],
      layoutTensions: ['NEGATIVE_SPACE_HERO', 'CORNER_ANCHOR', 'FRAME_WITHIN_FRAME'],
      contentDensities: ['MINIMAL', 'BALANCED'],
      graphicAccents: ['GEOMETRIC_SHAPE', 'DOT_CLUSTER', 'NONE'],
    },
  },

  'pixel-art': {
    id: 'pixel-art',
    name: 'Pixel Art',
    essence: 'Own the pixel grid as the unit of drawing.',
    fitsBrands: 'Gaming, tech communities, nostalgic brands, web culture, developer products.',
    surface: 'either',
    radius: 0,
    typeRatio: 1.25,
    borders: '1 to 2 pixel borders, stepped, never smoothed.',
    shadows: 'A 1-pixel offset shadow in an indexed colour.',
    layout:
      'Everything snaps to a visible pixel grid. Stepped edges, no smooth curves. Frontal, symmetrical compositions.',
    color:
      'The charter palette reduced to 6–10 indexed tones. Gradients rendered by dithering, never by a fade.',
    typography:
      'Bitmap type or a very crisp sans-serif at small sizes for eyebrows, balanced by a sharp headline in the brand typeface.',
    devices: 'Dithering, stepped borders, 1-pixel shadows, repeated patterns, 16x16 icons.',
    imagery: 'Pixel art scenes only, no photography.',
    imagePromptModifier:
      'pixel art illustration, strict pixel grid, limited indexed color palette, dithering for gradients, hard aliased edges, 16-bit era game aesthetic, no anti-aliasing, crisp retro sprite work',
    imageNegativePrompt:
      'anti-aliasing, smooth gradients, photorealistic, blurry, high resolution photography, soft shadows, vector curves',
    antiPatterns:
      'An image smoothed or resized off the grid: the pixels go blurry and the effect is lost.',
    bans: [
      'No smoothed curve, no anti-aliasing.',
      'The palette is limited to 10 indexed tones at most.',
    ],
    tailwindRecipe:
      'page: \'p-[12mm] bg-[BACKGROUND]\' with everything snapped to a 4px grid. sectionTitle: \'font-primary text-[32px] font-bold uppercase tracking-[0.06em] text-[TEXT]\'. body: \'font-secondary text-[11px] leading-[1.6] text-[TEXT]\'. rule: \'h-[4px] bg-[TEXT]\'. dataBlock: table with \'border-[2px] border-[TEXT]\' cells, no radius anywhere. kpi: \'font-primary text-[64px] tabular-nums text-[PRIMARY]\' with a 2px offset TEXT shadow. caption: \'text-[9px] uppercase tracking-[0.16em]\'. emphasis: a 4px checkerboard built with repeating-linear-gradient. Every dimension is a multiple of 4px; no rounded corner, no blur.',
    typePairings: ['Archivo + IBM Plex Sans', 'Chivo + Public Sans', 'Big Shoulders Display + Work Sans'],
    seedSpace: {
      archetypes: ['C', 'D', 'G', 'L'],
      colorStrategies: ['DUOTONE', 'MONOCHROME_ACCENT', 'BRAND_FULL'],
      typographyMoods: ['CONDENSED_TOWER', 'STAGGERED_INDENT', 'WEIGHT_CLASH'],
      layoutTensions: ['RULE_HEAVY', 'FRAME_WITHIN_FRAME', 'CORNER_ANCHOR', 'FULL_BLEED_EDGE'],
      contentDensities: ['MINIMAL', 'BALANCED'],
      graphicAccents: ['PATTERN_STRIP', 'DOT_CLUSTER', 'BORDER_ACCENT'],
    },
  },

  editorial: {
    id: 'editorial',
    name: 'Editorial',
    essence: 'The page layout of a high-end magazine: columns, hierarchy, breathing room.',
    fitsBrands:
      'Consulting, media, culture, real estate, higher education, brands with a lot to say.',
    surface: 'light',
    radius: 0,
    typeRatio: 1.5,
    borders: 'Hairline rules separating columns and sections. No card borders.',
    shadows: 'None. A magazine page has no drop shadow.',
    layout:
      'A strict column grid (3 to 6), separating rules, a standfirst set large, running text in justified columns, images either full width or in an inset aligned to the grid. Visible section numbering.',
    color:
      'Light ground, text in the charter text colour, primary colour reserved for section titles and rules. Colour punctuates, it does not fill.',
    typography:
      'A rich hierarchy: eyebrow in spaced capitals, headline set very large, standfirst, running text, captions, folio. A drop cap is allowed. An 8x scale ratio between headline and caption.',
    devices:
      'Hairline rules, folios, oversized section numbers, captions aligned under images, pull quotes.',
    imagery:
      'Documentary photography, real subjects, wide framing, black and white or restrained colour, always captioned.',
    imagePromptModifier:
      'editorial magazine photography, documentary style, natural available light, real people in real environments, restrained color grading, medium format look, generous composition with room for captions, timeless and refined',
    imageNegativePrompt:
      'stock corporate photo, staged handshake, glossy advertising, oversaturated, heavy vignette, artificial studio look',
    antiPatterns:
      'One single text size from top to bottom, or images without captions: the page stops being editorial.',
    bans: [
      'No rounded card with a shadow.',
      'Every image carries a caption.',
      'Never one single text size across the whole page.',
    ],
    tailwindRecipe:
      'page: \'p-[15mm] bg-[BACKGROUND]\' on a 6-column grid. sectionNumber: \'font-primary text-[72px] leading-none text-[TEXT]/12\' in the margin. sectionTitle: \'font-primary text-[40px] leading-[1.05] tracking-[-0.015em] text-[TEXT]\'. standfirst: \'font-secondary text-[14px] leading-[1.6] text-[TEXT]/75 max-w-[52ch]\'. body: \'font-secondary text-[10.5px] leading-[1.72] text-[TEXT]/90 columns-2 gap-[8mm] max-w-none\'. rule: \'h-px bg-[TEXT]/15\'. dataBlock: table with \'border-t border-b border-[TEXT]/20\', head row \'uppercase text-[9px] tracking-[0.16em] text-[TEXT]/50\', numbers \'tabular-nums text-right\'. kpi: \'font-primary text-[60px] leading-none\' with a caption under it. pullQuote: \'font-primary text-[22px] leading-[1.35] border-l-0 pl-0 text-[PRIMARY]\'. caption: \'text-[9px] text-[TEXT]/50\' under every figure. Colour appears only in the section title and one rule.',
    typePairings: ['Playfair Display + Source Serif 4', 'Instrument Serif + Work Sans', 'Newsreader + Public Sans'],
    seedSpace: {
      archetypes: ['A', 'C', 'G', 'K', 'L'],
      colorStrategies: ['MONOCHROME_ACCENT', 'DUOTONE', 'IMAGE_EXTRACTED'],
      typographyMoods: ['WEIGHT_CLASH', 'STAGGERED_INDENT', 'WIDE_WHISPER', 'SINGLE_LETTER_ANCHOR'],
      layoutTensions: ['RULE_HEAVY', 'NEGATIVE_SPACE_HERO', 'FRAME_WITHIN_FRAME', 'TEXT_ESCAPES_BOUNDS'],
      contentDensities: ['EDITORIAL', 'TYPE_HEAVY', 'BALANCED'],
      graphicAccents: ['THICK_UNDERLINE', 'OVERSIZED_PUNCTUATION', 'NONE', 'BORDER_ACCENT'],
    },
  },

  y2k: {
    id: 'y2k',
    name: 'Y2K',
    essence: 'The aesthetic of the turn of the 2000s: chrome, bubbles, digital optimism.',
    fitsBrands: 'Young fashion, music, social apps, niche brands, Gen Z campaigns.',
    surface: 'either',
    radius: 28,
    typeRatio: 1.414,
    borders: 'Bulging glass frames, doubled glossy outlines.',
    shadows: 'Iridescent reflections and halos rather than shadows.',
    layout:
      'Floating elements with no apparent grid, bubble shapes, stars and sparkles, playful overlaps.',
    color:
      'Charter colours pushed towards gloss, chrome gradients, iridescent halos, bluish or lilac grounds.',
    typography: 'Stretched glossy sans-serif, outline and bevel effects, curved text.',
    devices: 'Liquid chrome, bubbles, four-pointed stars, iridescent reflections, bulging glass frames.',
    imagery: 'Chromed 3D renders, floating objects, lens effects, flares.',
    imagePromptModifier:
      'Y2K aesthetic, liquid chrome 3D objects, iridescent holographic gradients, glossy bubble shapes, lens flares, early-2000s digital optimism, glossy reflective surfaces, playful floating composition',
    imageNegativePrompt:
      'matte, flat design, muted earth tones, minimal swiss layout, documentary photography, serious corporate',
    antiPatterns:
      'Using Y2K for an institutional brand: the style carries an irony that undermines seriousness.',
    bans: [
      'Never for an institutional brand: the style carries an irony that undermines credibility.',
      'No matte surface.',
    ],
    tailwindRecipe:
      'page: \'p-[13mm] bg-[BACKGROUND] rounded-[28px]\'. sectionTitle: \'font-primary text-[44px] font-bold tracking-[-0.02em]\' with a chrome gradient fill. body: \'font-secondary text-[11px] leading-[1.6] text-[TEXT]/85\'. surface: \'bg-white/40 border border-white/60 rounded-[28px] p-6\'. rule: \'h-[2px] bg-gradient-to-r from-[PRIMARY] to-[ACCENT] rounded-full\'. dataBlock: a glossy bubble table with a 28px radius. kpi: \'font-primary text-[64px]\' in a bubble. caption: \'text-[9px] text-[TEXT]/60\'. emphasis: an iridescent halo. Never matte.',
    typePairings: ['Unbounded + Figtree', 'Syne + Hanken Grotesk', 'Sora + Instrument Sans'],
    seedSpace: {
      archetypes: ['B', 'F', 'H', 'J'],
      colorStrategies: ['BRAND_FULL', 'SPLIT_COMPLEMENTARY', 'IMAGE_EXTRACTED'],
      typographyMoods: ['OUTLINE_FILLED_MIX', 'ROTATED_AXIS', 'SINGLE_LETTER_ANCHOR', 'WIDE_WHISPER'],
      layoutTensions: ['COLLAGE_LAYER', 'DIAGONAL_FLOW', 'TEXT_ESCAPES_BOUNDS'],
      contentDensities: ['MINIMAL', 'BALANCED'],
      graphicAccents: ['GRADIENT_WASH', 'DOT_CLUSTER', 'GEOMETRIC_SHAPE'],
    },
  },

  swiss: {
    id: 'swiss',
    name: 'Swiss Design',
    essence: 'Information organised by the grid: objectivity, rigour, no decoration.',
    fitsBrands:
      'Institutions, industry, B2B, transport, education, scholarly culture, engineering brands.',
    surface: 'light',
    radius: 0,
    typeRatio: 1.25,
    borders: 'Structural rules 3 to 6px thick, aligned to the grid and visible.',
    shadows: 'None. Ever.',
    layout:
      'A visible modular grid, merciless alignment, everything flush left or ragged right. Rectangular blocks, no organic shapes. Calculated asymmetric margins.',
    color:
      'Black, white and ONE charter colour as a solid flat. The red of the classic style is replaced by the brand primary.',
    typography:
      'Neo-grotesque sans-serif, two weights at most, tightly controlled body text, tight leading, no decorative capitals. Typography IS the graphic design.',
    devices:
      'Thick rules (3 to 6px), oversized numbers, tables, sober diagrams, text rotated 90° in the margin.',
    imagery:
      'Black and white photography, cropped inside a rectangle of the grid, never cut out or rounded.',
    imagePromptModifier:
      'swiss international style photography, black and white or single accent color, strict rectangular framing, objective documentary subject, even lighting, no decorative elements, high clarity, graphic and structural composition',
    imageNegativePrompt:
      'decorative elements, gradients, rounded corners, soft focus, warm nostalgic filter, cluttered composition',
    antiPatterns:
      'Adding rounding, shadows or a second colour: Swiss design does not survive decoration.',
    bans: [
      'No rounding, no shadow, no gradient.',
      'One accent colour only, the brand primary.',
      'No centring: everything is flush left.',
    ],
    tailwindRecipe:
      'page: \'p-[15mm] bg-[BACKGROUND]\' on a strict 12-column grid, everything flush left. sectionNumber: \'font-primary text-[16px] tabular-nums text-[PRIMARY]\' above the title. sectionTitle: \'font-primary text-[34px] font-medium leading-[1.1] tracking-[-0.01em] text-[TEXT]\'. body: \'font-secondary text-[10.5px] leading-[1.55] text-[TEXT] max-w-[58ch]\'. rule: \'h-[4px] bg-[TEXT]\' as a structural separator, spanning full columns. dataBlock: table with \'border-t-[3px] border-[TEXT]\' on the head and \'border-b border-[TEXT]/20\' on rows, numbers \'tabular-nums text-right\'. kpi: \'font-primary text-[72px] leading-none tabular-nums text-[TEXT]\' with the label in \'text-[10px] uppercase tracking-[0.16em]\'. caption: \'text-[9px] text-[TEXT]/60\'. emphasis: PRIMARY on ONE element per page. No radius, no shadow, no centring, ever.',
    typePairings: ['Archivo + IBM Plex Sans', 'Schibsted Grotesk + Public Sans', 'Hanken Grotesk + Libre Franklin'],
    seedSpace: {
      archetypes: ['A', 'C', 'D', 'G', 'L'],
      colorStrategies: ['MONOCHROME_ACCENT', 'DUOTONE', 'INVERSE'],
      typographyMoods: ['CONDENSED_TOWER', 'WEIGHT_CLASH', 'STAGGERED_INDENT', 'ROTATED_AXIS'],
      layoutTensions: ['RULE_HEAVY', 'NEGATIVE_SPACE_HERO', 'CORNER_ANCHOR', 'FULL_BLEED_EDGE'],
      contentDensities: ['BALANCED', 'EDITORIAL', 'TYPE_HEAVY'],
      graphicAccents: ['BORDER_ACCENT', 'THICK_UNDERLINE', 'NONE'],
    },
  },

  surreal: {
    id: 'surreal',
    name: 'Surrealism',
    essence: 'Combine impossible elements to produce one memorable image.',
    fitsBrands:
      'Creative brands, agencies, fragrance, awareness campaigns, culture, brands that want to be remembered.',
    surface: 'either',
    radius: 0,
    typeRatio: 1.618,
    borders: 'None: the image carries the composition alone.',
    shadows: 'Long coherent cast shadows, which is what makes the impossible believable.',
    layout:
      'One strong central image fills the composition, the text stays minimal and sits in the void. Deliberately false scale (a giant object, a tiny figure).',
    color:
      'Sky and ground in charter colours, subjects in contrast. A reduced palette so the strangeness is not buried under noise.',
    typography:
      'Sober, discreet typography: the image carries the idea, the text must not compete with it.',
    devices:
      'Long cast shadows, empty horizons, levitating objects, doors and windows in the void, impossible repetitions.',
    imagery:
      'A photograph or photoreal render of an impossible scene, with coherent lighting that makes it credible.',
    imagePromptModifier:
      'surrealist photographic scene, impossible juxtaposition of scale, single strong central subject, clean empty horizon, long dramatic shadows, coherent believable lighting, dreamlike but photoreal, minimal palette',
    imageNegativePrompt:
      'busy collage, multiple competing ideas, cartoon illustration, low quality composite, cluttered scene',
    antiPatterns:
      'Piling up oddities: one impossible idea per image, otherwise the effect turns decorative.',
    bans: [
      'One impossible idea per image, no more.',
      'Typography never competes with the image.',
    ],
    tailwindRecipe:
      'page: \'p-[16mm] bg-[BACKGROUND]\' with one dominant image zone and a lot of emptiness. sectionTitle: \'font-primary text-[30px] font-normal tracking-[0.02em] text-[TEXT]\' — deliberately quiet. body: \'font-secondary text-[11px] leading-[1.75] text-[TEXT]/80 max-w-[48ch]\'. rule: none. dataBlock: a minimal table, \'text-[10px] leading-[2]\', no borders. kpi: \'font-primary text-[64px] leading-none\' isolated in empty space. caption: \'text-[9px] text-[TEXT]/45\'. emphasis: scale and emptiness, never colour. The typography must never compete with the image.',
    typePairings: ['Instrument Serif + Work Sans', 'Gloock + Karla', 'Newsreader + Figtree'],
    seedSpace: {
      archetypes: ['B', 'C', 'E', 'F'],
      colorStrategies: ['DUOTONE', 'MONOCHROME_ACCENT', 'IMAGE_EXTRACTED'],
      typographyMoods: ['WIDE_WHISPER', 'ALL_LOWERCASE_INTIMATE', 'WEIGHT_CLASH'],
      layoutTensions: ['NEGATIVE_SPACE_HERO', 'FULL_BLEED_EDGE', 'CORNER_ANCHOR', 'TEXT_ESCAPES_BOUNDS'],
      contentDensities: ['MINIMAL', 'BALANCED'],
      graphicAccents: ['NONE', 'OVERSIZED_PUNCTUATION', 'GEOMETRIC_SHAPE'],
    },
  },

  bohemian: {
    id: 'bohemian',
    name: 'Bohemian',
    essence: 'Natural materials, earthy tones, visible handwork.',
    fitsBrands:
      'Wellness, craft, natural cosmetics, hospitality, local food, ethical fashion.',
    surface: 'light',
    radius: 40,
    typeRatio: 1.414,
    borders: 'Irregular hand-drawn rules, arches and pebble shapes used as frames.',
    shadows: 'Cast plant shadows and raking light, never a geometric shadow.',
    layout:
      'Supple compositions, soft alignments, organic shapes (arches, pebbles). Generous but warm space, never clinical.',
    color:
      'The charter palette pulled towards earthy, powdery tones, applied as wide matte flats. Soft contrasts.',
    typography:
      'Humanist serif or soft sans-serif for headlines, very readable running text, one handwritten word allowed as an accent.',
    devices:
      'Arches, pebble shapes, linen and paper textures, botanical line motifs, irregular rules.',
    imagery:
      'Photography in raking natural light, materials (wood, linen, terracotta), hands at work, cast plant shadows.',
    imagePromptModifier:
      'natural bohemian lifestyle photography, warm earthy tones, raw natural materials like linen wood and clay, soft directional natural window light, organic plant shadows, artisanal handmade feel, film photography warmth',
    imageNegativePrompt:
      'neon colors, hard studio flash, digital gradients, plastic materials, clinical white background, high saturation',
    antiPatterns:
      'Saturated colour or hard studio light: the style rests entirely on the softness of the light.',
    bans: [
      'No hard studio light: the style rests on soft light.',
      'No saturated cool colour.',
    ],
    tailwindRecipe:
      'page: \'p-[15mm] bg-[BACKGROUND]\'. sectionTitle: \'font-primary text-[36px] leading-[1.15] text-[TEXT]\'. body: \'font-secondary text-[11px] leading-[1.75] text-[TEXT]/80 max-w-[58ch]\'. surface: an arch, \'rounded-t-[999px] rounded-b-[40px] bg-[PRIMARY]/10 p-6\'. rule: \'h-px bg-[TEXT]/20\'. dataBlock: a borderless table with generous line height, \'leading-[2.1]\'. kpi: \'font-primary text-[52px] text-[PRIMARY]\'. caption: \'text-[9px] italic text-[TEXT]/55\'. emphasis: a warm tinted ground behind the block. Soft light everywhere, no hard geometry.',
    typePairings: ['Fraunces + Karla', 'Young Serif + Work Sans', 'Bitter + Figtree'],
    seedSpace: {
      archetypes: ['A', 'B', 'E', 'K'],
      colorStrategies: ['MONOCHROME_ACCENT', 'DUOTONE', 'IMAGE_EXTRACTED'],
      typographyMoods: ['ALL_LOWERCASE_INTIMATE', 'WIDE_WHISPER', 'STAGGERED_INDENT'],
      layoutTensions: ['NEGATIVE_SPACE_HERO', 'FRAME_WITHIN_FRAME', 'CORNER_ANCHOR', 'FULL_BLEED_EDGE'],
      contentDensities: ['BALANCED', 'MINIMAL', 'EDITORIAL'],
      graphicAccents: ['PATTERN_STRIP', 'NONE', 'THICK_UNDERLINE'],
    },
  },

  victorian: {
    id: 'victorian',
    name: 'Victorian',
    essence: 'Nineteenth-century engraved ornament: symmetry, frames, decorative density.',
    fitsBrands: 'Spirits, apothecary, jewellery, heritage hospitality, legacy brands.',
    surface: 'dark',
    radius: 4,
    typeRatio: 1.5,
    borders: 'Double rules and ornate frames, worked corners.',
    shadows: 'No modern shadow: relief comes from the line engraving.',
    layout:
      'Strict axial symmetry, cartouche composition, ornate framing, centred hierarchy. Everything is ordered around a vertical axis.',
    color:
      'A deep ground (the darkened charter secondary) or cream, ornaments in a single charter colour, often given a metallic feel through a very tight gradient.',
    typography:
      'Serif with pronounced serifs, capitals, typographic ornaments, many scale changes inside the same centred block.',
    devices: 'Double rules, ornamental corners, garlands, line engravings, monograms, framing.',
    imagery:
      'Line engravings, botanical illustration, aged paper textures, high-contrast photography treated in sepia.',
    imagePromptModifier:
      'victorian engraved illustration style, fine line etching, ornamental symmetrical frame, botanical engraving detail, aged paper texture, single ink color, apothecary label aesthetic, intricate but legible',
    imageNegativePrompt:
      'modern minimal, flat design, sans-serif typography, asymmetric layout, neon colors, digital gradient',
    antiPatterns:
      'Asymmetric ornament or contemporary typography: the style depends on symmetry and serifs.',
    bans: [
      'No asymmetry: the composition is axial.',
      'No sans-serif typeface for headlines.',
    ],
    tailwindRecipe:
      'page: \'p-[15mm] bg-[TEXT] text-[BACKGROUND]\' with an inner \'border border-[PRIMARY]/50 p-[8mm]\' frame, everything centred on a vertical axis. sectionTitle: \'font-primary text-[38px] uppercase tracking-[0.12em] text-[PRIMARY] text-center\'. body: \'font-secondary text-[10.5px] leading-[1.75] text-[BACKGROUND]/85 text-center max-w-[54ch] mx-auto\'. rule: a double rule, \'h-px bg-[PRIMARY]\' over \'h-[2px] bg-[PRIMARY] mt-1\', centred and narrower than the column. dataBlock: a centred table with fine PRIMARY rules. kpi: \'font-primary text-[56px] text-[PRIMARY]\'. caption: \'text-[9px] italic tracking-[0.1em]\'. emphasis: an ornamental frame. Strict axial symmetry, no sans-serif heading.',
    typePairings: ['Playfair Display + Spectral', 'Libre Baskerville + Crimson Pro', 'Gloock + Lora'],
    seedSpace: {
      archetypes: ['E', 'G', 'J', 'K'],
      colorStrategies: ['MONOCHROME_ACCENT', 'DUOTONE'],
      typographyMoods: ['WEIGHT_CLASH', 'WIDE_WHISPER', 'OUTLINE_FILLED_MIX'],
      layoutTensions: ['FRAME_WITHIN_FRAME', 'RULE_HEAVY', 'NEGATIVE_SPACE_HERO'],
      contentDensities: ['BALANCED', 'EDITORIAL'],
      graphicAccents: ['PATTERN_STRIP', 'OVERSIZED_PUNCTUATION', 'BORDER_ACCENT'],
    },
  },

  graffiti: {
    id: 'graffiti',
    name: 'Graffiti',
    essence: 'Street energy: spray, stencil, layering, gesture.',
    fitsBrands: 'Urban sport, streetwear, music, youth events, activist brands.',
    surface: 'dark',
    radius: 0,
    typeRatio: 1.618,
    borders: 'Doubled stencil outlines, spray-painted markings.',
    shadows: 'Hard offset shadow, like sprayed lettering in relief.',
    layout:
      'Dynamic diagonal composition, elements running off the edge, accidental overlaps, text at wall scale.',
    color:
      'Charter colours as sprayed flats with overspray and drips. Textured ground (concrete, metal). Maximum contrast.',
    typography:
      'Very heavy, slanted lettering, doubled outlines, stencil effect. The headline is a painted object, not text placed on a surface.',
    devices: 'Drips, overspray, stencils, stickers, wall textures, ground markings.',
    imagery: 'Raw urban photography, direct flash, heavy grain, motion.',
    imagePromptModifier:
      'street art photography, raw urban concrete texture, spray paint drips and stencil marks, direct flash, high grain, gritty authentic city environment, bold graphic energy, high contrast',
    imageNegativePrompt:
      'clean white background, corporate stock, soft pastel, minimal swiss layout, studio product shot',
    antiPatterns: 'A "clean" graffiti on a white ground: the style lives off the texture of its support.',
    bans: [
      'The ground always carries a support texture (concrete, metal, pasted paper).',
      'No "clean" graffiti placed on a smooth flat.',
    ],
    tailwindRecipe:
      'page: \'p-[12mm] bg-[TEXT] text-[BACKGROUND]\' over a concrete texture. sectionTitle: \'font-primary text-[56px] font-black uppercase italic leading-[0.92] text-[BACKGROUND]\' with a hard offset shadow in ACCENT. body: \'font-secondary text-[11px] leading-[1.55] text-[BACKGROUND]/80\'. rule: \'h-[6px] bg-[ACCENT] -rotate-1\'. dataBlock: table on \'bg-[BACKGROUND]/8\' with \'border-b border-[BACKGROUND]/20\' rows. kpi: \'font-primary text-[88px] leading-none text-[ACCENT]\' running off the edge. caption: \'text-[9px] uppercase tracking-[0.2em] text-[BACKGROUND]/50\'. emphasis: a stencil block. The ground always carries a texture.',
    typePairings: ['Anton + Work Sans', 'Archivo Black + Karla', 'Big Shoulders Display + Figtree'],
    seedSpace: {
      archetypes: ['B', 'C', 'F', 'H'],
      colorStrategies: ['BRAND_FULL', 'DUOTONE', 'IMAGE_EXTRACTED', 'INVERSE'],
      typographyMoods: ['CONDENSED_TOWER', 'OUTLINE_FILLED_MIX', 'ROTATED_AXIS', 'SINGLE_LETTER_ANCHOR'],
      layoutTensions: ['TEXT_ESCAPES_BOUNDS', 'DIAGONAL_FLOW', 'COLLAGE_LAYER', 'FULL_BLEED_EDGE'],
      contentDensities: ['MINIMAL', 'BALANCED', 'TYPE_HEAVY'],
      graphicAccents: ['GEOMETRIC_SHAPE', 'PATTERN_STRIP', 'OVERSIZED_PUNCTUATION'],
    },
  },

  aurora: {
    id: 'aurora',
    name: 'Aurora',
    essence: 'Veils of graded coloured light, soft and enveloping.',
    fitsBrands: 'AI, digital wellbeing, premium SaaS, mental health, calming brands.',
    surface: 'dark',
    radius: 20,
    typeRatio: 1.414,
    borders: 'No hard border: zones separate through light.',
    shadows: 'Wide diffuse halos, never a crisp drop shadow.',
    layout:
      'The ground is entirely occupied by veils of light, content placed centred or low, very airy. Few elements, a lot of light.',
    color:
      'Wide soft gradients between the charter colours, on a dark or very light ground. No hard edge between colours.',
    typography:
      'Thin to medium sans-serif, large sizes, open tracking, text always in strong contrast with the veil behind it.',
    devices: 'Light veils, wide gaussian blurs, a light grain to avoid banding, halos.',
    imagery: 'Luminous abstractions, never a sharp photographic subject.',
    imagePromptModifier:
      'aurora gradient abstraction, soft flowing veils of light, wide smooth color transitions, subtle film grain to avoid banding, deep background, ethereal and calm, high resolution, no hard edges, no visible subject',
    imageNegativePrompt:
      'hard edges, banding, flat solid background, sharp geometric shapes, photographic subject, high contrast blacks',
    antiPatterns:
      'Banded gradients, or thin text placed on the brightest part of the veil.',
    bans: [
      'No hard edge between two colours.',
      'A light grain is mandatory to avoid gradient banding.',
      'No thin text on the brightest zone.',
    ],
    tailwindRecipe:
      'page: \'p-[16mm] bg-[TEXT] text-[BACKGROUND]\' with wide soft light veils built from \'radial-gradient\' at low opacity, plus a light grain overlay to avoid banding. sectionTitle: \'font-primary text-[38px] font-light tracking-[0.01em] text-[BACKGROUND]\'. body: \'font-secondary text-[11px] leading-[1.8] text-[BACKGROUND]/75 max-w-[54ch]\'. rule: none — zones separate through light. dataBlock: a borderless table, \'leading-[2]\', numbers \'tabular-nums\'. kpi: \'font-primary text-[64px] font-light text-[BACKGROUND]\'. caption: \'text-[9px] text-[BACKGROUND]/45\'. emphasis: raise the light behind the block. No text below 14px over the brightest zone.',
    typePairings: ['Hanken Grotesk + Figtree', 'Epilogue + Instrument Sans', 'Onest + Public Sans'],
    seedSpace: {
      archetypes: ['B', 'E', 'F', 'I'],
      colorStrategies: ['MONOCHROME_ACCENT', 'BRAND_FULL', 'DUOTONE'],
      typographyMoods: ['WIDE_WHISPER', 'WEIGHT_CLASH', 'ALL_LOWERCASE_INTIMATE'],
      layoutTensions: ['NEGATIVE_SPACE_HERO', 'FULL_BLEED_EDGE', 'CORNER_ANCHOR'],
      contentDensities: ['MINIMAL', 'BALANCED'],
      graphicAccents: ['GRADIENT_WASH', 'NONE', 'GEOMETRIC_SHAPE'],
    },
  },

  handwritten: {
    id: 'handwritten',
    name: 'Handwritten',
    essence: 'The trace of the hand: notes, sketches, annotations, deliberate imperfection.',
    fitsBrands: 'Education, coaching, craft, restaurants, personal brands, associations.',
    surface: 'light',
    radius: 12,
    typeRatio: 1.414,
    borders: 'Hand-drawn strokes, irregular underlines, sketched frames.',
    shadows: 'Light shadows of laid paper, tape and lifted corners.',
    layout:
      'A notebook structure: margins, ruled lines, annotations in the margin, arrows linking blocks. Deliberately imperfect alignment.',
    color:
      'Paper ground (the charter background), ink in the charter text colour, highlighting in the accent. Two ink colours at most.',
    typography:
      'One handwritten or strongly italic headline, balanced by a very readable running text in the brand typeface. Never everything handwritten.',
    devices:
      'Drawn underlines, annotation circles, arrows, crossings-out, sticky notes, tape, line sketches.',
    imagery: 'Line sketches, photographs of notebooks and writing hands, paper textures.',
    imagePromptModifier:
      'hand-drawn sketch aesthetic, ink on textured paper, visible pen strokes and imperfections, notebook and annotation feel, warm paper tone, single ink color with one highlight color, authentic handmade look',
    imageNegativePrompt:
      'polished vector, perfect symmetry, glossy digital render, neon colors, corporate stock photo',
    antiPatterns:
      'Setting a whole paragraph in handwriting: illegible. Handwriting accents, it does not carry running text.',
    bans: [
      'Never a whole paragraph in handwriting.',
      'Two ink colours at most.',
    ],
    tailwindRecipe:
      'page: \'p-[15mm] bg-[BACKGROUND]\' with a ruled left margin, \'border-l border-[ACCENT]/40 pl-[10mm]\'. sectionTitle: \'font-primary text-[34px] italic text-[TEXT]\' with a hand-drawn underline built from an irregular SVG-free div, \'h-[3px] bg-[ACCENT] w-[70%] -rotate-[0.6deg]\'. body: \'font-secondary text-[11px] leading-[1.75] text-[TEXT]/85\' — the running text is NEVER handwritten. rule: \'h-px bg-[TEXT]/20\'. dataBlock: a notebook table with light ruled lines. kpi: \'font-primary text-[52px] text-[TEXT]\' circled by a \'rounded-[50%] border-2 border-[ACCENT] px-4 py-2 -rotate-2\'. caption: \'text-[9px] italic text-[TEXT]/55\' set as a margin annotation. emphasis: a highlighter stroke in ACCENT at 35% opacity. Two ink colours maximum.',
    typePairings: ['Young Serif + Karla', 'Fraunces + Work Sans', 'Bricolage Grotesque + Atkinson Hyperlegible'],
    seedSpace: {
      archetypes: ['A', 'C', 'G', 'K'],
      colorStrategies: ['MONOCHROME_ACCENT', 'DUOTONE', 'IMAGE_EXTRACTED'],
      typographyMoods: ['ALL_LOWERCASE_INTIMATE', 'STAGGERED_INDENT', 'SINGLE_LETTER_ANCHOR'],
      layoutTensions: ['COLLAGE_LAYER', 'FRAME_WITHIN_FRAME', 'CORNER_ANCHOR', 'RULE_HEAVY'],
      contentDensities: ['EDITORIAL', 'BALANCED'],
      graphicAccents: ['THICK_UNDERLINE', 'OVERSIZED_PUNCTUATION', 'DOT_CLUSTER'],
    },
  },
};

/** Liste des identifiants, pour la validation d'une sortie de modèle. */
export const ART_DIRECTION_STYLE_IDS = Object.keys(ART_DIRECTION_STYLES) as ArtDirectionStyleId[];

/**
 * Catalogue condensé injecté dans le prompt de sélection : identifiant, nom,
 * essence et type de marque. Assez pour choisir, pas assez pour noyer le prompt
 * (la fiche complète du style retenu est injectée ensuite).
 */
export function buildStyleCatalogBrief(): string {
  return ART_DIRECTION_STYLE_IDS.map((id) => {
    const s = ART_DIRECTION_STYLES[id];
    return `- ${s.id} — ${s.name}: ${s.essence} Fits: ${s.fitsBrands}`;
  }).join('\n');
}

/** Fiche complète d'un style, telle qu'injectée dans les prompts de génération. */
export function buildStyleSheet(id: ArtDirectionStyleId): string {
  const s = ART_DIRECTION_STYLES[id];
  if (!s) return '';
  const surface =
    s.surface === 'dark'
      ? 'dark ground, mandatory'
      : s.surface === 'light'
        ? 'light ground, mandatory'
        : 'light or dark, but only one per deliverable';
  return [
    `Style: ${s.name} (${s.id})`,
    `Essence: ${s.essence}`,
    `Surface: ${surface}`,
    `Composition: ${s.layout}`,
    `Colour: ${s.color}`,
    `Typography: ${s.typography} Type scale ratio: ${s.typeRatio} between two consecutive levels.`,
    `Border radius: ${s.radius}px on EVERY element (no exception, never a mix of radii).`,
    `Rules and borders: ${s.borders}`,
    `Shadows: ${s.shadows}`,
    `Graphic devices: ${s.devices}`,
    `Imagery: ${s.imagery}`,
    // Le vocabulaire de composants est ce qui empêche le modèle d'inventer une
    // carte, un badge ou un liseré à chaque bloc : il assemble des primitives
    // données au lieu de bricoler de la décoration.
    `Component vocabulary — use THESE exact classes, replacing PRIMARY / TEXT / BACKGROUND / ACCENT with the charter hex values. Do not invent another block type:\n${s.tailwindRecipe}`,
    `Typography that serves this style (if the brand has no typeface yet): ${s.typePairings.join(' · ')}`,
    `Style-specific bans: ${s.bans.join(' ')}`,
    `Amateur execution to avoid: ${s.antiPatterns}`,
  ].join('\n');
}

/** Style du catalogue, ou repli éditorial si l'identifiant est inconnu/absent. */
export function resolveStyle(id?: string | null): ArtDirectionStyle {
  const known = (id || '') as ArtDirectionStyleId;
  return ART_DIRECTION_STYLES[known] || ART_DIRECTION_STYLES.editorial;
}

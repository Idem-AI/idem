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
 *
 * Les pages, visuels et cartes ne lisent PAS ces fiches : le moteur graphique (@idem/graphic-engine) porte
 * sa propre table des mêmes styles (`STYLE_DATA` : rayon, ratio, fond, espace de choix). `check:design`
 * vérifie que les deux tables parlent des mêmes styles, avec les mêmes rayons, ratios et fonds.
 */

import { ArtDirectionStyleId } from '../brand/art-direction.model';

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
  /** Interdits durs propres au style, en plus des interdits globaux anti-slop. */
  bans: string[];
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
    bans: [
      'No rounded card carrying a drop shadow.',
      'No gradient, anywhere.',
      'Never two focal points in the same composition.',
      'No decorative icon.',
    ],
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
    bans: [
      'Never a composition without a zone of rest: without it, nothing stands out.',
      'No element placed at random: the underlying grid must stay readable.',
    ],
  },

  futuristic: {
    id: 'futuristic',
    name: 'Futuristic',
    essence: 'Signal technological advance through precision, not through science-fiction clichés.',
    fitsBrands: 'Deeptech, AI, fintech, mobility, energy, telecoms, advanced industry.',
    surface: 'dark',
    radius: 4,
    typeRatio: 1.414,
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
    bans: [
      'No printed circuit, no hexagon, no digital brain: these are the stock clichés.',
      'The ground can never be light.',
      'Colour does not fill large areas, it lights up edges.',
    ],
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
    bans: [
      'Never a photograph in the same composition as an illustration.',
      'No gradients: flat fills only.',
      'One single stroke language for every shape.',
    ],
  },

  'collage-art': {
    id: 'collage-art',
    name: 'Collage',
    essence: 'Assemble heterogeneous fragments so they produce a new meaning.',
    fitsBrands: 'Culture, education, media, social economy, activist brands, craft, festivals.',
    surface: 'light',
    radius: 0,
    typeRatio: 1.5,
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
    bans: [
      'Images stacked without a cut-out and a rotation do not make a collage.',
      'No fading between fragments: the edges stay crisp.',
    ],
  },

  retro: {
    id: 'retro',
    name: 'Retro',
    essence: 'Borrow the graphic grammar of one precise decade (70s, 80s) and stay inside it.',
    fitsBrands: 'Food and beverage, hospitality, craft, music, warm family-facing brands.',
    surface: 'light',
    radius: 24,
    typeRatio: 1.414,
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
    bans: [
      'Never mix two decades: quote one era only.',
      'No saturated cool colours.',
    ],
  },

  cyberpunk: {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    essence: 'The dense nocturnal city: neon, rain, a violent contrast between black and light.',
    fitsBrands: 'Gaming, streaming, crypto, nightlife events, cybersecurity, provocative brands.',
    surface: 'dark',
    radius: 2,
    typeRatio: 1.5,
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
    bans: [
      'The ground can never be light.',
      'Two neon colours at most at the same time.',
      'Without large black areas the neon effect disappears.',
    ],
  },

  'pop-art': {
    id: 'pop-art',
    name: 'Pop Art',
    essence: 'Mass culture treated as an art object: flats, halftones, repetition.',
    fitsBrands: 'Retail, food, young fashion, entertainment, promotional campaigns, joyful brands.',
    surface: 'light',
    radius: 0,
    typeRatio: 1.618,
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
    bans: [
      'Bright colours without a halftone and an outline do not make pop art.',
      'Black is the outline, never the ground.',
    ],
  },

  glassmorphism: {
    id: 'glassmorphism',
    name: 'Glassmorphism',
    essence: 'Frosted glass surfaces floating above a coloured, blurred ground.',
    fitsBrands: 'Fintech, mobile apps, modern SaaS, digital products, elegant tech brands.',
    surface: 'either',
    radius: 24,
    typeRatio: 1.333,
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
    bans: [
      'No text placed directly on the blurred ground: it must rest on a glass surface.',
      'The blurred ground must contain no recognisable subject.',
    ],
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
    bans: [
      'No specular highlight, no metal, no glass.',
      'The ground stays plain and light.',
    ],
  },

  'pixel-art': {
    id: 'pixel-art',
    name: 'Pixel Art',
    essence: 'Own the pixel grid as the unit of drawing.',
    fitsBrands: 'Gaming, tech communities, nostalgic brands, web culture, developer products.',
    surface: 'either',
    radius: 0,
    typeRatio: 1.25,
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
    bans: [
      'No smoothed curve, no anti-aliasing.',
      'The palette is limited to 10 indexed tones at most.',
    ],
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
    bans: [
      'No rounded card with a shadow.',
      'Every image carries a caption.',
      'Never one single text size across the whole page.',
    ],
  },

  y2k: {
    id: 'y2k',
    name: 'Y2K',
    essence: 'The aesthetic of the turn of the 2000s: chrome, bubbles, digital optimism.',
    fitsBrands: 'Young fashion, music, social apps, niche brands, Gen Z campaigns.',
    surface: 'either',
    radius: 28,
    typeRatio: 1.414,
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
    bans: [
      'Never for an institutional brand: the style carries an irony that undermines credibility.',
      'No matte surface.',
    ],
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
    bans: [
      'No rounding, no shadow, no gradient.',
      'One accent colour only, the brand primary.',
      'No centring: everything is flush left.',
    ],
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
    bans: [
      'One impossible idea per image, no more.',
      'Typography never competes with the image.',
    ],
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
    bans: [
      'No hard studio light: the style rests on soft light.',
      'No saturated cool colour.',
    ],
  },

  victorian: {
    id: 'victorian',
    name: 'Victorian',
    essence: 'Nineteenth-century engraved ornament: symmetry, frames, decorative density.',
    fitsBrands: 'Spirits, apothecary, jewellery, heritage hospitality, legacy brands.',
    surface: 'dark',
    radius: 4,
    typeRatio: 1.5,
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
    bans: [
      'No asymmetry: the composition is axial.',
      'No sans-serif typeface for headlines.',
    ],
  },

  graffiti: {
    id: 'graffiti',
    name: 'Graffiti',
    essence: 'Street energy: spray, stencil, layering, gesture.',
    fitsBrands: 'Urban sport, streetwear, music, youth events, activist brands.',
    surface: 'dark',
    radius: 0,
    typeRatio: 1.618,
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
    bans: [
      'The ground always carries a support texture (concrete, metal, pasted paper).',
      'No "clean" graffiti placed on a smooth flat.',
    ],
  },

  aurora: {
    id: 'aurora',
    name: 'Aurora',
    essence: 'Veils of graded coloured light, soft and enveloping.',
    fitsBrands: 'AI, digital wellbeing, premium SaaS, mental health, calming brands.',
    surface: 'dark',
    radius: 20,
    typeRatio: 1.414,
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
    bans: [
      'No hard edge between two colours.',
      'A light grain is mandatory to avoid gradient banding.',
      'No thin text on the brightest zone.',
    ],
  },

  handwritten: {
    id: 'handwritten',
    name: 'Handwritten',
    essence: 'The trace of the hand: notes, sketches, annotations, deliberate imperfection.',
    fitsBrands: 'Education, coaching, craft, restaurants, personal brands, associations.',
    surface: 'light',
    radius: 12,
    typeRatio: 1.414,
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
    bans: [
      'Never a whole paragraph in handwriting.',
      'Two ink colours at most.',
    ],
  },
};

/** Liste des identifiants, pour la validation d'une sortie de modèle. */
export const ART_DIRECTION_STYLE_IDS = Object.keys(ART_DIRECTION_STYLES) as ArtDirectionStyleId[];

/**
 * Identifiants proposés au directeur artistique.
 *
 * Les styles à fond sombre obligatoire en sont écartés : la plateforme est à
 * surface claire (voir `design/lightSurface`), et un style retenu ici impose sa
 * polarité à TOUS les livrables de la marque pour les trois ans qui suivent.
 * Un seul tirage sur « cyberpunk » et la charte, le business plan et le deck
 * sortaient en noir sans que personne ne l'ait demandé.
 */
export const SELECTABLE_ART_DIRECTION_STYLE_IDS = ART_DIRECTION_STYLE_IDS.filter(
  (id) => ART_DIRECTION_STYLES[id].surface !== 'dark'
);

/**
 * Catalogue condensé injecté dans le prompt de sélection : identifiant, nom,
 * essence et type de marque. Assez pour choisir, pas assez pour noyer le prompt
 * (le style retenu est ensuite lu par le moteur graphique, en jetons et en motifs).
 */
export function buildStyleCatalogBrief(): string {
  return SELECTABLE_ART_DIRECTION_STYLE_IDS.map((id) => {
    const s = ART_DIRECTION_STYLES[id];
    return `- ${s.id} — ${s.name}: ${s.essence} Fits: ${s.fitsBrands}`;
  }).join('\n');
}

/** Style du catalogue, ou repli éditorial si l'identifiant est inconnu/absent. */
export function resolveStyle(id?: string | null): ArtDirectionStyle {
  const known = (id || '') as ArtDirectionStyleId;
  return ART_DIRECTION_STYLES[known] || ART_DIRECTION_STYLES.editorial;
}

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
 * Chaque fiche est écrite pour être LUE PAR UN MODÈLE et exécutée telle quelle :
 * des règles opérables (grille, échelle, traitement d'image), pas des adjectifs.
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
  /** Nom affiché (français). */
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
}

export const ART_DIRECTION_STYLES: Record<ArtDirectionStyleId, ArtDirectionStyle> = {
  minimalism: {
    id: 'minimalism',
    name: 'Minimalisme',
    essence:
      "Retirer jusqu'à ce qu'il ne reste que l'essentiel, puis soigner ce qui reste jusqu'à l'obsession.",
    fitsBrands:
      'Marques premium, conseil, santé, finance, tech B2B, luxe discret — tout ce qui vend la confiance et la maîtrise.',
    surface: 'light',
    radius: 0,
    typeRatio: 1.5,
    borders:
      'Un filet de 1px maximum par composition, dans la couleur texte à 15%. Aucune bordure de carte.',
    shadows:
      'Aucune. La profondeur vient de l\'espace, jamais de l\'élévation.',
    imageNegativePrompt:
      'cluttered, busy background, props, heavy shadows, saturated colors, text overlay, watermark, collage, multiple subjects',
    bans: [
      'Aucune carte à coins arrondis avec ombre portée.',
      'Aucun dégradé, nulle part.',
      'Jamais deux points focaux dans la même composition.',
      'Aucune icône décorative.',
    ],
    seedSpace: {
      archetypes: ['A', 'C', 'E', 'L'],
      colorStrategies: ['MONOCHROME_ACCENT', 'DUOTONE', 'INVERSE'],
      typographyMoods: ['WIDE_WHISPER', 'WEIGHT_CLASH', 'ALL_LOWERCASE_INTIMATE', 'STAGGERED_INDENT'],
      layoutTensions: ['NEGATIVE_SPACE_HERO', 'CORNER_ANCHOR', 'FRAME_WITHIN_FRAME'],
      contentDensities: ['MINIMAL', 'BALANCED'],
      graphicAccents: ['NONE', 'THICK_UNDERLINE', 'BORDER_ACCENT'],
    },
    layout:
      "50 à 65% d'espace vide, assumé et non résiduel. Une seule zone occupée par composition, alignée sur une grille stricte de 12 colonnes. Marges généreuses et égales (au moins 8% du plus petit côté). Un seul point focal, jamais deux.",
    color:
      'Un fond neutre dominant (background de la charte), le texte dans la couleur texte, et UNE seule intervention de couleur primaire par composition — un filet, un mot, une forme. Aucun dégradé.',
    typography:
      "Deux niveaux typographiques seulement, séparés par un écart d'au moins 4x. Titre en graisse moyenne, jamais en black. Interlettrage légèrement ouvert sur les capitales (0.08–0.2em). Alignement à gauche par défaut.",
    devices:
      "Filet de 1px, respiration, alignement optique. Aucune ombre, aucun arrondi décoratif, aucun badge, aucune icône décorative.",
    imagery:
      "Photographie sobre, sujet isolé sur fond uni ou dégradé imperceptible, beaucoup d'air autour du sujet. Une image maximum par composition.",
    imagePromptModifier:
      'minimalist commercial photography, single subject isolated on a clean seamless background, abundant negative space, soft even diffused studio light, muted neutral palette, no props, no clutter, sharp focus, editorial product photography, shot on 85mm, subtle natural film grain',
    antiPatterns:
      "Du vide sans intention (marges inégales), du gris partout, une seule taille de texte, ou du « minimalisme » qui n'est que du contenu manquant.",
  },

  maximalism: {
    id: 'maximalism',
    name: 'Maximalisme',
    essence: "Saturer le champ visuel — mais selon une règle, pas au hasard.",
    fitsBrands:
      'Culture, événementiel, mode, food, musique, marques jeunes et expressives, festivals, médias.',
    surface: 'either',
    radius: 8,
    typeRatio: 1.618,
    borders:
      'Cadres épais (6 à 12px) en couleur pleine, utilisés comme éléments de composition.',
    shadows:
      'Ombres franches et décalées (offset dur, pas de flou), en couleur de la charte.',
    imageNegativePrompt:
      'minimal, empty, plain background, muted, washed out, single element, sparse',
    bans: [
      'Jamais de composition sans zone de repos : sans elle, plus rien ne ressort.',
      'Aucun élément posé au hasard : la grille sous-jacente doit rester lisible.',
    ],
    seedSpace: {
      archetypes: ['B', 'C', 'F', 'G', 'H'],
      colorStrategies: ['BRAND_FULL', 'SPLIT_COMPLEMENTARY', 'IMAGE_EXTRACTED'],
      typographyMoods: ['CONDENSED_TOWER', 'OUTLINE_FILLED_MIX', 'SINGLE_LETTER_ANCHOR', 'ROTATED_AXIS'],
      layoutTensions: ['COLLAGE_LAYER', 'TEXT_ESCAPES_BOUNDS', 'FULL_BLEED_EDGE', 'DIAGONAL_FLOW'],
      contentDensities: ['EDITORIAL', 'TYPE_HEAVY'],
      graphicAccents: ['GEOMETRIC_SHAPE', 'PATTERN_STRIP', 'OVERSIZED_PUNCTUATION', 'DOT_CLUSTER'],
    },
    layout:
      "Densité assumée : superpositions, calques, éléments qui débordent des bords. Une structure sous-jacente rigide (grille modulaire) rend le chaos lisible. Toujours UNE zone de repos, sinon rien ne ressort.",
    color:
      "Toutes les couleurs de la charte simultanément, en aplats francs et en grands blocs. Les contrastes sont recherchés, jamais atténués. Les couleurs se touchent sans transition.",
    typography:
      "Mélange d'échelles extrême (10x), textes pivotés, mots découpés par des formes, capitales très grasses en surimpression. Trois niveaux minimum.",
    devices:
      "Motifs répétés, cadres dans le cadre, empilements, textures, formes géométriques pleines qui découpent l'image.",
    imagery:
      "Images multiples, recadrées serré, détourées et superposées. Couleurs poussées, contraste élevé.",
    imagePromptModifier:
      'maximalist editorial art direction, layered composition, bold saturated color blocking, high contrast, busy but structured, pattern-on-pattern, vivid graphic energy, magazine collage feel, crisp detail',
    antiPatterns:
      "Le fouillis : sans grille sous-jacente ni zone de repos, on obtient une page illisible, pas du maximalisme.",
  },

  futuristic: {
    id: 'futuristic',
    name: 'Futuriste',
    essence: "Suggérer l'avance technologique par la précision, pas par les clichés de science-fiction.",
    fitsBrands:
      'Deeptech, IA, fintech, mobilité, énergie, télécoms, industrie de pointe.',
    surface: 'dark',
    radius: 4,
    typeRatio: 1.414,
    borders:
      'Filets de 1px en couleur primaire à pleine intensité, tracés comme des arêtes lumineuses.',
    shadows:
      'Pas d\'ombre portée : des halos (box-shadow diffus, même teinte que l\'objet).',
    imageNegativePrompt:
      'humanoid robot, glowing brain, circuit board background, hexagon grid overlay, blue neon cliché, stock technology, lens flare spam',
    bans: [
      'Aucun circuit imprimé, aucun hexagone, aucun cerveau numérique : ce sont les clichés du stock.',
      'Le fond ne peut pas être clair.',
      'La couleur ne remplit pas de grandes surfaces, elle éclaire des arêtes.',
    ],
    seedSpace: {
      archetypes: ['B', 'F', 'I', 'J', 'L'],
      colorStrategies: ['MONOCHROME_ACCENT', 'DUOTONE', 'INVERSE'],
      typographyMoods: ['CONDENSED_TOWER', 'WIDE_WHISPER', 'WEIGHT_CLASH', 'ROTATED_AXIS'],
      layoutTensions: ['DIAGONAL_FLOW', 'FULL_BLEED_EDGE', 'RULE_HEAVY', 'NEGATIVE_SPACE_HERO'],
      contentDensities: ['MINIMAL', 'BALANCED'],
      graphicAccents: ['GEOMETRIC_SHAPE', 'BORDER_ACCENT', 'PATTERN_STRIP', 'NONE'],
    },
    layout:
      "Composition sur fond sombre, éléments alignés sur une grille visible par endroits. Lignes de fuite, perspectives, formes qui suggèrent le mouvement. Beaucoup de noir profond entre les éléments.",
    color:
      "Fond sombre (couleur secondaire ou texte de la charte assombri), couleur primaire en lumière — traits fins, halos, arêtes. La couleur ne remplit pas, elle éclaire.",
    typography:
      "Sans-serif géométrique ou technique. Capitales espacées pour les surtitres (0.25–0.4em), titres serrés. Chiffres et données mis en scène comme des éléments graphiques.",
    devices:
      "Grilles filaires, courbes de données, arêtes lumineuses, dégradés radiaux discrets, réticules, mesures et annotations techniques.",
    imagery:
      "Rendus techniques, macro de matériaux, lumière rasante bleutée ou dans la primaire. Jamais de robot humanoïde ni de « cerveau digital ».",
    imagePromptModifier:
      'futuristic technology art direction, dark background, precise engineered forms, thin luminous edge lighting, volumetric haze, macro detail of advanced materials, cinematic rim light, ultra sharp, high dynamic range, no sci-fi clichés, no humanoid robots',
    antiPatterns:
      "Le fond bleu avec des circuits imprimés et un hexagone : c'est le cliché du stock, pas une direction artistique.",
  },

  'vector-art': {
    id: 'vector-art',
    name: 'Vector Art',
    essence: "Tout est dessiné : formes pleines, aplats nets, aucune photo.",
    fitsBrands:
      'SaaS, éducation, services publics, santé accessible, applications grand public, ONG.',
    surface: 'light',
    radius: 16,
    typeRatio: 1.333,
    borders:
      'Contours de 2 à 3px de la même couleur que le remplissage assombri, ou aucun contour — jamais un mélange.',
    shadows:
      'Ombre en aplat décalé (même forme, couleur plus sombre), jamais de flou.',
    imageNegativePrompt:
      'photograph, photorealistic, 3d render, gradient mesh, texture, film grain, realistic lighting, drop shadow blur',
    bans: [
      'Jamais de photographie dans la même composition qu\'une illustration.',
      'Aucun dégradé : uniquement des aplats.',
      'Un seul style de trait pour toutes les formes.',
    ],
    seedSpace: {
      archetypes: ['A', 'C', 'J', 'L'],
      colorStrategies: ['BRAND_FULL', 'MONOCHROME_ACCENT'],
      typographyMoods: ['WEIGHT_CLASH', 'ALL_LOWERCASE_INTIMATE', 'STAGGERED_INDENT'],
      layoutTensions: ['CORNER_ANCHOR', 'FULL_BLEED_EDGE', 'NEGATIVE_SPACE_HERO'],
      contentDensities: ['MINIMAL', 'BALANCED'],
      graphicAccents: ['GEOMETRIC_SHAPE', 'DOT_CLUSTER', 'THICK_UNDERLINE'],
    },
    layout:
      "Scènes illustrées occupant 40 à 60% de la composition, personnages ou objets stylisés en aplats. Le texte cohabite avec l'illustration sur la même grille.",
    color:
      "Palette de la charte étendue par des teintes obtenues en opacité, jamais par de nouvelles couleurs. Aplats francs, contours nets, ombres portées en aplat décalé plutôt qu'en flou.",
    typography:
      "Sans-serif géométrique ronde, graisses moyennes à grasses, arrondis cohérents avec les formes illustrées.",
    devices:
      "Formes géométriques primitives, arrondis constants, personnages sans traits de visage détaillés, icônes pleines dessinées dans le même trait.",
    imagery:
      "Illustration vectorielle exclusivement. Aucun mélange photo/illustration dans la même composition.",
    imagePromptModifier:
      'flat vector illustration, clean geometric shapes, solid fills, consistent stroke weight, no gradients, no photographic texture, isometric or front-facing scene, generous flat color blocking, crisp edges, professional UI illustration style',
    antiPatterns:
      "Mélanger une illustration vectorielle avec une photographie, ou empiler des styles d'illustration différents.",
  },

  'collage-art': {
    id: 'collage-art',
    name: 'Collage',
    essence: "Assembler des fragments hétérogènes pour créer un sens nouveau.",
    fitsBrands:
      'Culture, éducation, médias, ESS, marques militantes, artisanat, festivals.',
    surface: 'light',
    radius: 0,
    typeRatio: 1.5,
    borders:
      'Bords de découpe francs (parfois déchirés), jamais de bordure tracée régulière.',
    shadows:
      'Ombres portées courtes et dures sous chaque fragment, pour donner l\'épaisseur du papier.',
    imageNegativePrompt:
      'smooth digital composite, seamless blending, soft edges, gradient background, glossy, 3d render',
    bans: [
      'Des images empilées sans découpe ni rotation ne font pas un collage.',
      'Aucun fondu entre les fragments : les bords restent nets.',
    ],
    seedSpace: {
      archetypes: ['C', 'F', 'H', 'K'],
      colorStrategies: ['DUOTONE', 'IMAGE_EXTRACTED', 'MONOCHROME_ACCENT'],
      typographyMoods: ['OUTLINE_FILLED_MIX', 'STAGGERED_INDENT', 'SINGLE_LETTER_ANCHOR', 'ROTATED_AXIS'],
      layoutTensions: ['COLLAGE_LAYER', 'TEXT_ESCAPES_BOUNDS', 'DIAGONAL_FLOW'],
      contentDensities: ['EDITORIAL', 'BALANCED'],
      graphicAccents: ['OVERSIZED_PUNCTUATION', 'PATTERN_STRIP', 'GEOMETRIC_SHAPE'],
    },
    layout:
      "Fragments découpés (bords francs, ciseaux) posés en superposition, avec des rotations légères (±3 à 8°). Les éléments se chevauchent et sortent du cadre. Une hiérarchie claire malgré le collage.",
    color:
      "Aplats de la charte comme papiers de fond, images en duotone ou noir et blanc pour les unifier, une couleur d'accent en surlignage.",
    typography:
      "Titres composés de mots découpés à des tailles différentes, comme des lettres découpées dans un journal. Un texte courant sobre pour contrebalancer.",
    devices:
      "Bords déchirés, ombres portées franches, adhésif, formes découpées à la main, textures papier, filets tracés.",
    imagery:
      "Photos détourées, recadrées de façon inattendue, mélangées à des aplats et à des textures papier.",
    imagePromptModifier:
      'paper collage art direction, cut-out photographic fragments with visible torn and scissor edges, layered paper textures, halftone print texture, mixed media, tactile analogue feel, subtle drop shadows between layers, scanned paper grain',
    antiPatterns:
      "Des images simplement empilées sans découpe ni rotation : c'est une superposition, pas un collage.",
  },

  retro: {
    id: 'retro',
    name: 'Rétro',
    essence: "Emprunter la grammaire graphique d'une décennie précise (70s, 80s) et s'y tenir.",
    fitsBrands:
      'Food & beverage, hospitalité, artisanat, musique, marques chaleureuses et familiales.',
    surface: 'light',
    radius: 24,
    typeRatio: 1.414,
    borders:
      'Cadres arrondis épais et cartouches, filets doubles.',
    shadows:
      'Ombre typographique dure et décalée, aucune ombre floue.',
    imageNegativePrompt:
      'modern minimal, clean digital, cool blue tones, sharp clinical lighting, contemporary sans-serif',
    bans: [
      'Ne jamais mélanger deux décennies : une seule époque citée.',
      'Aucune couleur froide saturée.',
    ],
    seedSpace: {
      archetypes: ['B', 'G', 'J', 'K'],
      colorStrategies: ['BRAND_FULL', 'DUOTONE', 'MONOCHROME_ACCENT'],
      typographyMoods: ['CONDENSED_TOWER', 'WEIGHT_CLASH', 'OUTLINE_FILLED_MIX'],
      layoutTensions: ['FRAME_WITHIN_FRAME', 'FULL_BLEED_EDGE', 'CORNER_ANCHOR'],
      contentDensities: ['MINIMAL', 'BALANCED'],
      graphicAccents: ['PATTERN_STRIP', 'THICK_UNDERLINE', 'GEOMETRIC_SHAPE'],
    },
    layout:
      "Compositions centrées ou symétriques, cadres et cartouches, bandes horizontales. Badge/écusson comme élément de composition central.",
    color:
      "Palette de la charte désaturée d'un cran et réchauffée, appliquée en larges bandes. Dégradés en bandes discrètes plutôt qu'en fondus.",
    typography:
      "Serif grasse ou sans-serif arrondie des années 70, lettrage courbé, ombres portées typographiques dures, texte dans des formes.",
    devices:
      "Soleils levants en bandes, arcs, cadres arrondis, grain d'impression, trames offset, coins arrondis généreux.",
    imagery:
      "Photographie au grain marqué, couleurs légèrement passées, halos lumineux, comme un tirage argentique.",
    imagePromptModifier:
      'retro 1970s commercial photography, warm faded film stock, visible grain, slightly washed halation, sunburst warm tones, vintage print texture, nostalgic art direction, analog camera look',
    antiPatterns:
      "Mélanger plusieurs décennies (70s + 90s) : le rétro n'est crédible que s'il cite une seule époque.",
  },

  cyberpunk: {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    essence: "La ville dense et nocturne : néon, pluie, contraste violent entre noir et lumière.",
    fitsBrands:
      'Gaming, streaming, crypto, événementiel nocturne, cybersécurité, marques provocantes.',
    surface: 'dark',
    radius: 2,
    typeRatio: 1.5,
    borders:
      'Filets techniques de 1px, coins coupés, réticules aux angles.',
    shadows:
      'Halos néon (text-shadow / box-shadow colorés), jamais d\'ombre grise.',
    imageNegativePrompt:
      'daylight, pastel colors, white background, soft warm lighting, minimal empty scene, corporate stock photo',
    bans: [
      'Le fond ne peut pas être clair.',
      'Deux couleurs néon maximum en simultané.',
      'Sans grandes zones de noir, l\'effet néon disparaît.',
    ],
    seedSpace: {
      archetypes: ['B', 'F', 'I', 'L'],
      colorStrategies: ['MONOCHROME_ACCENT', 'DUOTONE', 'INVERSE'],
      typographyMoods: ['CONDENSED_TOWER', 'ROTATED_AXIS', 'OUTLINE_FILLED_MIX', 'WEIGHT_CLASH'],
      layoutTensions: ['FULL_BLEED_EDGE', 'DIAGONAL_FLOW', 'COLLAGE_LAYER', 'RULE_HEAVY'],
      contentDensities: ['MINIMAL', 'BALANCED', 'TYPE_HEAVY'],
      graphicAccents: ['BORDER_ACCENT', 'PATTERN_STRIP', 'GEOMETRIC_SHAPE'],
    },
    layout:
      "Fond très sombre, éléments alignés à gauche ou empilés en couches. Textes en surimpression sur des blocs opaques. Beaucoup de contraste entre zones vides et zones saturées d'information.",
    color:
      "Noir profond dominant, couleur primaire et accent utilisées comme des néons (halos, text-shadow), jamais en aplat pastel. Deux couleurs vives maximum en simultané.",
    typography:
      "Sans-serif condensée en capitales, glitch typographique parcimonieux, surtitres monospace, chiffres et codes comme éléments décoratifs.",
    devices:
      "Halos lumineux, lignes de scan, décalages chromatiques légers, cadres techniques, texte vertical le long des bords.",
    imagery:
      "Photographie nocturne urbaine, reflets mouillés, contre-jour néon, silhouettes.",
    imagePromptModifier:
      'cyberpunk night photography, rain-slick reflective surfaces, neon rim lighting, deep blacks with two dominant neon hues, volumetric fog, urban night scene, cinematic anamorphic look, high contrast, moody',
    antiPatterns:
      "Le néon appliqué partout : sans grandes zones de noir, l'effet disparaît et le texte devient illisible.",
  },

  'pop-art': {
    id: 'pop-art',
    name: 'Pop Art',
    essence: "La culture de masse traitée comme un objet d'art : aplats, trames, répétition.",
    fitsBrands:
      'Retail, food, mode jeune, divertissement, campagnes promotionnelles, marques joyeuses.',
    surface: 'light',
    radius: 0,
    typeRatio: 1.618,
    borders:
      'Contours noirs épais (4 à 8px) autour des formes et des cadres.',
    shadows:
      'Aucune ombre : la profondeur vient du contour et de la trame.',
    imageNegativePrompt:
      'muted colors, soft gradient, photorealistic skin, subtle lighting, minimal white space, blurry',
    bans: [
      'Des couleurs vives sans trame ni contour ne font pas du pop art.',
      'Le noir sert de contour, jamais de fond.',
    ],
    seedSpace: {
      archetypes: ['B', 'C', 'H', 'K'],
      colorStrategies: ['BRAND_FULL', 'DUOTONE', 'SPLIT_COMPLEMENTARY'],
      typographyMoods: ['WEIGHT_CLASH', 'SINGLE_LETTER_ANCHOR', 'OUTLINE_FILLED_MIX', 'CONDENSED_TOWER'],
      layoutTensions: ['RULE_HEAVY', 'FULL_BLEED_EDGE', 'FRAME_WITHIN_FRAME', 'COLLAGE_LAYER'],
      contentDensities: ['MINIMAL', 'BALANCED'],
      graphicAccents: ['GEOMETRIC_SHAPE', 'PATTERN_STRIP', 'OVERSIZED_PUNCTUATION'],
    },
    layout:
      "Grille de panneaux répétés, cadres épais (4 à 8px), sujets détourés posés sur aplats. Composition frontale et lisible d'un coup d'œil.",
    color:
      "Couleurs de la charte en aplats purs et saturés, juxtaposées sans transition. Le noir sert de contour, jamais de fond.",
    typography:
      "Capitales très grasses, phylactères, onomatopées, texte inscrit dans des formes pleines.",
    devices:
      "Trames de points (halftone), contours noirs épais, rayons partant du centre, répétition du même sujet en variantes de couleur.",
    imagery:
      "Portraits ou produits détourés, postérisés, traités en 2 à 3 tons avec trame de points.",
    imagePromptModifier:
      'pop art treatment, bold halftone dot texture, posterized two-tone subject, thick black outlines, flat saturated color blocking, comic book print feel, high contrast screen print aesthetic',
    antiPatterns:
      "Des couleurs vives sans trame ni contour : c'est du « coloré », pas du pop art.",
  },

  glassmorphism: {
    id: 'glassmorphism',
    name: 'Glassmorphism',
    essence: "Des surfaces de verre dépoli flottant au-dessus d'un fond coloré et flou.",
    fitsBrands:
      'Fintech, applications mobiles, SaaS moderne, produits digitaux, marques tech élégantes.',
    surface: 'either',
    radius: 24,
    typeRatio: 1.333,
    borders:
      'Filet de 1px blanc à 20% sur le bord haut des surfaces de verre.',
    shadows:
      'Ombres très diffuses et colorées, jamais noires.',
    imageNegativePrompt:
      'flat design, hard edges, opaque solid background, harsh shadows, sharp corners, photographic subject in background',
    bans: [
      'Aucun texte posé directement sur le fond flou : il doit reposer sur une surface de verre.',
      'Le fond flou ne doit contenir aucun sujet reconnaissable.',
    ],
    seedSpace: {
      archetypes: ['B', 'E', 'F', 'J'],
      colorStrategies: ['MONOCHROME_ACCENT', 'BRAND_FULL', 'DUOTONE'],
      typographyMoods: ['WEIGHT_CLASH', 'WIDE_WHISPER', 'ALL_LOWERCASE_INTIMATE'],
      layoutTensions: ['COLLAGE_LAYER', 'NEGATIVE_SPACE_HERO', 'FRAME_WITHIN_FRAME', 'CORNER_ANCHOR'],
      contentDensities: ['MINIMAL', 'BALANCED'],
      graphicAccents: ['GRADIENT_WASH', 'GEOMETRIC_SHAPE', 'NONE'],
    },
    layout:
      "Cartes translucides superposées à un arrière-plan coloré et flouté. Hiérarchie donnée par la profondeur (flou + opacité), pas par la taille seule. Coins arrondis constants et généreux.",
    color:
      "Arrière-plan composé de larges taches des couleurs de la charte, fortement floutées. Les cartes reprennent la couleur de fond à 10–20% d'opacité, bordées d'un filet blanc à 20%.",
    typography:
      "Sans-serif neutre, graisses moyennes, textes toujours posés sur une surface de verre pour rester lisibles — jamais directement sur le fond flou.",
    devices:
      "Flou d'arrière-plan, bordures lumineuses de 1px, ombres portées très diffuses, reflets légers en haut des cartes.",
    imagery:
      "Formes abstraites floutées, dégradés de maille, aucun sujet photographique net en arrière-plan.",
    imagePromptModifier:
      'abstract soft gradient mesh background, large blurred color blobs, frosted glass surfaces, subtle light refraction, translucent layered panels, soft diffuse shadows, clean modern digital product aesthetic',
    antiPatterns:
      "Du texte posé sur un fond flou sans carte de verre : la lisibilité s'effondre et l'effet paraît raté.",
  },

  clay: {
    id: 'clay',
    name: 'Clay 3D',
    essence: "Des volumes mats, arrondis et tactiles, comme modelés dans de la pâte.",
    fitsBrands:
      'Applications grand public, éducation, enfance, santé douce, services accessibles, onboarding.',
    surface: 'light',
    radius: 32,
    typeRatio: 1.333,
    borders:
      'Aucune bordure : les volumes se détachent par l\'ombre douce.',
    shadows:
      'Occlusion ambiante douce au sol, aucune ombre dure.',
    imageNegativePrompt:
      'glossy, metallic, specular highlights, reflective, sharp edges, realistic materials, hard shadows, dark background',
    bans: [
      'Aucun reflet spéculaire, aucun métal, aucun verre.',
      'Le fond reste uni et clair.',
    ],
    seedSpace: {
      archetypes: ['A', 'B', 'E', 'J'],
      colorStrategies: ['MONOCHROME_ACCENT', 'BRAND_FULL'],
      typographyMoods: ['WEIGHT_CLASH', 'ALL_LOWERCASE_INTIMATE', 'WIDE_WHISPER'],
      layoutTensions: ['NEGATIVE_SPACE_HERO', 'CORNER_ANCHOR', 'FRAME_WITHIN_FRAME'],
      contentDensities: ['MINIMAL', 'BALANCED'],
      graphicAccents: ['GEOMETRIC_SHAPE', 'DOT_CLUSTER', 'NONE'],
    },
    layout:
      "Objets 3D isolés au centre ou en trois-quarts, posés sur un fond uni de la charte. Beaucoup d'air autour du volume. Ombres douces au sol.",
    color:
      "Fond en couleur de charte désaturée, volumes dans les couleurs primaires/accent en version mate. Aucune couleur métallique, aucun reflet spéculaire dur.",
    typography:
      "Sans-serif ronde et grasse, coins doux, alignée avec la douceur des volumes.",
    devices:
      "Arrondis très prononcés, ombres douces multi-directionnelles, absence totale de reflets, matière mate uniforme.",
    imagery:
      "Rendus 3D en argile ou plasticine, éclairage studio doux, objets simplifiés.",
    imagePromptModifier:
      '3D clay render, soft matte plasticine material, rounded chunky shapes, soft studio lighting with gentle ambient occlusion, pastel background, no specular highlights, playful tactile toy-like objects, octane render quality',
    antiPatterns:
      "Un rendu 3D brillant ou métallique : le clay perd tout son sens dès qu'il réfléchit la lumière.",
  },

  'pixel-art': {
    id: 'pixel-art',
    name: 'Pixel Art',
    essence: "Assumer la grille de pixels comme unité de dessin.",
    fitsBrands:
      'Gaming, communautés tech, marques nostalgiques, culture web, produits développeurs.',
    surface: 'either',
    radius: 0,
    typeRatio: 1.25,
    borders:
      'Bordures d\'1 à 2 pixels, en escalier, jamais lissées.',
    shadows:
      'Ombre à 1 pixel décalé, en couleur indexée.',
    imageNegativePrompt:
      'anti-aliasing, smooth gradients, photorealistic, blurry, high resolution photography, soft shadows, vector curves',
    bans: [
      'Aucune courbe lissée, aucun anticrénelage.',
      'Palette limitée à 10 teintes indexées maximum.',
    ],
    seedSpace: {
      archetypes: ['C', 'D', 'G', 'L'],
      colorStrategies: ['DUOTONE', 'MONOCHROME_ACCENT', 'BRAND_FULL'],
      typographyMoods: ['CONDENSED_TOWER', 'STAGGERED_INDENT', 'WEIGHT_CLASH'],
      layoutTensions: ['RULE_HEAVY', 'FRAME_WITHIN_FRAME', 'CORNER_ANCHOR', 'FULL_BLEED_EDGE'],
      contentDensities: ['MINIMAL', 'BALANCED'],
      graphicAccents: ['PATTERN_STRIP', 'DOT_CLUSTER', 'BORDER_ACCENT'],
    },
    layout:
      "Tout est aligné sur une grille de pixels visible. Bordures en escalier, aucune courbe lisse. Compositions frontales et symétriques.",
    color:
      "Palette de la charte réduite à 6–10 teintes indexées. Dégradés rendus par tramage (dithering), jamais par fondu.",
    typography:
      "Police bitmap ou sans-serif très nette en petites tailles pour les surtitres, contrebalancée par un titre net dans la police de la marque.",
    devices:
      "Tramage, bordures en escalier, ombres à 1 pixel, motifs répétés, icônes 16x16.",
    imagery:
      "Scènes en pixel art, aucune photographie.",
    imagePromptModifier:
      'pixel art illustration, strict pixel grid, limited indexed color palette, dithering for gradients, hard aliased edges, 16-bit era game aesthetic, no anti-aliasing, crisp retro sprite work',
    antiPatterns:
      "Une image lissée ou redimensionnée sans respecter la grille : les pixels deviennent flous et l'effet est perdu.",
  },

  editorial: {
    id: 'editorial',
    name: 'Éditorial',
    essence: "La mise en page d'un magazine haut de gamme : colonnes, hiérarchie, respiration.",
    fitsBrands:
      'Conseil, médias, culture, immobilier, éducation supérieure, marques qui ont beaucoup à dire.',
    surface: 'light',
    radius: 0,
    typeRatio: 1.5,
    borders:
      'Filets fins (1px) comme séparateurs de colonnes et de sections. Aucune bordure de carte.',
    shadows:
      'Aucune. Une page de magazine n\'a pas d\'ombre portée.',
    imageNegativePrompt:
      'stock corporate photo, staged handshake, glossy advertising, oversaturated, heavy vignette, artificial studio look',
    bans: [
      'Aucune carte arrondie avec ombre.',
      'Toute image porte une légende.',
      'Jamais une seule taille de texte sur toute la page.',
    ],
    seedSpace: {
      archetypes: ['A', 'C', 'G', 'K', 'L'],
      colorStrategies: ['MONOCHROME_ACCENT', 'DUOTONE', 'IMAGE_EXTRACTED'],
      typographyMoods: ['WEIGHT_CLASH', 'STAGGERED_INDENT', 'WIDE_WHISPER', 'SINGLE_LETTER_ANCHOR'],
      layoutTensions: ['RULE_HEAVY', 'NEGATIVE_SPACE_HERO', 'FRAME_WITHIN_FRAME', 'TEXT_ESCAPES_BOUNDS'],
      contentDensities: ['EDITORIAL', 'TYPE_HEAVY', 'BALANCED'],
      graphicAccents: ['THICK_UNDERLINE', 'OVERSIZED_PUNCTUATION', 'NONE', 'BORDER_ACCENT'],
    },
    layout:
      "Grille de colonnes stricte (3 à 6), filets de séparation, chapeau en gros corps, texte en colonnes justifiées, images pleine largeur ou en encart aligné sur la grille. Numérotation de section apparente.",
    color:
      "Fond clair, texte dans la couleur texte, couleur primaire réservée aux titres de section et aux filets. La couleur ponctue, elle ne remplit pas.",
    typography:
      "Hiérarchie riche : surtitre en capitales espacées, titre en très gros corps, chapeau, texte courant, légendes, folio. Lettrine possible. Contraste d'échelle 8x entre titre et légende.",
    devices:
      "Filets fins, folios, numéros de section surdimensionnés, légendes alignées sous les images, citations mises en exergue.",
    imagery:
      "Photographie documentaire, sujets réels, cadrages larges, noir et blanc ou couleurs sobres, toujours légendée.",
    imagePromptModifier:
      'editorial magazine photography, documentary style, natural available light, real people in real environments, restrained color grading, medium format look, generous composition with room for captions, timeless and refined',
    antiPatterns:
      "Une seule taille de texte du haut en bas de la page, ou des images sans légende : la page cesse d'être éditoriale.",
  },

  y2k: {
    id: 'y2k',
    name: 'Y2K',
    essence: "L'esthétique du tournant des années 2000 : chrome, bulles, optimisme numérique.",
    fitsBrands:
      'Mode jeune, musique, applications sociales, marques de niche, campagnes ciblant la Gen Z.',
    surface: 'either',
    radius: 28,
    typeRatio: 1.414,
    borders:
      'Cadres en verre bombé, contours brillants doublés.',
    shadows:
      'Reflets et halos irisés plutôt que des ombres.',
    imageNegativePrompt:
      'matte, flat design, muted earth tones, minimal swiss layout, documentary photography, serious corporate',
    bans: [
      'Jamais pour une marque institutionnelle : le style porte une ironie qui décrédibilise.',
      'Aucune surface mate.',
    ],
    seedSpace: {
      archetypes: ['B', 'F', 'H', 'J'],
      colorStrategies: ['BRAND_FULL', 'SPLIT_COMPLEMENTARY', 'IMAGE_EXTRACTED'],
      typographyMoods: ['OUTLINE_FILLED_MIX', 'ROTATED_AXIS', 'SINGLE_LETTER_ANCHOR', 'WIDE_WHISPER'],
      layoutTensions: ['COLLAGE_LAYER', 'DIAGONAL_FLOW', 'TEXT_ESCAPES_BOUNDS'],
      contentDensities: ['MINIMAL', 'BALANCED'],
      graphicAccents: ['GRADIENT_WASH', 'DOT_CLUSTER', 'GEOMETRIC_SHAPE'],
    },
    layout:
      "Éléments flottants sans grille apparente, formes en bulle, étoiles et scintillements, superpositions ludiques.",
    color:
      "Couleurs de la charte poussées vers le brillant, dégradés chromés, halos irisés, fonds bleutés ou lilas.",
    typography:
      "Sans-serif étirée et brillante, effets de contour et de biseau, texte incurvé.",
    devices:
      "Chrome liquide, bulles, étoiles à quatre branches, reflets irisés, cadres en verre bombé.",
    imagery:
      "Rendus 3D chromés, objets flottants, effets de lentille, flares.",
    imagePromptModifier:
      'Y2K aesthetic, liquid chrome 3D objects, iridescent holographic gradients, glossy bubble shapes, lens flares, early-2000s digital optimism, glossy reflective surfaces, playful floating composition',
    antiPatterns:
      "Utiliser le Y2K pour une marque institutionnelle : le style porte une ironie qui décrédibilise le sérieux.",
  },

  swiss: {
    id: 'swiss',
    name: 'Design Suisse',
    essence: "L'information organisée par la grille : objectivité, rigueur, aucune décoration.",
    fitsBrands:
      'Institutions, industrie, B2B, transport, éducation, culture savante, marques d\'ingénierie.',
    surface: 'light',
    radius: 0,
    typeRatio: 1.25,
    borders:
      'Filets structurels de 3 à 6px, alignés sur la grille et visibles.',
    shadows:
      'Aucune. Jamais.',
    imageNegativePrompt:
      'decorative elements, gradients, rounded corners, soft focus, warm nostalgic filter, cluttered composition',
    bans: [
      'Aucun arrondi, aucune ombre, aucun dégradé.',
      'Une seule couleur d\'accent, celle de la marque.',
      'Aucun centrage : tout est en drapeau à gauche.',
    ],
    seedSpace: {
      archetypes: ['A', 'C', 'D', 'G', 'L'],
      colorStrategies: ['MONOCHROME_ACCENT', 'DUOTONE', 'INVERSE'],
      typographyMoods: ['CONDENSED_TOWER', 'WEIGHT_CLASH', 'STAGGERED_INDENT', 'ROTATED_AXIS'],
      layoutTensions: ['RULE_HEAVY', 'NEGATIVE_SPACE_HERO', 'CORNER_ANCHOR', 'FULL_BLEED_EDGE'],
      contentDensities: ['BALANCED', 'EDITORIAL', 'TYPE_HEAVY'],
      graphicAccents: ['BORDER_ACCENT', 'THICK_UNDERLINE', 'NONE'],
    },
    layout:
      "Grille modulaire visible, alignements impitoyables, tout à gauche ou en drapeau. Blocs rectangulaires, aucune forme organique. Marges asymétriques calculées.",
    color:
      "Noir, blanc et UNE couleur de la charte en aplat franc. Le rouge du style est remplacé par la primaire de la marque.",
    typography:
      "Sans-serif néo-grotesque, deux graisses maximum, corps de texte très maîtrisé, interlignage serré, aucune capitale décorative. La typographie EST le graphisme.",
    devices:
      "Filets épais (3 à 6px), numéros surdimensionnés, tableaux, diagrammes sobres, texte pivoté à 90° en marge.",
    imagery:
      "Photographie noir et blanc, cadrée dans un rectangle de la grille, jamais détourée ni arrondie.",
    imagePromptModifier:
      'swiss international style photography, black and white or single accent color, strict rectangular framing, objective documentary subject, even lighting, no decorative elements, high clarity, graphic and structural composition',
    antiPatterns:
      "Ajouter des arrondis, des ombres ou une deuxième couleur : le style suisse ne survit pas à la décoration.",
  },

  surreal: {
    id: 'surreal',
    name: 'Surréalisme',
    essence: "Associer des éléments impossibles pour créer une image mémorable.",
    fitsBrands:
      'Marques créatives, agences, parfums, campagnes de notoriété, culture, marques qui veulent marquer les esprits.',
    surface: 'either',
    radius: 0,
    typeRatio: 1.618,
    borders:
      'Aucune : l\'image porte seule la composition.',
    shadows:
      'Ombres portées longues et cohérentes, qui rendent l\'impossible crédible.',
    imageNegativePrompt:
      'busy collage, multiple competing ideas, cartoon illustration, low quality composite, cluttered scene',
    bans: [
      'Une seule idée impossible par image.',
      'La typographie ne rivalise jamais avec l\'image.',
    ],
    seedSpace: {
      archetypes: ['B', 'C', 'E', 'F'],
      colorStrategies: ['DUOTONE', 'MONOCHROME_ACCENT', 'IMAGE_EXTRACTED'],
      typographyMoods: ['WIDE_WHISPER', 'ALL_LOWERCASE_INTIMATE', 'WEIGHT_CLASH'],
      layoutTensions: ['NEGATIVE_SPACE_HERO', 'FULL_BLEED_EDGE', 'CORNER_ANCHOR', 'TEXT_ESCAPES_BOUNDS'],
      contentDensities: ['MINIMAL', 'BALANCED'],
      graphicAccents: ['NONE', 'OVERSIZED_PUNCTUATION', 'GEOMETRIC_SHAPE'],
    },
    layout:
      "Une image centrale forte occupe la composition, le texte reste minimal et posé dans le vide. Échelles délibérément fausses (objet géant, personnage minuscule).",
    color:
      "Ciel et fond en couleur de charte, sujets en contraste. Palette réduite pour ne pas ajouter du bruit à l'étrangeté.",
    typography:
      "Typographie sobre et discrète : l'image porte l'idée, le texte ne doit pas rivaliser.",
    devices:
      "Ombres portées longues, horizons dégagés, objets en lévitation, portes et fenêtres dans le vide, répétitions impossibles.",
    imagery:
      "Photographie ou rendu photoréaliste d'une scène impossible, lumière cohérente qui rend l'impossible crédible.",
    imagePromptModifier:
      'surrealist photographic scene, impossible juxtaposition of scale, single strong central subject, clean empty horizon, long dramatic shadows, coherent believable lighting, dreamlike but photoreal, minimal palette',
    antiPatterns:
      "Accumuler les bizarreries : une seule idée impossible par image, sinon l'effet devient décoratif.",
  },

  bohemian: {
    id: 'bohemian',
    name: 'Bohème',
    essence: "Matières naturelles, tons terreux, gestes faits main.",
    fitsBrands:
      'Bien-être, artisanat, cosmétique naturelle, hospitalité, agroalimentaire local, mode éthique.',
    surface: 'light',
    radius: 40,
    typeRatio: 1.414,
    borders:
      'Filets irréguliers tracés à la main, arches et formes de galets en guise de cadres.',
    shadows:
      'Ombres végétales portées et lumière rasante, jamais d\'ombre géométrique.',
    imageNegativePrompt:
      'neon colors, hard studio flash, digital gradients, plastic materials, clinical white background, high saturation',
    bans: [
      'Aucune lumière studio dure : le style repose sur la douceur de la lumière.',
      'Aucune couleur saturée froide.',
    ],
    seedSpace: {
      archetypes: ['A', 'B', 'E', 'K'],
      colorStrategies: ['MONOCHROME_ACCENT', 'DUOTONE', 'IMAGE_EXTRACTED'],
      typographyMoods: ['ALL_LOWERCASE_INTIMATE', 'WIDE_WHISPER', 'STAGGERED_INDENT'],
      layoutTensions: ['NEGATIVE_SPACE_HERO', 'FRAME_WITHIN_FRAME', 'CORNER_ANCHOR', 'FULL_BLEED_EDGE'],
      contentDensities: ['BALANCED', 'MINIMAL', 'EDITORIAL'],
      graphicAccents: ['PATTERN_STRIP', 'NONE', 'THICK_UNDERLINE'],
    },
    layout:
      "Compositions souples, alignements doux, formes organiques (arches, galets). Espace généreux mais chaleureux, jamais clinique.",
    color:
      "Palette de la charge ramenée vers des tons terreux et poudrés, appliquée en larges aplats mats. Contrastes doux.",
    typography:
      "Serif humaniste ou sans-serif douce pour les titres, texte courant très lisible, un mot manuscrit possible en accent.",
    devices:
      "Arches, formes de galets, textures de lin et de papier, motifs botaniques dessinés au trait, filets irréguliers.",
    imagery:
      "Photographie en lumière naturelle rasante, matières (bois, lin, terre cuite), mains au travail, ombres portées végétales.",
    imagePromptModifier:
      'natural bohemian lifestyle photography, warm earthy tones, raw natural materials like linen wood and clay, soft directional natural window light, organic plant shadows, artisanal handmade feel, film photography warmth',
    antiPatterns:
      "Des couleurs saturées ou une lumière studio dure : le style repose entièrement sur la douceur de la lumière.",
  },

  victorian: {
    id: 'victorian',
    name: 'Style Victorien',
    essence: "L'ornement gravé du XIXᵉ siècle : symétrie, cadres, densité décorative.",
    fitsBrands:
      'Spiritueux, apothicaire, joaillerie, hospitalité patrimoniale, marques d\'héritage.',
    surface: 'dark',
    radius: 4,
    typeRatio: 1.5,
    borders:
      'Filets doubles et encadrements ornés, coins travaillés.',
    shadows:
      'Aucune ombre moderne : l\'effet de relief vient de la gravure au trait.',
    imageNegativePrompt:
      'modern minimal, flat design, sans-serif typography, asymmetric layout, neon colors, digital gradient',
    bans: [
      'Aucune asymétrie : la composition est axiale.',
      'Aucune typographie sans empattement pour les titres.',
    ],
    seedSpace: {
      archetypes: ['E', 'G', 'J', 'K'],
      colorStrategies: ['MONOCHROME_ACCENT', 'DUOTONE'],
      typographyMoods: ['WEIGHT_CLASH', 'WIDE_WHISPER', 'OUTLINE_FILLED_MIX'],
      layoutTensions: ['FRAME_WITHIN_FRAME', 'RULE_HEAVY', 'NEGATIVE_SPACE_HERO'],
      contentDensities: ['BALANCED', 'EDITORIAL'],
      graphicAccents: ['PATTERN_STRIP', 'OVERSIZED_PUNCTUATION', 'BORDER_ACCENT'],
    },
    layout:
      "Symétrie axiale stricte, composition en cartouche, encadrements ornés, hiérarchie centrée. Tout est ordonné autour d'un axe vertical.",
    color:
      "Fond profond (couleur secondaire foncée) ou crème, ornements dans une seule couleur de la charte, souvent en version métallique simulée par un dégradé très serré.",
    typography:
      "Serif à empattements marqués, capitales, ornements typographiques, variations d'échelle nombreuses au sein du même bloc centré.",
    devices:
      "Filets doubles, coins ornementés, guirlandes, gravures au trait, monogrammes, encadrements.",
    imagery:
      "Gravures au trait, illustrations botaniques, textures de papier ancien, photographie très contrastée traitée en sépia.",
    imagePromptModifier:
      'victorian engraved illustration style, fine line etching, ornamental symmetrical frame, botanical engraving detail, aged paper texture, single ink color, apothecary label aesthetic, intricate but legible',
    antiPatterns:
      "Un ornement asymétrique ou une typographie contemporaine : la crédibilité du style tient à la symétrie et aux empattements.",
  },

  graffiti: {
    id: 'graffiti',
    name: 'Graffiti',
    essence: "L'énergie de la rue : bombe, pochoir, superposition, geste.",
    fitsBrands:
      'Sport urbain, streetwear, musique, événements jeunes, marques militantes.',
    surface: 'dark',
    radius: 0,
    typeRatio: 1.618,
    borders:
      'Contours doublés au pochoir, marquages tracés à la bombe.',
    shadows:
      'Ombre portée dure et décalée, comme un lettrage bombé en relief.',
    imageNegativePrompt:
      'clean white background, corporate stock, soft pastel, minimal swiss layout, studio product shot',
    bans: [
      'Le fond porte toujours une texture de support (béton, métal, papier collé).',
      'Aucun graffiti « propre » posé sur un aplat lisse.',
    ],
    seedSpace: {
      archetypes: ['B', 'C', 'F', 'H'],
      colorStrategies: ['BRAND_FULL', 'DUOTONE', 'IMAGE_EXTRACTED', 'INVERSE'],
      typographyMoods: ['CONDENSED_TOWER', 'OUTLINE_FILLED_MIX', 'ROTATED_AXIS', 'SINGLE_LETTER_ANCHOR'],
      layoutTensions: ['TEXT_ESCAPES_BOUNDS', 'DIAGONAL_FLOW', 'COLLAGE_LAYER', 'FULL_BLEED_EDGE'],
      contentDensities: ['MINIMAL', 'BALANCED', 'TYPE_HEAVY'],
      graphicAccents: ['GEOMETRIC_SHAPE', 'PATTERN_STRIP', 'OVERSIZED_PUNCTUATION'],
    },
    layout:
      "Composition dynamique en diagonale, éléments qui débordent, superpositions accidentelles, texte à l'échelle du mur.",
    color:
      "Couleurs de la charte en aplats bombés avec débords et coulures. Fond texturé (béton, métal). Contraste maximal.",
    typography:
      "Lettrage très gras, incliné, contours doublés, effet pochoir. Le titre est un objet peint, pas un texte posé.",
    devices:
      "Coulures, projections, pochoirs, adhésifs, textures de mur, marquages au sol.",
    imagery:
      "Photographie urbaine brute, flash direct, grain élevé, mouvement.",
    imagePromptModifier:
      'street art photography, raw urban concrete texture, spray paint drips and stencil marks, direct flash, high grain, gritty authentic city environment, bold graphic energy, high contrast',
    antiPatterns:
      "Un graffiti « propre » posé sur un fond blanc : le style vit de la texture du support.",
  },

  aurora: {
    id: 'aurora',
    name: 'Aurora',
    essence: "Des voiles de lumière colorée en dégradé, doux et enveloppants.",
    fitsBrands:
      'IA, bien-être digital, produits SaaS haut de gamme, santé mentale, marques apaisantes.',
    surface: 'dark',
    radius: 20,
    typeRatio: 1.414,
    borders:
      'Aucune bordure franche : les zones se séparent par la lumière.',
    shadows:
      'Halos larges et diffus, jamais d\'ombre portée nette.',
    imageNegativePrompt:
      'hard edges, banding, flat solid background, sharp geometric shapes, photographic subject, high contrast blacks',
    bans: [
      'Aucune arête franche entre deux couleurs.',
      'Un grain léger est obligatoire pour éviter les bandes de dégradé.',
      'Aucun texte fin sur la zone la plus lumineuse.',
    ],
    seedSpace: {
      archetypes: ['B', 'E', 'F', 'I'],
      colorStrategies: ['MONOCHROME_ACCENT', 'BRAND_FULL', 'DUOTONE'],
      typographyMoods: ['WIDE_WHISPER', 'WEIGHT_CLASH', 'ALL_LOWERCASE_INTIMATE'],
      layoutTensions: ['NEGATIVE_SPACE_HERO', 'FULL_BLEED_EDGE', 'CORNER_ANCHOR'],
      contentDensities: ['MINIMAL', 'BALANCED'],
      graphicAccents: ['GRADIENT_WASH', 'NONE', 'GEOMETRIC_SHAPE'],
    },
    layout:
      "Fond entièrement occupé par des voiles lumineux, contenu posé au centre ou en bas, très aéré. Peu d'éléments, beaucoup de lumière.",
    color:
      "Dégradés larges et doux entre les couleurs de la charte, sur fond sombre ou très clair. Aucune arête franche entre les couleurs.",
    typography:
      "Sans-serif fine à moyenne, grandes tailles, interlettrage ouvert, texte toujours en contraste fort avec le voile derrière lui.",
    devices:
      "Voiles de lumière, flous gaussiens larges, grain léger pour éviter les bandes de dégradé, halos.",
    imagery:
      "Abstractions lumineuses, aucune photographie de sujet net.",
    imagePromptModifier:
      'aurora gradient abstraction, soft flowing veils of light, wide smooth color transitions, subtle film grain to avoid banding, deep background, ethereal and calm, high resolution, no hard edges, no visible subject',
    antiPatterns:
      "Des dégradés en bandes (banding) ou un texte fin posé sur la zone la plus claire du voile.",
  },

  handwritten: {
    id: 'handwritten',
    name: 'Manuscrit',
    essence: "La trace de la main : notes, croquis, annotations, imperfection assumée.",
    fitsBrands:
      'Éducation, coaching, artisanat, restauration, marques personnelles, associations.',
    surface: 'light',
    radius: 12,
    typeRatio: 1.414,
    borders:
      'Traits tracés à la main, soulignements irréguliers, cadres esquissés.',
    shadows:
      'Ombres légères de papier posé, adhésif et coins relevés.',
    imageNegativePrompt:
      'polished vector, perfect symmetry, glossy digital render, neon colors, corporate stock photo',
    bans: [
      'Jamais un paragraphe entier en écriture manuscrite.',
      'Deux couleurs d\'encre maximum.',
    ],
    seedSpace: {
      archetypes: ['A', 'C', 'G', 'K'],
      colorStrategies: ['MONOCHROME_ACCENT', 'DUOTONE', 'IMAGE_EXTRACTED'],
      typographyMoods: ['ALL_LOWERCASE_INTIMATE', 'STAGGERED_INDENT', 'SINGLE_LETTER_ANCHOR'],
      layoutTensions: ['COLLAGE_LAYER', 'FRAME_WITHIN_FRAME', 'CORNER_ANCHOR', 'RULE_HEAVY'],
      contentDensities: ['EDITORIAL', 'BALANCED'],
      graphicAccents: ['THICK_UNDERLINE', 'OVERSIZED_PUNCTUATION', 'DOT_CLUSTER'],
    },
    layout:
      "Structure de carnet : marges, lignes, annotations dans les marges, flèches qui relient les blocs. Alignements volontairement imparfaits.",
    color:
      "Fond papier (background de la charte), encre dans la couleur texte, surlignage dans la couleur accent. Deux couleurs d'encre maximum.",
    typography:
      "Un titre manuscrit ou en italique appuyée, contrebalancé par un texte courant très lisible dans la police de la marque. Jamais tout en manuscrit.",
    devices:
      "Soulignements tracés, cercles d'annotation, flèches, ratures, post-it, ruban adhésif, croquis au trait.",
    imagery:
      "Croquis au trait, photographies de carnets et de mains qui écrivent, textures de papier.",
    imagePromptModifier:
      'hand-drawn sketch aesthetic, ink on textured paper, visible pen strokes and imperfections, notebook and annotation feel, warm paper tone, single ink color with one highlight color, authentic handmade look',
    antiPatterns:
      "Composer un paragraphe entier en écriture manuscrite : illisible. Le manuscrit accentue, il ne porte pas le texte courant.",
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
    return `- ${s.id} — ${s.name}: ${s.essence} Convient à: ${s.fitsBrands}`;
  }).join('\n');
}

/** Fiche complète d'un style, telle qu'injectée dans les prompts de génération. */
export function buildStyleSheet(id: ArtDirectionStyleId): string {
  const s = ART_DIRECTION_STYLES[id];
  if (!s) return '';
  const surface =
    s.surface === 'dark'
      ? 'fond sombre imposé'
      : s.surface === 'light'
        ? 'fond clair imposé'
        : 'fond clair ou sombre, mais un seul par livrable';
  return [
    `Style: ${s.name} (${s.id})`,
    `Essence: ${s.essence}`,
    `Surface: ${surface}`,
    `Composition: ${s.layout}`,
    `Couleur: ${s.color}`,
    `Typographie: ${s.typography} Rapport d'échelle typographique: ${s.typeRatio} entre deux niveaux consécutifs.`,
    `Rayon de bordure: ${s.radius}px sur TOUS les éléments (aucune exception, aucun mélange de rayons).`,
    `Filets et bordures: ${s.borders}`,
    `Ombres: ${s.shadows}`,
    `Éléments graphiques: ${s.devices}`,
    `Imagerie: ${s.imagery}`,
    `Interdits propres au style: ${s.bans.join(' ')}`,
    `Exécution amateur à éviter: ${s.antiPatterns}`,
  ].join('\n');
}

/** Style du catalogue, ou repli éditorial si l'identifiant est inconnu/absent. */
export function resolveStyle(id?: string | null): ArtDirectionStyle {
  const known = (id || '') as ArtDirectionStyleId;
  return ART_DIRECTION_STYLES[known] || ART_DIRECTION_STYLES.editorial;
}

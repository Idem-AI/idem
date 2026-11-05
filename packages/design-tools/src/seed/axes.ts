/**
 * LE RÉPERTOIRE DES AXES DE DÉPART — ce qui décale l'idée d'un film ou d'un document avant que le modèle l'invente.
 *
 * Un axe n'impose ni mise en page ni composition : il donne au directeur un point de départ concret (un savoir-faire
 * d'un des 13 pays ouverts, ou une contrainte de composition ou de mouvement), pour que deux marques voisines ne
 * reçoivent pas la même idée la plus probable. Le directeur en tire un PRINCIPE visuel (matière, géométrie, rythme) ;
 * il ne reproduit jamais un objet, n'en affirme jamais le sens, et n'écrit jamais son nom à l'écran.
 *
 * Choix retenus : des savoir-faire, des matières, des architectures et des arts du quotidien — jamais d'objet sacré,
 * de rituel ni de masque de cérémonie.
 *
 * RELECTURE (décision du 04/11/2026) : chaque entrée culturelle est d'abord DOCUMENTÉE (sources publiques citées dans
 * `sources`), puis RELUE par une personne du pays (`review.status: 'reviewed'`, avec son nom ou son rôle). Une entrée
 * seulement documentée sert en production ; `IDEM_AXES_REVIEWED_ONLY=1` restreint le tirage aux entrées relues dès
 * que chaque pays en a au moins une. La relecture se fait dans ce fichier (une ligne `review` par entrée).
 */

export type CountryCode = 'BEN' | 'CIV' | 'CMR' | 'COD' | 'COG' | 'GAB' | 'KEN' | 'MOZ' | 'RWA' | 'SEN' | 'SLE' | 'UGA' | 'ZMB';

/** Les 13 pays provisionnés (paiements en production). */
export const COUNTRIES: CountryCode[] = ['BEN', 'CIV', 'CMR', 'COD', 'COG', 'GAB', 'KEN', 'MOZ', 'RWA', 'SEN', 'SLE', 'UGA', 'ZMB'];

export type AxisKind = 'craft' | 'architecture' | 'art' | 'composition' | 'motion';

export interface AxisReview {
  status: 'documented' | 'reviewed';
  /** Qui a relu (nom ou rôle), et quand. */
  by?: string;
  date?: string;
  note?: string;
}

export interface StartAxis {
  id: string;
  kind: AxisKind;
  /** Pays d'origine (axes culturels seulement). */
  country?: CountryCode;
  /** Le nom de l'élément (journaux, relecture) — jamais écrit à l'écran. */
  name: string;
  /** Le principe visuel, en anglais (langue des consignes) : ce que le directeur en tire. */
  principle: string;
  /** Ce que cela peut donner en mouvement (vidéo). */
  motion?: string;
  /** Les sources publiques qui documentent l'élément. */
  sources?: string[];
  review?: AxisReview;
}

const doc = (sources: string[]): Pick<StartAxis, 'sources' | 'review'> => ({ sources, review: { status: 'documented' } });

/** Les axes culturels : deux par pays au départ, à enrichir. */
export const CULTURAL_AXES: StartAxis[] = [
  { id: 'ben-abomey-applique', kind: 'craft', country: 'BEN', name: "Tentures appliquées d'Abomey", principle: 'flat cut-out shapes of solid colour stitched onto a plain ground; bold silhouettes, no gradients, figures read at a glance', motion: 'shapes placed one by one like appliqué pieces, crisp cuts, no morphing', ...doc(['Musée historique d’Abomey (palais royaux, inscrits au patrimoine mondial UNESCO en 1985)', 'Collections de tentures appliquées du Fon, musées d’ethnographie']) },
  { id: 'ben-tata-somba', kind: 'architecture', country: 'BEN', name: 'Tata somba', principle: 'stacked cylindrical volumes of earth with small openings; warm clay tones, rounded towers rising from a single base', motion: 'volumes rising from the ground in a steady rhythm', ...doc(['Koutammakou, le pays des Batammariba (UNESCO, 2004, partagé avec le Togo)']) },
  { id: 'civ-korhogo-cloth', kind: 'art', country: 'CIV', name: 'Toiles peintes de Korhogo', principle: 'black ink line drawing on raw off-white cotton; figures and animals outlined freehand, repeated in loose rows', motion: 'a line drawing itself, hand-drawn stroke', ...doc(['Toiles de Korhogo, artisans sénoufo de Fakaha (documentation du ministère ivoirien de la Culture)']) },
  { id: 'civ-baoule-strip', kind: 'craft', country: 'CIV', name: 'Pagne baoulé tissé', principle: 'narrow woven strips sewn side by side; a rhythm of stripes and small blocks that change from strip to strip', motion: 'strips sliding in one after another, sewn edge to edge', ...doc(['Tissage baoulé en bandes étroites (collections du musée des Civilisations de Côte d’Ivoire)']) },
  { id: 'cmr-ndop', kind: 'craft', country: 'CMR', name: 'Ndop des Grassfields', principle: 'deep indigo ground with white resist motifs in a grid; geometric signs repeated in square cells', motion: 'motifs revealed as if the dye drains away from them', ...doc(['Ndop, textile à réserve des chefferies des Grassfields (Bamiléké, Bamoun) — collections muséales']) },
  { id: 'cmr-beadwork', kind: 'craft', country: 'CMR', name: 'Perlage des Grassfields', principle: 'surfaces built from tiny units of saturated colour; triangles and lozenges made of dots', motion: 'a surface filling unit by unit', ...doc(['Perlage des royaumes des Grassfields (musée des Civilisations de Dschang)']) },
  { id: 'cod-kuba-raffia', kind: 'craft', country: 'COD', name: 'Velours de raphia kuba', principle: 'broken geometry: interlocking lines and labyrinths that shift direction without warning; earth tones', motion: 'a maze path that turns and branches', ...doc(['Textiles en raphia du royaume kuba (collections du Musée royal de l’Afrique centrale, Tervuren)']) },
  { id: 'cod-kinshasa-painting', kind: 'art', country: 'COD', name: 'Peinture populaire de Kinshasa', principle: 'vivid storytelling scenes with hand-painted lettering in the image; flat bright colours, a caption band', motion: 'a scene panning like a painted street sign', ...doc(['Peinture populaire urbaine de Kinshasa (Chéri Samba, Moke ; expositions muséales)']) },
  { id: 'cog-poto-poto', kind: 'art', country: 'COG', name: 'École de peinture de Poto-Poto', principle: 'elongated stylised silhouettes over flat colour fields; repetition of slender vertical figures', motion: 'tall forms gliding in vertical rhythm', ...doc(['École de peinture de Poto-Poto, Brazzaville, fondée en 1951']) },
  { id: 'cog-sape', kind: 'art', country: 'COG', name: 'La Sape', principle: 'confident elegance: pure saturated colour blocks, sharp tailoring lines, one bold accent against a calm ground', motion: 'a poised entrance, a confident turn', ...doc(['Société des ambianceurs et des personnes élégantes (Brazzaville, Kinshasa) — documentation culturelle']) },
  { id: 'gab-mbigou-stone', kind: 'craft', country: 'GAB', name: 'Pierre de Mbigou', principle: 'smooth polished volumes with soft curves; a few calm forms, matte surfaces, generous space', motion: 'slow rotation of a smooth form', ...doc(['Sculpture sur stéatite de Mbigou (artisanat du Gabon)']) },
  { id: 'gab-weaving', kind: 'craft', country: 'GAB', name: 'Vannerie et nattes tressées', principle: 'over-under weave: two directions crossing in a tight regular rhythm; natural fibre tones', motion: 'threads weaving across each other', ...doc(['Vannerie traditionnelle gabonaise (artisanat de raphia et de rotin)']) },
  { id: 'ken-kanga', kind: 'craft', country: 'KEN', name: 'Kanga', principle: 'a framed composition: a border, a central motif, and a line of text set inside the cloth', motion: 'the border draws first, the centre blooms, the line of text appears last', ...doc(['Kanga, textile d’Afrique de l’Est portant un proverbe (collections du musée national du Kenya)']) },
  { id: 'ken-maasai-beads', kind: 'craft', country: 'KEN', name: 'Perlage maasaï', principle: 'concentric rings and bands of pure colour (red, blue, white, green); strong contrast, no gradients', motion: 'rings expanding from a centre', ...doc(['Perlage maasaï (documentation muséale et associations d’artisanes)']) },
  { id: 'moz-capulana', kind: 'craft', country: 'MOZ', name: 'Capulana', principle: 'large printed motifs repeated edge to edge; joyful contrast, a bold border', motion: 'a printed motif unrolling across the frame', ...doc(['Capulana, pagne imprimé du Mozambique (musée de la Capulana, Maputo)']) },
  { id: 'moz-makonde', kind: 'craft', country: 'MOZ', name: 'Sculpture makonde', principle: 'interlaced forms growing from one another; a single block carved into many linked shapes', motion: 'shapes emerging and intertwining from one mass', ...doc(['Sculpture makonde (plateau de Mueda ; collections muséales)']) },
  { id: 'rwa-imigongo', kind: 'art', country: 'RWA', name: 'Imigongo', principle: 'raised geometric relief in black, white and ochre; zigzags, spirals and diamonds in strict symmetry', motion: 'relief lines rising and locking into symmetry', ...doc(['Imigongo, art de la province de l’Est (coopérative de Nyakarambi ; musées du Rwanda)']) },
  { id: 'rwa-agaseke', kind: 'craft', country: 'RWA', name: 'Paniers agaseke', principle: 'fine spiral coils climbing to a pointed lid; thin concentric patterns, two or three colours', motion: 'a spiral coiling upward', ...doc(['Agaseke, vannerie rwandaise (coopératives d’artisanes)']) },
  { id: 'sen-sous-verre', kind: 'art', country: 'SEN', name: 'Peinture sous verre', principle: 'strong black contour lines filled with vivid flat colours; small ornamental borders', motion: 'contours first, colour filling them', ...doc(['Peinture sous verre du Sénégal (Gora Mbengue ; musée Théodore Monod, Dakar)']) },
  { id: 'sen-car-rapide', kind: 'art', country: 'SEN', name: 'Cars rapides peints', principle: 'hand-painted lettering and ornaments on bright colour bands; signs, slogans and patterns side by side', motion: 'colour bands passing like a decorated bus going by', ...doc(['Cars rapides de Dakar, décor peint (documentation du patrimoine urbain)']) },
  { id: 'sle-country-cloth', kind: 'craft', country: 'SLE', name: 'Country cloth', principle: 'woven bands in indigo and natural cotton sewn together; a checkerboard rhythm of light and dark', motion: 'bands joining one by one into a cloth', ...doc(['Country cloth, tissage en bandes de Sierra Leone (collections muséales)']) },
  { id: 'sle-gara', kind: 'craft', country: 'SLE', name: 'Teinture gara', principle: 'indigo and earth dyes with tie and wax patterns; soft-edged repeated motifs', motion: 'patterns blooming as dye spreads', ...doc(['Teinture gara de Sierra Leone (coopératives de teinturières)']) },
  { id: 'uga-barkcloth', kind: 'craft', country: 'UGA', name: "Tissu d'écorce", principle: 'warm terracotta surface with a soft fibrous texture; large calm fields, few marks', motion: 'a surface slowly stretched open', ...doc(['Fabrication du tissu d’écorce en Ouganda (UNESCO, patrimoine culturel immatériel, 2008)']) },
  { id: 'uga-basketry', kind: 'craft', country: 'UGA', name: 'Vannerie ougandaise', principle: 'coiled rings of colour around a centre; bands of pattern stacked in concentric order', motion: 'rings stacking outward', ...doc(['Vannerie en raphia et fibres de bananier (artisanat ougandais)']) },
  { id: 'zmb-chitenge', kind: 'craft', country: 'ZMB', name: 'Chitenge', principle: 'printed cloth in wide bands: a motif strip, a plain strip, a border; vivid but ordered', motion: 'bands wiping in one after another', ...doc(['Chitenge, pagne imprimé de Zambie (usage courant ; documentation culturelle)']) },
  { id: 'zmb-tonga-basket', kind: 'craft', country: 'ZMB', name: 'Vannerie tonga', principle: 'radiating motifs from a centre point; dark and natural fibres alternating in rays', motion: 'rays turning around a centre', ...doc(['Vannerie tonga de la vallée de Gwembe (artisanat de Zambie)']) },
];

/** Les axes non culturels : des contraintes de composition ou de mouvement (aucune relecture nécessaire). */
export const FORM_AXES: StartAxis[] = [
  { id: 'one-big-number', kind: 'composition', name: 'Un seul grand chiffre', principle: 'build the piece around one very large figure or word; everything else is small and quiet' },
  { id: 'dense-text-block', kind: 'composition', name: 'Bloc de texte serré', principle: 'set the key message as one dense typographic block at the scale of the canvas' },
  { id: 'cropped-edge', kind: 'composition', name: 'Image coupée au bord', principle: 'let the main image or shape bleed off one edge; the crop creates the tension' },
  { id: 'two-colours', kind: 'composition', name: 'Deux couleurs', principle: 'use only two of the brand colours plus the ground; contrast does all the work' },
  { id: 'strong-diagonal', kind: 'composition', name: 'Une diagonale', principle: 'one dominant diagonal organises the whole layout' },
  { id: 'empty-half', kind: 'composition', name: 'Une moitié vide', principle: 'half of the canvas stays empty ground; the content concentrates in the other half' },
  { id: 'grid-break', kind: 'composition', name: 'Une grille, une rupture', principle: 'a strict grid that one element breaks on purpose' },
  { id: 'slow-then-cut', kind: 'motion', name: 'Lent puis rupture', principle: 'a slow, calm build followed by one sharp cut at the payoff', motion: 'slow ease, then a hard cut' },
  { id: 'travelling-object', kind: 'motion', name: 'Un objet qui traverse', principle: 'one single object travels through every scene and links them', motion: 'the same object carried across cuts' },
  { id: 'camera-push', kind: 'motion', name: 'La caméra avance', principle: 'a continuous push forward through layers of the scene', motion: 'constant forward dolly' },
  { id: 'type-as-image', kind: 'motion', name: 'Le texte fait image', principle: 'the words themselves become the visual: scale, cut and move them like shapes', motion: 'kinetic typography as the main subject' },
  { id: 'reveal-by-mask', kind: 'motion', name: 'Révélé par un masque', principle: 'each new element is revealed through a moving mask shape taken from the brand', motion: 'mask wipes in the brand shape' },
];

export const ALL_AXES: StartAxis[] = [...CULTURAL_AXES, ...FORM_AXES];

/** Un pays a-t-il au moins une entrée relue ? */
export function reviewedCountries(): Set<CountryCode> {
  return new Set(CULTURAL_AXES.filter((a) => a.review?.status === 'reviewed' && a.country).map((a) => a.country!));
}

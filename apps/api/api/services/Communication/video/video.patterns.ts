/**
 * LA COUCHE DES MOTIFS — le graphe de capacités devient un espace de recherche.
 *
 * Le graphe (`video.capabilities.ts`) répond à « quels outils sont compatibles avec ce
 * contexte ? ». Cette couche répond à la question suivante : « quelles combinaisons
 * intéressantes puis-je construire avec eux ? ». Elle relie cinq étages :
 *
 *   Intention    ce que la scène doit faire ressentir (croissance, preuve, question, urgence…)
 *   Capacité     ce que le moteur sait faire pour ça (compteur, graphique, dessin, 3D plate…)
 *   Motif        une façon éprouvée de le faire (« le compteur qui accélère », « l'anneau qui se remplit »)
 *   Outil        les nœuds du graphe qui l'implémentent (mise en page, technique de texte, fond, annotation)
 *   Primitive    les briques du kit qu'un plan codé importe (`Odometer`, `springEase`, `ChartJs`…)
 *
 * Un même motif sert à tous les crans : en Low → Max il se RÉSOUT en choix du moteur (mise en page,
 * entrée du titre, fond, annotation, coupe) ; en Ultra il dit au codeur quelles briques importer
 * (manifeste du kit restreint, `video.coder.ts#scopedKitManifest`). Le modèle ne reçoit jamais la
 * documentation du moteur : seulement 3 à 6 motifs que le planificateur (`video.planner.ts`) a
 * déjà jugés pertinents, nouveaux et fidèles à la charte.
 *
 * Statut : `safe` = combinaison éprouvée ; `experimental` = combinaison compatible mais peu courante
 * (motif marqué tel, ou porté par une direction qui lui est peu affine). Le cran fixe la part
 * d'exploration (`EXPLORATION_BUDGET`).
 */
import { DirectionId, DIRECTION_IDS, DIRECTIONS, MotionTransition, TextTechnique, TRANSITION_IDS } from './video.direction';
import { LAYOUT_CATALOGUE, LayoutId, layoutFits, LayoutScene, LAYOUT_SCENES } from './video.layouts';
import { CAP_BY_ID } from './video.capabilities';
import { BriefFacts } from './video.copy';

// ─── Intentions et capacités ────────────────────────────────────────────────

export type IntentId =
  | 'grab'
  | 'question'
  | 'problem'
  | 'promise'
  | 'growth'
  | 'proof'
  | 'comparison'
  | 'list'
  | 'urgency'
  | 'reveal'
  | 'place'
  | 'testimony'
  | 'action'
  | 'signature';

export const INTENTS: Record<IntentId, string> = {
  grab: 'capter l’attention dès la première seconde',
  question: 'poser la question que le public se pose',
  problem: 'nommer un problème du quotidien',
  promise: 'affirmer une promesse, une conviction',
  growth: 'faire ressentir une croissance, un chiffre qui monte',
  proof: 'prouver : un chiffre, un fait',
  comparison: 'comparer : avant / après, ancien / nouveau prix',
  list: 'énumérer des avantages',
  urgency: 'créer l’urgence d’une offre',
  reveal: 'révéler un produit, une image',
  place: 'situer : un lieu, une date, un pays',
  testimony: 'faire parler un client',
  action: 'pousser à l’action',
  signature: 'finir sur la marque',
};

export type CapabilityId =
  | 'type-motion'
  | 'poster-type'
  | 'counter'
  | 'chart'
  | 'gauge'
  | 'area'
  | 'map'
  | 'hand-drawn'
  | 'brush'
  | 'organic'
  | 'mosaic'
  | 'flat-3d'
  | 'depth'
  | 'color-block'
  | 'grid'
  | 'radial'
  | 'band'
  | 'spotlight'
  | 'photo-frame'
  | 'logo-motion'
  | 'icon';

export const CAPABILITY_LABELS: Record<CapabilityId, string> = {
  'type-motion': 'typographie animée (20 techniques)',
  'poster-type': 'typographie d’affiche',
  counter: 'compteur à rouleaux',
  chart: 'graphiques Chart.js',
  gauge: 'jauge visx',
  area: 'aire qui se dessine',
  map: 'carte de l’Afrique',
  'hand-drawn': 'croquis à la main (rough.js)',
  brush: 'coup de pinceau (perfect-freehand)',
  organic: 'bruit organique, lignes de flux',
  mosaic: 'mosaïque de Voronoï',
  'flat-3d': '3D plate (Zdog)',
  depth: 'profondeur, caméra, plans superposés',
  'color-block': 'aplats de la marque',
  grid: 'grille, bento',
  radial: 'cercle, anneau, étoile',
  band: 'bandeaux défilants',
  spotlight: 'projecteur, halo',
  'photo-frame': 'photo mise en scène',
  'logo-motion': 'logo animé',
  icon: 'pictogrammes',
};

/** Familles de vocabulaire visuel : l'ADN d'une vidéo en garde une ou deux, l'accent en prend une autre. */
export type PatternFamily = 'type' | 'data' | 'graphic' | 'drawn' | 'spatial' | 'photo' | 'brand';
export const PATTERN_FAMILIES: PatternFamily[] = ['type', 'data', 'graphic', 'drawn', 'spatial', 'photo', 'brand'];

export const FAMILY_PITCH: Record<PatternFamily, string> = {
  type: 'type-led (kinetic and poster typography)',
  data: 'data-led (counters, rings, gauges, bars)',
  graphic: 'graphic (brand color blocks, bands, circles, grids)',
  drawn: 'hand-drawn (sketches, brush strokes, checks)',
  spatial: 'spatial (depth, flat 3D, organic fields)',
  photo: 'photographic (framed and masked photos)',
  brand: 'brand-led (the logo animated)',
};

// ─── Les motifs ─────────────────────────────────────────────────────────────

export interface PatternTools {
  /** Mise en page (scènes de texte). `classic` = la composition de la direction. */
  layout?: LayoutId;
  /** Entrées de titre préférées (appliquées si la direction les porte). */
  techniques?: TextTechnique[];
  /** Surcouche posée par le kit (accent créatif seulement). */
  annotate?: string;
  background?: string;
  /** Coupe qui ouvre la scène. */
  transitionIn?: MotionTransition[];
  /** Plans de médias et signature : nœud du graphe qui l'implémente. */
  treatment?: string;
  logo?: string;
}

export interface PatternDef {
  id: string;
  /** Nom en français (doc, interface). */
  label: string;
  /** Une ligne en anglais pour les menus des agents et l'univers du directeur (≤ 14 mots). */
  pitch: string;
  family: PatternFamily;
  intents: IntentId[];
  scenes: string[];
  capabilities: CapabilityId[];
  tools: PatternTools;
  /** Les briques de `@idem/kit` qu'un plan codé importe pour ce motif (cran Ultra). */
  kit: string[];
  /** La consigne d'un plan codé (cran Ultra). */
  recipe: string;
  status: 'safe' | 'experimental';
  /**
   * `scene` : la composition d'une scène ; `overlay` : une surcouche (fond, annotation, coupe) posée
   * en accent créatif sur une scène ; `derived` : lu après coup sur le kit (mises en scène des plans,
   * signature) ; `ultra` : seulement écrit en code (aucune brique toute faite dans les menus).
   */
  role: 'scene' | 'overlay' | 'derived' | 'ultra';
  cost: 0 | 1 | 2;
  /** Affinités par direction (sinon : celles de l'outil). */
  directions?: Partial<Record<DirectionId, number>>;
  /** Motif générique (la composition de la direction) : pertinence plafonnée. */
  generic?: boolean;
  /** Faits du brief qu'il exige (cran Ultra : le directeur ne compose qu'avec ce qui existe). */
  needsFacts?: 'numbers' | 'percent' | 'places' | 'photo';
}

const TEXT_SCENES = ['hook', 'statement', 'stat', 'benefits', 'offer', 'quote', 'cta', 'event', 'product'];
/** Scènes où le kit pose un fond (`video.capabilities.ts#BACKDROP_SCENES`). */
const BACKDROP_SCENES = ['hook', 'statement', 'stat', 'kinetic', 'wordswap', 'cta', 'quote', 'benefits', 'offer'];

const P = (p: PatternDef): PatternDef => p;

export const PATTERNS: PatternDef[] = [
  // ── Typographie ──
  P({ id: 'posterStack', label: 'Affiche typographique', pitch: 'headline stacked as a huge poster, solid and outline lines', family: 'type', intents: ['grab', 'promise', 'action'], scenes: ['hook', 'statement', 'cta'], capabilities: ['poster-type', 'type-motion'], tools: { layout: 'wordStack', techniques: ['stackPush', 'slideAlternate', 'maskUp'] }, kit: ['Kinetic', 'stackLines', 'useEnter', 'useBeatPulse'], recipe: 'Stack the headline line by line as a poster, huge; alternate solid and outline lines; the key line pulses on the beat.', status: 'safe', role: 'scene', cost: 0 }),
  P({ id: 'marqueeEcho', label: 'Mot géant en écho', pitch: 'a giant outlined keyword scrolls behind the headline', family: 'type', intents: ['grab', 'promise'], scenes: ['hook', 'statement', 'cta'], capabilities: ['band', 'type-motion'], tools: { layout: 'marqueeBack', techniques: ['trackIn', 'scaleBlur', 'maskUp'] }, kit: ['Kinetic', 'useSceneProgress', 'mix'], recipe: 'A giant outlined keyword scrolls slowly behind the headline; the headline settles early and holds.', status: 'safe', role: 'scene', cost: 0 }),
  P({ id: 'wordSpotlight', label: 'Mot sous le projecteur', pitch: 'sentence small, then its key word huge under a spotlight', family: 'type', intents: ['question', 'reveal', 'promise'], scenes: ['hook', 'statement'], capabilities: ['spotlight', 'type-motion'], tools: { layout: 'spotlightWord', techniques: ['blurWords', 'scaleBlur', 'trackIn'] }, kit: ['Kinetic', 'useSceneProgress', 'progress'], recipe: 'Show the sentence small, then its key word grows huge under a soft spotlight that drifts.', status: 'safe', role: 'scene', cost: 0 }),
  P({ id: 'tickerFrame', label: 'Bandeaux d’actualité', pitch: 'two scrolling news-ticker bands frame the headline', family: 'type', intents: ['urgency', 'grab', 'action'], scenes: ['hook', 'cta', 'statement'], capabilities: ['band', 'type-motion'], tools: { layout: 'ticker', techniques: ['slideAlternate', 'skewIn', 'maskUp'] }, kit: ['Kinetic', 'useSceneProgress', 'mix'], recipe: 'Two bands scroll in opposite directions above and below the headline, like breaking news.', status: 'safe', role: 'scene', cost: 0 }),
  P({ id: 'questionReveal', label: 'La question qui s’écrit', pitch: 'the question types itself, holds, its key word lights up', family: 'type', intents: ['question', 'problem'], scenes: ['hook', 'statement'], capabilities: ['type-motion'], tools: { layout: 'classic', techniques: ['typewriter', 'charCascade', 'blurWords'] }, kit: ['Kinetic', 'useEnter'], recipe: 'The question writes itself letter by letter, holds in silence, then its key word takes the brand colour.', status: 'safe', role: 'scene', cost: 0, directions: { editorial: 2.5, precision: 2.5, cinematic: 2, swiss: 1.5, collage: 2, kinetic: 1.5, brutal: 1, drenched: 1.5 } }),
  P({ id: 'directionClassic', label: 'Composition de la direction', pitch: 'the motion direction’s own composition, typography first', family: 'type', intents: ['grab', 'promise', 'action', 'list', 'proof', 'place', 'reveal', 'urgency', 'testimony', 'growth', 'comparison', 'question', 'problem'], scenes: TEXT_SCENES, capabilities: ['type-motion'], tools: { layout: 'classic' }, kit: ['Headline', 'Support', 'Composition', 'useEnter'], recipe: 'The direction’s own composition: the headline on its anchor, generous space, one accent.', status: 'safe', role: 'scene', cost: 0, generic: true, directions: Object.fromEntries(DIRECTION_IDS.map((d) => [d, 2])) }),
  P({ id: 'kineticBurst', label: 'Mots qui jaillissent', pitch: 'short words burst in one after another, zoom and scatter', family: 'type', intents: ['grab', 'promise', 'urgency'], scenes: ['kinetic', 'wordswap'], capabilities: ['type-motion'], tools: { techniques: ['zoomWords', 'scatter', 'springUp', 'charCascade', 'stretch'] }, kit: ['Kinetic', 'useBeatPulse'], recipe: 'Each short line bursts in on a beat (zoom, scatter), the last one lands hard and holds.', status: 'safe', role: 'scene', cost: 0 }),
  P({ id: 'typeCascade', label: 'Cascade de lettres', pitch: 'letters cascade and wave in, line after line', family: 'type', intents: ['promise', 'grab'], scenes: ['kinetic', 'wordswap'], capabilities: ['type-motion'], tools: { techniques: ['charCascade', 'wave', 'flipChars', 'maskUp', 'lineWipe', 'boxReveal'] }, kit: ['Kinetic'], recipe: 'Letters cascade in line after line with a short stagger; the punchline gets the brand colour.', status: 'safe', role: 'scene', cost: 0 }),
  P({ id: 'quoteGiant', label: 'Grande citation', pitch: 'a giant quotation mark behind the testimonial, author underlined', family: 'type', intents: ['testimony', 'proof'], scenes: ['quote'], capabilities: ['poster-type', 'type-motion'], tools: { layout: 'quoteBig', techniques: ['blurWords', 'lineWipe', 'maskUp'] }, kit: ['Kinetic', 'useEnter'], recipe: 'A giant quotation mark in the brand colour behind the words; the author signs with a drawn rule.', status: 'safe', role: 'scene', cost: 0 }),

  // ── Données ──
  P({ id: 'counterAcceleration', label: 'Le compteur qui accélère', pitch: 'the number rolls up fast, decelerates, fills the frame', family: 'data', intents: ['growth', 'proof', 'urgency'], scenes: ['stat', 'offer'], capabilities: ['counter', 'poster-type'], tools: { layout: 'bigNumber', techniques: ['scaleBlur', 'maskUp', 'trackIn', 'stretch'] }, kit: ['Odometer', 'springEase', 'progress', 'useBeatPulse'], recipe: 'The figure rolls up fast and decelerates, filling the frame; its label slides in a colour block.', status: 'safe', role: 'scene', cost: 0 }),
  P({ id: 'ringSweep', label: 'L’anneau qui se remplit', pitch: 'the percentage as a ring sweeping to its value', family: 'data', intents: ['growth', 'proof'], scenes: ['stat'], capabilities: ['chart', 'counter', 'radial'], tools: { layout: 'chartRing' }, kit: ['ChartJs', 'percentIn', 'Odometer'], recipe: 'A Chart.js ring sweeps to the percentage while the number rolls in its centre.', status: 'safe', role: 'scene', cost: 1, needsFacts: 'percent' }),
  P({ id: 'gaugeFill', label: 'La jauge', pitch: 'a thick 270° gauge fills to the percentage', family: 'data', intents: ['growth', 'proof'], scenes: ['stat'], capabilities: ['gauge', 'counter'], tools: { layout: 'dataArc' }, kit: ['DataArc', 'percentIn', 'Odometer'], recipe: 'A thick 270° gauge fills to the percentage, the label settles under it.', status: 'safe', role: 'scene', cost: 1, needsFacts: 'percent' }),
  P({ id: 'priceDrop', label: 'Le prix qui baisse', pitch: 'old and new price as two bars, the saving made visible', family: 'data', intents: ['comparison', 'urgency'], scenes: ['offer'], capabilities: ['chart'], tools: { layout: 'barCompare' }, kit: ['ChartJs', 'numbersIn'], recipe: 'Old price and new price rise as two bars; the gap between them is the saving.', status: 'safe', role: 'scene', cost: 1, needsFacts: 'numbers' }),
  P({ id: 'metricStage', label: 'Le chiffre en scène', pitch: 'the number inside a big brand circle with a turning ring', family: 'data', intents: ['proof', 'growth'], scenes: ['stat'], capabilities: ['radial', 'counter'], tools: { layout: 'circleStage', techniques: ['maskUp', 'trackIn'] }, kit: ['Odometer', 'useSceneProgress', 'useEnter'], recipe: 'The number sits inside a big brand circle while a thin ring turns around it.', status: 'safe', role: 'scene', cost: 0 }),

  // ── Graphique ──
  P({ id: 'colorSplit', label: 'Deux blocs de couleur', pitch: 'the frame split in two brand blocks, headline and details', family: 'graphic', intents: ['promise', 'comparison', 'action', 'place', 'list'], scenes: ['statement', 'benefits', 'stat', 'cta', 'event'], capabilities: ['color-block'], tools: { layout: 'splitBlock', techniques: ['maskUp', 'slideAlternate', 'lineWipe'] }, kit: ['Kinetic', 'useEnter', 'progress'], recipe: 'Split the frame in two brand colour blocks that slide apart: headline on one, details on the other.', status: 'safe', role: 'scene', cost: 0 }),
  P({ id: 'diagonalCross', label: 'Bandeau diagonal', pitch: 'a tilted brand band crosses the frame carrying the headline', family: 'graphic', intents: ['grab', 'urgency', 'action'], scenes: ['hook', 'statement', 'cta', 'offer'], capabilities: ['color-block', 'band'], tools: { layout: 'diagonalBand', techniques: ['skewIn', 'slideAlternate', 'stackPush'] }, kit: ['Kinetic', 'useEnter', 'mix'], recipe: 'A tilted brand band sweeps across the frame and carries the headline.', status: 'safe', role: 'scene', cost: 0 }),
  P({ id: 'frameOffset', label: 'Bloc et cadre décalés', pitch: 'headline on a brand block, an offset outline frame behind', family: 'graphic', intents: ['promise', 'reveal'], scenes: ['hook', 'statement', 'cta', 'product'], capabilities: ['color-block', 'depth'], tools: { layout: 'frameOverlap', techniques: ['maskUp', 'lineWipe', 'trackIn'] }, kit: ['Kinetic', 'useEnter', 'useSceneProgress'], recipe: 'Headline on a brand block, an outline frame offset behind it drifts the other way.', status: 'safe', role: 'scene', cost: 0 }),
  P({ id: 'bentoFocus', label: 'Grille bento', pitch: 'a bento grid, the focus moves from cell to cell', family: 'graphic', intents: ['list', 'place'], scenes: ['benefits', 'event'], capabilities: ['grid', 'icon'], tools: { layout: 'gridCards' }, kit: ['Icon', 'useEnter', 'progress'], recipe: 'A bento grid: the headline cell in brand colour, one cell per item, the focus moves from cell to cell.', status: 'safe', role: 'scene', cost: 0 }),
  P({ id: 'circleStage', label: 'Le cercle de la marque', pitch: 'a big brand circle with a turning ring, text beside it', family: 'graphic', intents: ['reveal', 'promise', 'action'], scenes: ['hook', 'statement', 'cta', 'product'], capabilities: ['radial'], tools: { layout: 'circleStage', techniques: ['maskUp', 'trackIn', 'blurWords'] }, kit: ['Kinetic', 'useSceneProgress', 'useEnter'], recipe: 'A big brand circle (photo or symbol) with a turning ring; the text settles beside it.', status: 'safe', role: 'scene', cost: 0 }),
  P({ id: 'priceBurst', label: 'Prix en étoile', pitch: 'the price inside a turning starburst, old price struck', family: 'graphic', intents: ['urgency', 'reveal'], scenes: ['offer', 'product'], capabilities: ['radial'], tools: { layout: 'priceBurst' }, kit: ['Odometer', 'useSceneProgress', 'useEnter'], recipe: 'The price pops inside a slowly turning starburst; the old price is struck through.', status: 'safe', role: 'scene', cost: 0 }),

  // ── Dessiné ──
  P({ id: 'checkTrail', label: 'Liste cochée', pitch: 'items checked one by one, a drawn line connects them', family: 'drawn', intents: ['list', 'proof'], scenes: ['benefits'], capabilities: ['hand-drawn', 'icon'], tools: { layout: 'checklist' }, kit: ['Sketch', 'Icon', 'progress'], recipe: 'Items are checked one by one with drawn check marks; a hand-drawn line connects them.', status: 'safe', role: 'scene', cost: 0 }),
  P({ id: 'handCircle', label: 'Cercle au crayon', pitch: 'the key word circled with a pencil stroke', family: 'drawn', intents: ['promise', 'question', 'grab', 'action'], scenes: ['hook', 'statement', 'cta'], capabilities: ['hand-drawn'], tools: { annotate: 'sketch-circle', layout: 'classic' }, kit: ['Sketch', 'Kinetic', 'progress'], recipe: 'Once the headline holds, a pencil circle (rough.js) draws itself around the key word.', status: 'safe', role: 'overlay', cost: 1 }),
  P({ id: 'brushUnderline', label: 'Coup de pinceau', pitch: 'a brush stroke sweeps under the key word', family: 'drawn', intents: ['promise', 'grab', 'action'], scenes: ['hook', 'statement', 'cta'], capabilities: ['brush'], tools: { annotate: 'brush', layout: 'classic' }, kit: ['Brush', 'Kinetic', 'progress'], recipe: 'A pressure brush stroke sweeps under the key word after the headline settles.', status: 'safe', role: 'overlay', cost: 1 }),
  P({ id: 'penUnderline', label: 'Souligné au feutre', pitch: 'a felt-pen line underlines the key word', family: 'drawn', intents: ['promise', 'action'], scenes: ['hook', 'statement', 'cta'], capabilities: ['hand-drawn'], tools: { annotate: 'underline', layout: 'classic' }, kit: ['Sketch', 'Kinetic'], recipe: 'A felt-pen line underlines the key word once the headline is read.', status: 'safe', role: 'overlay', cost: 0 }),
  P({ id: 'markerSweep', label: 'Surligneur', pitch: 'a highlighter sweeps behind the key word', family: 'drawn', intents: ['promise', 'urgency', 'action'], scenes: ['hook', 'statement', 'cta'], capabilities: ['hand-drawn'], tools: { annotate: 'marker', layout: 'classic' }, kit: ['Kinetic', 'progress'], recipe: 'A highlighter stroke sweeps behind the key word.', status: 'safe', role: 'overlay', cost: 0 }),
  P({ id: 'sketchBackdrop', label: 'Formes au crayon', pitch: 'pencil shapes draw themselves behind the scene', family: 'drawn', intents: ['grab', 'promise', 'list'], scenes: BACKDROP_SCENES, capabilities: ['hand-drawn'], tools: { background: 'sketch-shapes' }, kit: ['Sketch', 'progress'], recipe: 'Pencil circles, squares and arcs in the brand colours draw themselves one after the other in the free space.', status: 'safe', role: 'overlay', cost: 1 }),

  // ── Spatial ──
  P({ id: 'cardStack', label: 'Cartes superposées', pitch: 'each item on a floating card, cards stacked with depth', family: 'spatial', intents: ['list', 'place'], scenes: ['benefits', 'event'], capabilities: ['depth', 'icon'], tools: { layout: 'layeredCards' }, kit: ['Icon', 'useEnter', 'useSceneProgress'], recipe: 'Each item on a card; the cards are stacked with depth and float at different speeds.', status: 'safe', role: 'scene', cost: 0 }),
  P({ id: 'flatObjects', label: 'Objets 3D plats', pitch: 'flat 3D objects turn slowly in the free space', family: 'spatial', intents: ['grab', 'reveal', 'promise'], scenes: BACKDROP_SCENES, capabilities: ['flat-3d', 'depth'], tools: { background: 'flat3d' }, kit: ['Flat3D', 'useLocalTime'], recipe: 'A box, a ring and a sphere in flat 3D (Zdog) turn slowly beside the text.', status: 'safe', role: 'overlay', cost: 1 }),
  P({ id: 'flowField', label: 'Lignes de flux', pitch: 'organic flow lines drift behind the scene', family: 'spatial', intents: ['promise', 'grab', 'reveal'], scenes: BACKDROP_SCENES, capabilities: ['organic'], tools: { background: 'flow-field' }, kit: ['FlowField', 'useNoise'], recipe: 'Organic lines drift in a simplex-noise field, brand colours, on the free side of the frame.', status: 'safe', role: 'overlay', cost: 1 }),
  P({ id: 'mosaicField', label: 'Mosaïque', pitch: 'brand-colour mosaic cells drift slowly', family: 'spatial', intents: ['grab', 'promise'], scenes: BACKDROP_SCENES, capabilities: ['mosaic'], tools: { background: 'voronoi' }, kit: ['VoronoiField'], recipe: 'Voronoi cells in the brand colours drift slowly behind the text.', status: 'safe', role: 'overlay', cost: 1 }),
  P({ id: 'waveGrid', label: 'Vague en grille', pitch: 'a dot grid lights up in a wave from the centre', family: 'spatial', intents: ['grab', 'growth'], scenes: BACKDROP_SCENES, capabilities: ['grid', 'depth'], tools: { background: 'stagger-grid' }, kit: ['useLocalTime', 'progress'], recipe: 'A grid of dots lights up in a wave from the focal point.', status: 'safe', role: 'overlay', cost: 1 }),
  P({ id: 'depthPush', label: 'Traversée', pitch: 'the camera travels through the previous shot into this one', family: 'spatial', intents: ['reveal', 'grab', 'growth'], scenes: TEXT_SCENES, capabilities: ['depth'], tools: { transitionIn: ['zoomThrough', 'zoomBlur', 'cube'] }, kit: ['useCamera', 'useEnter'], recipe: 'Enter by travelling through the frame: a strong zoom that resolves on the focal point.', status: 'safe', role: 'overlay', cost: 0 }),

  // ── Graphique en fond (surcouches) ──
  P({ id: 'dotGridReveal', label: 'Trame de points', pitch: 'a regular dot grid reveals from the free corner', family: 'graphic', intents: ['proof', 'promise'], scenes: BACKDROP_SCENES, capabilities: ['grid'], tools: { background: 'dot-grid' }, kit: ['useLocalTime'], recipe: 'A regular dot grid reveals from the free corner.', status: 'safe', role: 'overlay', cost: 0 }),
  P({ id: 'shapeField', label: 'Formes de la marque', pitch: 'brand circles and squares gather on the free side', family: 'graphic', intents: ['grab', 'urgency'], scenes: BACKDROP_SCENES, capabilities: ['color-block'], tools: { background: 'shape-field' }, kit: ['useEnter', 'useSceneProgress'], recipe: 'Brand circles, squares and rings gather on the free side and drift.', status: 'safe', role: 'overlay', cost: 0 }),
  P({ id: 'haloDrift', label: 'Halo', pitch: 'a halo of the accent colour glides slowly', family: 'graphic', intents: ['reveal', 'promise'], scenes: BACKDROP_SCENES, capabilities: ['spotlight'], tools: { background: 'spotlight' }, kit: ['useSceneProgress'], recipe: 'A soft halo of the accent colour glides behind the focal point.', status: 'safe', role: 'overlay', cost: 0 }),
  P({ id: 'halftoneBloom', label: 'Demi-teinte', pitch: 'a printer’s halftone blooms in a corner', family: 'graphic', intents: ['grab', 'promise'], scenes: BACKDROP_SCENES, capabilities: ['grid'], tools: { background: 'halftone' }, kit: ['useLocalTime'], recipe: 'A printer’s halftone blooms in one corner and drifts.', status: 'safe', role: 'overlay', cost: 0 }),
  P({ id: 'rulerTicks', label: 'Graduations', pitch: 'ruler ticks on two edges: measure, precision', family: 'graphic', intents: ['proof', 'growth'], scenes: BACKDROP_SCENES, capabilities: ['grid'], tools: { background: 'ticks' }, kit: ['useLocalTime'], recipe: 'Ruler ticks run along two edges, as if the scene were measured.', status: 'safe', role: 'overlay', cost: 0 }),
  P({ id: 'nameMarquee', label: 'Bandeau du nom', pitch: 'the brand name huge, outlined, scrolling behind', family: 'type', intents: ['grab', 'action'], scenes: BACKDROP_SCENES, capabilities: ['band'], tools: { background: 'marquee' }, kit: ['useSceneProgress'], recipe: 'The brand name, huge and outlined, scrolls behind the scene.', status: 'safe', role: 'overlay', cost: 0 }),

  // ── Plans de médias (lus sur le kit) ──
  ...(
    [
      ['photoSplit', 'Écran partagé', 'the photo on half the frame, text on the brand block', 'split'],
      ['photoWindow', 'Fenêtre', 'the photo appears inside an opening shape', 'window'],
      ['photoBlinds', 'Lames', 'blinds reveal the photo, one band keeps the title', 'blinds'],
      ['photoMagazine', 'Page de magazine', 'magazine page: title, framed photo, caption', 'magazine'],
      ['photoKnockout', 'Image dans les lettres', 'the image plays inside giant letters', 'knockout'],
      ['photoInline', 'Image dans la phrase', 'the image in a capsule inside the headline', 'inline'],
      ['photoDuotone', 'Bichromie', 'the image in two brand colours, outlined title', 'duotone'],
      ['photoBroadcast', 'Barre de titre', 'broadcast title bar over the full-frame image', 'broadcast'],
      ['photoCinema', 'Cinéma', 'subtitles over the image, film vignette', 'cinema'],
    ] as const
  ).map(([id, label, pitch, treatment]) =>
    P({ id, label, pitch, family: 'photo', intents: ['reveal'], scenes: ['footage', 'product'], capabilities: ['photo-frame'], tools: { treatment }, kit: ['useEnter', 'useSceneProgress', 'Kinetic'], recipe: `Show the photo (s.image): ${pitch}.`, status: 'safe', role: 'derived', cost: 0, needsFacts: 'photo' })
  ),
  P({ id: 'photoGallery', label: 'Galerie', pitch: 'three photos in a row, each entering on the beat', family: 'photo', intents: ['reveal'], scenes: ['gallery'], capabilities: ['photo-frame'], tools: {}, kit: ['useEnter', 'useBeatPulse'], recipe: 'Three photos enter one after another on the beat.', status: 'safe', role: 'derived', cost: 0, needsFacts: 'photo' }),
  P({ id: 'productTurn', label: 'Vitrine 3D', pitch: 'the product turning in a studio, or photos as 3D cards', family: 'spatial', intents: ['reveal'], scenes: ['showcase3d'], capabilities: ['depth'], tools: {}, kit: [], recipe: '', status: 'safe', role: 'derived', cost: 2 }),
  P({ id: 'illustratedMoment', label: 'Animation illustrée', pitch: 'an illustrated animation (confetti, check, sparkle)', family: 'drawn', intents: ['reveal', 'promise'], scenes: ['lottie'], capabilities: ['hand-drawn'], tools: {}, kit: [], recipe: '', status: 'safe', role: 'derived', cost: 1 }),

  // ── Signature (lue sur le kit) ──
  ...(
    [
      ['logoDraw', 'Logo tracé', 'the logo outlines draw, then fill', 'draw'],
      ['logoTrace', 'Logo à la plume', 'a pen follows the logo outlines', 'trace'],
      ['logoMorph', 'Point → logo', 'a dot grows and morphs into the logo', 'morph'],
      ['logoAssemble', 'Logo assemblé', 'the logo shapes fly in and lock together', 'assemble'],
      ['logoWipe', 'Logo balayé', 'a diagonal wipe reveals the logo', 'wipe'],
      ['logoSplit', 'Symbole puis nom', 'the symbol lands, the name slides from behind it', 'split'],
      ['logoExtrude', 'Logo extrudé', 'the logo extruded in 3D, light sweeps its edge', 'extrude'],
      ['logoClassic', 'Signature de la direction', 'the direction’s own signature', 'classic'],
    ] as const
  ).map(([id, label, pitch, logo]) =>
    P({ id, label, pitch, family: 'brand', intents: ['signature'], scenes: ['logo'], capabilities: ['logo-motion'], tools: { logo }, kit: ['LogoMotion', 'Kinetic', 'useEnter'], recipe: `The signature: ${pitch} (<LogoMotion variant="${logo === 'classic' || logo === 'split' || logo === 'extrude' ? 'draw' : logo}" />), tagline under it.`, status: 'safe', role: 'derived', cost: logo === 'extrude' ? 2 : 0 })
  ),

  // ── Motifs écrits seulement en code (cran Ultra) : combinaisons compatibles, peu courantes ──
  P({ id: 'chartExplosion', label: 'Graphique qui explose', pitch: 'bars burst up one after another, a flash on the tallest', family: 'data', intents: ['growth', 'proof', 'comparison'], scenes: ['statement', 'stat'], capabilities: ['chart', 'counter'], tools: {}, kit: ['ChartJs', 'numbersIn', 'slotNumbers', 'Odometer', 'cue'], recipe: 'Bars built ONLY from the numbers of the texts burst up with a stagger; the tallest flashes in the accent colour as its number rolls.', status: 'experimental', role: 'ultra', cost: 1, needsFacts: 'numbers', directions: { kinetic: 2.5, brutal: 2, swiss: 2, drenched: 2, precision: 1.5, collage: 1.5, editorial: 1, cinematic: 0.8 } }),
  P({ id: 'spatialClimb', label: 'L’ascension', pitch: 'flat 3D steps rise, the camera climbs with the number', family: 'spatial', intents: ['growth', 'promise'], scenes: ['statement', 'stat'], capabilities: ['flat-3d', 'counter', 'depth'], tools: {}, kit: ['Flat3D', 'Odometer', 'springEase', 'useSceneProgress'], recipe: 'Flat 3D steps (Zdog boxes) rise one after another while the view climbs; the number rolls at the top.', status: 'experimental', role: 'ultra', cost: 1, directions: { kinetic: 2.5, precision: 2, drenched: 2, collage: 1.5, swiss: 1, cinematic: 1, editorial: 0.8, brutal: 1 } }),
  P({ id: 'mapLightUp', label: 'La carte qui s’allume', pitch: 'Africa map: the places named in the text light up', family: 'data', intents: ['place', 'growth', 'proof'], scenes: ['statement', 'event', 'cta'], capabilities: ['map'], tools: {}, kit: ['AfricaMap', 'countriesIn', 'Kinetic'], recipe: 'The map of Africa draws in; only the countries or cities NAMED in the text light up, one after another.', status: 'experimental', role: 'ultra', cost: 1, needsFacts: 'places', directions: { precision: 2.5, editorial: 2, cinematic: 2, swiss: 2, drenched: 2, kinetic: 1.5, collage: 1.5, brutal: 1 } }),
  P({ id: 'flowReveal', label: 'Le texte né du flux', pitch: 'organic flow lines converge and the headline emerges', family: 'spatial', intents: ['promise', 'reveal', 'grab'], scenes: ['hook', 'statement'], capabilities: ['organic', 'type-motion'], tools: {}, kit: ['FlowField', 'useNoise', 'Kinetic'], recipe: 'Organic flow lines converge on the focal point and the headline emerges from them.', status: 'experimental', role: 'ultra', cost: 1, directions: { cinematic: 2.5, drenched: 2.5, precision: 2, editorial: 1.5, kinetic: 1.5, collage: 1, swiss: 0.8, brutal: 0.5 } }),
  P({ id: 'brushReveal', label: 'Révélé au pinceau', pitch: 'a big brush stroke paints the headline into view', family: 'drawn', intents: ['promise', 'grab', 'action'], scenes: ['hook', 'statement', 'cta'], capabilities: ['brush', 'type-motion'], tools: {}, kit: ['Brush', 'Kinetic', 'progress'], recipe: 'A wide pressure brush stroke in the brand colour paints across the frame and reveals the headline.', status: 'experimental', role: 'ultra', cost: 1, directions: { editorial: 2.5, collage: 2.5, kinetic: 2, drenched: 1.5, cinematic: 1, brutal: 1, precision: 0.8, swiss: 0.5 } }),
  P({ id: 'sketchProof', label: 'La preuve entourée', pitch: 'the figure appears, a pencil circle and arrow point at it', family: 'drawn', intents: ['proof', 'urgency', 'growth'], scenes: ['stat', 'offer', 'statement'], capabilities: ['hand-drawn', 'counter'], tools: {}, kit: ['Sketch', 'Odometer', 'progress'], recipe: 'The figure rolls in, then a pencil circle and an arrow (rough.js) draw themselves around it.', status: 'experimental', role: 'ultra', cost: 1, needsFacts: 'numbers', directions: { collage: 2.5, editorial: 2, kinetic: 2, brutal: 1.5, swiss: 1, precision: 1, drenched: 1, cinematic: 0.8 } }),
  P({ id: 'areaGrowth', label: 'La courbe qui monte', pitch: 'an area chart draws itself upward, the last value rolls', family: 'data', intents: ['growth'], scenes: ['statement', 'stat'], capabilities: ['area', 'counter'], tools: {}, kit: ['GrowArea', 'numbersIn', 'Odometer'], recipe: 'An area chart built from the numbers of the texts draws itself left to right; the last value rolls in.', status: 'experimental', role: 'ultra', cost: 1, needsFacts: 'numbers', directions: { precision: 2.5, swiss: 2, drenched: 2, cinematic: 1.5, editorial: 1.5, kinetic: 1.5, collage: 1, brutal: 1 } }),
  P({ id: 'photoMosaic', label: 'Photo en mosaïque', pitch: 'the photo assembles from drifting mosaic cells', family: 'photo', intents: ['reveal'], scenes: ['statement', 'product'], capabilities: ['mosaic', 'photo-frame'], tools: {}, kit: ['VoronoiField', 'useEnter'], recipe: 'The photo (s.image) assembles from drifting brand-colour mosaic cells, then the headline settles.', status: 'experimental', role: 'ultra', cost: 1, needsFacts: 'photo', directions: { drenched: 2.5, kinetic: 2, precision: 1.5, swiss: 1.5, collage: 1.5, cinematic: 1, editorial: 1, brutal: 1 } }),
  P({ id: 'orbitProduct', label: 'Le produit en orbite', pitch: 'the photo in a circle, flat 3D rings orbit around it', family: 'spatial', intents: ['reveal', 'promise'], scenes: ['statement', 'product'], capabilities: ['flat-3d', 'radial', 'photo-frame'], tools: {}, kit: ['Flat3D', 'useEnter', 'useSceneProgress'], recipe: 'The photo (s.image) inside a circle while flat 3D rings orbit around it at different speeds.', status: 'experimental', role: 'ultra', cost: 1, needsFacts: 'photo', directions: { precision: 2.5, kinetic: 2, drenched: 2, cinematic: 1.5, collage: 1.5, editorial: 1, swiss: 1, brutal: 0.8 } }),
];

export const PATTERN_BY_ID = new Map(PATTERNS.map((p) => [p.id, p]));
export const PATTERN_IDS = PATTERNS.map((p) => p.id);

// ─── Affinités, résolution, inférence ───────────────────────────────────────

/** Affinité d'un motif avec une direction (0 = incompatible, sauf en accent créatif). */
export function patternAffinity(p: PatternDef, direction: DirectionId): number {
  if (p.directions && p.directions[direction] != null) return p.directions[direction] || 0;
  const t = p.tools;
  if (t.layout && t.layout !== 'classic') return LAYOUT_CATALOGUE[t.layout as Exclude<LayoutId, 'classic'>]?.directions[direction] || 0;
  const node = t.background ? CAP_BY_ID.get(`bg:${t.background}`) : t.annotate ? CAP_BY_ID.get(`annotate:${t.annotate}`) : t.treatment ? CAP_BY_ID.get(`treatment:${t.treatment}`) : t.logo ? CAP_BY_ID.get(`logo:${t.logo}`) : undefined;
  if (node) return node.suits?.directions?.[direction] || 0;
  if (t.transitionIn?.length) return Math.max(...t.transitionIn.map((id) => CAP_BY_ID.get(`transition:${id}`)?.suits?.directions?.[direction] || 0));
  if (t.techniques?.length) {
    const vocab = new Set<string>([...DIRECTIONS[direction].headline, ...DIRECTIONS[direction].support]);
    return (3 * t.techniques.filter((x) => vocab.has(x)).length) / t.techniques.length;
  }
  return 1;
}

/**
 * Combinaison peu courante pour cette direction : motif marqué expérimental, ou porté par une
 * direction qui ne l'emploie pas d'ordinaire (affinité < 1,5 : compatible, pas habituel).
 */
export const USUAL_AFFINITY = 1.5;
export function isExperimental(p: PatternDef, direction: DirectionId): boolean {
  return p.status === 'experimental' || patternAffinity(p, direction) < USUAL_AFFINITY;
}

/** Les intentions d'une scène, la principale d'abord (concept, contenu). */
export function sceneIntents(sceneId: string, slots: Record<string, string> = {}, concept?: string): IntentId[] {
  const title = slots.title || '';
  switch (sceneId) {
    case 'hook':
      if (/\?\s*$/.test(title) || concept === 'question') return ['question', 'grab'];
      if (concept === 'problem-solution') return ['problem', 'grab'];
      if (concept === 'teaser') return ['reveal', 'grab'];
      return ['grab', 'promise'];
    case 'statement':
      if (concept === 'problem-solution') return ['problem', 'promise'];
      if (concept === 'teaser') return ['reveal', 'promise'];
      return ['promise', 'proof'];
    case 'kinetic':
      return concept === 'offer-blast' ? ['urgency', 'grab'] : ['grab', 'promise'];
    case 'wordswap':
      return concept === 'offer-blast' ? ['urgency', 'promise'] : ['promise', 'urgency'];
    case 'stat':
      return /%/.test(slots.value || '') ? ['growth', 'proof'] : ['proof', 'growth'];
    case 'quote':
      return ['testimony', 'proof'];
    case 'benefits':
      return ['list', 'proof'];
    case 'offer':
      return slots.oldPrice ? ['comparison', 'urgency'] : ['urgency', 'comparison'];
    case 'product':
      return ['reveal', 'promise'];
    case 'event':
      return ['place', 'action'];
    case 'cta':
      return ['action', 'urgency'];
    case 'logo':
      return ['signature'];
    default:
      return ['reveal'];
  }
}

/** Le motif est-il possible sur cette scène, dans cette direction, sous cette DA ? */
export function patternFits(p: PatternDef, sc: LayoutScene, ctx: { direction: DirectionId; excludedLayouts?: string[]; boosts?: Record<string, number>; accent?: boolean }): boolean {
  if (!p.scenes.includes(sc.sceneId)) return false;
  const t = p.tools;
  if (t.layout && LAYOUT_SCENES.has(sc.sceneId) && !layoutFits(t.layout, sc, { direction: ctx.direction, excluded: ctx.excludedLayouts })) return false;
  if (t.layout && !LAYOUT_SCENES.has(sc.sceneId)) return false;
  // Une surcouche n'est jamais posée là où la charte l'interdit (malus de la DA, transitions exclues).
  const node = t.background ? `bg:${t.background}` : t.annotate ? `annotate:${t.annotate}` : undefined;
  if (node && (ctx.boosts?.[node] || 0) < 0) return false;
  if (t.annotate && (sc.slots.title || '').split(/\s+/).filter(Boolean).length < 3) return false;
  if (t.background && (sc.image || sc.video)) return false;
  // Hors de l'accent, un motif doit être porté par la direction.
  if (!ctx.accent && patternAffinity(p, ctx.direction) <= 0) return false;
  return true;
}

/** Les motifs « scène » possibles pour une scène (ceux qu'on peut assigner à n'importe quel cran). */
export function scenePatterns(sc: LayoutScene, ctx: { direction: DirectionId; excludedLayouts?: string[]; boosts?: Record<string, number> }): PatternDef[] {
  return PATTERNS.filter((p) => p.role === 'scene' && patternFits(p, sc, ctx));
}

/** Le motif qui correspond à une mise en page déjà décidée (retouche, critique, vidéo ancienne). */
export function patternForLayout(sceneId: string, layout: string | undefined, technique?: string): string | undefined {
  const candidates = PATTERNS.filter((p) => p.role === 'scene' && p.scenes.includes(sceneId) && (LAYOUT_SCENES.has(sceneId) ? (p.tools.layout || '') === (layout || 'classic') : !p.tools.layout));
  if (!candidates.length) return undefined;
  // L'entrée du titre trahit le motif (« la question qui s'écrit » = machine à écrire) ; sinon, sur
  // la composition de la direction, le motif générique : on n'invente pas une intention.
  const byTechnique = technique ? candidates.find((p) => !p.generic && p.tools.techniques?.includes(technique as TextTechnique)) : undefined;
  const generic = (layout || 'classic') === 'classic' ? candidates.find((p) => p.generic) : undefined;
  return (byTechnique || generic || candidates.find((p) => !p.generic) || candidates[0]).id;
}

/** Le motif d'un plan de médias ou de la signature, lu sur le kit. */
export function derivedPattern(sceneId: string, kit: { treatments?: Record<string, string>; logo?: string } | undefined, key: string): string | undefined {
  if (sceneId === 'logo') return PATTERNS.find((p) => p.family === 'brand' && p.tools.logo === (kit?.logo || 'classic'))?.id;
  if (sceneId === 'gallery') return 'photoGallery';
  if (sceneId === 'showcase3d') return 'productTurn';
  if (sceneId === 'lottie') return 'illustratedMoment';
  const treatment = kit?.treatments?.[key];
  if (treatment) return PATTERNS.find((p) => p.tools.treatment === treatment)?.id;
  return undefined;
}

/** Les capacités qui servent une intention (Intention → Capacité). */
export function capabilitiesForIntent(intent: IntentId): CapabilityId[] {
  return [...new Set(PATTERNS.filter((p) => p.intents.includes(intent)).flatMap((p) => p.capabilities))];
}

/** Les motifs que les faits du brief rendent possibles (cran Ultra : rien sans matière). */
export function factsAllow(p: PatternDef, facts: BriefFacts | undefined, photos: number): boolean {
  if (!p.needsFacts) return true;
  if (p.needsFacts === 'photo') return photos > 0;
  if (!facts) return false;
  if (p.needsFacts === 'percent') return facts.percents.length > 0 || facts.stats.some((s) => /%/.test(s.value));
  if (p.needsFacts === 'numbers') return facts.prices.length + facts.percents.length + facts.stats.length >= 1;
  if (p.needsFacts === 'places') return facts.places.length > 0;
  return true;
}

/** Les briques du kit d'une liste de motifs (manifeste restreint du codeur). */
export function kitOfPatterns(ids: string[]): string[] {
  return [...new Set(ids.flatMap((id) => PATTERN_BY_ID.get(id)?.kit || []))];
}

/**
 * Le motif d'une consigne libre (« VISUAL » du directeur), par mots-clés : sert à restreindre le
 * manifeste du codeur quand le directeur n'a pas nommé de motif.
 */
export function inferPatternFromText(text: string): string[] {
  const t = (text || '').toLowerCase();
  const out: string[] = [];
  if (/\b(bar|bars|barres|histogram|chart|graph)/.test(t)) out.push('chartExplosion');
  if (/\b(ring|anneau|donut|doughnut)\b/.test(t)) out.push('ringSweep');
  if (/\b(gauge|jauge)\b/.test(t)) out.push('gaugeFill');
  if (/\b(area|courbe|curve|line chart)\b/.test(t)) out.push('areaGrowth');
  if (/\b(map|carte|africa|afrique)\b/.test(t)) out.push('mapLightUp');
  if (/\b(sketch|pencil|crayon|hand-drawn|drawn|rough|doodle|arrow|flèche)/.test(t)) out.push('sketchProof');
  if (/\b(brush|pinceau|paint|stroke)/.test(t)) out.push('brushReveal');
  if (/\b(flow|noise|organic|flux|wave field)/.test(t)) out.push('flowReveal');
  if (/\b(3d|zdog|cube|sphere|box|cylinder|ring orbit|orbit)/.test(t)) out.push('spatialClimb');
  if (/\b(mosaic|voronoi|mosaïque|cells)/.test(t)) out.push('photoMosaic');
  if (/\b(counter|odometer|compteur|rolls?)\b/.test(t)) out.push('counterAcceleration');
  return [...new Set(out)];
}

/** Contrôle de cohérence (contrôles, doc) : chaque motif se résout en briques qui existent. */
export function patternIssues(kitNames: Set<string>): string[] {
  const issues: string[] = [];
  const techniques = new Set<string>(DIRECTION_IDS.flatMap((d) => [...DIRECTIONS[d].headline, ...DIRECTIONS[d].support]));
  const transitions = new Set<string>(TRANSITION_IDS);
  for (const p of PATTERNS) {
    const t = p.tools;
    if (t.layout && t.layout !== 'classic' && !LAYOUT_CATALOGUE[t.layout as Exclude<LayoutId, 'classic'>]) issues.push(`${p.id} : mise en page inconnue ${t.layout}`);
    if (t.layout && t.layout !== 'classic') {
      const def = LAYOUT_CATALOGUE[t.layout as Exclude<LayoutId, 'classic'>];
      const extra = p.scenes.filter((s) => def && !def.scenes.includes(s));
      if (extra.length) issues.push(`${p.id} : ${t.layout} ne met pas en page ${extra.join(', ')}`);
    }
    for (const x of t.techniques || []) if (!techniques.has(x)) issues.push(`${p.id} : technique inconnue ${x}`);
    for (const x of t.transitionIn || []) if (!transitions.has(x)) issues.push(`${p.id} : transition inconnue ${x}`);
    if (t.background && !CAP_BY_ID.has(`bg:${t.background}`)) issues.push(`${p.id} : fond inconnu ${t.background}`);
    if (t.annotate && !CAP_BY_ID.has(`annotate:${t.annotate}`)) issues.push(`${p.id} : annotation inconnue ${t.annotate}`);
    if (t.treatment && !CAP_BY_ID.has(`treatment:${t.treatment}`)) issues.push(`${p.id} : mise en scène inconnue ${t.treatment}`);
    if (t.logo && !CAP_BY_ID.has(`logo:${t.logo}`)) issues.push(`${p.id} : animation de logo inconnue ${t.logo}`);
    for (const k of p.kit) if (!kitNames.has(k)) issues.push(`${p.id} : ${k} n’est pas exporté par @idem/kit`);
    if (p.pitch.split(/\s+/).length > 14) issues.push(`${p.id} : ligne de menu trop longue`);
    if (p.role === 'ultra' && !p.recipe) issues.push(`${p.id} : motif Ultra sans consigne`);
  }
  for (const id of Object.keys(INTENTS) as IntentId[]) if (PATTERNS.filter((p) => p.intents.includes(id)).length < 2 && id !== 'signature') issues.push(`intention ${id} : moins de deux motifs`);
  return issues;
}

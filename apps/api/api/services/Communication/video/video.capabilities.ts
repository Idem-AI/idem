/**
 * LE GRAPHE DE CAPACITÉS — ce que la vidéo PEUT utiliser, et quand.
 *
 * Chaque nœud est une chose disponible dans l'environnement : une bibliothèque
 * installée, un addon du moteur, une animation de logo, un fond, une
 * annotation, une bibliothèque d'icônes, un effet 3D, une technique de texte,
 * une transition. Les arêtes disent ce qu'un nœud EXIGE (`requires` : un autre
 * nœud, donc un paquet à charger), ce qu'il EXCLUT (`conflicts`) et ce à quoi il
 * CONVIENT (`suits` : directions de motion, types de vidéo, objectifs,
 * directions artistiques de la marque, secteurs).
 *
 * Le ROUTEUR (`resolveKit`) parcourt le graphe avec le contexte du projet —
 * type, objectif, direction de motion, direction artistique, charte (logo
 * vectoriel analysé, symbole), médias disponibles, format, qualité, durée,
 * secteur, vidéos précédentes — et rend :
 *   - les choix du kit (fond, annotation, animation de logo, icônes, ressort, effets 3D) ;
 *   - les addons à charger dans la page (rien d'autre n'est embarqué) ;
 *   - le vocabulaire court que le modèle de copie peut employer (concepts d'icônes) ;
 *   - une trace lisible de chaque décision (pourquoi ce nœud, pourquoi pas les autres).
 *
 * Le routeur est déterministe (graine de la vidéo) et n'appelle aucun modèle.
 * Le modèle ne reçoit que le vocabulaire : il ne choisit jamais une bibliothèque.
 *
 * Doc générée depuis ce fichier : `npm run docs:video-graph` → docs/VIDEO_CAPABILITIES.md.
 */
import { KitDecision, VideoFormat, VideoKit, VideoObjective, VideoQuality, VideoType } from '../../../models/motionVideo.model';
import type { AddonId } from './video.engine';
import { ICON_CONCEPT_IDS, ICON_CONCEPTS, IconSetId, resolveConcept } from './video.icons';
import { LogoSvgInfo } from './video.logo';
import { DIRECTION_IDS, DirectionId, DIRECTIONS, TRANSITION_CATALOGUE, TRANSITION_IDS } from './video.direction';
import { LAYOUT_CATALOGUE, LAYOUT_IDS } from './video.layouts';
import { CONCEPT_IDS, CONCEPTS } from './video.concepts';
import { rng } from './video.music';

// ─── Nœuds ──────────────────────────────────────────────────────────────────

export type CapKind = 'library' | 'addon' | 'concept' | 'rhythm' | 'camera' | 'entrance' | 'accent' | 'treatment' | 'logo' | 'background' | 'annotate' | 'icons' | 'brandmark' | 'easing' | 'postfx' | 'media' | 'technique' | 'transition' | 'layout' | 'direction';

/** Conditions déclaratives (lisibles dans la doc, évaluées par `meets`). */
export interface CapWhen {
  /** Un logo vectoriel exploitable. */
  logoSvg?: boolean;
  logoMinShapes?: number;
  logoMaxShapes?: number;
  /** Pas d'image matricielle dans le SVG. */
  logoNoRaster?: boolean;
  /** Pas de dégradé (la morphose garde les aplats). */
  logoNoPaint?: boolean;
  /** Le symbole de la marque en image (assetUrls.icon). */
  logoIcon?: boolean;
  /** Qualité minimale du rendu. */
  minQuality?: VideoQuality;
  /** Au moins une scène 3D dans le storyboard. */
  scene3d?: boolean;
  /** Scènes du storyboard qui doivent exister (une au moins). */
  scenes?: string[];
  /** Médias importés requis. */
  media?: 'model3d' | 'lottie' | 'rive' | 'images' | 'video';
  /** Formats où le nœud est lisible. */
  formats?: VideoFormat[];
  /** Le type de vidéo doit le demander (ex. logo extrudé : type « logo »). */
  types?: VideoType[];
}

export type Determinism = 'pure' | 'seek' | 'clock-pinned' | 'static';

export interface CapNode {
  id: string;
  kind: CapKind;
  label: string;
  summary: string;
  /** Paquets npm qui l'implémentent. */
  packages?: string[];
  /** Le paquet de moteur à charger. */
  addon?: AddonId;
  /** Arêtes « exige ». */
  requires?: string[];
  /** Arêtes « exclut ». */
  conflicts?: string[];
  when?: CapWhen;
  /** Affinités (poids ajoutés au score). */
  suits?: {
    directions?: Partial<Record<DirectionId, number>>;
    types?: Partial<Record<VideoType, number>>;
    objectives?: Partial<Record<VideoObjective, number>>;
    /** styleId de la direction artistique de la marque. */
    arts?: Record<string, number>;
    /** Concepts de secteur (détectés dans le brief et le projet). */
    sectors?: Record<string, number>;
  };
  /** Coût de rendu : 0 négligeable → 3 lourd (SwiftShader). */
  cost: 0 | 1 | 2 | 3;
  /** Comment la bibliothèque est rendue image par image. */
  determinism: Determinism;
  /** Où vit l'implémentation. */
  impl?: string;
  /** Le modèle de copie peut-il le choisir (via un vocabulaire) ? */
  llm?: boolean;
}

const D = (o: Partial<Record<DirectionId, number>>) => o;

/** Bibliothèques installées (apps/api/package.json) : nœuds de documentation et cibles des arêtes. */
const LIBRARIES: CapNode[] = [
  { id: 'lib:react', kind: 'library', label: 'React 19 + ReactDOM', summary: 'Le moteur entier : une image = un rendu synchrone (flushSync) de <Video t={t}/>.', packages: ['react', 'react-dom'], cost: 0, determinism: 'pure', impl: 'video-engine/src/runtime.ts' },
  { id: 'lib:tailwind', kind: 'library', label: 'Tailwind CSS v4', summary: 'Utilitaires compilés au paquet ; palette par défaut retirée, seules les couleurs de la charte existent.', packages: ['tailwindcss', 'clsx', 'tailwind-merge'], cost: 0, determinism: 'static', impl: 'video-engine/src/tailwind.css' },
  { id: 'lib:motion', kind: 'library', label: 'Motion (ex-Framer Motion)', summary: 'Ressorts physiques et interpolation par images clés, fonctions pures du temps (pas animate()).', packages: ['motion'], cost: 0, determinism: 'pure', impl: 'video-engine/src/time.ts' },
  { id: 'lib:gsap', kind: 'library', label: 'GSAP 3 + DrawSVG, MorphSVG, MotionPath, CustomEase', summary: 'Timelines en pause posées par seek(t) ; horloge endormie.', packages: ['gsap', '@gsap/react'], addon: 'gsap', cost: 1, determinism: 'seek', impl: 'video-engine/src/addons/gsap.ts' },
  { id: 'lib:anime', kind: 'library', label: 'anime.js v4', summary: 'Timelines autoplay:false posées par seek(ms) ; stagger en grille.', packages: ['animejs'], addon: 'anime', cost: 1, determinism: 'seek', impl: 'video-engine/src/addons/anime.ts' },
  { id: 'lib:flubber', kind: 'library', label: 'flubber', summary: 'Morphose de formes SVG (1→1, 1→N, cercle→tracé), fonction pure.', packages: ['flubber'], addon: 'flubber', cost: 1, determinism: 'pure', impl: 'video-engine/src/addons/flubber.ts' },
  { id: 'lib:three', kind: 'library', label: 'three.js + React Three Fiber v9 + drei + postprocessing', summary: 'Racine R3F frameloop "never", advance(t) par image, horloge posée sur t, lumière Lightformer sans fichier.', packages: ['three', '@react-three/fiber', '@react-three/drei', '@react-three/postprocessing', 'postprocessing'], addon: 'three', cost: 3, determinism: 'clock-pinned', impl: 'video-engine/src/addons/three.tsx' },
  { id: 'lib:lottie', kind: 'library', label: 'lottie-web (light)', summary: 'Rendu SVG sans moteur d’expressions (aucun code d’un fichier importé ne s’exécute) ; goToAndStop(trame).', packages: ['lottie-web', 'jszip'], addon: 'lottie', cost: 1, determinism: 'seek', impl: 'video-engine/src/addons/lottie.ts' },
  { id: 'lib:rive', kind: 'library', label: 'Rive (canvas)', summary: 'Fichiers .riv importés ; WebAssembly embarqué ; scrub(animation, t).', packages: ['@rive-app/canvas'], addon: 'rive', cost: 2, determinism: 'seek', impl: 'video-engine/src/addons/rive.ts' },
  { id: 'lib:chartjs', kind: 'library', label: 'Chart.js 4 + datalabels, annotation, treemap, sankey, matrix', summary: 'Graphiques sur toile : animation coupée, valeurs de l’instant posées puis update("none") (dessin synchrone).', packages: ['chart.js', 'chartjs-plugin-datalabels', 'chartjs-plugin-annotation', 'chartjs-chart-treemap', 'chartjs-chart-sankey', 'chartjs-chart-matrix'], addon: 'chart', cost: 1, determinism: 'seek', impl: 'video-engine/src/addons/chart.ts' },
  { id: 'lib:visx', kind: 'library', label: 'visx v4 (composants de data-visualisation) + d3 (interpolate, delaunay, geo) + world-atlas', summary: 'Composants React en SVG sans animation propre (formes, échelles, dégradés, motifs, courbes, hiérarchies, projections) ; carte du monde en topojson.', packages: ['@visx/shape', '@visx/scale', '@visx/group', '@visx/gradient', '@visx/pattern', '@visx/curve', '@visx/text', '@visx/hierarchy', '@visx/heatmap', '@visx/glyph', '@visx/marker', '@visx/geo', '@visx/grid', '@visx/axis', 'd3-interpolate', 'd3-delaunay', 'd3-geo', 'topojson-client', 'world-atlas'], addon: 'viz', cost: 1, determinism: 'pure', impl: 'video-engine/src/addons/viz.ts' },
  { id: 'lib:draw', kind: 'library', label: 'rough.js + perfect-freehand + simplex-noise', summary: 'Formes dessinées à la main (graine fixe), traits de pinceau à pression, bruit continu à graine du moteur.', packages: ['roughjs', 'perfect-freehand', 'simplex-noise'], addon: 'draw', cost: 1, determinism: 'pure', impl: 'video-engine/src/addons/draw.ts' },
  { id: 'lib:zdog', kind: 'library', label: 'Zdog', summary: 'Objets en pseudo-3D plats et ronds rendus en SVG ; rotation posée puis updateRenderGraph(), sans boucle.', packages: ['zdog'], addon: 'zdog', cost: 1, determinism: 'pure', impl: 'video-engine/src/addons/zdog.ts' },
  { id: 'lib:lucide', kind: 'library', label: 'Lucide', summary: '~2 100 icônes au trait ; SVG lus côté serveur, jamais embarqués en bloc.', packages: ['lucide-static'], cost: 0, determinism: 'static', impl: 'api/services/Communication/video/video.icons.ts' },
  { id: 'lib:tabler', kind: 'library', label: 'Tabler Icons', summary: '~5 100 icônes au trait géométrique.', packages: ['@tabler/icons'], cost: 0, determinism: 'static', impl: 'api/services/Communication/video/video.icons.ts' },
  { id: 'lib:phosphor', kind: 'library', label: 'Phosphor Icons', summary: '~1 500 icônes × 6 graisses (thin, light, regular, bold, fill, duotone).', packages: ['@phosphor-icons/core'], cost: 0, determinism: 'static', impl: 'api/services/Communication/video/video.icons.ts' },
  { id: 'lib:heroicons', kind: 'library', label: 'Heroicons', summary: '~320 icônes pleines et denses.', packages: ['heroicons'], cost: 0, determinism: 'static', impl: 'api/services/Communication/video/video.icons.ts' },
];

/** Bibliothèque de chaque addon (nœud `lib:*`). */
const ADDON_LIB: Record<AddonId, string> = { three: 'three', gsap: 'gsap', anime: 'anime', flubber: 'flubber', lottie: 'lottie', rive: 'rive', chart: 'chartjs', viz: 'visx', draw: 'draw', zdog: 'zdog' };

const ADDONS: CapNode[] = (Object.keys(ADDON_LIB) as AddonId[]).map((id) => ({
  id: `addon:${id}`,
  kind: 'addon',
  label: `addon-${id}.js`,
  summary: `Paquet du moteur chargé seulement si un nœud retenu l'exige.`,
  addon: id,
  requires: [`lib:${ADDON_LIB[id]}`],
  cost: id === 'three' ? 3 : id === 'rive' ? 2 : 1,
  determinism: id === 'three' ? 'clock-pinned' : ['flubber', 'viz', 'draw', 'zdog'].includes(id) ? 'pure' : 'seek',
  impl: `public/video-engine/addon-${id}.js`,
}));

const LOGO: CapNode[] = [
  {
    id: 'logo:classic',
    kind: 'logo',
    label: 'Signature de la direction',
    summary: 'Fin propre à la direction (mot-symbole géant, filet suisse, carte de papier, éclat…), logo en image.',
    cost: 0,
    determinism: 'pure',
    suits: { directions: D({ brutal: 1.5, collage: 1.5, kinetic: 1, drenched: 1 }) },
    impl: 'video-engine/src/scenes.tsx#Logo',
  },
  {
    id: 'logo:draw',
    kind: 'logo',
    label: 'Tracé puis remplissage',
    summary: 'Les contours du logo vectoriel se tracent, le remplissage monte ensuite.',
    when: { logoSvg: true, logoMinShapes: 1, logoMaxShapes: 40, logoNoRaster: true },
    cost: 0,
    determinism: 'pure',
    suits: { directions: D({ precision: 2, editorial: 1.5, swiss: 1, cinematic: 1 }), types: { logo: 1.5 }, arts: { minimalism: 1, swiss: 1, handwritten: 1.5 } },
    impl: 'video-engine/src/kit/LogoMotion.tsx#drawPlan',
  },
  {
    id: 'logo:trace',
    kind: 'logo',
    label: 'Plume',
    summary: 'Une plume parcourt les contours (GSAP DrawSVG + CustomEase « main »), forme après forme.',
    requires: ['addon:gsap'],
    when: { logoSvg: true, logoMinShapes: 1, logoMaxShapes: 12, logoNoRaster: true },
    cost: 1,
    determinism: 'seek',
    suits: { directions: D({ editorial: 2, collage: 1.5, precision: 1 }), arts: { handwritten: 2, bohemian: 1.5, retro: 1 } },
    impl: 'video-engine/src/kit/LogoMotion.tsx#tracePlan',
  },
  {
    id: 'logo:morph',
    kind: 'logo',
    label: 'Point → logo',
    summary: 'Un point grossit puis se divise et prend la forme exacte de chaque partie du logo (flubber).',
    requires: ['addon:flubber'],
    when: { logoSvg: true, logoMinShapes: 1, logoMaxShapes: 16, logoNoRaster: true, logoNoPaint: true },
    cost: 1,
    determinism: 'pure',
    suits: { directions: D({ kinetic: 2, drenched: 1.5, precision: 1, cinematic: 0.5 }), types: { logo: 1.5, illustrated: 1 }, arts: { futuristic: 1.5, 'pop-art': 1, clay: 1 } },
    impl: 'video-engine/src/kit/LogoMotion.tsx#morphPlan',
  },
  {
    id: 'logo:assemble',
    kind: 'logo',
    label: 'Assemblage',
    summary: 'Les formes arrivent de directions différentes et s’emboîtent (ressort si la direction rebondit).',
    when: { logoSvg: true, logoMinShapes: 2, logoMaxShapes: 48 },
    cost: 0,
    determinism: 'pure',
    suits: { directions: D({ collage: 2, kinetic: 1.5, brutal: 1 }), arts: { maximalism: 1, 'collage-art': 2, y2k: 1 } },
    impl: 'video-engine/src/kit/LogoMotion.tsx#assemblePlan',
  },
  {
    id: 'logo:wipe',
    kind: 'logo',
    label: 'Balayage oblique',
    summary: 'Une diagonale révèle le logo entier ; accepte tout SVG (texte, image, dégradé).',
    when: { logoSvg: true },
    cost: 0,
    determinism: 'pure',
    suits: { directions: D({ swiss: 2, brutal: 1.5, cinematic: 1, drenched: 1 }) },
    impl: 'video-engine/src/kit/LogoMotion.tsx#wipePlan',
  },
  {
    id: 'logo:split',
    kind: 'logo',
    label: 'Symbole puis nom',
    summary: 'Le symbole se pose, le nom de la marque glisse de derrière lui.',
    when: { logoIcon: true },
    cost: 0,
    determinism: 'pure',
    suits: { directions: D({ precision: 1, swiss: 1, editorial: 1, cinematic: 1 }), objectives: { opening: 1, announce: 0.5 } },
    impl: 'video-engine/src/scenes.tsx#Logo',
  },
  {
    id: 'logo:extrude',
    kind: 'logo',
    label: 'Logo extrudé en 3D',
    summary: 'Le symbole SVG extrudé, lumière de studio et reflet qui balaie la tranche (R3F).',
    requires: ['addon:three'],
    when: { logoSvg: true, logoNoRaster: true, types: ['logo'] },
    cost: 3,
    determinism: 'clock-pinned',
    suits: { types: { logo: 3 }, directions: D({ precision: 1, cinematic: 1 }) },
    impl: 'video-engine/src/addons/three.tsx#LogoRig',
  },
];

const BACKGROUNDS: CapNode[] = [
  { id: 'bg:none', kind: 'background', label: 'Aucun fond', summary: 'La surface seule : le choix par défaut des directions sobres (pas de décor par défaut).', cost: 0, determinism: 'static', suits: { directions: D({ precision: 2, cinematic: 2, editorial: 1.5, swiss: 1, drenched: 1, brutal: 1, kinetic: 0.5, collage: 0.5 }) } },
  { id: 'bg:flow-field', kind: 'background', label: 'Lignes de flux', summary: 'Lignes qui ondulent dans un champ de bruit simplex, aux couleurs de la marque, du côté libre.', requires: ['addon:draw'], cost: 1, determinism: 'pure', suits: { directions: D({ cinematic: 1.5, precision: 1, drenched: 1.5, editorial: 0.5 }), arts: { aurora: 2, surreal: 1.5, futuristic: 1, minimalism: 0.5 }, sectors: { water: 1.5, eco: 1, health: 1, internet: 1 } }, impl: 'video-engine/src/kit/Backdrop.tsx#FlowFieldBg' },
  { id: 'bg:sketch-shapes', kind: 'background', label: 'Formes au crayon', summary: 'Cercle, carré, trait et arc de la charte tracés à la main (rough.js), l’un après l’autre.', requires: ['addon:draw'], cost: 1, determinism: 'pure', suits: { directions: D({ collage: 2, editorial: 1.5, kinetic: 1 }), arts: { handwritten: 2.5, bohemian: 1.5, 'collage-art': 1.5, clay: 1 }, sectors: { education: 1.5, book: 1, family: 1, smile: 1 } }, impl: 'video-engine/src/kit/Backdrop.tsx#SketchShapesBg' },
  { id: 'bg:voronoi', kind: 'background', label: 'Mosaïque', summary: 'Cellules de Voronoï aux couleurs de la charte qui dérivent lentement (d3-delaunay).', requires: ['addon:viz'], cost: 1, determinism: 'pure', suits: { directions: D({ swiss: 1, precision: 1, drenched: 1.5, kinetic: 1 }), arts: { 'vector-art': 2, maximalism: 1, futuristic: 1, 'pop-art': 0.5 }, sectors: { chart: 1, code: 1, design: 1 } }, impl: 'video-engine/src/kit/Backdrop.tsx#VoronoiBg' },
  { id: 'bg:flat3d', kind: 'background', label: 'Objets 3D plats', summary: 'Boîte, anneau et sphère en pseudo-3D (Zdog) qui tournent lentement du côté libre, sans WebGL.', requires: ['addon:zdog'], cost: 1, determinism: 'pure', suits: { directions: D({ kinetic: 1.5, collage: 1, precision: 1 }), arts: { clay: 2, y2k: 1.5, 'vector-art': 1.5, futuristic: 1 }, sectors: { delivery: 1.5, rocket: 1, store: 1, gift: 1 } }, impl: 'video-engine/src/kit/Backdrop.tsx#Flat3DBg' },
  { id: 'bg:dot-grid', kind: 'background', label: 'Trame de points', summary: 'Points réguliers révélés depuis le coin libre.', cost: 0, determinism: 'pure', suits: { directions: D({ swiss: 2, precision: 1.5 }), arts: { minimalism: 1, swiss: 1.5, futuristic: 1 }, sectors: { code: 1, business: 1, chart: 1 } }, impl: 'video-engine/src/kit/Backdrop.tsx#DotGrid' },
  { id: 'bg:halftone', kind: 'background', label: 'Demi-teinte', summary: 'Trame d’imprimerie qui fleurit dans un coin, dérive lente.', cost: 0, determinism: 'pure', suits: { directions: D({ editorial: 1.5, collage: 2 }), arts: { retro: 2, 'pop-art': 2, 'collage-art': 1 }, sectors: { fashion: 1, music: 1, book: 1 } }, impl: 'video-engine/src/kit/Backdrop.tsx#Halftone' },
  { id: 'bg:shape-field', kind: 'background', label: 'Formes de la marque', summary: 'Cercles, carrés, anneaux aux couleurs de la charte, groupés du côté libre.', cost: 0, determinism: 'pure', suits: { directions: D({ kinetic: 2, collage: 1.5 }), objectives: { promotion: 1, event: 1, opening: 1 }, arts: { maximalism: 1.5, y2k: 1.5, clay: 1, 'pop-art': 1 }, sectors: { family: 1, food: 0.5, smile: 1 } }, impl: 'video-engine/src/kit/Backdrop.tsx#ShapeField' },
  { id: 'bg:stagger-grid', kind: 'background', label: 'Vague en grille', summary: 'Grille de points qui s’allume en vague depuis le centre (anime.js stagger grid).', requires: ['addon:anime'], cost: 1, determinism: 'seek', suits: { directions: D({ kinetic: 1.5, drenched: 1.5, precision: 0.5 }), arts: { futuristic: 2, cyberpunk: 1.5 }, sectors: { code: 1.5, internet: 1, rocket: 1 } }, impl: 'video-engine/src/kit/Backdrop.tsx#StaggerGrid' },
  { id: 'bg:marquee', kind: 'background', label: 'Bandeau du nom', summary: 'Le nom de la marque en très grand, au trait, qui défile en fond.', cost: 0, determinism: 'pure', suits: { directions: D({ brutal: 2, kinetic: 1 }), objectives: { promotion: 1, event: 1 }, arts: { graffiti: 1.5, maximalism: 1, cyberpunk: 1 } }, impl: 'video-engine/src/kit/Backdrop.tsx#Marquee' },
  { id: 'bg:spotlight', kind: 'background', label: 'Halo', summary: 'Un halo de la couleur d’accent qui glisse lentement.', cost: 0, determinism: 'pure', suits: { directions: D({ cinematic: 1, drenched: 2 }), arts: { aurora: 2, glassmorphism: 1 }, sectors: { beauty: 1.5, drink: 0.5 } }, impl: 'video-engine/src/kit/Backdrop.tsx#Spotlight' },
  { id: 'bg:ticks', kind: 'background', label: 'Graduations', summary: 'Graduations de règle sur deux bords : mesure, exactitude.', cost: 0, determinism: 'pure', suits: { directions: D({ precision: 2, swiss: 1 }), arts: { minimalism: 1, futuristic: 1 }, sectors: { tools: 1.5, chart: 1, health: 0.5, business: 0.5 } }, impl: 'video-engine/src/kit/Backdrop.tsx#Ticks' },
];

const ANNOTATIONS: CapNode[] = [
  { id: 'annotate:none', kind: 'annotate', label: 'Aucune annotation', summary: 'Le mot mis en valeur change seulement de couleur.', cost: 0, determinism: 'static', suits: { directions: D({ precision: 2, cinematic: 2, swiss: 1.5, brutal: 1, drenched: 1, editorial: 0.5 }) } },
  { id: 'annotate:marker', kind: 'annotate', label: 'Surligneur', summary: 'Un trait de surligneur glisse derrière le mot.', cost: 0, determinism: 'pure', suits: { directions: D({ kinetic: 1.5, collage: 1, editorial: 1 }), objectives: { promotion: 1 }, arts: { 'pop-art': 1, y2k: 1 } }, impl: 'video-engine/src/kit/Em.tsx' },
  { id: 'annotate:underline', kind: 'annotate', label: 'Soulignement à la main', summary: 'Un trait de feutre souligne le mot.', cost: 0, determinism: 'pure', suits: { directions: D({ editorial: 2, collage: 1 }), arts: { handwritten: 2, bohemian: 1 } }, impl: 'video-engine/src/kit/Em.tsx' },
  { id: 'annotate:sketch-circle', kind: 'annotate', label: 'Cercle au crayon', summary: 'Le mot est entouré d’un double trait de crayon (rough.js).', requires: ['addon:draw'], cost: 1, determinism: 'pure', suits: { directions: D({ collage: 1.5, editorial: 1, kinetic: 0.5 }), objectives: { promotion: 0.5, event: 0.5 }, arts: { handwritten: 2, 'collage-art': 1, bohemian: 1 } }, impl: 'video-engine/src/kit/Em.tsx' },
  { id: 'annotate:brush', kind: 'annotate', label: 'Coup de pinceau', summary: 'Un coup de pinceau à pression variable passe sous le mot (perfect-freehand).', requires: ['addon:draw'], cost: 1, determinism: 'pure', suits: { directions: D({ editorial: 1.5, kinetic: 1, collage: 1, drenched: 0.5 }), objectives: { promotion: 0.5 }, arts: { handwritten: 1.5, bohemian: 1.5, retro: 1, aurora: 0.5 } }, impl: 'video-engine/src/kit/Em.tsx' },
  { id: 'annotate:circle', kind: 'annotate', label: 'Cercle à la main', summary: 'Le mot est entouré d’un trait de feutre.', cost: 0, determinism: 'pure', suits: { directions: D({ collage: 2, kinetic: 1 }), objectives: { promotion: 1, event: 0.5 }, arts: { handwritten: 1.5, 'collage-art': 1.5, retro: 1 } }, impl: 'video-engine/src/kit/Em.tsx' },
];

const ICON_SETS: CapNode[] = [
  { id: 'icons:lucide', kind: 'icons', label: 'Lucide (trait 1,6)', summary: 'Trait régulier et net.', requires: ['lib:lucide'], cost: 0, determinism: 'static', suits: { directions: D({ precision: 3, editorial: 0.5 }), arts: { minimalism: 1 } } },
  { id: 'icons:tabler', kind: 'icons', label: 'Tabler (trait 1,75)', summary: 'Trait géométrique.', requires: ['lib:tabler'], cost: 0, determinism: 'static', suits: { directions: D({ swiss: 3, precision: 1 }), arts: { swiss: 1.5 } } },
  { id: 'icons:phosphor-thin', kind: 'icons', label: 'Phosphor Thin', summary: 'Trait très fin, élégant.', requires: ['lib:phosphor'], cost: 0, determinism: 'static', suits: { directions: D({ cinematic: 3 }), arts: { victorian: 1, editorial: 1 } } },
  { id: 'icons:phosphor-light', kind: 'icons', label: 'Phosphor Light', summary: 'Trait léger, éditorial.', requires: ['lib:phosphor'], cost: 0, determinism: 'static', suits: { directions: D({ editorial: 3, cinematic: 0.5 }) } },
  { id: 'icons:phosphor-bold', kind: 'icons', label: 'Phosphor Bold', summary: 'Trait épais, affirmé.', requires: ['lib:phosphor'], cost: 0, determinism: 'static', suits: { directions: D({ brutal: 3 }), arts: { graffiti: 1 } } },
  { id: 'icons:phosphor-fill', kind: 'icons', label: 'Phosphor Fill', summary: 'Pictogrammes pleins.', requires: ['lib:phosphor'], cost: 0, determinism: 'static', suits: { directions: D({ kinetic: 3, drenched: 1 }), arts: { 'pop-art': 1 } } },
  { id: 'icons:phosphor-duotone', kind: 'icons', label: 'Phosphor Duotone', summary: 'Deux tons, façon découpage.', requires: ['lib:phosphor'], cost: 0, determinism: 'static', suits: { directions: D({ collage: 3 }), arts: { 'collage-art': 1, clay: 1 } } },
  { id: 'icons:heroicons-solid', kind: 'icons', label: 'Heroicons Solid', summary: 'Plein et dense, lisible sur aplat.', requires: ['lib:heroicons'], cost: 0, determinism: 'static', suits: { directions: D({ drenched: 3 }) } },
];

/**
 * Le GRAND MOMENT : une scène par vidéo (choisie par le modèle, ou par le concept)
 * reçoit un effet — l'effet, lui, vient de la direction, donc de la charte.
 */
const ACCENTS: CapNode[] = [
  { id: 'accent:punch', kind: 'accent', label: 'Coup de poing', summary: 'Zoom bref et éclair de couleur à l’entrée de la scène, son d’impact.', cost: 0, determinism: 'pure', suits: { directions: D({ brutal: 2.5, kinetic: 2, collage: 1.5 }) }, impl: 'video-engine/src/App.tsx#AccentFlash' },
  { id: 'accent:giant', kind: 'accent', label: 'Titre géant', summary: 'Le titre de la scène occupe tout le cadre.', cost: 0, determinism: 'pure', suits: { directions: D({ swiss: 2, brutal: 1.5, drenched: 1.5, precision: 1, kinetic: 1 }) }, impl: 'video-engine/src/scenes.tsx#Headline' },
  { id: 'accent:hold', kind: 'accent', label: 'Temps suspendu', summary: 'La scène dure plus longtemps et ses entrées ralentissent : on laisse respirer.', cost: 0, determinism: 'pure', suits: { directions: D({ cinematic: 2.5, editorial: 2, precision: 1 }) }, impl: 'video-engine/src/text.tsx#Kinetic' },
  { id: 'accent:flip', kind: 'accent', label: 'Bascule de couleur', summary: 'La scène prend la couleur qui tranche avec ses voisines.', cost: 0, determinism: 'static', suits: { directions: D({ drenched: 2, swiss: 1.5, precision: 1, editorial: 0.5 }) }, impl: 'api/services/Communication/video/video.storyboard.ts' },
];

/**
 * Mises en scène des plans (clips, photos plein cadre) : une par plan, jamais deux
 * fois la même de suite, différente des vidéos récentes. Plus de « fond + dégradé + boîte ».
 */
const TREATMENTS: CapNode[] = [
  { id: 'treatment:split', kind: 'treatment', label: 'Écran partagé', summary: 'Le clip sur une moitié du cadre, le texte sur l’aplat de la marque, une couture de couleur.', cost: 0, determinism: 'pure', suits: { directions: D({ swiss: 2, precision: 2, editorial: 1, brutal: 1 }), arts: { swiss: 1.5, minimalism: 1 } }, impl: 'video-engine/src/treatments.tsx#Split' },
  { id: 'treatment:window', kind: 'treatment', label: 'Fenêtre', summary: 'Le clip apparaît dans une forme qui s’ouvre : arche, cercle ou rectangle.', cost: 0, determinism: 'pure', suits: { directions: D({ editorial: 2, collage: 2, cinematic: 1, drenched: 1, kinetic: 1, precision: 1 }), arts: { bohemian: 1.5, retro: 1, handwritten: 1, victorian: 1 } }, impl: 'video-engine/src/treatments.tsx#Window' },
  { id: 'treatment:blinds', kind: 'treatment', label: 'Lames', summary: 'Des lames découvrent le clip ; une bande reste et porte le titre.', cost: 0, determinism: 'pure', suits: { directions: D({ brutal: 2, swiss: 1.5, kinetic: 1.5, drenched: 1 }), arts: { maximalism: 1, graffiti: 1 } }, impl: 'video-engine/src/treatments.tsx#Blinds' },
  { id: 'treatment:magazine', kind: 'treatment', label: 'Page de magazine', summary: 'Titre en haut, clip encadré au centre, légende en bas, filet décalé.', cost: 0, determinism: 'pure', suits: { directions: D({ editorial: 2.5, precision: 1.5, swiss: 1, collage: 1 }), arts: { editorial: 2, minimalism: 1 } }, impl: 'video-engine/src/treatments.tsx#Magazine' },
  { id: 'treatment:knockout', kind: 'treatment', label: 'Clip dans les lettres', summary: 'Le clip joue dans les lettres géantes du titre, puis la caméra traverse le texte.', cost: 0, determinism: 'pure', suits: { directions: D({ kinetic: 2, brutal: 2, drenched: 1.5, swiss: 1, editorial: 0.5 }), arts: { maximalism: 1.5, 'pop-art': 1, cyberpunk: 1, futuristic: 1 } }, impl: 'video-engine/src/treatments.tsx#Knockout' },
  { id: 'treatment:inline', kind: 'treatment', label: 'Clip dans la phrase', summary: 'Le clip dans une capsule insérée au milieu du titre.', cost: 0, determinism: 'pure', suits: { directions: D({ kinetic: 2, collage: 2, editorial: 1, precision: 1 }), arts: { y2k: 1.5, clay: 1, 'pop-art': 1 } }, impl: 'video-engine/src/treatments.tsx#Inline' },
  { id: 'treatment:duotone', kind: 'treatment', label: 'Bichromie', summary: 'Le clip aux couleurs de la marque, titre géant au trait.', cost: 0, determinism: 'pure', suits: { directions: D({ drenched: 3, kinetic: 1, brutal: 1 }), arts: { aurora: 1, surreal: 1, 'pop-art': 1 } }, impl: 'video-engine/src/treatments.tsx#Duotone' },
  { id: 'treatment:broadcast', kind: 'treatment', label: 'Barre de titre', summary: 'Barre et onglet façon télévision, sur le clip plein cadre.', cost: 0, determinism: 'pure', suits: { directions: D({ precision: 2, swiss: 1.5 }) }, impl: 'video-engine/src/treatments.tsx#Broadcast' },
  { id: 'treatment:cinema', kind: 'treatment', label: 'Cinéma', summary: 'Sous-titres sur le clip, vignettage de film.', cost: 0, determinism: 'pure', suits: { directions: D({ cinematic: 3 }) }, impl: 'video-engine/src/treatments.tsx#Cinema' },
];

/**
 * RYTHME, CAMÉRA, ENTRÉES : ce qui faisait que deux vidéos d'une même direction se
 * ressemblaient (même tempo, même caméra, mêmes entrées). Désormais choisis par vidéo.
 */
const RHYTHMS: CapNode[] = [
  { id: 'rhythm:steady', kind: 'rhythm', label: 'Régulier', summary: 'Chaque scène a son temps de lecture, coupes sur le temps.', cost: 0, determinism: 'pure', suits: { directions: D({ precision: 1.5, swiss: 1.5, editorial: 1 }), objectives: { announce: 0.5, recruitment: 0.5 } }, impl: 'api/services/Communication/video/video.rhythm.ts' },
  { id: 'rhythm:crescendo', kind: 'rhythm', label: 'Crescendo', summary: 'Ça s’accélère jusqu’au grand moment, puis la signature respire.', cost: 0, determinism: 'pure', suits: { directions: D({ kinetic: 2, drenched: 1.5, brutal: 1, swiss: 0.5 }), objectives: { promotion: 1, event: 1, opening: 1 } }, impl: 'api/services/Communication/video/video.rhythm.ts' },
  { id: 'rhythm:staccato', kind: 'rhythm', label: 'Staccato', summary: 'Coupes sèches sur chaque temps, textes brefs.', cost: 0, determinism: 'pure', suits: { directions: D({ brutal: 2, kinetic: 2, collage: 1 }), objectives: { promotion: 1.5 } }, impl: 'api/services/Communication/video/video.rhythm.ts' },
  { id: 'rhythm:breathe', kind: 'rhythm', label: 'Ample', summary: 'Longues tenues, entrées lentes, coupes à la mesure.', cost: 0, determinism: 'pure', suits: { directions: D({ cinematic: 2.5, editorial: 2, precision: 1 }), objectives: { testimonial: 1, announce: 0.5 } }, impl: 'api/services/Communication/video/video.rhythm.ts' },
  { id: 'rhythm:drop', kind: 'rhythm', label: 'Montée puis drop', summary: 'Une montée lente, puis tout s’accélère au grand moment.', cost: 0, determinism: 'pure', suits: { directions: D({ drenched: 2, kinetic: 1.5, cinematic: 1, brutal: 1, collage: 0.5 }), objectives: { product: 1, opening: 1 } }, impl: 'api/services/Communication/video/video.rhythm.ts' },
];

const CAMERAS: CapNode[] = [
  { id: 'camera:still', kind: 'camera', label: 'Fixe', summary: 'Aucun mouvement de caméra : la typographie porte tout.', cost: 0, determinism: 'pure', suits: { directions: D({ swiss: 2, brutal: 2, collage: 1.5 }) }, impl: 'video-engine/src/layout.tsx#useCamera' },
  { id: 'camera:push', kind: 'camera', label: 'Poussée', summary: 'La caméra avance lentement vers le texte.', cost: 0, determinism: 'pure', suits: { directions: D({ cinematic: 2, kinetic: 1.5, drenched: 1.5 }) }, impl: 'video-engine/src/layout.tsx#useCamera' },
  { id: 'camera:pull', kind: 'camera', label: 'Recul', summary: 'La caméra recule et se pose.', cost: 0, determinism: 'pure', suits: { directions: D({ precision: 1.5, cinematic: 1.5, editorial: 1 }) }, impl: 'video-engine/src/layout.tsx#useCamera' },
  { id: 'camera:drift', kind: 'camera', label: 'Dérive', summary: 'Un glissement latéral, dans un sens puis dans l’autre.', cost: 0, determinism: 'pure', suits: { directions: D({ editorial: 2, precision: 1.5, cinematic: 1 }) }, impl: 'video-engine/src/layout.tsx#useCamera' },
  { id: 'camera:rise', kind: 'camera', label: 'Élévation', summary: 'Le bloc monte doucement pendant la scène.', cost: 0, determinism: 'pure', suits: { directions: D({ drenched: 1, kinetic: 1, collage: 1, editorial: 0.5 }) }, impl: 'video-engine/src/layout.tsx#useCamera' },
  { id: 'camera:tilt', kind: 'camera', label: 'Bascule 3D', summary: 'Légère rotation en perspective, comme un plan tourné.', cost: 0, determinism: 'pure', suits: { directions: D({ kinetic: 1.5, precision: 1, drenched: 1 }), arts: { futuristic: 2, glassmorphism: 1.5, cyberpunk: 1 } }, impl: 'video-engine/src/layout.tsx#useCamera' },
];

const ENTRANCES: CapNode[] = [
  { id: 'entrance:rise', kind: 'entrance', label: 'Montée', summary: 'Les éléments montent en fondu.', cost: 0, determinism: 'pure', suits: { directions: D({ editorial: 1.5, precision: 1.5, cinematic: 1.5, swiss: 1 }) }, impl: 'video-engine/src/layout.tsx#useEnter' },
  { id: 'entrance:spring', kind: 'entrance', label: 'Ressort', summary: 'Les éléments dépassent leur place puis se posent (ressort physique motion).', requires: ['lib:motion'], cost: 0, determinism: 'pure', suits: { directions: D({ kinetic: 2, collage: 1.5, drenched: 1 }) }, impl: 'video-engine/src/layout.tsx#useEnter' },
  { id: 'entrance:flip', kind: 'entrance', label: 'Bascule', summary: 'Les éléments basculent vers le spectateur (3D).', cost: 0, determinism: 'pure', suits: { directions: D({ swiss: 1.5, precision: 1.5, kinetic: 1, editorial: 0.5 }) }, impl: 'video-engine/src/layout.tsx#useEnter' },
  { id: 'entrance:unfold', kind: 'entrance', label: 'Dépliage', summary: 'Les éléments se déplient depuis leur bord haut.', cost: 0, determinism: 'pure', suits: { directions: D({ editorial: 1.5, swiss: 1.5, brutal: 1 }) }, impl: 'video-engine/src/layout.tsx#useEnter' },
  { id: 'entrance:skew', kind: 'entrance', label: 'Glissé penché', summary: 'Les éléments arrivent penchés, puis se redressent.', cost: 0, determinism: 'pure', suits: { directions: D({ brutal: 2, kinetic: 1, swiss: 1 }) }, impl: 'video-engine/src/layout.tsx#useEnter' },
  { id: 'entrance:iris', kind: 'entrance', label: 'Iris', summary: 'Les éléments s’ouvrent depuis leur centre.', cost: 0, determinism: 'pure', suits: { directions: D({ cinematic: 1.5, drenched: 1.5, precision: 1 }) }, impl: 'video-engine/src/layout.tsx#useEnter' },
  { id: 'entrance:drop', kind: 'entrance', label: 'Chute', summary: 'Les éléments tombent et se posent de travers, comme des papiers.', cost: 0, determinism: 'pure', suits: { directions: D({ collage: 2, kinetic: 1 }) }, impl: 'video-engine/src/layout.tsx#useEnter' },
  { id: 'entrance:pop', kind: 'entrance', label: 'Pop', summary: 'Les éléments jaillissent en tournant légèrement.', cost: 0, determinism: 'pure', suits: { directions: D({ kinetic: 1.5, collage: 1.5 }) }, impl: 'video-engine/src/layout.tsx#useEnter' },
  { id: 'entrance:slideLeft', kind: 'entrance', label: 'Glissé', summary: 'Les éléments glissent depuis la droite.', cost: 0, determinism: 'pure', suits: { directions: D({ swiss: 1.5, brutal: 1.5, precision: 1 }) }, impl: 'video-engine/src/layout.tsx#useEnter' },
];

/** Directions où la photo d'un produit passe en plein cadre (et reçoit une mise en scène). */
const FULL_BLEED_PRODUCT = new Set(['cinematic', 'drenched', 'kinetic']);

/** Les concepts narratifs, nœuds du graphe (générés depuis video.concepts.ts). */
function conceptNodes(): CapNode[] {
  return CONCEPT_IDS.map((id) => {
    const c = CONCEPTS[id];
    return {
      id: `concept:${id}`,
      kind: 'concept' as const,
      label: id,
      summary: c.pitch,
      cost: 0 as const,
      determinism: 'static' as const,
      suits: { objectives: c.suits.objectives, types: c.suits.types, directions: c.suits.directions, arts: c.suits.arts },
      impl: 'api/services/Communication/video/video.concepts.ts',
      llm: true,
    };
  });
}

/** Le logo pendant la vidéo (en plus de la signature finale). */
const BRANDMARKS: CapNode[] = [
  { id: 'brandmark:none', kind: 'brandmark', label: 'Pas de logo pendant la vidéo', summary: 'Le logo n’apparaît qu’à la signature finale.', cost: 0, determinism: 'static', suits: { directions: D({ brutal: 2, cinematic: 2, kinetic: 1.5, collage: 1.5, drenched: 1 }), types: { logo: 3, kinetic: 1 } } },
  {
    id: 'brandmark:corner',
    kind: 'brandmark',
    label: 'Logo discret en coin',
    summary: 'Le logo en monochrome (couleur du texte de la scène), sans conteneur, dans le coin que la composition laisse libre ; masqué sur les plans plein cadre.',
    when: { logoSvg: true },
    cost: 0,
    determinism: 'pure',
    suits: { directions: D({ swiss: 2, precision: 2, editorial: 1.5 }), types: { footage: 1.5, slideshow: 1, product: 1, mix: 1 }, arts: { minimalism: 1, swiss: 1.5, editorial: 1 } },
    impl: 'video-engine/src/App.tsx#Brandmark',
  },
];

const EXTRA: CapNode[] = [
  { id: 'easing:spring', kind: 'easing', label: 'Ressort physique', summary: 'Rebond réel (motion spring) au lieu d’une courbe : réservé aux directions qui rebondissent.', requires: ['lib:motion'], cost: 0, determinism: 'pure', suits: { directions: D({ kinetic: 3, collage: 3 }) } },
  { id: 'postfx:bloom', kind: 'postfx', label: 'Bloom 3D', summary: 'Halo léger sur les reflets de la scène 3D (premium seulement, coût SwiftShader).', requires: ['addon:three'], when: { scene3d: true, minQuality: 'premium' }, cost: 2, determinism: 'clock-pinned', suits: { directions: D({ cinematic: 2, precision: 1.5, drenched: 1 }) }, impl: 'video-engine/src/addons/three.tsx#Stage' },
  { id: 'postfx:smaa', kind: 'postfx', label: 'Anticrénelage SMAA', summary: 'Bords nets de la 3D (posé avec tout effet 3D).', requires: ['addon:three'], when: { scene3d: true, minQuality: 'hd' }, cost: 1, determinism: 'clock-pinned', impl: 'video-engine/src/addons/three.tsx#Stage' },
  { id: 'media:lottie', kind: 'media', label: 'Animation Lottie', summary: 'Lottie intégrée (aux couleurs de la marque) ou importée (.json, .lottie).', requires: ['addon:lottie'], when: { scenes: ['lottie'] }, cost: 1, determinism: 'seek', impl: 'video-engine/src/media.tsx#LottieBox' },
  { id: 'media:rive', kind: 'media', label: 'Animation Rive', summary: 'Fichier .riv importé, joué image par image.', requires: ['addon:rive'], when: { media: 'rive' }, cost: 2, determinism: 'seek', impl: 'video-engine/src/media.tsx#RiveBox' },
  { id: 'media:model3d', kind: 'media', label: 'Modèle 3D importé', summary: 'GLB tourné en studio, ombre de contact (R3F + drei).', requires: ['addon:three'], when: { media: 'model3d' }, cost: 3, determinism: 'clock-pinned', impl: 'video-engine/src/addons/three.tsx#ModelRig' },
  { id: 'media:cards3d', kind: 'media', label: 'Photos en cartes 3D', summary: 'Photos posées en arc, caméra qui tourne (R3F + drei RoundedBox).', requires: ['addon:three'], when: { scene3d: true, media: 'images' }, cost: 3, determinism: 'clock-pinned', impl: 'video-engine/src/addons/three.tsx#CardsRig' },
];

/** Techniques de texte et transitions : générées depuis les directions (aucune double saisie). */
function directionNodes(): CapNode[] {
  const nodes: CapNode[] = [];
  const techniques = new Map<string, Partial<Record<DirectionId, number>>>();
  const transitions = new Map<string, Partial<Record<DirectionId, number>>>();
  for (const id of DIRECTION_IDS) {
    const d = DIRECTIONS[id];
    nodes.push({ id: `direction:${id}`, kind: 'direction', label: id, summary: `Direction de motion « ${id} » (couleur ${d.color}, décor ${d.decor}).`, cost: 0, determinism: 'pure', impl: 'api/services/Communication/video/video.direction.ts' });
    for (const t of [...d.headline, ...d.support]) techniques.set(t, { ...(techniques.get(t) || {}), [id]: 1 });
    for (const t of d.transitions) transitions.set(t, { ...(transitions.get(t) || {}), [id]: 1 });
  }
  for (const [t, dirs] of techniques) nodes.push({ id: `technique:${t}`, kind: 'technique', label: t, summary: 'Technique d’entrée de texte.', cost: 0, determinism: 'pure', suits: { directions: dirs }, impl: 'video-engine/src/text.tsx' });
  // Transitions : tout le catalogue (une direction emprunte celles qui s'accordent à son caractère).
  for (const id of TRANSITION_IDS) {
    const def = TRANSITION_CATALOGUE[id];
    const dirs = { ...def.directions };
    for (const [d, w] of transitions.get(id) ? Object.entries(transitions.get(id)!) : []) dirs[d as DirectionId] = (dirs[d as DirectionId] || 0) + (w as number);
    nodes.push({ id: `transition:${id}`, kind: 'transition', label: id, summary: `${def.summary} (${def.feel})`, cost: 0, determinism: 'pure', suits: { directions: dirs }, impl: 'video-engine/src/transitions.tsx' });
  }
  // Mises en page : archétypes de composition, choisis scène par scène par l'agent directeur artistique.
  for (const id of LAYOUT_IDS) {
    const def = LAYOUT_CATALOGUE[id];
    nodes.push({ id: `layout:${id}`, kind: 'layout', label: id, summary: `${def.summary} — scènes : ${def.scenes.join(', ')}.`, cost: 0, determinism: 'pure', suits: { directions: def.directions }, impl: 'video-engine/src/layouts.tsx' });
  }
  return nodes;
}

export const CAPABILITIES: CapNode[] = [...LIBRARIES, ...ADDONS, ...conceptNodes(), ...RHYTHMS, ...CAMERAS, ...ENTRANCES, ...ACCENTS, ...TREATMENTS, ...LOGO, ...BACKGROUNDS, ...ANNOTATIONS, ...ICON_SETS, ...BRANDMARKS, ...EXTRA, ...directionNodes()];
export const CAP_BY_ID = new Map(CAPABILITIES.map((n) => [n.id, n]));

/** Bibliothèques évaluées et écartées, avec la raison (documentées dans VIDEO_ENGINE.md). */
export const EXCLUDED_LIBRARIES: { name: string; reason: string }[] = [
  { name: 'react-spring / @react-spring/three', reason: 'animation physique en temps réel (horloge interne) : une image ne se recalcule pas à un instant t donné.' },
  { name: 'motion animate() / <motion.div>', reason: 'lecture en temps réel ; seules les fonctions pures de motion (spring, interpolate) sont utilisées.' },
  { name: '@formkit/auto-animate', reason: 'anime les changements du DOM au fil du temps : sans objet pour un rendu image par image.' },
  { name: 'Remotion', reason: 'licence commerciale pour une entreprise ; le moteur maison couvre le besoin avec Puppeteer + ffmpeg.' },
  { name: 'Theatre.js', reason: 'éditeur de timelines pour un humain ; trop lourd pour un rendu piloté par données.' },
  { name: '@lottiefiles/dotlottie-web', reason: 'les .lottie sont décompressés côté serveur (jszip) et joués par lottie-web, sans second moteur WebAssembly.' },
  { name: 'Vivus, Rough Notation, mo.js', reason: 'tracé, annotations et éclats couverts par le kit (LogoMotion, Em, Backdrop) en fonctions du temps ; mo.js n’est plus maintenu.' },
  { name: 'Magic UI, React Bits, Aceternity, Motion Primitives', reason: 'collections à copier-coller pensées pour l’interaction (hover, scroll) ; leurs meilleures idées sont réécrites dans le kit en fonctions du temps, aux couleurs de la charte.' },
  { name: 'drei <Float>, <Sparkles>, <Text>, <Environment preset>', reason: 'Float et Sparkles lisent l’horloge (déterministes ici, mais remplacés par la prop t) ; Text et les presets d’Environment téléchargent des fichiers pendant le rendu.' },
  { name: 'lucide-react, @phosphor-icons/react', reason: 'tout le jeu d’icônes serait embarqué : le serveur n’injecte que les quelques SVG utilisés.' },
  { name: 'Recharts', reason: 'rendu en plusieurs passes par son store et ses effets : une image n’est pas garantie en un seul rendu synchrone ; visx couvre les composants de data-visualisation.' },
  { name: 'Nivo, Victory', reason: 'animations par react-spring ou minuteries (horloge interne).' },
  { name: 'ECharts, ApexCharts', reason: 'horloge d’animation propre et poids ; Chart.js (animation coupée, valeurs posées à chaque image) couvre le besoin.' },
  { name: 'p5.js, paper.js', reason: 'boucle de dessin propre et poids ; Zdog, rough.js, perfect-freehand et simplex-noise couvrent le dessin génératif image par image.' },
  { name: 'chartjs-chart-wordcloud, @visx/wordcloud', reason: 'placement des mots aléatoire : une image changerait d’une lecture à l’autre.' },
];

// ─── Contexte et routeur ────────────────────────────────────────────────────

export interface KitContext {
  type: VideoType;
  objective: VideoObjective;
  direction: DirectionId;
  artStyleId?: string;
  quality: VideoQuality;
  format: VideoFormat;
  durationSec: number;
  logo: LogoSvgInfo | null;
  /** Symbole de la marque en image. */
  hasLogoIcon: boolean;
  media: { images: number; videos: number; models: number; lotties: number; rive: number };
  /** Scènes du storyboard (clé, type de scène, médias). */
  scenes: { key: string; sceneId: string; hasMedia: boolean; hasTitle: boolean; three?: boolean }[];
  /** Texte du brief et du projet, pour détecter le secteur. */
  text: string;
  seed: number;
  /** Kits des vidéos précédentes du projet (variété). */
  recent?: VideoKit[];
  /** Bonus venus de la DA de la charte (éléments graphiques, à éviter) : id de nœud → poids. */
  boosts?: Record<string, number>;
}

export type { KitDecision, VideoKit };

const QUALITY_RANK: Record<VideoQuality, number> = { standard: 0, hd: 1, premium: 2 };

/** Concepts de secteur présents dans le texte du projet. */
export function sectorsOf(text: string): string[] {
  return ICON_CONCEPT_IDS.filter((c) => ICON_CONCEPTS[c].keywords.test(text));
}

/** Pourquoi un nœud n'est pas possible dans ce contexte (null s'il l'est). */
export function unmet(node: CapNode, ctx: KitContext): string | null {
  const w = node.when;
  if (w) {
    const l = ctx.logo;
    if (w.logoSvg && !l) return 'pas de logo vectoriel';
    if (l && w.logoMinShapes != null && l.shapes < w.logoMinShapes) return `logo : ${l.shapes} forme(s) < ${w.logoMinShapes}`;
    if (l && w.logoMaxShapes != null && l.shapes > w.logoMaxShapes) return `logo : ${l.shapes} formes > ${w.logoMaxShapes}`;
    if (l && w.logoNoRaster && l.images > 0) return 'logo avec image matricielle';
    if (l && w.logoNoPaint && l.paints > 0) return 'logo en dégradé';
    if (w.logoIcon && !ctx.hasLogoIcon) return 'pas de symbole en image';
    if (w.minQuality && QUALITY_RANK[ctx.quality] < QUALITY_RANK[w.minQuality]) return `qualité ${ctx.quality} < ${w.minQuality}`;
    if (w.scene3d && !ctx.scenes.some((s) => s.three)) return 'pas de scène 3D';
    if (w.scenes && !ctx.scenes.some((s) => w.scenes!.includes(s.sceneId))) return `aucune scène ${w.scenes.join('/')}`;
    if (w.media === 'model3d' && !ctx.media.models) return 'aucun modèle 3D';
    if (w.media === 'lottie' && !ctx.media.lotties) return 'aucune Lottie';
    if (w.media === 'rive' && !ctx.media.rive) return 'aucun fichier Rive';
    if (w.media === 'images' && !ctx.media.images) return 'aucune image';
    if (w.media === 'video' && !ctx.media.videos) return 'aucun clip';
    if (w.formats && !w.formats.includes(ctx.format)) return `format ${ctx.format}`;
    if (w.types && !w.types.includes(ctx.type)) return `type ${ctx.type}`;
  }
  for (const r of node.requires || []) {
    const dep = CAP_BY_ID.get(r);
    if (!dep) return `dépendance inconnue ${r}`;
    const why = unmet(dep, ctx);
    if (why) return `${r} : ${why}`;
  }
  return null;
}

/** Score d'affinité d'un nœud possible, avec ses raisons. */
function score(node: CapNode, ctx: KitContext, sectors: string[]): { score: number; why: string[] } {
  const s = node.suits || {};
  const why: string[] = [];
  let v = 1;
  const add = (w: number | undefined, label: string) => {
    if (!w) return;
    v += w;
    why.push(`${label} +${w}`);
  };
  add((s.directions?.[ctx.direction] || 0) * 1.5, `direction ${ctx.direction}`);
  add(s.types?.[ctx.type], `type ${ctx.type}`);
  add(s.objectives?.[ctx.objective], `objectif ${ctx.objective}`);
  if (ctx.artStyleId) add(s.arts?.[ctx.artStyleId.toLowerCase()], `DA ${ctx.artStyleId}`);
  for (const sec of sectors) add(s.sectors?.[sec], `secteur ${sec}`);
  // La charte : ses éléments graphiques poussent un nœud, ses « à éviter » l'écartent.
  const b = ctx.boosts?.[node.id];
  if (b) {
    v += b;
    why.push(`charte ${b > 0 ? '+' : ''}${b}`);
  }
  // Coût : une option lourde doit mériter sa place (rendu SwiftShader).
  if (node.cost >= 2) {
    v -= node.cost * 0.4;
    why.push(`coût ${node.cost} −${(node.cost * 0.4).toFixed(1)}`);
  }
  return { score: v, why };
}

/** Choisit un nœud d'un genre : possibles → scorés → variété (vidéos récentes) → tirage parmi les meilleurs. */
function choose(kind: CapKind, ctx: KitContext, sectors: string[], recentIds: string[], salt: number, filter?: (n: CapNode) => boolean): KitDecision {
  const rejected: { id: string; reason: string }[] = [];
  const pool: { node: CapNode; score: number; why: string[] }[] = [];
  for (const node of CAPABILITIES) {
    if (node.kind !== kind || (filter && !filter(node))) continue;
    const reason = unmet(node, ctx);
    if (reason) {
      rejected.push({ id: node.id, reason });
      continue;
    }
    const sc = score(node, ctx, sectors);
    // Mémoire décroissante (plus récent en dernier) : −1,5 pour les deux dernières vidéos,
    // −1 pour les deux d'avant, −0,5 au-delà. Des fenêtres fixes et identiques sur tous les
    // axes faisaient revenir la même combinaison toutes les quatre vidéos.
    const at = recentIds.lastIndexOf(node.id);
    if (at >= 0 && !node.id.endsWith(':none')) {
      const age = recentIds.length - 1 - at;
      const malus = age < 2 ? 1.5 : age < 4 ? 1 : 0.5;
      sc.score -= malus;
      sc.why.push(`déjà vu il y a ${age + 1} vidéo(s) −${malus}`);
    }
    pool.push({ node, ...sc });
  }
  pool.sort((a, b) => b.score - a.score || a.node.id.localeCompare(b.node.id));
  if (!pool.length) return { kind, chosen: '', score: 0, why: ['aucun nœud possible'], rejected };
  // Tirage déterministe parmi les nœuds proches du meilleur (variété sans perdre la cohérence).
  const best = pool[0].score;
  const close = pool.filter((p) => p.score >= best - 0.75);
  const pick = close[Math.floor(rng(ctx.seed ^ salt)() * close.length)];
  for (const p of pool) {
    if (p === pick) continue;
    rejected.push({ id: p.node.id, reason: close.includes(p) ? `score ${p.score.toFixed(2)}, proche du meilleur : non tiré` : `score ${p.score.toFixed(2)} < ${(best - 0.75).toFixed(2)}` });
  }
  return { kind, chosen: pick.node.id, score: pick.score, why: pick.why, rejected };
}

const BACKDROP_SCENES = ['statement', 'stat', 'kinetic', 'wordswap', 'cta', 'quote', 'benefits', 'offer', 'hook'];
const ANNOTATABLE = ['hook', 'statement', 'cta'];

/** Le kit d'une vidéo : choix validés, addons, trace. */
export function resolveKit(ctx: KitContext): VideoKit {
  const sectors = sectorsOf(ctx.text);
  const recent = (ctx.recent || []).slice(-6);
  const recentIds = (k: (v: VideoKit) => string) => recent.map(k);
  const trace: KitDecision[] = [];

  const logo = choose('logo', ctx, sectors, recentIds((v) => `logo:${v.logo}`), 0x10a0);
  const bg = choose('background', ctx, sectors, recentIds((v) => `bg:${v.background}`), 0xb6);
  const ann = choose('annotate', ctx, sectors, recentIds((v) => `annotate:${v.annotate}`), 0xa7);
  const icons = choose('icons', ctx, sectors, [], 0x1c);
  const mark = choose('brandmark', ctx, sectors, [], 0xb4);
  trace.push(logo, bg, ann, icons, mark);

  // Ressort : seulement si la direction rebondit déjà.
  const springNode = CAP_BY_ID.get('easing:spring')!;
  const spring = (springNode.suits?.directions?.[ctx.direction] || 0) > 0 && DIRECTIONS[ctx.direction].overshoot && (ctx.boosts?.['easing:spring'] || 0) >= 0 ? { bounce: ctx.direction === 'kinetic' ? 0.42 : 0.3 } : undefined;
  if (spring) trace.push({ kind: 'easing', chosen: 'easing:spring', score: 1, why: [`direction ${ctx.direction} à rebond`], rejected: [] });

  // Effets 3D : SMAA dès la HD, bloom en premium si la direction l'appelle — et
  // seulement s'il reste une scène 3D une fois le logo choisi (un logo tracé n'est pas en 3D).
  const postfx: string[] = [];
  const ctx3d: KitContext = { ...ctx, scenes: ctx.scenes.map((s) => ({ ...s, three: !!s.three && (s.sceneId !== 'logo' || logo.chosen === 'logo:extrude') })) };
  for (const id of ['postfx:smaa', 'postfx:bloom']) {
    const n = CAP_BY_ID.get(id)!;
    const reason = unmet(n, ctx3d);
    if (reason) continue;
    if (id === 'postfx:bloom' && !(n.suits?.directions?.[ctx.direction] || 0)) continue;
    postfx.push(id.slice('postfx:'.length));
  }

  // Fond : sur deux scènes de texte au plus, jamais consécutives.
  const background = bg.chosen.slice('bg:'.length) || 'none';
  const backdropScenes: string[] = [];
  if (background !== 'none') {
    const candidates = ctx.scenes.map((s, i) => ({ s, i })).filter(({ s }) => BACKDROP_SCENES.includes(s.sceneId) && !s.hasMedia);
    const order = candidates.sort((a, b) => BACKDROP_SCENES.indexOf(a.s.sceneId) - BACKDROP_SCENES.indexOf(b.s.sceneId));
    const taken: number[] = [];
    for (const c of order) {
      if (taken.length >= 2) break;
      if (taken.some((i) => Math.abs(i - c.i) < 2)) continue;
      taken.push(c.i);
      backdropScenes.push(c.s.key);
    }
  }

  // Annotation : une seule scène, la première qui a un titre annotable.
  const annotate = ann.chosen.slice('annotate:'.length) || 'none';
  const annotateScene = annotate !== 'none' ? ctx.scenes.find((s) => ANNOTATABLE.includes(s.sceneId) && s.hasTitle)?.key : undefined;

  // Mises en scène des plans : une par plan, jamais la même que le plan précédent,
  // les déjà vues (dans cette vidéo et les dernières du projet) pénalisées.
  const treatments: Record<string, string> = {};
  const usedInVideo: string[] = [];
  const recentTreatments = recent.flatMap((v) => Object.values(v.treatments || {})).map((t) => `treatment:${t}`);
  ctx.scenes.forEach((sc, i) => {
    const needs = sc.sceneId === 'footage' || (sc.sceneId === 'product' && sc.hasMedia && FULL_BLEED_PRODUCT.has(ctx.direction));
    if (!needs) return;
    const previous = usedInVideo[usedInVideo.length - 1];
    const d = choose('treatment', ctx, sectors, [...usedInVideo, ...recentTreatments], 0x7e0 + i * 31, (n) => n.id !== previous);
    if (!d.chosen) return;
    treatments[sc.key] = d.chosen.slice('treatment:'.length);
    usedInVideo.push(d.chosen);
    trace.push({ ...d, why: [`plan ${sc.key}`, ...d.why] });
  });

  // Caméra et famille d'entrée des éléments : par vidéo, jamais celles des dernières vidéos si possible.
  const camera = choose('camera', ctx, sectors, recentIds((v) => `camera:${v.camera}`), 0xca3);
  const springBanned = (ctx.boosts?.['easing:spring'] || 0) < 0;
  const entrance = choose('entrance', ctx, sectors, recentIds((v) => `entrance:${v.entrance}`), 0xe47, (n) => !(springBanned && n.id === 'entrance:spring'));
  trace.push(camera, entrance);

  const kit: VideoKit = {
    treatments,
    camera: camera.chosen.slice('camera:'.length) || undefined,
    entrance: entrance.chosen.slice('entrance:'.length) || undefined,
    background: backdropScenes.length ? background : 'none',
    backdropScenes,
    annotate: annotateScene ? annotate : 'none',
    annotateScene,
    logo: logo.chosen.slice('logo:'.length) || 'classic',
    iconSet: (icons.chosen.slice('icons:'.length) || 'lucide') as IconSetId,
    brandmark: mark.chosen.slice('brandmark:'.length) || 'none',
    icons: {},
    spring,
    postfx,
    addons: [],
    trace,
  };
  kit.addons = addonsForKit(kit);
  return kit;
}

/** Les addons qu'exigent les choix du kit (le montage y ajoute ceux des médias réels). */
export function addonsForKit(kit: Pick<VideoKit, 'logo' | 'background' | 'postfx'> & { annotate?: string }): AddonId[] {
  const ids = [`logo:${kit.logo}`, `bg:${kit.background}`, ...(kit.annotate ? [`annotate:${kit.annotate}`] : []), ...kit.postfx.map((p) => `postfx:${p}`)];
  const out = new Set<AddonId>();
  const walk = (id: string) => {
    const n = CAP_BY_ID.get(id);
    if (!n) return;
    if (n.kind === 'addon' && n.addon) out.add(n.addon);
    (n.requires || []).forEach(walk);
  };
  ids.forEach(walk);
  return [...out];
}

/**
 * Vocabulaire d'icônes pour le modèle : les concepts du secteur d'abord, puis
 * les plus génériques ; 30 au plus (≈ 60 tokens).
 */
export function iconVocabulary(text: string, max = 30): string[] {
  const generic = ['quality', 'fast', 'price', 'delivery', 'secure', 'support', 'time', 'place', 'payment', 'mobile', 'community', 'star', 'heart', 'gift', 'check', 'growth', 'idea', 'world'];
  const list = [...new Set([...sectorsOf(text), ...generic, ...ICON_CONCEPT_IDS])];
  return list.slice(0, max);
}

/**
 * Carte de capacités compacte, pour un modèle plus capable qui composerait une
 * scène sur mesure : ce qui est possible dans CE contexte, rien d'autre.
 */
export function capabilityCard(ctx: KitContext): string {
  const lines: string[] = [];
  const kinds: CapKind[] = ['rhythm', 'camera', 'entrance', 'logo', 'background', 'annotate', 'icons', 'brandmark', 'treatment', 'postfx', 'media'];
  for (const kind of kinds) {
    const ok = CAPABILITIES.filter((n) => n.kind === kind && !unmet(n, ctx)).map((n) => n.id.split(':')[1]);
    if (ok.length) lines.push(`${kind}: ${ok.join(', ')}`);
  }
  const d = DIRECTIONS[ctx.direction];
  lines.push(`techniques: ${[...new Set([...d.headline, ...d.support])].join(', ')}`);
  lines.push(`transitions: ${d.transitions.join(', ')}`);
  lines.push(`colors: bg ink muted hl hl-ink hl-text hl-soft soft primary secondary accent (Tailwind: bg-*, text-*)`);
  lines.push(`icons vocabulary: ${iconVocabulary(ctx.text, 30).join(', ')}`);
  return lines.join('\n');
}

// ─── Icônes des scènes, retouches du kit ────────────────────────────────────

/**
 * Concepts d'icônes par scène. Avantages : un concept par élément, celui que le
 * modèle a proposé (case `icons`) s'il est dans le vocabulaire, sinon le repli
 * par mots-clés sur le texte de l'élément. Événement : date, heure, lieu.
 * La case `icons` est retirée des textes (elle n'est pas affichée).
 */
export function assignIcons(scenes: { key: string; sceneId: string; slots: Record<string, string> }[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const sc of scenes) {
    if (sc.sceneId === 'benefits') {
      const proposed = (sc.slots.icons || '').split(/[,;/|\s]+/).filter(Boolean);
      const used: string[] = [];
      const items = ['b1', 'b2', 'b3'].map((k) => sc.slots[k]).filter(Boolean);
      out[sc.key] = items.map((text, i) => {
        const c = resolveConcept(proposed[i], text, used);
        used.push(c);
        return c;
      });
    } else if (sc.sceneId === 'event') out[sc.key] = ['calendar', 'time', 'place'];
    delete sc.slots.icons;
  }
  return out;
}

export interface KitOverrides {
  logo?: string;
  background?: string;
  annotate?: string;
  iconSet?: string;
  /** Caméra et famille d'entrée : choisies par l'agent animateur dans le menu du graphe. */
  camera?: string;
  entrance?: string;
}

/**
 * Retouche du kit (interface ou agent) : une valeur n'est acceptée que si son
 * nœud existe et est possible dans ce contexte ; sinon elle est ignorée et la
 * raison est rendue.
 */
export function applyKitOverrides(kit: VideoKit, overrides: KitOverrides, ctx: KitContext): { kit: VideoKit; refused: { field: string; reason: string }[] } {
  const next: VideoKit = { ...kit, trace: [...kit.trace] };
  const refused: { field: string; reason: string }[] = [];
  const prefix: Record<keyof KitOverrides, string> = { logo: 'logo', background: 'bg', annotate: 'annotate', iconSet: 'icons', camera: 'camera', entrance: 'entrance' };
  for (const field of Object.keys(prefix) as (keyof KitOverrides)[]) {
    const value = overrides[field];
    if (value === undefined) continue;
    const node = CAP_BY_ID.get(`${prefix[field]}:${value}`);
    if (!node) {
      refused.push({ field, reason: 'inconnu' });
      continue;
    }
    const why = unmet(node, ctx);
    if (why) {
      refused.push({ field, reason: why });
      continue;
    }
    (next as any)[field] = value;
    next.trace.push({ kind: node.kind, chosen: node.id, score: 0, why: ['choix explicite'], rejected: [] });
  }
  // Un fond choisi à la main a besoin de scènes où se poser.
  if (overrides.background !== undefined && next.background !== 'none' && !next.backdropScenes.length) {
    const fresh = resolveKit({ ...ctx, seed: ctx.seed });
    next.backdropScenes = fresh.backdropScenes.length ? fresh.backdropScenes : ctx.scenes.filter((s) => BACKDROP_SCENES.includes(s.sceneId) && !s.hasMedia).slice(0, 2).map((s) => s.key);
  }
  if (overrides.background === 'none') next.backdropScenes = [];
  if (overrides.annotate !== undefined && next.annotate !== 'none' && !next.annotateScene) next.annotateScene = ctx.scenes.find((s) => ANNOTATABLE.includes(s.sceneId) && s.hasTitle)?.key;
  next.addons = addonsForKit(next);
  return { kit: next, refused };
}


// ─── Menus pour le modèle, effets décidés par la direction ──────────────────

/**
 * Les k meilleurs nœuds possibles d'un genre : c'est le menu court proposé au
 * modèle (il choisit DANS ce que le graphe juge pertinent, jamais hors de lui).
 */
export function topNodes(kind: CapKind, ctx: KitContext, k: number): string[] {
  const d = choose(kind, ctx, sectorsOf(ctx.text), [], 0x70a);
  const scoredRejected = d.rejected.filter((r) => /^score/.test(r.reason)).map((r) => r.id);
  return [d.chosen, ...scoredRejected].filter(Boolean).slice(0, k).map((id) => id.split(':')[1]);
}

/** L'effet du grand moment : celui que la direction appelle (graphe, déterministe). */
export function pickAccentEffect(direction: DirectionId, seed: number, boosts?: Record<string, number>): 'punch' | 'giant' | 'hold' | 'flip' {
  const ctx: KitContext = {
    type: 'mix',
    objective: 'announce',
    direction,
    quality: 'hd',
    format: 'story',
    durationSec: 15,
    logo: null,
    hasLogoIcon: false,
    media: { images: 0, videos: 0, models: 0, lotties: 0, rive: 0 },
    scenes: [],
    text: '',
    seed,
    boosts,
  };
  const chosen = choose('accent', ctx, [], [], 0xacc).chosen.split(':')[1];
  return (['punch', 'giant', 'hold', 'flip'].includes(chosen) ? chosen : 'giant') as 'punch' | 'giant' | 'hold' | 'flip';
}


/** Rythmes qui demandent du temps : une montée ou de longues tenues n'ont pas de sens en 6 s. */
const LONG_RHYTHMS = new Set(['rhythm:breathe', 'rhythm:drop', 'rhythm:crescendo']);
const rhythmFits = (ctx: KitContext) => (n: CapNode) => ctx.durationSec >= 15 || !LONG_RHYTHMS.has(n.id);

/** Le rythme d'une vidéo (graphe) : le mieux noté pour la direction et l'objectif, différent des dernières vidéos. */
export function pickRhythm(ctx: KitContext, recent: string[] = []): string {
  // Jamais le rythme de la vidéo précédente (s'il reste un choix), mémoire décroissante au-delà.
  const last = recent[recent.length - 1];
  const fits = rhythmFits(ctx);
  const others = CAPABILITIES.filter((n) => n.kind === 'rhythm' && fits(n) && n.id !== `rhythm:${last}`).length;
  const filter = (n: CapNode) => fits(n) && (!last || others === 0 || n.id !== `rhythm:${last}`);
  return choose('rhythm', ctx, sectorsOf(ctx.text), recent.slice(-6).map((r) => `rhythm:${r}`), 0x7b7, filter).chosen.split(':')[1] || 'steady';
}

/** Menu de rythmes pour le modèle : les 3 meilleurs, sans ceux des 2 dernières vidéos (s'il en reste 2). */
export function rhythmMenu(ctx: KitContext, recent: string[] = []): string[] {
  const d = choose('rhythm', ctx, sectorsOf(ctx.text), [], 0x70b, rhythmFits(ctx));
  const top = [d.chosen, ...d.rejected.filter((r) => /^score/.test(r.reason)).map((r) => r.id)].filter(Boolean).map((id) => id.split(':')[1]);
  const fresh = top.filter((r) => !recent.slice(-2).includes(r));
  return (fresh.length >= 2 ? fresh : top).slice(0, 3);
}

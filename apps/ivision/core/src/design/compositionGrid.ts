/**
 * GRILLE DE COMPOSITION — le squelette invisible d'un visuel.
 *
 * ── LE DÉFAUT QUE CE MODULE SUPPRIME ────────────────────────────────────────
 *
 * La graine (`designSeed.ts`) dit au modèle QUOI faire — un archétype, une
 * stratégie de couleur, une humeur typographique. Elle ne lui dit jamais OÙ :
 * aucune ligne, aucune mesure, aucun rapport. Le modèle improvisait donc chaque
 * coordonnée (`left-[137px]`, `text-[64px]`, `p-12`), et c'est exactement ce
 * qu'un directeur artistique ne fait jamais. Un visuel professionnel n'est pas
 * une suite de bonnes décisions isolées : c'est une poignée de lignes décidées
 * AVANT le contenu, sur lesquelles tout vient ensuite se poser.
 *
 * Les quatre symptômes, tous visibles sans savoir les nommer :
 *
 *  1. DÉSALIGNEMENT DE QUELQUES PIXELS. Quatre blocs commençant à 137, 140,
 *     144 et 136 px : personne ne sait dire ce qui cloche, tout le monde voit
 *     que c'est bâclé. C'est le `columns` de ce module — et le contrôle qui
 *     recale (cf. `visualAudit.ts`).
 *
 *  2. PARTAGE EN DEUX. La moitié / la moitié est le réflexe par défaut, et
 *     c'est la proportion la plus morte qui soit. Le partage 62/38 du nombre
 *     d'or est dynamique par construction. C'est `golden`.
 *
 *  3. ÉCHELLE TYPOGRAPHIQUE PLATE. Un titre à 64 px et un sous-titre à 48 :
 *     deux tailles voisines qui se disputent le regard au lieu de le guider.
 *     L'échelle φ impose un écart franc à chaque cran. C'est `type`.
 *
 *  4. COULEUR SANS DOSAGE. Trois couleurs de marque réparties « à l'équilibre »
 *     donnent une image sans point d'entrée. 60/30/10 dit laquelle domine et
 *     laquelle ne sert qu'à poser le regard. C'est `colors`.
 *
 * ── POURQUOI DES PIXELS, ET PAS DES PRINCIPES ───────────────────────────────
 *
 * « Utilise le nombre d'or » est une consigne qu'un modèle approuve et
 * n'exécute pas : il ne sait pas quel côté, ni de quoi. « La césure verticale
 * est à x=667, le champ typographique occupe x=711→1021 » est une consigne
 * exécutable, et surtout VÉRIFIABLE après coup. Tout ce que ce module produit
 * est un nombre, et chaque nombre a un contrôle correspondant dans
 * `visualAudit.ts`.
 *
 * Aucun appel réseau, aucun modèle : de l'arithmétique sur un format et une
 * graine. Le même visuel regénéré retrouve donc exactement la même grille.
 */

import { DesignSeed } from './designSeed';

/** Nombre d'or. Le rapport de 1:1,618 — soit 61,8 % / 38,2 %. */
export const PHI = 1.618033988749895;

/**
 * Marge de sécurité, en part du petit côté.
 *
 * Deux menaces différentes, une seule marge : le rognage des réseaux (une
 * vignette carrée dans un fil, un recadrage 4:5) et le massicot de l'imprimeur.
 * 5,5 % couvre les deux — c'est aussi la marge sous laquelle une composition
 * commence à paraître à l'étroit dans son cadre.
 */
const SAFE_RATIO = 0.055;

/** Fond perdu d'impression : 3 mm à 150 dpi. */
const BLEED_PX = Math.round((3 / 25.4) * 150);

/** Largeur de colonne en deçà de laquelle une grille cesse d'être utilisable. */
const MIN_COLUMN_WIDTH = 44;

/**
 * Taille du niveau d'affichage, en part de la diagonale géométrique.
 *
 * 13 % de √(l×h) donne 140 px sur un carré 1080, 187 px sur une story : la
 * taille à laquelle un mot se lit à deux mètres, quel que soit le format.
 */
const DISPLAY_RATIO = 0.13;

/** Le niveau d'affichage ne descend jamais sous ce seuil : c'est « la » chose à retenir. */
const MIN_DISPLAY_RATIO = 0.075;

/** Densité de contenu → facteur appliqué à l'échelle typographique. */
const DENSITY_SCALE: Record<string, number> = {
  MINIMAL: 1.15,
  BALANCED: 1,
  EDITORIAL: 0.85,
  TYPE_HEAVY: 1.3,
};

export interface CompositionCanvas {
  width: number;
  height: number;
  /** Destiné à l'impression : prévoir le fond perdu et le massicot. */
  print?: boolean;
}

export interface CompositionPalette {
  primary?: string;
  secondary?: string;
  accent?: string;
  background?: string;
  text?: string;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TypeScale {
  /** LA chose à retenir. Utilisée une seule fois dans le visuel. */
  display: number;
  headline: number;
  subhead: number;
  body: number;
  caption: number;
  /** Mentions légales, crédits, date. */
  fine: number;
}

export interface ColorBudget {
  /** ~60 % de la surface : la couleur dominante, celle qui donne l'impression générale. */
  dominant: string;
  /** ~30 % : la couleur de soutien. */
  support: string;
  /** ~10 % au plus : l'accent, là où le regard se pose. */
  accent: string;
  /** Ce que la stratégie de couleur de la graine impose, en une phrase. */
  note: string;
}

export interface CompositionGrid {
  width: number;
  height: number;
  /** Marge de sécurité, en px depuis chaque bord. */
  safe: number;
  /** Fond perdu, en px. 0 hors impression. */
  bleed: number;
  columns: {
    count: number;
    gutter: number;
    width: number;
    /** Abscisse du bord gauche de chaque colonne. */
    lines: number[];
  };
  rows: {
    count: number;
    gutter: number;
    height: number;
    lines: number[];
  };
  /** Unité de rythme vertical : tout écart est un multiple de cette valeur. */
  unit: number;
  golden: {
    /** Césure à 61,8 % de la largeur. */
    x: number;
    /** Césure à 61,8 % de la hauteur. */
    y: number;
  };
  thirds: { x: [number, number]; y: [number, number] };
  /** Les quatre intersections de la règle des tiers. */
  powerPoints: Array<{ x: number; y: number }>;
  /** Celle des quatre où le sujet principal doit tomber. */
  focal: { x: number; y: number };
  /** Axe du partage 62/38. */
  splitAxis: 'vertical' | 'horizontal';
  /** Zone majeure (62 %) — l'image, sauf archétype pleine page. */
  imageField: Rect;
  /** Zone mineure (38 %) — le bloc typographique. */
  typeField: Rect;
  /** L'image couvre tout le cadre (archétype pleine page) : le champ image n'est alors qu'un centre de gravité. */
  imageBleeds: boolean;
  type: TypeScale;
  colors: ColorBudget;
  /** Part minimale du cadre laissée vide. */
  negativeSpace: { min: number; max: number };
}

/** Archétypes où l'image occupe tout le cadre : la césure ne découpe plus l'image, seulement le texte. */
const FULL_BLEED_ARCHETYPES = new Set(['B', 'C', 'F', 'H', 'I', 'K']);

/** Positions d'image qui appellent une césure horizontale plutôt que verticale. */
const HORIZONTAL_POSITIONS = new Set(['TOP_BAND', 'BOTTOM_BAND']);

/** Positions d'image posant l'image sur la fin de l'axe (droite ou bas). */
const END_POSITIONS = new Set(['TOP_RIGHT', 'BOTTOM_RIGHT', 'RIGHT_STRIP', 'BOTTOM_BAND']);

/** Positions « bande » : l'image prend la part MINEURE, le texte la majeure. */
const STRIP_POSITIONS = new Set(['LEFT_STRIP', 'RIGHT_STRIP', 'TOP_BAND', 'BOTTOM_BAND']);

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Échelle typographique en puissances de φ.
 *
 * On part du HAUT — la taille d'affichage est celle qui doit se lire à deux
 * mètres, elle se déduit du format — et on divise. Partir du corps de texte
 * pour multiplier donnerait un titre dont la taille dépend d'un réglage de
 * lisibilité d'écran, ce qui n'a aucun sens sur une affiche.
 */
function buildTypeScale(canvas: CompositionCanvas, density: string): TypeScale {
  const diagonal = Math.sqrt(canvas.width * canvas.height);
  const factor = DENSITY_SCALE[density] ?? 1;
  const display = Math.round(diagonal * DISPLAY_RATIO * factor);
  const step = (level: number) => Math.round(display / Math.pow(PHI, level));
  return {
    display,
    headline: step(1),
    subhead: step(2),
    body: step(3),
    caption: step(4),
    // En dessous de 11 px un texte imprimé n'est plus lisible, et à l'écran il
    // disparaît dans la compression JPEG des réseaux.
    fine: Math.max(11, step(5)),
  };
}

/**
 * Dosage 60/30/10 déduit de la stratégie de couleur de la graine.
 *
 * La règle ne dit pas QUELLES couleurs employer — la charte s'en charge — mais
 * dans quelles PROPORTIONS. C'est la différence entre trois couleurs posées
 * côte à côte et une image qui a un sujet.
 */
function buildColorBudget(strategy: string, palette: CompositionPalette): ColorBudget {
  const primary = palette.primary || '#111111';
  const secondary = palette.secondary || primary;
  const accent = palette.accent || primary;
  const background = palette.background || '#ffffff';
  const text = palette.text || '#111111';

  switch (strategy) {
    case 'MONOCHROME_ACCENT':
      return {
        dominant: background,
        support: text,
        accent: primary,
        note: 'Greyscale base. The brand colour appears ONCE, on the element that must be seen first.',
      };
    case 'DUOTONE':
      return {
        dominant: primary,
        support: background,
        accent,
        note: 'Two colours only: the duotone-treated photograph carries the 60, the flat carries the 30.',
      };
    case 'IMAGE_EXTRACTED':
      return {
        dominant: '(the photograph)',
        support: background,
        accent: primary,
        note: 'The image owns the 60. The brand colour is the 10 — a rule, a word, the logo zone.',
      };
    case 'INVERSE':
      return {
        dominant: background,
        support: text,
        accent,
        note: 'One hard contrast zone holds the 30. The accent marks the entry point into it.',
      };
    case 'SPLIT_COMPLEMENTARY':
      return {
        dominant: primary,
        support: '(the image tones)',
        accent,
        note: 'The brand primary dominates; the image tones support it; the accent stays at 10%.',
      };
    case 'BRAND_FULL':
    default:
      return {
        dominant: background,
        support: primary,
        accent,
        note: 'Each colour owns a distinct zone. The accent never grows into a second dominant.',
      };
  }
}

/**
 * Point focal : l'intersection de la règle des tiers où tombe le sujet.
 *
 * Il est choisi dans la zone où le regard ENTRE selon la direction de lecture
 * de la graine, puis ramené dans le champ typographique quand celui-ci en
 * contient une : le point focal et le texte qui le nomme doivent se rejoindre,
 * sinon le visuel a deux centres.
 */
function pickFocal(
  thirds: { x: [number, number]; y: [number, number] },
  readingDirection: string,
  typeField: Rect
): { x: number; y: number } {
  const [x1, x2] = thirds.x;
  const [y1, y2] = thirds.y;
  const points = [
    { x: x1, y: y1 },
    { x: x2, y: y1 },
    { x: x1, y: y2 },
    { x: x2, y: y2 },
  ];

  const preferred: Record<string, { x: number; y: number }> = {
    TOP_DOWN: { x: x1, y: y1 },
    BOTTOM_UP: { x: x1, y: y2 },
    LEFT_TO_RIGHT: { x: x1, y: y1 },
    RIGHT_TO_LEFT: { x: x2, y: y1 },
    CENTER_OUT: { x: x2, y: y1 },
    CORNER_DIAGONAL: { x: x1, y: y2 },
  };
  const wanted = preferred[readingDirection] || points[0];

  const inside = (p: { x: number; y: number }) =>
    p.x >= typeField.x &&
    p.x <= typeField.x + typeField.width &&
    p.y >= typeField.y &&
    p.y <= typeField.y + typeField.height;

  if (inside(wanted)) return wanted;
  const fallback = points.find(inside);
  return fallback || wanted;
}

/**
 * Construit la grille d'un visuel.
 *
 * @param canvas Dimensions exactes du support.
 * @param seed   Graine de composition — c'est elle qui décide de l'axe de la
 *               césure, du point focal et de la densité.
 * @param palette Palette de la marque, pour le dosage 60/30/10.
 */
export function buildCompositionGrid(
  canvas: CompositionCanvas,
  seed: DesignSeed,
  palette: CompositionPalette = {}
): CompositionGrid {
  const { width, height } = canvas;
  const shortSide = Math.min(width, height);
  const safe = Math.round(shortSide * SAFE_RATIO);
  const bleed = canvas.print ? BLEED_PX : 0;

  // Unité de rythme : le multiplicateur de la graine, exprimé en pixels. Tous
  // les écarts verticaux du visuel en sont des multiples — c'est la
  // transposition de la grille de ligne de base de l'imprimé.
  const unit = seed.spacingMultiplier * 4;

  // Colonnes. Un format très allongé en hauteur (story) ne porte pas douze
  // colonnes : elles y seraient plus étroites qu'un mot.
  const tall = height / width >= 1.5;
  let columnCount = tall ? 8 : 12;
  const innerWidth = width - safe * 2;
  let gutter = unit;
  // Une gouttière prise sur le rythme peut étrangler les colonnes : on la
  // resserre jusqu'à ce que la colonne reste utilisable, puis on retire des
  // colonnes si cela ne suffit pas.
  while (
    columnCount > 3 &&
    (innerWidth - gutter * (columnCount - 1)) / columnCount < MIN_COLUMN_WIDTH
  ) {
    if (gutter > 8) gutter = Math.max(8, gutter - 4);
    else columnCount -= 2;
  }
  const columnWidth = (innerWidth - gutter * (columnCount - 1)) / columnCount;
  const columnLines = Array.from({ length: columnCount }, (_, i) =>
    Math.round(safe + i * (columnWidth + gutter))
  );

  // Rangées : la même maille, reportée sur la hauteur. C'est la grille
  // MODULAIRE — celle qui tient un programme, plusieurs intervenants, une
  // série de blocs, sans que rien ne flotte.
  const rowCount = clamp(Math.round(columnCount * (height / width)), 4, 20);
  const innerHeight = height - safe * 2;
  const rowGutter = gutter;
  const rowHeight = (innerHeight - rowGutter * (rowCount - 1)) / rowCount;
  const rowLines = Array.from({ length: rowCount }, (_, i) =>
    Math.round(safe + i * (rowHeight + rowGutter))
  );

  const goldenX = Math.round(width / PHI);
  const goldenY = Math.round(height / PHI);
  const thirds: { x: [number, number]; y: [number, number] } = {
    x: [Math.round(width / 3), Math.round((width * 2) / 3)],
    y: [Math.round(height / 3), Math.round((height * 2) / 3)],
  };

  // Césure 62/38. L'axe et le côté viennent de la position d'image de la
  // graine : c'est ce qui fait qu'un même format ne produit pas deux fois la
  // même découpe.
  const splitAxis: 'vertical' | 'horizontal' = HORIZONTAL_POSITIONS.has(seed.imagePosition)
    ? 'horizontal'
    : 'vertical';
  const atEnd = END_POSITIONS.has(seed.imagePosition);
  const imageTakesMinor = STRIP_POSITIONS.has(seed.imagePosition);

  const axisLength = splitAxis === 'vertical' ? width : height;
  const major = splitAxis === 'vertical' ? goldenX : goldenY;
  const minor = axisLength - major;
  const imageExtent = imageTakesMinor ? minor : major;
  const typeExtent = axisLength - imageExtent - gutter;

  const imageStart = atEnd ? axisLength - imageExtent : 0;
  const typeStart = atEnd ? 0 : imageExtent + gutter;

  const imageField: Rect =
    splitAxis === 'vertical'
      ? { x: imageStart, y: 0, width: imageExtent, height }
      : { x: 0, y: imageStart, width, height: imageExtent };
  // Le champ typographique reste dans la marge de sécurité : c'est là que le
  // texte vit, et le texte est précisément ce que le rognage ne doit pas manger.
  const typeField: Rect =
    splitAxis === 'vertical'
      ? {
          x: Math.max(typeStart, safe),
          y: safe,
          width: Math.min(typeExtent, width - Math.max(typeStart, safe) - safe),
          height: innerHeight,
        }
      : {
          x: safe,
          y: Math.max(typeStart, safe),
          width: innerWidth,
          height: Math.min(typeExtent, height - Math.max(typeStart, safe) - safe),
        };

  return {
    width,
    height,
    safe,
    bleed,
    columns: {
      count: columnCount,
      gutter,
      width: Math.round(columnWidth),
      lines: columnLines,
    },
    rows: { count: rowCount, gutter: rowGutter, height: Math.round(rowHeight), lines: rowLines },
    unit,
    golden: { x: goldenX, y: goldenY },
    thirds,
    powerPoints: [
      { x: thirds.x[0], y: thirds.y[0] },
      { x: thirds.x[1], y: thirds.y[0] },
      { x: thirds.x[0], y: thirds.y[1] },
      { x: thirds.x[1], y: thirds.y[1] },
    ],
    focal: pickFocal(thirds, seed.readingDirection, typeField),
    splitAxis,
    imageField,
    typeField,
    imageBleeds: FULL_BLEED_ARCHETYPES.has(seed.archetype),
    type: buildTypeScale(canvas, seed.contentDensity),
    colors: buildColorBudget(seed.colorStrategy, palette),
    // 30 à 50 % de vide : la fourchette des compositions imprimées tenues pour
    // professionnelles. En dessous le visuel est encombré, au-dessus il est
    // inachevé.
    negativeSpace: { min: 0.3, max: 0.5 },
  };
}

/**
 * Graine NEUTRE — celle du contrôle, jamais celle d'une composition.
 *
 * Un visuel dont on a perdu la graine (rendu redemandé des mois plus tard par
 * l'endpoint image, visuel retouché à la main dans l'éditeur) doit tout de même
 * être mesurable. Les dimensions que la graine pilote ne changent alors presque
 * rien au contrôle : la marge de sécurité, la grille de colonnes, le rognage et
 * le contraste dépendent du FORMAT, pas du parti pris. Seuls le rythme vertical
 * et l'échelle typographique bougent, et une densité « équilibrée » est
 * précisément la référence sur laquelle il faut juger à défaut de mieux.
 *
 * Figée en dur plutôt que tirée : un contrôle dont les seuils changent d'un
 * appel à l'autre ne serait pas un contrôle.
 */
export const NEUTRAL_SEED: DesignSeed = {
  archetype: 'A',
  colorStrategy: 'BRAND_FULL',
  typographyMood: 'WEIGHT_CLASH',
  layoutTension: 'NEGATIVE_SPACE_HERO',
  spacingMultiplier: 7,
  imagePosition: 'LEFT_STRIP',
  readingDirection: 'TOP_DOWN',
  graphicAccent: 'NONE',
  contentDensity: 'BALANCED',
};

/** Taille d'affichage minimale tolérée sur ce cadre (contrôle de hiérarchie). */
export function minDisplaySize(grid: CompositionGrid): number {
  return Math.round(Math.sqrt(grid.width * grid.height) * MIN_DISPLAY_RATIO);
}

/** Rendu lisible d'une liste de positions, tronquée pour ne pas noyer le prompt. */
function lineList(lines: number[], limit = 8): string {
  const shown = lines.slice(0, limit).join(', ');
  return lines.length > limit ? `${shown}, …` : shown;
}

/**
 * Bloc `<composition_grid>` injecté dans le prompt de composition.
 *
 * Il est écrit en NOMBRES. « Sers-toi du nombre d'or » est une consigne qu'un
 * modèle approuve sans l'exécuter ; « la césure est à x=667 » est une consigne
 * qu'il exécute et qu'on peut vérifier ensuite au pixel près.
 */
export function describeCompositionGrid(grid: CompositionGrid): string {
  const t = grid.type;
  const field = (r: Rect) =>
    `x ${Math.round(r.x)}→${Math.round(r.x + r.width)}, y ${Math.round(r.y)}→${Math.round(r.y + r.height)}`;

  return `<composition_grid>
Every professional layout rests on a skeleton decided BEFORE the content. Here is this visual's, in pixels. These numbers are measured on the rendered image afterwards, and what misses them is corrected automatically — a correction means your composition was improvised.

CANVAS — ${grid.width} × ${grid.height} px.
SAFE AREA — nothing that must be READ (headline, facts, logo) comes closer than ${grid.safe}px to any edge. Social platforms re-crop, printers trim.${
    grid.bleed
      ? `\nBLEED — this is printed: the background, the photo and the colour blocks MUST run past all four edges (full bleed). A white margin is the amateur tell. Keep the readable content ${grid.safe + grid.bleed}px away from the edges.`
      : ''
  }

COLUMN GRID — ${grid.columns.count} columns of ${grid.columns.width}px, ${grid.columns.gutter}px gutters, ${grid.safe}px side margins.
Left edges available (x): ${lineList(grid.columns.lines)}
EVERY block starts on one of those lines. Use THREE different left edges at most in the whole visual — an element that starts 6px away from another is not a choice, it is a mistake, and it is what separates professional work from amateur work.
Horizontal rules for a modular grid (y): ${lineList(grid.rows.lines, 6)}

GOLDEN SECTION — the frame is cut at 62/38, never in half: x = ${grid.golden.x}, y = ${grid.golden.y}.
This visual's split is ${grid.splitAxis.toUpperCase()}.
- Image field: ${field(grid.imageField)}${grid.imageBleeds ? ' (your archetype bleeds the image across the whole frame — this rectangle is then its visual centre of gravity, where the subject sits)' : ''}
- Type field: ${field(grid.typeField)} — the headline, the copy and the facts live INSIDE it. Nothing important outside.

RULE OF THIRDS — lines at x = ${grid.thirds.x.join(', ')} and y = ${grid.thirds.y.join(', ')}.
Focal point of this visual: (${grid.focal.x}, ${grid.focal.y}). The ONE thing a viewer must retain is anchored there — not centred, not floating.

TYPE SCALE (φ = 1.618 — these sizes, not round numbers):
- display ${t.display}px — used ONCE, the thing read at two metres
- headline ${t.headline}px · subhead ${t.subhead}px · body ${t.body}px · caption ${t.caption}px · fine print ${t.fine}px
Skip a level rather than sit between two: two elements at neighbouring sizes fight each other and the eye stops guiding.

SPATIAL RHYTHM — every vertical gap is a multiple of ${grid.unit}px. Gestalt proximity does the grouping for you: under ${grid.unit}px two elements read as ONE block, past ${grid.unit * 2}px they read as two. Group what belongs together, separate what does not.

COLOUR BUDGET 60/30/10 — dominant ${grid.colors.dominant} (~60% of the surface), support ${grid.colors.support} (~30%), accent ${grid.colors.accent} (10% AT MOST). ${grid.colors.note}
The accent is where the eye lands: spread over a third of the frame it stops working.

NEGATIVE SPACE — between ${Math.round(grid.negativeSpace.min * 100)}% and ${Math.round(grid.negativeSpace.max * 100)}% of the frame carries nothing at all. Empty space is a tool, not waste: beginners fill, professionals let it breathe.

BREAKING THE GRID — the grid is what makes the break legible. ONE element may deliberately escape it (a crop, a bleed, a rotation, an overflow). One. Everything else obeys.
</composition_grid>`;
}

/**
 * Ce que la GRILLE attend de la PHOTO, en une consigne pour le brief d'image.
 *
 * Le brief demandait jusqu'ici « décris où se trouve l'espace vide » sans
 * savoir où le texte allait tomber : la photo revenait donc avec son sujet
 * exactement là où le titre devait se poser, et la composition passait sa vie
 * à contourner son image. La grille est tirée avant le brief précisément pour
 * que cette phrase puisse être écrite.
 */
export function describeImageNeed(grid: CompositionGrid): string {
  const f = grid.typeField;
  const horizontal = f.x + f.width / 2 < grid.width / 2 ? 'left' : 'right';
  const vertical = f.y + f.height / 2 < grid.height / 2 ? 'upper' : 'lower';
  const zone =
    grid.splitAxis === 'vertical' ? `${horizontal} side` : `${vertical} part`;

  return `The text of this visual lands on the ${zone} of the frame (x ${Math.round(f.x)}→${Math.round(
    f.x + f.width
  )}, y ${Math.round(f.y)}→${Math.round(f.y + f.height)} of a ${grid.width}×${grid.height} frame).
So the photograph must be CALM there — sky, wall, shadow, blur, water, a flat expanse — and carry its subject on the opposite side. Say so explicitly in generationPrompt, and let it steer the stock choice.
A photograph whose subject sits where the headline goes forces the composition to work around its own image; that is how a visual ends up looking improvised.`;
}

/**
 * Version COURTE de la grille, pour une RETOUCHE.
 *
 * Un visuel déjà validé ne se recompose pas : lui servir la grille complète
 * inviterait le modèle à tout replacer « proprement », c'est-à-dire à défaire
 * le travail que l'utilisateur a accepté. Ce qu'il lui faut tient en trois
 * nombres — la marge, les colonnes, l'échelle — pour que ce qu'il AJOUTE
 * atterrisse sur la même trame que le reste.
 */
export function describeGridInvariants(grid: CompositionGrid): string {
  const t = grid.type;
  return `<grid_invariants>
The visual sits on a grid. You are retouching it, not recomposing it — but anything you ADD or MOVE lands on that grid, otherwise it will be the one element that looks pasted on.
- Safe margin: ${grid.safe}px. Nothing that must be READ comes closer to an edge.${
    grid.bleed ? ` Printed piece: the background still runs past all four edges.` : ''
  }
- Column lines (x): ${grid.columns.lines.slice(0, 8).join(', ')}${grid.columns.lines.length > 8 ? ', …' : ''}. Reuse a left edge that already exists in the markup rather than inventing a new one.
- Vertical gaps are multiples of ${grid.unit}px.
- Type scale: display ${t.display} · headline ${t.headline} · subhead ${t.subhead} · body ${t.body} · caption ${t.caption} · fine ${t.fine}. A new text takes one of these sizes, never a value in between.
- The accent colour stays at a tenth of the surface at most.
Positions, sizes and contrasts are measured on the rendered image afterwards, and what misses these is corrected automatically.
</grid_invariants>`;
}

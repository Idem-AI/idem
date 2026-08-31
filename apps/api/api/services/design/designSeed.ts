/**
 * Graine de composition.
 *
 * Deuxième moitié du dispositif anti-monoculture : les contraintes NÉGATIVES
 * (antiSlop.prompt.ts) retirent les défauts, la graine fournit les contraintes
 * POSITIVES qui prennent leur place — un archétype de mise en page, une
 * stratégie de couleur, une humeur typographique, une tension spatiale, tirés
 * pour CE livrable.
 *
 * Deux propriétés comptent :
 *  - le tirage se fait dans l'espace autorisé par le STYLE de la direction
 *    artistique, jamais dans le catalogue complet. Une charte « Design Suisse »
 *    ne peut pas tirer « néon sur fond noir » : la variété reste, la cohérence
 *    de marque aussi ;
 *  - il peut être DÉTERMINISTE (dérivé d'une clé) ou aléatoire. Déterministe
 *    pour les pages d'un même document, qui doivent se ressembler entre elles et
 *    différer d'un projet à l'autre ; aléatoire pour deux visuels sociaux d'une
 *    même marque, qui doivent différer entre eux.
 */

import crypto from 'crypto';
import { ArtDirectionStyle, resolveStyle } from './artDirection.catalog';

export interface DesignSeed {
  /** Archétype de mise en page (A–L, cf. ARCHETYPE_CATALOG). */
  archetype: string;
  colorStrategy: string;
  typographyMood: string;
  layoutTension: string;
  /** Entier impair 3–11 : multiplicateur du rythme spatial. */
  spacingMultiplier: number;
  imagePosition: string;
  readingDirection: string;
  graphicAccent: string;
  contentDensity: string;
}

const IMAGE_POSITIONS = [
  'TOP_LEFT',
  'TOP_RIGHT',
  'BOTTOM_LEFT',
  'BOTTOM_RIGHT',
  'CENTER_BLEED',
  'LEFT_STRIP',
  'RIGHT_STRIP',
  'TOP_BAND',
  'BOTTOM_BAND',
  'DIAGONAL_SLICE',
];

const READING_DIRECTIONS = [
  'TOP_DOWN',
  'BOTTOM_UP',
  'LEFT_TO_RIGHT',
  'RIGHT_TO_LEFT',
  'CENTER_OUT',
  'CORNER_DIAGONAL',
];

/**
 * Catalogue des archétypes, partagé par tous les générateurs HTML.
 *
 * Il vivait dans le prompt du visuel social ; l'extraire ici permet à la charte,
 * au deck et au business plan de tirer dans le même vocabulaire — ce qui est la
 * condition pour que les livrables d'un même projet se ressemblent.
 */
export const ARCHETYPE_CATALOG: Record<string, string> = {
  A: 'EDITORIAL SPLIT — the image bleeds across 60-70% of the frame, a solid flat holds the rest. The headline bleeds onto the image. The split is irregular (angled 5 to 15°), never a plain vertical.',
  B: 'FULL BLEED CINEMATIC — the image covers the whole frame. A semi-opaque geometric shape anchors the headline. Poster feeling.',
  C: 'TYPOGRAPHIC DOMINANT — oversized outlined words fill 40 to 60% of the frame. The image shows through the letters (layering, mix-blend-mode: multiply). Everything else kept to a minimum.',
  D: 'SWISS BRUTALIST — a strict modular grid revealed by thick rules (3-6px). An oversized number or label as the primary graphic. Monochrome base plus one vivid accent. Image cropped into a geometric shape.',
  E: 'LUXURY MINIMAL — maximum negative space (50 to 65%). The image occupies at most 35%, offset towards a corner. Thin uppercase headline with extreme letter-spacing (0.3 to 0.5em). One 1px hairline rule.',
  F: 'LAYERED DEPTH — the same image used three times: full bleed at 8% opacity (background), cropped at 40% (mid ground), sharp at 100% (foreground, offset). Text floats between the layers.',
  G: 'NEWSPAPER GRID — a heavy masthead bar across the top. Content below in 2 or 3 columns separated by rules. The headline spans the full width.',
  H: 'FRAGMENTED MOSAIC — the image cut into 3 to 5 fragments (absolute divs, overflow-hidden, rotated ±3 to 8°). Fragments overlap. Text lives in the gaps.',
  I: 'NEON GLOW DARK — a very dark canvas. One primary colour at full intensity with a glow (text-shadow 0 0 10px, 30px, 60px). The image carries a 50% dark overlay.',
  J: 'ISOMETRIC FRAME — a geometric frame (hexagon, parallelogram) contains the image. Flat brand-colour ground. The headline follows the frame.',
  K: 'HALFTONE EDITORIAL — a halftone dot overlay (radial-gradient) at 20% opacity. Condensed slab-serif headline. Three colours maximum.',
  L: 'DATA POSTER — one number or statistic set very large (30 to 40% of the frame) overlapping the image. Contemporary infographic writing.',
};

export const COLOR_STRATEGY_CATALOG: Record<string, string> = {
  MONOCHROME_ACCENT:
    'Near-black + near-white + exactly one brand accent. Greyscale base.',
  SPLIT_COMPLEMENTARY:
    'The brand primary plus two tones from the image, roughly split-complementary to it.',
  DUOTONE:
    'Two colours only. Treat the image with filter: sepia(1) hue-rotate(Xdeg) saturate(Y).',
  IMAGE_EXTRACTED:
    'Two or three dominant tones from the image. The brand colour is reserved for a single accent (a rule, a word, the logo zone).',
  INVERSE:
    'A hard geometric contrast zone. Dark image → light text block; light image → dark text block.',
  BRAND_FULL: 'Brand primary, secondary and accent, each owning a distinct zone.',
};

export const TYPOGRAPHY_MOOD_CATALOG: Record<string, string> = {
  CONDENSED_TOWER: 'Tall narrow headline. Words stacked vertically with near-zero leading.',
  WIDE_WHISPER:
    'One key word at a small size (24px) but with 0.6em tracking, running the full width.',
  WEIGHT_CLASH: 'Massive black headline (140px+) against a very thin subheadline (20px) below it.',
  SINGLE_LETTER_ANCHOR:
    'One oversized letter (300px+) as a background graphic at 15-25% opacity.',
  ALL_LOWERCASE_INTIMATE:
    'Everything in lowercase. Headline at 72px with tight tracking. No capitals at all.',
  ROTATED_AXIS:
    'One key text rotated 90° counter-clockwise, running bottom-to-top along an edge.',
  OUTLINE_FILLED_MIX: 'Within the headline, alternate outlined and solid words.',
  STAGGERED_INDENT: 'Progressive staircase indentation of the headline lines.',
};

export const LAYOUT_TENSION_CATALOG: Record<string, string> = {
  TEXT_ESCAPES_BOUNDS: 'The headline overflows its container by 5 to 15% through negative margins.',
  DIAGONAL_FLOW: 'transform: rotate(10-20deg) on one key element. Everything else aligns to it.',
  RULE_HEAVY: 'At least three rules (2 to 6px) divide the frame.',
  NEGATIVE_SPACE_HERO: 'At least 60% of the frame stays empty. The occupied zone is highly refined.',
  CORNER_ANCHOR: 'Every element pulled towards one corner. The opposite corner stays empty.',
  FULL_BLEED_EDGE: 'Colour or image zones touch all four edges. No margins.',
  FRAME_WITHIN_FRAME: 'An inset border (1-2px) set 20 to 30px inside the frame.',
  COLLAGE_LAYER: 'At least four overlapping absolute elements at varying opacities.',
};

export const GRAPHIC_ACCENT_CATALOG: Record<string, string> = {
  GEOMETRIC_SHAPE: 'A bold circle, triangle or polygon as a decorative element.',
  THICK_UNDERLINE: 'A heavy underline or overline on the headline (8-12px).',
  DOT_CLUSTER: 'Small dots scattered through the negative space.',
  OVERSIZED_PUNCTUATION: 'An oversized quotation mark, ampersand or slash used as decoration.',
  GRADIENT_WASH: 'A discreet gradient wash over a single zone of the frame.',
  NONE: 'Nothing added: typography and image carry the composition alone.',
  BORDER_ACCENT: 'A thick border on one or two sides only.',
  PATTERN_STRIP: 'A thin strip of repeating geometric pattern.',
};

export const CONTENT_DENSITY_CATALOG: Record<string, string> = {
  MINIMAL: 'Headline + image + brand signature. Almost no running text.',
  BALANCED: 'Headline, short copy, factual information. Standard density.',
  EDITORIAL: 'Headline, subheadline, paragraph, fine print. More text.',
  TYPE_HEAVY: 'Text IS the graphic design. Large typographic blocks.',
};

/**
 * Tirage.
 *
 * Sans `entropyKey`, on tire au CSPRNG : deux visuels générés dans la même
 * seconde diffèrent (le tirage horodaté produisait des graines quasi identiques
 * en rafale). Avec une clé, le tirage est reproductible — le même document
 * regénéré garde sa mise en page, un autre projet en obtient une autre.
 */
function makePicker(entropyKey?: string): <T>(arr: T[], salt: string) => T {
  if (!entropyKey) {
    return <T>(arr: T[]): T => arr[crypto.randomInt(arr.length)];
  }
  return <T>(arr: T[], salt: string): T => {
    const digest = crypto.createHash('sha256').update(`${entropyKey}:${salt}`).digest();
    return arr[digest.readUInt32BE(0) % arr.length];
  };
}

/** Espace de tirage du style, avec repli sur le catalogue complet si vide. */
function spaceOf(style: ArtDirectionStyle) {
  const s = style.seedSpace;
  const fallback = <T>(list: T[] | undefined, all: T[]) => (list && list.length ? list : all);
  return {
    archetypes: fallback(s?.archetypes, Object.keys(ARCHETYPE_CATALOG)),
    colorStrategies: fallback(s?.colorStrategies, Object.keys(COLOR_STRATEGY_CATALOG)),
    typographyMoods: fallback(s?.typographyMoods, Object.keys(TYPOGRAPHY_MOOD_CATALOG)),
    layoutTensions: fallback(s?.layoutTensions, Object.keys(LAYOUT_TENSION_CATALOG)),
    contentDensities: fallback(s?.contentDensities, Object.keys(CONTENT_DENSITY_CATALOG)),
    graphicAccents: fallback(s?.graphicAccents, Object.keys(GRAPHIC_ACCENT_CATALOG)),
  };
}

/**
 * Construit une graine dans l'espace autorisé par le style.
 *
 * @param styleId  Identifiant du style de la direction artistique.
 * @param entropyKey Clé de reproductibilité (id de projet + nom de section…).
 *                   Omise, le tirage est aléatoire.
 */
export function buildDesignSeed(styleId?: string | null, entropyKey?: string): DesignSeed {
  const style = resolveStyle(styleId);
  const space = spaceOf(style);
  const pick = makePicker(entropyKey);

  return {
    archetype: pick(space.archetypes, 'archetype'),
    colorStrategy: pick(space.colorStrategies, 'color'),
    typographyMood: pick(space.typographyMoods, 'type'),
    layoutTension: pick(space.layoutTensions, 'tension'),
    spacingMultiplier: pick([3, 5, 7, 9, 11], 'spacing'),
    imagePosition: pick(IMAGE_POSITIONS, 'imagePos'),
    readingDirection: pick(READING_DIRECTIONS, 'reading'),
    graphicAccent: pick(space.graphicAccents, 'accent'),
    contentDensity: pick(space.contentDensities, 'density'),
  };
}

/**
 * Rend la graine LISIBLE pour le modèle.
 *
 * Transmettre `{"archetype":"D"}` revient à ne rien transmettre : le modèle
 * ignore ce que « D » recouvre. On développe donc chaque valeur en sa consigne.
 */
export function describeSeed(seed: DesignSeed): string {
  const line = (label: string, key: string, catalog: Record<string, string>) =>
    `- ${label}: ${key} — ${catalog[key] || 'free'}`;
  return [
    line('Layout archetype', seed.archetype, ARCHETYPE_CATALOG),
    line('Colour strategy', seed.colorStrategy, COLOR_STRATEGY_CATALOG),
    line('Typographic mood', seed.typographyMood, TYPOGRAPHY_MOOD_CATALOG),
    line('Spatial tension', seed.layoutTension, LAYOUT_TENSION_CATALOG),
    line('Graphic accent', seed.graphicAccent, GRAPHIC_ACCENT_CATALOG),
    line('Content density', seed.contentDensity, CONTENT_DENSITY_CATALOG),
    `- Spatial rhythm: multiply the base spacing unit by ${seed.spacingMultiplier}.`,
    `- Image position: ${seed.imagePosition}.`,
    `- Reading direction: ${seed.readingDirection}.`,
  ].join('\n');
}

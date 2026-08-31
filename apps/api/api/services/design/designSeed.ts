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
  A: "EDITORIAL SPLIT — l'image occupe 60-70% du cadre, un aplat plein tient le reste. Le titre déborde sur l'image. La coupe est irrégulière (inclinée de 5 à 15°), jamais une verticale.",
  B: "FULL BLEED CINEMATIC — l'image couvre tout le cadre. Une forme géométrique semi-opaque ancre le titre. Sensation d'affiche.",
  C: 'TYPOGRAPHIC DOMINANT — des mots démesurés, ajourés, occupent 40 à 60% du cadre. L\'image apparaît à travers les lettres (superposition, mix-blend-mode: multiply). Le reste au minimum.',
  D: "SWISS BRUTALIST — grille modulaire stricte révélée par des filets épais (3-6px). Un nombre ou un label surdimensionné comme graphisme principal. Base monochrome + un accent vif. Image recadrée dans une forme géométrique.",
  E: "LUXURY MINIMAL — espace négatif maximal (50 à 65%). L'image occupe au plus 35%, décalée vers un angle. Titre fin en capitales très espacées (0.3 à 0.5em). Un filet d'1px.",
  F: "LAYERED DEPTH — la même image utilisée trois fois : pleine page à 8% d'opacité (fond), recadrée à 40% (plan médian), nette à 100% (premier plan, décalé). Le texte flotte entre les couches.",
  G: 'NEWSPAPER GRID — bandeau de titre épais en haut. Contenu en 2 ou 3 colonnes séparées par des filets. Le titre court sur toute la largeur.',
  H: "FRAGMENTED MOSAIC — l'image découpée en 3 à 5 fragments (div absolus, overflow-hidden, rotation ±3 à 8°). Les fragments se chevauchent. Le texte occupe les interstices.",
  I: "NEON GLOW DARK — fond très sombre. Une couleur primaire à pleine intensité avec halo (text-shadow 0 0 10px, 30px, 60px). L'image reçoit un voile sombre à 50%.",
  J: "ISOMETRIC FRAME — un cadre géométrique (hexagone, parallélogramme) contient l'image. Fond en aplat de marque. Le titre épouse le cadre.",
  K: 'HALFTONE EDITORIAL — trame de points (radial-gradient) à 20% d\'opacité. Titre en slab-serif condensée. Trois couleurs maximum.',
  L: "DATA POSTER — un nombre ou une statistique en très gros (30 à 40% du cadre) chevauchant l'image. Écriture infographique contemporaine.",
};

export const COLOR_STRATEGY_CATALOG: Record<string, string> = {
  MONOCHROME_ACCENT:
    'Quasi-noir + quasi-blanc + exactement un accent de la marque. Base en niveaux de gris.',
  SPLIT_COMPLEMENTARY:
    "Primaire de la marque + deux teintes de l'image approximativement complémentaires adjacentes.",
  DUOTONE: 'Deux couleurs seulement. Traiter l\'image en filter: sepia(1) hue-rotate(Xdeg) saturate(Y).',
  IMAGE_EXTRACTED:
    "Deux ou trois teintes dominantes de l'image. La couleur de marque est réservée à un seul accent (un filet, un mot, la zone du logo).",
  INVERSE:
    'Zone de contraste géométrique franche. Image sombre → bloc de texte clair ; image claire → bloc de texte sombre.',
  BRAND_FULL: 'Primaire, secondaire et accent de la marque, chacune sur une zone distincte.',
};

export const TYPOGRAPHY_MOOD_CATALOG: Record<string, string> = {
  CONDENSED_TOWER: 'Titre étroit et haut. Mots empilés verticalement, interlignage quasi nul.',
  WIDE_WHISPER:
    "Un mot-clé en petit corps (24px) mais avec un interlettrage de 0.6em qui court sur toute la largeur.",
  WEIGHT_CLASH: 'Titre massif en black (140px+) contre un sous-titre très fin (20px) en dessous.',
  SINGLE_LETTER_ANCHOR:
    "Une lettre démesurée (300px+) en graphisme de fond, à 15-25% d'opacité.",
  ALL_LOWERCASE_INTIMATE:
    'Tout en bas de casse. Titre à 72px, interlettrage serré. Aucune capitale.',
  ROTATED_AXIS:
    "Un texte-clé pivoté de 90° dans le sens antihoraire, courant du bas vers le haut le long d'un bord.",
  OUTLINE_FILLED_MIX: 'Dans le titre, alternance de mots ajourés et de mots pleins.',
  STAGGERED_INDENT: 'Indentation progressive en escalier des lignes du titre.',
};

export const LAYOUT_TENSION_CATALOG: Record<string, string> = {
  TEXT_ESCAPES_BOUNDS: 'Le titre déborde de son conteneur de 5 à 15% par marges négatives.',
  DIAGONAL_FLOW: 'transform: rotate(10-20deg) sur un élément-clé. Tout le reste s\'aligne dessus.',
  RULE_HEAVY: 'Au moins trois filets (2 à 6px) découpent le cadre.',
  NEGATIVE_SPACE_HERO: '60% du cadre au moins reste vide. La zone occupée est très travaillée.',
  CORNER_ANCHOR: 'Tous les éléments tirés vers un même angle. L\'angle opposé reste vide.',
  FULL_BLEED_EDGE: 'Les zones de couleur ou d\'image touchent tous les bords. Aucune marge.',
  FRAME_WITHIN_FRAME: 'Bordure intérieure (1-2px) en retrait de 20 à 30px du bord du cadre.',
  COLLAGE_LAYER: 'Au moins quatre éléments absolus superposés, à des opacités variées.',
};

export const GRAPHIC_ACCENT_CATALOG: Record<string, string> = {
  GEOMETRIC_SHAPE: 'Un cercle, un triangle ou un polygone franc comme élément décoratif.',
  THICK_UNDERLINE: 'Un soulignement ou surlignement épais (8-12px) sur le titre.',
  DOT_CLUSTER: 'De petits points dispersés dans l\'espace négatif.',
  OVERSIZED_PUNCTUATION: 'Un guillemet, une esperluette ou une barre oblique démesurés en décor.',
  GRADIENT_WASH: 'Un voile dégradé discret sur une seule zone du cadre.',
  NONE: 'Aucun ajout : la typographie et l\'image portent seules la composition.',
  BORDER_ACCENT: 'Bordure épaisse sur un ou deux côtés seulement.',
  PATTERN_STRIP: 'Une bande fine de motif géométrique répété.',
};

export const CONTENT_DENSITY_CATALOG: Record<string, string> = {
  MINIMAL: 'Titre + image + signature de marque. Presque aucun texte courant.',
  BALANCED: 'Titre, texte court, informations factuelles. Densité standard.',
  EDITORIAL: 'Titre, sous-titre, paragraphe, mentions. Plus de texte.',
  TYPE_HEAVY: 'Le texte EST le graphisme. De grands blocs typographiques.',
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
    `- ${label}: ${key} — ${catalog[key] || 'libre'}`;
  return [
    line('Archétype de mise en page', seed.archetype, ARCHETYPE_CATALOG),
    line('Stratégie de couleur', seed.colorStrategy, COLOR_STRATEGY_CATALOG),
    line('Humeur typographique', seed.typographyMood, TYPOGRAPHY_MOOD_CATALOG),
    line('Tension spatiale', seed.layoutTension, LAYOUT_TENSION_CATALOG),
    line('Accent graphique', seed.graphicAccent, GRAPHIC_ACCENT_CATALOG),
    line('Densité de contenu', seed.contentDensity, CONTENT_DENSITY_CATALOG),
    `- Rythme spatial: multiplier les unités d'espacement de base par ${seed.spacingMultiplier}.`,
    `- Position de l'image: ${seed.imagePosition}.`,
    `- Sens de lecture: ${seed.readingDirection}.`,
  ].join('\n');
}

/**
 * LE MOTEUR DE VISUELS — types.
 *
 * Un visuel est DESSINÉ PAR LE CODE : une composition éprouvée (gabarit), une palette tirée de
 * la charte avec contraste vérifié, une échelle typographique, des textes ajustés au millimètre
 * dans le navigateur, un logo posé là où il se lit. L'IA n'écrit jamais de HTML : elle écrit les
 * mots (dans des cases bornées) et, selon le cran, choisit la composition dans un menu — puis
 * juge les candidats rendus. C'est la logique du moteur vidéo, appliquée aux visuels.
 */
import type { FlyerFormat } from '../visual.model';

export type PosterIntent = 'event' | 'promo' | 'launch' | 'product' | 'quote' | 'recruit' | 'info';

/** Un fait du brief, montré tel quel (jamais inventé). */
export interface PosterFact {
  kind: 'date' | 'time' | 'place' | 'price' | 'contact' | 'other';
  text: string;
}

/** Les mots du visuel, en cases bornées. */
export interface PosterCopy {
  kicker?: string;
  headline: string;
  sub?: string;
  facts: PosterFact[];
  /** Le chiffre de l'offre (« −20 % », « 5 000 F »), s'il y en a un dans le brief. */
  offer?: string;
  quote?: { text: string; author?: string };
  /** Index du mot du titre mis en valeur. */
  emphasis?: number;
}

export interface PosterScheme {
  id: 'paper' | 'tint' | 'brand' | 'accent' | 'ink';
  label: string;
  bg: string;
  ink: string;
  muted: string;
  /** Couleur forte lisible sur `bg` en grand (≥ 3:1). */
  accent: string;
  /** Une surface secondaire (encart, bande) et son encre. */
  panel: string;
  panelInk: string;
  rule: string;
  dark: boolean;
  /** Fond riche (dégradé) quand la gamme en a un ; `bg` reste la couleur de référence des contrastes. */
  bgCss?: string;
}

export interface PosterImage {
  url: string;
  /** Point d'intérêt (0–1), pour cadrer sans couper le sujet. */
  focal: { x: number; y: number };
  /** Largeur / hauteur de l'image source. */
  aspect: number;
  origin: 'user' | 'brand' | 'stock' | 'generated';
}

export interface PosterLogo {
  url?: string;
  /** Encre dominante du logo : où il se lit sans halo. */
  ink: 'dark' | 'light' | 'color';
  /** Luminance relative moyenne de l'encre (0–1). */
  luminance: number;
  /** Luminance des parties les plus sombres et les plus claires de l'encre (déciles 2 et 8). */
  darkPart?: number;
  lightPart?: number;
  /** Largeur / hauteur de l'ENCRE (marges transparentes du fichier retirées). */
  aspect: number;
  /** Marges transparentes du fichier (fractions), rognées à l'affichage. */
  trim?: { top: number; right: number; bottom: number; left: number };
}

export type PosterTreatment = 'natural' | 'duotone' | 'mono';

/** Tout ce qu'un gabarit reçoit. */
export interface PosterSpec {
  format: FlyerFormat;
  width: number;
  height: number;
  /** Unité : 1 % du petit côté. */
  u: number;
  orientation: 'portrait' | 'square' | 'landscape';
  /** Marges de sécurité (story : l'interface du réseau couvre le haut et le bas). */
  safe: { top: number; right: number; bottom: number; left: number };
  copy: PosterCopy;
  scheme: PosterScheme;
  palette: { primary: string; secondary: string; accent: string; background: string; text: string };
  image?: PosterImage;
  /** Photos supplémentaires (mosaïque). */
  extraImages: PosterImage[];
  treatment: PosterTreatment;
  logo: PosterLogo;
  brandName: string;
  /** Miroir de la composition (variante B). */
  mirror: boolean;
  language: string;
}

export interface PosterTemplate {
  id: string;
  label: string;
  /** Ce que la composition dit, pour le menu du directeur artistique. */
  summary: string;
  needsImage: boolean;
  /** Fonctionne sans photo (sinon exclue quand il n'y en a pas). */
  needs?: (spec: Pick<PosterSpec, 'copy' | 'image' | 'extraImages'>) => boolean;
  /** Affinité avec l'intention du visuel (0 à 2). */
  intents: Partial<Record<PosterIntent, number>>;
  /** Palettes qui lui vont, de la meilleure à la moins bonne. */
  schemes: PosterScheme['id'][];
  render: (spec: PosterSpec) => string;
}

/** Une composition candidate (gabarit × palette × variante × traitement). */
export interface PosterChoice {
  template: string;
  scheme: PosterScheme['id'];
  mirror: boolean;
  treatment: PosterTreatment;
  emphasis?: number;
}

/** Ce que le rendu MESURE : la composition est refusée s'il reste un défaut bloquant. */
export interface PosterMeasure {
  overflow: string[];
  /** Textes retirés faute de place (sous-titre, sur-titre…). */
  dropped?: string[];
  overlaps: string[];
  outside: string[];
  tooSmall: string[];
  /** Taille finale du titre, en unités (1 % du petit côté). */
  headlineU: number;
  score: number;
  blocking: boolean;
}

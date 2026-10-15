/**
 * Ce qu'une scène reçoit : le contexte que le harnais passe au code écrit par l'IA.
 *
 * Les textes, les médias, la marque et le minutage ne sont JAMAIS écrits en dur dans le code d'une
 * scène : ils sont lus ici. C'est ce qui permet de retoucher un texte ou de changer une photo sans
 * toucher au code (le code fourni par le modèle reste tel quel).
 */

export type SfxKind = 'whoosh' | 'softwhoosh' | 'pop' | 'click' | 'tick' | 'impact' | 'shimmer' | 'riser';

export type FilmFormat = 'story' | 'square' | 'portrait' | 'landscape';

export interface SceneMedia {
  /** Identifiant stable dans le film (« m1 », « m2 »…). */
  id: string;
  kind: 'image' | 'video';
  /** URL à passer telle quelle à `<Img src>` / `<Video src>`. */
  url: string;
  /** Dimensions natives quand on les connaît (sinon 0). */
  width: number;
  height: number;
  /** Clip : durée en secondes. */
  durationSec?: number;
  /** Ce que montre le média (description). */
  note?: string;
}

export interface BrandColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
}

export interface BrandTokens {
  name: string;
  colors: BrandColors;
  fonts: { display: string; body: string };
  /** Le logo : image (URL ou data URI) pour fond clair, pour fond sombre, et son SVG brut s'il existe. */
  logo?: { light?: string; dark?: string; svg?: string; width: number; height: number };
}

export interface SceneContext {
  /** Clé de la scène (« s1 »…), son rang (0…) et le nombre de scènes du film. */
  key: string;
  index: number;
  count: number;
  format: FilmFormat;
  /** Taille de l'image en pixels. L'origine (0, 0) est au CENTRE ; x vers la droite, y vers le bas. */
  width: number;
  height: number;
  /** 1 % du plus petit côté : une unité qui suit tous les formats. */
  unit: number;
  /** Durée de la scène en secondes (le harnais coupe ce qui dépasse et complète ce qui manque). */
  duration: number;
  fps: number;
  /** Les textes EXACTS à afficher, par clé (headline, sub…). */
  texts: Record<string, string>;
  media: SceneMedia[];
  brand: BrandTokens;
  /** La ligne de voix off de la scène : ce qui est dit, et quand (secondes depuis le début de la scène). */
  voice?: { text: string; at: number; duration: number };
  /** Le tempo de la musique : premier temps (secondes depuis le début de la scène, ≥ 0) et battements par minute. */
  beat?: { bpm: number; first: number };
  /** Pose un effet sonore à l'instant courant de la scène. */
  sfx(kind: SfxKind): void;
}

/**
 * Les données d'un film, telles que le serveur les pose dans la page (rendu ou aperçu).
 *
 * Types seulement : partagés par le navigateur (harnais, lecteur) et le serveur (composition de
 * la page). Le CODE des scènes n'y est pas : il est compilé dans le paquet de la page.
 */
import type { BrandTokens, FilmFormat, SceneMedia, SfxKind } from '../kit/context';

export interface FilmSceneData {
  key: string;
  /** Début et durée (secondes) dans le film. */
  start: number;
  duration: number;
  texts: Record<string, string>;
  media: SceneMedia[];
  voice?: { text: string; at: number; duration: number };
  /** Le code de la scène n'a pas compilé : le message, montré à sa place (jamais une autre composition). */
  compileError?: string;
}

export interface FilmCaption {
  text: string;
  /** Instants absolus dans le film (secondes). */
  start: number;
  end: number;
}

export interface FilmData {
  format: FilmFormat;
  /** Taille de COMPOSITION (fixe par format) : le code des scènes travaille dans ces coordonnées. */
  width: number;
  height: number;
  /** Échelle de sortie (qualité « standard » : 2/3 ; aperçu : 1/2). Le code n'en sait rien. */
  resolutionScale?: number;
  fps: number;
  /** Fond posé sous chaque scène avant son code (la couleur de fond de la marque). */
  background: string;
  brand: BrandTokens;
  scenes: FilmSceneData[];
  /** Tempo de la musique : premier temps (secondes dans le film) et battements par minute. */
  beat?: { bpm: number; offset: number };
  /** Sous-titres de la voix off, dessinés par le harnais au-dessus des scènes. */
  captions?: FilmCaption[];
  /** Familles de polices à charger avant la première image. */
  fontFamilies: string[];
  /** Langue des messages du harnais (erreurs). */
  lang: 'fr' | 'en';
}

/** Ce que l'aperçu fait entendre (le rendu, lui, mixe le son avec ffmpeg). */
export interface FilmAudio {
  music?: { url: string; startAt: number; gain: number };
  voice: { url: string; at: number }[];
  sfx: Partial<Record<SfxKind, { url: string; gain: number }>>;
}

export interface SfxCueRecord {
  kind: SfxKind;
  /** Instant absolu dans le film (secondes). */
  t: number;
  scene: string;
  /** Gain relatif (0..1) décidé par la scène (une transition se glisse sous le reste). */
  gain?: number;
}

export interface SceneErrorRecord {
  key: string;
  stage: 'compile' | 'runtime';
  message: string;
}

/**
 * Vidéos de promotion en motion design — le modèle persistant.
 *
 * Une vidéo n'est PAS un fichier généré par un modèle : c'est un STORYBOARD
 * (quelques kilo-octets) que le moteur de scènes rejoue image par image. Le LLM
 * n'écrit que les textes des cases ; l'animation, la charte, le rythme et la
 * musique sont posés par le code. C'est ce qui permet de tenir un rendu
 * professionnel avec le modèle le moins cher du marché.
 */

/** Où la vidéo sera vue. */
export type VideoFormat = 'story' | 'square' | 'portrait' | 'landscape';

export const VIDEO_FORMATS: VideoFormat[] = ['story', 'square', 'portrait', 'landscape'];

/** Durées proposées, en secondes. */
export type VideoDuration = 6 | 15 | 30 | 60;

export const VIDEO_DURATIONS: VideoDuration[] = [6, 15, 30, 60];

/**
 * Qualité de rendu.
 *  - standard : 720p, 30 i/s — léger, idéal pour le Statut WhatsApp ;
 *  - hd       : 1080p, 30 i/s — le défaut ;
 *  - premium  : 1080p, 60 i/s — mouvements très fluides.
 */
export type VideoQuality = 'standard' | 'hd' | 'premium';

export const VIDEO_QUALITIES: VideoQuality[] = ['standard', 'hd', 'premium'];

/**
 * LE PÉRIMÈTRE choisi par l'utilisateur. Il fixe le prix : plus long, plus de
 * formats ou plus fluide coûte plus cher (cf. `video.pricing.ts`).
 */
export interface VideoScope {
  durationSec: VideoDuration;
  /** Au moins un format ; le premier est le format « principal » de l'aperçu. */
  formats: VideoFormat[];
  quality: VideoQuality;
}

/** Ce que la vidéo doit accomplir — décide de l'enchaînement des scènes. */
export type VideoObjective =
  | 'promotion'
  | 'product'
  | 'announce'
  | 'event'
  | 'opening'
  | 'testimonial'
  | 'recruitment';

export const VIDEO_OBJECTIVES: VideoObjective[] = [
  'promotion',
  'product',
  'announce',
  'event',
  'opening',
  'testimonial',
  'recruitment',
];

/** Langage de mouvement : courbes, vitesses, transitions. */
export type MotionStyle = 'energetic' | 'premium' | 'playful' | 'corporate';

export const MOTION_STYLES: MotionStyle[] = ['energetic', 'premium', 'playful', 'corporate'];

/** Ambiance musicale demandée. `none` = vidéo muette. */
export type MusicMood = 'auto' | 'upbeat' | 'calm' | 'epic' | 'corporate' | 'afro' | 'none';

export const MUSIC_MOODS: MusicMood[] = ['auto', 'upbeat', 'calm', 'epic', 'corporate', 'afro', 'none'];

/** La demande de l'utilisateur, telle qu'il l'a formulée. */
export interface VideoBrief {
  objective: VideoObjective;
  /** Le message en une phrase : « nos soldes de fin d'année, -30 % sur tout ». */
  message: string;
  /** Détails propres au commerce : prix, date, adresse, contact. Jamais inventés. */
  details?: string;
  musicMood: MusicMood;
  /** `auto` = déduit de la personnalité de la marque. */
  style?: MotionStyle | 'auto';
  /** Photos fournies (produit, équipe, local). Prioritaires sur la banque d'images. */
  imageUrls?: string[];
  /** Langue des textes à l'écran. */
  language?: string;
}

/** Une scène posée sur la ligne de temps. */
export interface VideoSceneInstance {
  /** Identifiant stable dans la vidéo (sert de clé de retouche). */
  key: string;
  /** Scène du catalogue (`hook`, `product`, `offer`…). */
  sceneId: string;
  /** Variante de mise en page tirée par la graine. */
  variant: number;
  /** Début, en secondes. */
  start: number;
  /** Durée, en secondes. */
  duration: number;
  /** Surface de la scène : claire, couleur primaire, secondaire ou accent. */
  surface: 'light' | 'primary' | 'secondary' | 'accent';
  /** Transition qui OUVRE la scène (aucune pour la première). */
  transitionIn?: VideoTransition;
  /** Textes des cases, déjà bornés et réparés. */
  slots: Record<string, string>;
  /** Image de la scène, quand elle en porte une. */
  image?: string;
  /** Images supplémentaires (galerie). */
  images?: string[];
}

export type VideoTransition = 'wipe' | 'circle' | 'push' | 'zoom' | 'split' | 'flash' | 'fade';

export interface VideoBeatGrid {
  bpm: number;
  /** Position du premier temps fort, en secondes depuis le début de l'extrait. */
  offset: number;
  confidence: number;
}

export interface VideoStoryboard {
  version: 1;
  seed: number;
  style: MotionStyle;
  durationSec: number;
  scenes: VideoSceneInstance[];
  beat?: VideoBeatGrid;
}

export type MusicLicense = 'cc0' | 'pdm' | 'cc-by' | 'cc-by-sa' | 'platform';

/** Une piste libre de droits, d'où qu'elle vienne. */
export interface MusicTrack {
  id: string;
  provider: 'local' | 'openverse' | 'ccmixter' | 'jamendo' | 'freesound';
  title: string;
  artist: string;
  /** URL directe du fichier audio. */
  url: string;
  durationSec: number;
  license: MusicLicense;
  licenseUrl?: string;
  /** Page de la piste chez son éditeur. */
  sourceUrl?: string;
  /** Ligne de crédit à reproduire (obligatoire pour CC BY). */
  attribution: string;
  moods: string[];
  /** Tempo annoncé par l'éditeur, quand il le donne. */
  bpm?: number;
}

/** La piste retenue pour une vidéo, et l'endroit où l'extrait commence. */
export interface VideoMusic extends MusicTrack {
  startAt: number;
  beat?: VideoBeatGrid;
}

export type VideoRenderStatus = 'queued' | 'rendering' | 'done' | 'failed';

export interface VideoRender {
  format: VideoFormat;
  status: VideoRenderStatus;
  /** 0 → 1. */
  progress: number;
  url?: string;
  posterUrl?: string;
  sizeBytes?: number;
  width?: number;
  height?: number;
  fps?: number;
  error?: string;
  renderedAt?: Date | string;
}

export type MotionVideoStatus = 'draft' | 'rendering' | 'ready' | 'failed';

export interface MotionVideo {
  id: string;
  title: string;
  brief: VideoBrief;
  scope: VideoScope;
  storyboard: VideoStoryboard;
  music?: VideoMusic;
  renders: VideoRender[];
  status: MotionVideoStatus;
  /** Prix payé pour le périmètre actuel : sert à facturer un élargissement. */
  paidCredits: number;
  /** Nombre d'exports MP4 réalisés (le premier est inclus dans le prix). */
  exportCount: number;
  /** Vrai quand les textes ont été retouchés depuis le dernier export. */
  dirty?: boolean;
  /** Mesure : tokens consommés par la rédaction (entrée + sortie estimées). */
  copyTokens?: { input: number; output: number; source: 'llm' | 'heuristic' };
  createdAt: Date | string;
  updatedAt: Date | string;
}

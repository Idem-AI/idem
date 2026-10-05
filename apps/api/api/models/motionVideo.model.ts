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

/**
 * LE TYPE DE MOTION choisi par l'utilisateur : la famille visuelle de la vidéo.
 * L'objectif (promotion, événement…) dit QUOI raconter ; le type dit COMMENT.
 */
export type VideoType =
  | 'kinetic'
  | 'product'
  | 'promo'
  | 'footage'
  | 'showcase3d'
  | 'illustrated'
  | 'slideshow'
  | 'logo'
  /** Combinée : le modèle choisit l'enchaînement des scènes (3D, clips, Lottie, typo…). */
  | 'mix';

export const VIDEO_TYPES: VideoType[] = [
  'kinetic',
  'product',
  'promo',
  'footage',
  'showcase3d',
  'illustrated',
  'slideshow',
  'logo',
  'mix',
];

/** Un média de la vidéo : importé par l'utilisateur, trouvé sur Pexels ou généré. */
export type VideoMediaKind = 'image' | 'video' | 'model3d' | 'lottie' | 'rive';

export interface VideoMediaAsset {
  id: string;
  kind: VideoMediaKind;
  /** URL publique (stockage IDEM ou source externe pour une image). */
  url: string;
  origin: 'upload' | 'pexels' | 'generated' | 'library' | 'visual';
  name?: string;
  /** Vidéo : durée (s) et dimensions ; image : dimensions. */
  durationSec?: number;
  width?: number;
  height?: number;
  /** Vignette (vidéo). */
  posterUrl?: string;
  /** Crédit (Pexels : auteur). */
  credit?: string;
  sourceUrl?: string;
}

/** Moments sonores posés par le moteur d'animation. */
export type SfxKind = 'whoosh' | 'softwhoosh' | 'pop' | 'click' | 'tick' | 'impact' | 'shimmer' | 'riser';

export const SFX_KINDS: SfxKind[] = ['whoosh', 'softwhoosh', 'pop', 'click', 'tick', 'impact', 'shimmer', 'riser'];

export interface SfxSound {
  id: string;
  kind: SfxKind;
  title: string;
  author: string;
  license: 'cc0' | 'cc-by' | 'generated';
  sourceUrl?: string;
  /** Durée après nettoyage (s). */
  durationSec: number;
  attribution?: string;
}

export interface VideoSfx {
  enabled: boolean;
  /** Un son retenu par moment sonore (tiré par la graine dans la sonothèque). */
  sounds: Partial<Record<SfxKind, SfxSound>>;
}

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
  /** Médias importés par l'utilisateur (photos, vidéos, modèles 3D, Lottie). */
  media?: VideoMediaAsset[];
  /** IDEM peut chercher des photos et vidéos sur Pexels. */
  allowStock?: boolean;
  /** IDEM peut générer une vidéo (Gemini Veo) si Pexels ne trouve rien. */
  allowGenerate?: boolean;
  /** Effets sonores (whoosh, pop…) : activés par défaut. */
  sfx?: boolean;
  /** Direction de motion imposée (sinon choisie par IDEM). */
  direction?: string;
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
  /** Surface de la scène : claire, primaire, secondaire, accent, teinte claire ou profonde de la primaire. */
  surface: 'light' | 'primary' | 'secondary' | 'accent' | 'tint' | 'deep';
  /** Transition qui OUVRE la scène (aucune pour la première). */
  transitionIn?: VideoTransition;
  /** Textes des cases, déjà bornés et réparés. */
  slots: Record<string, string>;
  /** Image de la scène, quand elle en porte une. */
  image?: string;
  /** Images supplémentaires (galerie, cartes 3D). */
  images?: string[];
  /** Clip vidéo de la scène (URL WebM). */
  video?: string;
  /** Modèle 3D (GLB). */
  model?: string;
  /** Animation Lottie : URL d'un fichier importé, ou `builtin:<nom>`. */
  lottie?: string;
  /** Animation Rive importée (.riv). */
  rive?: string;
  /** Le grand moment de la vidéo (une scène au plus) : effet choisi par la direction. */
  accent?: 'punch' | 'giant' | 'hold' | 'flip';
  /** Plan de mouvement : ancrage, techniques d'entrée, transition (cf. video.direction.ts). */
  motion?: {
    anchor: string;
    headline: string;
    support: string;
    align: 'left' | 'center';
    transition?: string;
    kicker: boolean;
  };
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
  /** Direction de motion (système visuel complet), cf. video.direction.ts. */
  direction?: string;
  durationSec: number;
  scenes: VideoSceneInstance[];
  beat?: VideoBeatGrid;
  /** Kit retenu par le graphe de capacités (cf. video.capabilities.ts). */
  kit?: VideoKit;
  /** Réglages imposés par la direction artistique de la charte (cf. video.artdirection.ts). */
  art?: VideoArtOverrides;
  /** Concept narratif (cf. video.concepts.ts) : sert aussi à varier les vidéos d'un projet. */
  concept?: string;
}

/** La DA de la charte traduite en réglages du moteur. */
export interface VideoArtOverrides {
  displayCase?: 'none' | 'upper';
  decor?: 'grain' | 'rules' | 'grid' | 'paper';
  /** Multiplicateur des durées d'entrée (> 1 = plus posé). */
  pace?: number;
  color?: 'restrained' | 'committed' | 'drenched';
}

/** Une décision du routeur de capacités : le nœud retenu, pourquoi, et les nœuds écartés. */
export interface KitDecision {
  kind: string;
  chosen: string;
  score: number;
  why: string[];
  rejected: { id: string; reason: string }[];
}

/** Les choix du kit pour une vidéo (graphe de capacités) : stables à la retouche et au réexport. */
export interface VideoKit {
  /** Fond du kit (none, dot-grid, halftone, shape-field, stagger-grid, marquee, spotlight, ticks). */
  background: string;
  /** Scènes qui portent le fond (deux au plus). */
  backdropScenes: string[];
  /** Annotation du mot mis en valeur (none, marker, underline, circle). */
  annotate: string;
  annotateScene?: string;
  /** Animation du logo (classic, draw, trace, morph, assemble, wipe, split, extrude). */
  logo: string;
  /** Bibliothèque d'icônes (lucide, tabler, phosphor-*, heroicons-solid). */
  iconSet: 'lucide' | 'tabler' | 'phosphor-thin' | 'phosphor-light' | 'phosphor-bold' | 'phosphor-fill' | 'phosphor-duotone' | 'heroicons-solid';
  /** Concepts d'icônes par scène (clé de scène → un concept par élément). */
  icons: Record<string, string[]>;
  /** Logo pendant la vidéo : none (signature finale seulement) ou corner (discret, sans conteneur). */
  brandmark?: string;
  spring?: { bounce: number };
  postfx: string[];
  addons: ('three' | 'gsap' | 'anime' | 'flubber' | 'lottie' | 'rive')[];
  trace: KitDecision[];
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
  /** Type de motion choisi (absent sur les vidéos d'avant les types). */
  type?: VideoType;
  /** Tous les médias de la vidéo, quelle que soit leur origine. */
  media?: VideoMediaAsset[];
  sfx?: VideoSfx;
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

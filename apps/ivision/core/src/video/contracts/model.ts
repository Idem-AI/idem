/**
 * Vidéos motion design — le modèle persistant.
 *
 * Une vidéo est un FILM : un concept, une bible visuelle et des scènes. Chaque scène porte son
 * intention, ses textes exacts, ses médias et le CODE Motion Canvas écrit par l'IA, gardé tel
 * quel. Les textes et les médias sont des données lues par ce code : les retoucher ne touche pas
 * au code. Le MP4 est rendu sur nos serveurs (Motion Canvas dans Chromium, puis ffmpeg).
 */
import type { RequestSpec } from '../request/request';

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
 * formats ou plus fluide coûte plus cher (cf. `pricing.ts`).
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
  /** Intensité décidée par l'agent sound designer : discrète (-4 dB), normale, appuyée (+3 dB). */
  intensity?: 'subtle' | 'normal' | 'punchy';
}

/** Une ligne de voix off, posée sur SA scène (la scène dure au moins le temps de la dire). */
export interface VoiceLine {
  /** Clé de la scène qui la porte. */
  sceneKey: string;
  text: string;
  /** Fichier traité (MP3 48 kHz, loudness normalisée), dans le stockage. */
  url: string;
  durationSec: number;
  /** Décalage depuis le début de la scène (laisse passer la transition). */
  offset: number;
}

export interface VideoVoice {
  enabled: boolean;
  /** Langue de la voix : celle de la vidéo (langue de l'utilisateur à la création). */
  language: string;
  /** Personnage de voix (catalogue `audio/voice.ts`), traduit en voix du fournisseur. */
  persona: string;
  provider: 'openrouter';
  model: string;
  voice: string;
  /** Jeu demandé par l'agent narrateur. */
  style?: string;
  lines: VoiceLine[];
  /** llm = texte écrit par l'agent narrateur ; heuristic = tiré des textes à l'écran. */
  source: 'llm' | 'heuristic';
  /** Absente : la langue ou le service ne permettaient pas de voix (la vidéo reste sans). */
  unavailable?: string;
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
  /** IDEM peut chercher des photos et vidéos sur Pexels (après trois échecs de génération). */
  allowStock?: boolean;
  /** IDEM génère les photos et les clips que l'utilisateur n'a pas fournis (modèles OpenRouter). */
  allowGenerate?: boolean;
  /** Effets sonores (whoosh, pop…) : activés par défaut. */
  sfx?: boolean;
  /** Voix off, dans la langue de la vidéo : choisie par l'utilisateur, désactivée par défaut. */
  voice?: boolean;
  /**
   * La demande telle que l'utilisateur l'a écrite, EN ENTIER (bornée à 20 000 signes) : `message`
   * et `details` n'en sont que le résumé pour les anciens appels.
   */
  request?: string;
  /** Le cahier des charges lu dans la demande (request/request.ts) : langue, scénario, consignes, supports. */
  spec?: RequestSpec;
  /** L'intention lue (request/intent.ts) : objectif, mode de production, langage de motion — et d'où vient chaque décision. */
  intent?: import('../request/intent').VideoIntentSpec;
}

export interface VideoBeatGrid {
  bpm: number;
  /** Position du premier temps fort, en secondes depuis le début de l'extrait. */
  offset: number;
  confidence: number;
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
  /** Qualité du rendu (la signature en dépend). */
  quality?: VideoQuality;
  /**
   * Signature de ce qui a été rendu (scènes, sons, voix, format, qualité) : le MP4 n'est à jour
   * que si elle est celle de la vidéo telle qu'elle est (`isRenderFresh`). Absente : anciens rendus.
   */
  key?: string;
  /**
   * Rendu fait D'AVANCE, pendant que l'utilisateur regarde l'aperçu : pas encore un export (ni
   * compté, ni facturé). Il le devient au premier téléchargement (`claimRender`).
   */
  prerender?: boolean;
  /** Lecture seule (vue) : le fichier ne reflète plus la vidéo (retouchée depuis). */
  stale?: boolean;
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
  /** Voix off (si l'utilisateur l'a demandée) : les scènes sont calées sur ses lignes. */
  voice?: VideoVoice;
  brief: VideoBrief;
  scope: VideoScope;
  /** Le film (moteur Motion Canvas). Absent : vidéo de l'ancien moteur, gardée en lecture seule. */
  film?: VideoFilm;
  /** Ancien moteur (avant octobre 2026) : son storyboard, conservé tel quel, jamais rejoué. */
  storyboard?: unknown;
  /** Lecture seule (vue) : vidéo de l'ancien moteur — ses MP4 se téléchargent, elle ne se retouche plus. */
  legacy?: boolean;
  music?: VideoMusic;
  renders: VideoRender[];
  status: MotionVideoStatus;
  /** Prix payé pour le périmètre actuel : sert à facturer un élargissement. */
  paidCredits: number;
  /** Nombre d'exports MP4 réalisés (le premier est inclus dans le prix). */
  exportCount: number;
  /** Vrai quand les textes ont été retouchés depuis le dernier export. */
  dirty?: boolean;
  /** Cran de la jauge de créativité choisi à la création (prix et décisions confiées à l'IA). */
  creativity?: 'low' | 'medium' | 'high' | 'ultra';
  /** L'enregistrement de la génération (décisions, médias, réparations, replis, constats) — format commun aux documents. */
  record?: import('@idem/graphic-engine').GenerationRecord;
  createdAt: Date | string;
  updatedAt: Date | string;
}

// ─── Le film ─────────────────────────────────────────────────────────────────

export type FilmSceneStatus = 'planned' | 'ready' | 'error';

/** Un média que le planificateur demande pour une scène (produit par la génération ou la banque d'images). */
export interface FilmMediaNeed {
  kind: 'image' | 'video';
  /** Ce qu'on voit (anglais : les modèles d'image et de vidéo le comprennent le mieux). */
  shot: string;
  /** Deux à quatre mots pour une banque d'images. */
  query: string;
}

export interface FilmScene {
  /** Identifiant stable (« s1 »…) : clé des retouches, des lignes de voix et des erreurs. */
  key: string;
  /** Début et durée, en secondes. */
  start: number;
  duration: number;
  /** L'intention narrative de la scène (planificateur). */
  purpose: string;
  /** L'idée visuelle et l'idée de mouvement (directeur, planificateur) : du texte libre, jamais un gabarit. */
  visual: string;
  motion: string;
  /** Comment la scène entre (texte libre). */
  transition?: string;
  /** Les textes EXACTS à l'écran, par clé (headline, sub…). Lus par le code, jamais écrits en dur. */
  texts: Record<string, string>;
  /** Les médias de la scène (identifiants de `MotionVideo.media`). */
  media: string[];
  /** Les médias demandés et pas encore produits. */
  needs?: FilmMediaNeed[];
  /** La ligne de voix off de la scène (écrite même sans voix : l'activer plus tard ne coûte pas d'agent). */
  voiceText?: string;
  /** Le code Motion Canvas (TSX) écrit par l'IA. Jamais réécrit par le code d'IDEM. */
  code?: string;
  /** Qui l'a écrit, et à quelle demande. */
  author?: {
    tokens: { input: number; output: number };
    ms: number;
    at: string;
    attempts: number;
    instruction?: string;
    /** Les corrections automatiques de cette scène, dans l'ordre (au plus trois approches différentes). */
    repairs?: { strategy: 'fix' | 'rewrite' | 'minimal'; ok: boolean; error?: string }[];
  };
  status: FilmSceneStatus;
  /** L'erreur TECHNIQUE qui empêche la scène de s'exécuter (jamais un jugement esthétique). */
  error?: { stage: 'author' | 'compile' | 'runtime'; message: string };
  /** Vignette de la scène (image rendue au dernier contrôle). */
  thumbnail?: string;
}

export interface FilmAgentTrace {
  agent: string;
  source: 'llm' | 'none';
  tokens: { input: number; output: number };
  ms: number;
  /** Pourquoi le modèle n'a rien rendu d'utilisable (réponse vide, illisible, panne). */
  failure?: string;
}

export interface VideoFilm {
  version: 2;
  engine: 'motion-canvas';
  title: string;
  /** Le concept du film, en une ou deux phrases. */
  concept: string;
  /** La bible visuelle : couleurs, typographie, formes, personnalité du mouvement (texte libre du directeur). */
  bible: string;
  durationSec: number;
  seed: number;
  /** Langue des textes et de la voix. */
  language: string;
  scenes: FilmScene[];
  /** Sous-titres de la voix off, posés par le harnais. */
  captions: boolean;
  /** Effets sonores posés par le code des scènes (dernier contrôle). */
  cues?: { kind: SfxKind; t: number; scene: string }[];
  /** Les appels de modèles : agent, tokens, durée. */
  agents: FilmAgentTrace[];
  /** Ce que la demande imposait et que le film ne suit pas (dit, jamais caché). */
  fidelity?: { notes: string[] };
  /** Dernier contrôle technique (compilation + exécution de chaque scène). */
  checkedAt?: string;
  /**
   * L'autocorrection avant livraison : tentatives, scènes corrigées, scènes restées en erreur, jetons
   * dépensés, et pourquoi elle s'est arrêtée (`budget`, `time`) quand ce n'est pas la fin des approches.
   */
  repair?: { attempts: number; fixed: string[]; unresolved: string[]; tokens: number; stopped?: 'budget' | 'time' };
  /** La vidéo modèle dont le film s'inspire. */
  reference?: { id?: string; summary: string };
}

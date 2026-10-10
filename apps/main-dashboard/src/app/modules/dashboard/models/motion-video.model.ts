/**
 * Vidéos de promotion en motion design — miroir des types de l'API
 * (`apps/api/api/models/motionVideo.model.ts`).
 */

export type VideoFormat = 'story' | 'square' | 'portrait' | 'landscape';
export type VideoDuration = 6 | 15 | 30 | 60;
export type VideoQuality = 'standard' | 'hd' | 'premium';
export type VideoObjective =
  | 'promotion'
  | 'product'
  | 'announce'
  | 'event'
  | 'opening'
  | 'testimonial'
  | 'recruitment';
export type VideoType = 'kinetic' | 'product' | 'promo' | 'footage' | 'showcase3d' | 'illustrated' | 'slideshow' | 'logo' | 'mix';
export type VideoMediaKind = 'image' | 'video' | 'model3d' | 'lottie' | 'rive';

export interface VideoMediaAsset {
  id: string;
  kind: VideoMediaKind;
  url: string;
  origin: 'upload' | 'pexels' | 'generated' | 'library' | 'visual';
  name?: string;
  durationSec?: number;
  posterUrl?: string;
  credit?: string;
  sourceUrl?: string;
}

export type SfxKind = 'whoosh' | 'softwhoosh' | 'pop' | 'click' | 'tick' | 'impact' | 'shimmer' | 'riser';

export interface SfxSound {
  id: string;
  kind: SfxKind;
  title: string;
  author: string;
  license: string;
  sourceUrl?: string;
}

export type MotionStyle = 'energetic' | 'premium' | 'playful' | 'corporate';
export type MusicMood = 'auto' | 'upbeat' | 'calm' | 'epic' | 'corporate' | 'afro' | 'none';

export interface VideoScope {
  durationSec: VideoDuration;
  formats: VideoFormat[];
  quality: VideoQuality;
}

export interface VideoBrief {
  /** Absent : déduit de la demande par le modèle. */
  objective?: VideoObjective;
  message: string;
  details?: string;
  musicMood: MusicMood;
  style?: MotionStyle | 'auto';
  imageUrls?: string[];
  language?: string;
  media?: VideoMediaAsset[];
  allowStock?: boolean;
  allowGenerate?: boolean;
  sfx?: boolean;
  /** Voix off dans la langue de la vidéo (désactivée par défaut). */
  voice?: boolean;
  direction?: string;
}

/** La voix off d'une vidéo : une ligne par scène, calée sur elle. */
export interface VideoVoice {
  enabled: boolean;
  language: string;
  persona: string;
  provider: 'glm' | 'gemini';
  model: string;
  voice: string;
  style?: string;
  lines: { sceneKey: string; text: string; url: string; durationSec: number; offset: number }[];
  source: 'llm' | 'heuristic';
  /** La voix n'a pas pu être produite (langue, service) : la vidéo reste sans. */
  unavailable?: string;
}

export interface VideoSceneInstance {
  key: string;
  sceneId: string;
  variant: number;
  start: number;
  duration: number;
  surface: 'light' | 'primary' | 'secondary' | 'accent';
  transitionIn?: string;
  slots: Record<string, string>;
  image?: string;
  images?: string[];
}

export interface VideoStoryboard {
  version: 1;
  seed: number;
  style: MotionStyle;
  direction?: string;
  /** Concept narratif retenu (question → réponse, le produit en héros…). */
  concept?: string;
  durationSec: number;
  scenes: VideoSceneInstance[];
  /** Cran Ultra : le film d'auteur (le directeur IA l'a inventé, `coded` plans écrits par l'IA). */
  authored?: { title: string; concept: string; bible: string; shots: number; coded: number; fallback: string[]; reviewed: number };
  /** Ce que chaque agent a décidé : `llm` = décision de l'IA retenue, `graph` = décision du code. */
  agents?: { agent: string; source: 'llm' | 'graph' }[];
  /** Le moteur créatif : écart à la vidéo la plus proche de la marque, touche inattendue. */
  creative?: {
    accent?: { index: number; pattern: string; family: string };
    novelty?: { nearest: number | null; verdict: 'too-close' | 'acceptable' | 'distinct' | 'first' };
  };
}

export interface MusicTrack {
  id: string;
  provider: string;
  title: string;
  artist: string;
  url: string;
  durationSec: number;
  license: string;
  licenseUrl?: string;
  sourceUrl?: string;
  attribution: string;
  bpm?: number;
}

export interface VideoMusic extends MusicTrack {
  startAt: number;
}

export interface VideoRender {
  format: VideoFormat;
  status: 'queued' | 'rendering' | 'done' | 'failed';
  progress: number;
  url?: string;
  posterUrl?: string;
  sizeBytes?: number;
  width?: number;
  height?: number;
  fps?: number;
  error?: string;
}

export interface MotionVideo {
  id: string;
  title: string;
  type?: VideoType;
  media?: VideoMediaAsset[];
  sfx?: { enabled: boolean; sounds: Partial<Record<SfxKind, SfxSound>> };
  voice?: VideoVoice;
  brief: VideoBrief;
  scope: VideoScope;
  storyboard: VideoStoryboard;
  music?: VideoMusic;
  renders: VideoRender[];
  status: 'draft' | 'rendering' | 'ready' | 'failed';
  paidCredits: number;
  exportCount: number;
  dirty?: boolean;
  createdAt: string;
  updatedAt: string;
  /** Cran de créativité de la création. */
  creativity?: 'low' | 'medium' | 'high' | 'max' | 'ultra';
}

/** Barème renvoyé par l'API : le prix se calcule en direct, sans aller-retour. */
export interface VideoPricing {
  referenceCost: number;
  durationFactor: Record<string, number>;
  extraFormatFactor: number;
  qualityFactor: Record<VideoQuality, number>;
  rerenderFactor: number;
  minRerender: number;
  durations: VideoDuration[];
  formats: VideoFormat[];
  qualities: VideoQuality[];
}

export interface SceneSlotSpec {
  key: string;
  max: number;
  required: boolean;
}

export interface VideoOptions {
  pricing: VideoPricing;
  objectives: VideoObjective[];
  moods: MusicMood[];
  styles: (MotionStyle | 'auto')[];
  /** Directions de motion : systèmes visuels complets (composition, techniques, transitions, couleur). */
  directions: string[];
  /** Cases de chaque scène, avec leur longueur maximale. */
  scenes: Record<string, SceneSlotSpec[]>;
  /** Types de motion proposés à la création. */
  types: { id: VideoType; icon: string; style: MotionStyle; needs: { images?: number; videos?: number }; durations?: VideoDuration[] }[];
}

/** Même formule que `video.pricing.ts` côté API (l'API reste l'autorité). */
export function priceVideo(pricing: VideoPricing, scope: VideoScope): number {
  const formats = Math.max(1, scope.formats.length);
  return Math.ceil(
    pricing.referenceCost *
      (pricing.durationFactor[String(scope.durationSec)] ?? 1) *
      (1 + pricing.extraFormatFactor * (formats - 1)) *
      (pricing.qualityFactor[scope.quality] ?? 1),
  );
}

export function priceExport(pricing: VideoPricing, video: MotionVideo, scope: VideoScope): number {
  const full = priceVideo(pricing, scope);
  const upgrade = Math.max(0, full - (video.paidCredits || 0));
  if (video.exportCount <= 0) return upgrade;
  return upgrade + Math.max(pricing.minRerender, Math.ceil(full * pricing.rerenderFactor));
}

/** Étapes réelles d'une création, reçues en direct (flux SSE). */
export type VideoProgressStage = 'plan' | 'copy' | 'layout' | 'media' | 'music' | 'sfx' | 'voice' | 'storyboard' | 'animation' | 'critique' | 'code' | 'direction' | 'shots';

export interface VideoProgressMediaItem {
  kind: VideoMediaKind;
  origin: string;
  url?: string;
  credit?: string;
  name?: string;
}

export interface VideoProgressData {
  type?: VideoType;
  /** Concept narratif retenu (étape « plan »). */
  concept?: string;
  scenes?: (string | { sceneId: string; duration: number; surface?: string })[];
  durationSec?: number;
  title?: string;
  lines?: number;
  source?: 'llm' | 'heuristic';
  query?: string;
  stockPhotos?: number;
  stockVideos?: number;
  generatedVideos?: number;
  generatedImages?: number;
  items?: VideoProgressMediaItem[];
  artist?: string;
  provider?: string;
  bpm?: number;
  none?: boolean;
  sounds?: { kind: SfxKind; title: string }[];
  /** Agents : mises en page retenues, transitions, caméra, corrections du critique. */
  layouts?: string[];
  transitions?: string[];
  camera?: string;
  fixes?: number;
  /** La piste a été choisie par l'agent sound designer. */
  pickedBy?: 'agent' | 'graph';
  /** Cran Ultra : scènes écrites par l'IA et retenues après contrôle. */
  coded?: number;
  tried?: number;
  /** Film d'auteur (Ultra) : le directeur a imaginé le film (étape « direction »). */
  shots?: { kind: string; duration: number; visual: string }[];
  fallback?: boolean;
  /** Film d'auteur : avancée des plans (étape « shots »). */
  total?: number;
  done?: number;
  current?: number;
  step?: 'writing' | 'review' | 'revise' | 'done';
  round?: number;
  reviewed?: number;
  authored?: { shots: number; coded: number };
  /** Médias générés : plans demandés au directeur photo, essais en échec, repli des visuels. */
  planned?: number;
  failedAttempts?: number;
  fromVisuals?: number;
  /** Voix off : lignes dites, langue, ou la raison de son absence. */
  language?: string;
  persona?: string;
  unavailable?: string;
}

export type VideoStreamEvent =
  | { type: 'progress'; stage: VideoProgressStage; state: 'running' | 'done'; data?: VideoProgressData }
  | { type: 'complete'; video: MotionVideo }
  | { type: 'error'; error: string; status?: number; cost?: number; balance?: number };

/**
 * Vidéos de promotion en motion design — miroir des types de l'API
 * (`apps/ivision/core/src/video/contracts/model.ts`, moteur Motion Canvas).
 */

export type VideoFormat = 'story' | 'square' | 'portrait' | 'landscape';
export type VideoDuration = 6 | 15 | 30 | 60 | 90 | 120 | 180;
export type VideoQuality = 'standard' | 'hd' | 'premium';
export type VideoObjective = 'promotion' | 'product' | 'announce' | 'event' | 'opening' | 'testimonial' | 'recruitment';
export type VideoType = 'kinetic' | 'product' | 'promo' | 'footage' | 'showcase3d' | 'illustrated' | 'slideshow' | 'logo' | 'mix';
export type VideoMediaKind = 'image' | 'video';

export interface VideoMediaAsset {
  id: string;
  kind: VideoMediaKind;
  url: string;
  origin: 'upload' | 'pexels' | 'generated' | 'library' | 'visual';
  name?: string;
  durationSec?: number;
  width?: number;
  height?: number;
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
  /** La demande telle que l'utilisateur l'a écrite. */
  request?: string;
}

/** La voix off d'une vidéo : une ligne par scène, calée sur elle. */
export interface VideoVoice {
  enabled: boolean;
  language: string;
  persona: string;
  provider: 'openrouter';
  model: string;
  voice: string;
  lines: { sceneKey: string; text: string; url: string; durationSec: number; offset: number }[];
  source: 'llm' | 'heuristic';
  unavailable?: string;
}

/** Une scène du film : son intention, ses textes (données), ses médias, et le code écrit par l'IA. */
export interface FilmScene {
  key: string;
  start: number;
  duration: number;
  purpose: string;
  visual: string;
  motion: string;
  transition?: string;
  texts: Record<string, string>;
  media: string[];
  voiceText?: string;
  code?: string;
  author?: { tokens: { input: number; output: number }; ms: number; at: string; attempts: number; instruction?: string };
  status: 'planned' | 'ready' | 'error';
  error?: { stage: 'author' | 'compile' | 'runtime'; message: string };
  thumbnail?: string;
}

export interface VideoFilm {
  version: 2;
  engine: 'motion-canvas';
  title: string;
  concept: string;
  bible: string;
  durationSec: number;
  language: string;
  scenes: FilmScene[];
  captions: boolean;
  agents: { agent: string; source: 'llm' | 'none'; tokens: { input: number; output: number }; ms: number; failure?: string }[];
  fidelity?: { notes: string[] };
  checkedAt?: string;
  /** L'autocorrection avant livraison : scènes corrigées, scènes restées en erreur, pourquoi elle s'est arrêtée. */
  repair?: { attempts: number; fixed: string[]; unresolved: string[]; tokens: number; stopped?: 'budget' | 'time' };
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
  /** `scene_error` : une scène a échoué pendant le rendu (le fichier n'est pas livré). */
  error?: string;
  stale?: boolean;
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
  /** Le film (moteur Motion Canvas). Absent : vidéo de l'ancien moteur (`legacy`). */
  film?: VideoFilm;
  /** Vidéo de l'ancien moteur : ses MP4 se téléchargent, elle ne se retouche plus. */
  legacy?: boolean;
  music?: VideoMusic;
  renders: VideoRender[];
  status: 'draft' | 'rendering' | 'ready' | 'failed';
  paidCredits: number;
  exportCount: number;
  dirty?: boolean;
  createdAt: string;
  updatedAt: string;
  creativity?: 'low' | 'medium' | 'high' | 'ultra';
}

/** Ce qu'une retouche peut demander (gratuite). */
export interface VideoPatch {
  texts?: Record<string, Record<string, string>>;
  images?: Record<string, string>;
  musicMood?: MusicMood;
  musicTrackId?: string;
  sfx?: boolean;
  voice?: boolean;
  captions?: boolean;
  voiceLines?: Record<string, string>;
  /** Clé de scène → consigne : l'IA réécrit le code de la scène. */
  visual?: Record<string, string>;
  /** Scènes en erreur à corriger (nouvel appel à l'IA, à la demande). */
  fix?: string[];
  /** Scènes à réécrire de zéro depuis leur fiche. */
  regenerate?: string[];
  scope?: Partial<VideoScope>;
}

export interface VideoRevisionResult {
  video: MotionVideo | null;
  report: { recoded: string[]; voiced: string[]; failed: { key: string; what: 'visual' | 'voice'; reason?: string }[] };
  reply?: string;
  newRequest: boolean;
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

export interface VideoOptions {
  engine: { name: string; version: string };
  pricing: VideoPricing;
  objectives: VideoObjective[];
  moods: MusicMood[];
  /** Familles proposées à la création : de simples indications pour le directeur. */
  types: { id: VideoType; icon: string }[];
}

/** Même formule que `pricing.ts` côté API (l'API reste l'autorité). */
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
export type VideoProgressStage = 'plan' | 'concept' | 'storyboard' | 'media' | 'music' | 'sfx' | 'voice' | 'code' | 'check' | 'repair';

export interface VideoProgressData {
  /** plan */
  language?: string;
  scripted?: boolean;
  media?: number;
  /** concept */
  title?: string;
  concept?: string;
  failed?: string;
  /** storyboard */
  scenes?: number | { duration: number; purpose: string }[];
  /** media */
  planned?: number;
  done?: number;
  total?: number;
  generatedImages?: number;
  generatedVideos?: number;
  stockPhotos?: number;
  stockVideos?: number;
  missing?: number;
  blocked?: 'payment' | 'unavailable';
  /** music */
  artist?: string;
  bpm?: number;
  none?: boolean;
  /** voice */
  lines?: number;
  unavailable?: string;
  /** code */
  scene?: string;
  ok?: boolean;
  ready?: number;
  /** check */
  errors?: string[] | { key: string; stage?: string; message?: string }[];
  /** repair : tour en cours, scènes corrigées et restées en erreur */
  round?: number;
  fixed?: number;
  unresolved?: number;
  attempts?: number;
}

export type VideoStreamEvent =
  | { type: 'progress'; stage: VideoProgressStage; state: 'running' | 'done'; data?: VideoProgressData }
  | { type: 'complete'; video: MotionVideo }
  | { type: 'error'; error: string; status?: number; cost?: number; balance?: number };

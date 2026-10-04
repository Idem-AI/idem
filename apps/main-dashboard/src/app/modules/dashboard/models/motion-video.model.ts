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
export type VideoType = 'kinetic' | 'product' | 'promo' | 'footage' | 'showcase3d' | 'illustrated' | 'slideshow' | 'logo';
export type VideoMediaKind = 'image' | 'video' | 'model3d' | 'lottie';

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
  objective: VideoObjective;
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
  durationSec: number;
  scenes: VideoSceneInstance[];
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

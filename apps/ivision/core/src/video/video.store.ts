/**
 * Ce que le service vidéo demande à son hôte : lire une MARQUE et ranger ses VIDÉOS.
 *
 *   IDEM     un projet : sa charte, le contexte extrait par le module Communication, ses
 *            visuels et ses vidéos (`apps/api/.../Communication/video/idemVideoStore.ts`)
 *   iVision  une marque de l'utilisateur : scannée depuis son site, saisie, ou importée d'un
 *            projet IDEM (`apps/ivision/api/src/stores/video.store.ts`)
 *
 * Le service ne sait rien de MongoDB ni de la forme des projets : il ne voit que ce contrat.
 */
import type { BrandKit, BrandVoice } from '../brand/brand-kit';
import type { MotionVideo, VideoObjective, VideoType } from './video.model';

export interface VideoBrandContext {
  brandName: string;
  /** La charte (IDEM) ou la marque scannée (iVision). */
  branding: BrandKit | null;
  /** Ton, promesse, secteur, langue (jamais réextraits pour une vidéo). */
  voice: BrandVoice;
  /** Les visuels déjà faits pour la marque : leurs photos sont payées et à la charte. */
  visuals: { backgroundImageUrl?: string; createdAt?: string }[];
  /** Les vidéos de la marque (mémoire du projet : variété, nouveauté). */
  videos: MotionVideo[];
}

/** Ce qu'un contenu du calendrier éditorial apporte au brief (IDEM). */
export interface ContentBrief {
  message: string;
  details?: string;
  objective?: VideoObjective;
  type?: VideoType;
}

export type VideoTier = 'mechanical' | 'writing' | 'reasoning';

export interface VideoStore {
  loadBrand(userId: string, projectId: string): Promise<VideoBrandContext | null>;
  listVideos(userId: string, projectId: string): Promise<MotionVideo[]>;
  saveVideo(userId: string, projectId: string, video: MotionVideo): Promise<void>;
  /** Modifie une vidéo à partir de son état EN BASE (et non d'une copie périmée). */
  mutateVideo(userId: string, projectId: string, videoId: string, mutate: (video: MotionVideo) => MotionVideo): Promise<MotionVideo | null>;
  removeVideo(userId: string, projectId: string, videoId: string): Promise<boolean>;
  /** Calendrier éditorial (IDEM) : le brief d'un contenu planifié. */
  briefFromContent?(userId: string, projectId: string, contentId: string): Promise<ContentBrief | null>;
  linkVideoToContent?(userId: string, projectId: string, contentId: string, videoId: string): Promise<void>;
  /** Les modèles de l'hôte : copie et agents, à l'étage que la jauge de créativité choisit. */
  runVideoTieredPrompt?(userId: string, system: string, user: string, tier: VideoTier, kind?: 'copy' | 'agents'): Promise<string>;
  runVideoCopyPrompt?(userId: string, system: string, user: string): Promise<string>;
  runVideoAgentPrompt?(userId: string, system: string, user: string): Promise<string>;
}

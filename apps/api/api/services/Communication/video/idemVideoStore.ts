/**
 * Les vidéos d'un projet IDEM, vues par le moteur partagé (apps/ivision/core).
 *
 * Le service vidéo du core ne connaît que le contrat `VideoStore` : une marque, des vidéos.
 * Dans IDEM, la marque est la charte du projet et le contexte que le module Communication a
 * déjà extrait ; les vidéos sont rangées dans `analysisResultModel.communication.videos` ;
 * le calendrier éditorial fournit le brief d'un contenu planifié.
 */
import type { MotionVideo } from '../../../models/motionVideo.model';
import type { ContentIdea } from '../../../models/communication.model';
import type { ContentBrief, VideoBrandContext, VideoStore, VideoTier } from '../../../../../ivision/core/src/video/video.store';
import { objectiveForContent } from './video.calendar';

/** Ce que l'adaptateur lit du module Communication (le service réel, ou son double dans les contrôles). */
export interface CommunicationVideoSource {
  loadProjectForVideo(userId: string, projectId: string): Promise<any | null>;
  listVideos(userId: string, projectId: string): Promise<MotionVideo[]>;
  saveVideo(userId: string, projectId: string, video: MotionVideo): Promise<void>;
  mutateVideo(userId: string, projectId: string, videoId: string, mutate: (video: MotionVideo) => MotionVideo): Promise<MotionVideo | null>;
  removeVideo(userId: string, projectId: string, videoId: string): Promise<boolean>;
  findPlanItem?(userId: string, projectId: string, contentId: string): Promise<ContentIdea | null>;
  linkVideoToContent?(userId: string, projectId: string, contentId: string, videoId: string): Promise<void>;
  runVideoTieredPrompt?(userId: string, system: string, user: string, tier: VideoTier, kind?: 'copy' | 'agents'): Promise<string>;
  runVideoCopyPrompt?(userId: string, system: string, user: string): Promise<string>;
  runVideoAgentPrompt?(userId: string, system: string, user: string): Promise<string>;
}

export class IdemVideoStore implements VideoStore {
  constructor(private readonly source: CommunicationVideoSource) {}

  async loadBrand(userId: string, projectId: string): Promise<VideoBrandContext | null> {
    const project = await this.source.loadProjectForVideo(userId, projectId);
    if (!project) return null;
    const analysis: any = project.analysisResultModel || {};
    const stored = analysis.communication?.context;
    return {
      brandName: stored?.brandName || project.name || 'Marque',
      branding: analysis.branding || null,
      // Le contexte déjà extrait par le module est réutilisé ; sinon on lit le projet directement.
      voice: {
        brandName: stored?.brandName || project.name,
        businessType: stored?.businessType || project.type,
        tone: stored?.tone,
        valueProposition: stored?.valueProposition || project.description || undefined,
        keywords: stored?.keywords,
        language: stored?.language || 'fr',
      },
      visuals: analysis.communication?.visuals || [],
      videos: analysis.communication?.videos || [],
    };
  }

  listVideos(userId: string, projectId: string) {
    return this.source.listVideos(userId, projectId);
  }
  saveVideo(userId: string, projectId: string, video: MotionVideo) {
    return this.source.saveVideo(userId, projectId, video);
  }
  mutateVideo(userId: string, projectId: string, videoId: string, mutate: (video: MotionVideo) => MotionVideo) {
    return this.source.mutateVideo(userId, projectId, videoId, mutate);
  }
  removeVideo(userId: string, projectId: string, videoId: string) {
    return this.source.removeVideo(userId, projectId, videoId);
  }

  /** Le brief d'un contenu du calendrier : ce que l'utilisateur n'a pas écrit vient du post. */
  async briefFromContent(userId: string, projectId: string, contentId: string): Promise<ContentBrief | null> {
    const item = await this.source.findPlanItem?.(userId, projectId, contentId);
    if (!item) return null;
    const message = (item.hook || item.title || '').slice(0, 400);
    return {
      message,
      details: [item.title !== message ? item.title : '', item.description, item.callToAction].filter(Boolean).join('\n').slice(0, 800) || undefined,
      objective: objectiveForContent(item),
      type: item.videoType,
    };
  }

  async linkVideoToContent(userId: string, projectId: string, contentId: string, videoId: string): Promise<void> {
    await this.source.linkVideoToContent?.(userId, projectId, contentId, videoId);
  }

  get runVideoTieredPrompt() {
    return this.source.runVideoTieredPrompt?.bind(this.source);
  }
  get runVideoCopyPrompt() {
    return this.source.runVideoCopyPrompt?.bind(this.source);
  }
  get runVideoAgentPrompt() {
    return this.source.runVideoAgentPrompt?.bind(this.source);
  }
}

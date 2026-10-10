/**
 * Les marques et les vidéos d'iVision, vues du service vidéo du moteur partagé (`VideoStore`).
 *
 * Le « projet » du moteur est ici une MARQUE de l'utilisateur. Les photos de la marque (site
 * scanné, projet IDEM importé, imports) jouent le rôle des visuels déjà faits d'un projet IDEM :
 * payées, à la charte, mises en scène avant toute banque d'images. Les modèles passent par la
 * passerelle d'IDEM (mêmes configurations, mêmes étages que dans IDEM).
 */
import type { MotionVideo } from '../../../core/src/video/video.model';
import type { VideoBrandContext, VideoStore, VideoTier } from '../../../core/src/video/video.store';
import { collection } from '../config/db';
import type { IvisionBrand, IvisionVideoDoc } from '../models';
import { idem } from '../services/idem.client';

const brands = () => collection<IvisionBrand>('brands');
const videos = () => collection<IvisionVideoDoc>('videos');

/** Le JSON d'une vidéo, sans les références partagées (le moteur modifie ses copies). */
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));

export class IvisionVideoStore implements VideoStore {
  async loadBrand(userId: string, brandId: string): Promise<VideoBrandContext | null> {
    const brand = await brands().findOne({ _id: brandId, userId });
    if (!brand) return null;
    const logo = brand.kit.logo as { svg?: string; assetUrls?: { primary?: string } } | null | undefined;
    return {
      brandName: brand.name,
      // Création sans charte (ou charte sans nom ni logo) : rien à signer.
      anonymous: !brand.name.trim() && !logo?.svg && !logo?.assetUrls?.primary,
      branding: brand.kit,
      voice: { ...brand.voice, brandName: brand.name },
      visuals: brand.photos.map((url) => ({ backgroundImageUrl: url, createdAt: brand.updatedAt })),
      videos: await this.listVideos(userId, brandId),
    };
  }

  async listVideos(userId: string, brandId: string): Promise<MotionVideo[]> {
    const docs = await videos().find({ userId, brandId }).sort({ updatedAt: -1 }).limit(200).toArray();
    return docs.map((d) => d.video);
  }

  async saveVideo(userId: string, brandId: string, video: MotionVideo): Promise<void> {
    await videos().updateOne({ _id: video.id }, { $set: { userId, brandId, video: copy(video), updatedAt: new Date().toISOString() } }, { upsert: true });
  }

  /** Lecture puis écriture conditionnelle : deux retouches simultanées ne s'écrasent pas. */
  async mutateVideo(userId: string, brandId: string, videoId: string, mutate: (video: MotionVideo) => MotionVideo): Promise<MotionVideo | null> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const doc = await videos().findOne({ _id: videoId, userId, brandId });
      if (!doc) return null;
      const next = copy(mutate(copy(doc.video)));
      const res = await videos().updateOne({ _id: videoId, updatedAt: doc.updatedAt }, { $set: { video: next, updatedAt: new Date().toISOString() } });
      if (res.modifiedCount === 1) return next;
    }
    throw new Error('video_write_conflict');
  }

  async removeVideo(userId: string, brandId: string, videoId: string): Promise<boolean> {
    const res = await videos().deleteOne({ _id: videoId, userId, brandId });
    return res.deletedCount === 1;
  }

  runVideoTieredPrompt(userId: string, system: string, user: string, tier: VideoTier, kind: 'copy' | 'agents' = 'copy'): Promise<string> {
    return idem.ai.text({ userId, system, user, tier, kind });
  }
}

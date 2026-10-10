/**
 * Les montages d'iVision (`ivision_montages`), vus du service de montage du moteur partagé.
 */
import type { MontageVideo } from '../../../core/src/montage/montage.model';
import type { MontageStore } from '../../../core/src/montage/montage.service';
import { collection } from '../config/db';
import type { IvisionMontageDoc } from '../models';

const montages = () => collection<IvisionMontageDoc>('montages');

/** Le JSON d'un montage, sans références partagées (le moteur modifie ses copies). */
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));

export class IvisionMontageStore implements MontageStore {
  async save(userId: string, brandId: string, montage: MontageVideo): Promise<void> {
    await montages().updateOne({ _id: montage.id }, { $set: { userId, brandId, montage: copy(montage), updatedAt: new Date().toISOString() } }, { upsert: true });
  }

  async get(userId: string, id: string): Promise<{ brandId: string; montage: MontageVideo } | null> {
    const doc = await montages().findOne({ _id: id, userId });
    return doc ? { brandId: doc.brandId, montage: doc.montage } : null;
  }

  async list(userId: string, brandId?: string): Promise<{ brandId: string; montage: MontageVideo }[]> {
    const docs = await montages()
      .find({ userId, ...(brandId ? { brandId } : {}) }, { projection: { 'montage.words': 0 } })
      .sort({ updatedAt: -1 })
      .limit(100)
      .toArray();
    return docs.map((d) => ({ brandId: d.brandId, montage: { ...d.montage, words: [] } }));
  }

  /** Lecture puis écriture conditionnelle : deux écritures simultanées ne s'écrasent pas. */
  async mutate(userId: string, id: string, fn: (m: MontageVideo) => MontageVideo): Promise<MontageVideo | null> {
    for (let attempt = 0; attempt < 8; attempt++) {
      const doc = await montages().findOne({ _id: id, userId });
      if (!doc) return null;
      const next = copy(fn(copy(doc.montage)));
      const res = await montages().updateOne({ _id: id, updatedAt: doc.updatedAt }, { $set: { montage: next, updatedAt: new Date().toISOString() } });
      // Trouvé = personne n'a écrit entre-temps (une écriture identique ne « modifie » rien).
      if (res.matchedCount === 1) return next;
    }
    throw new Error('montage_write_conflict');
  }

  async remove(userId: string, id: string): Promise<boolean> {
    const res = await montages().deleteOne({ _id: id, userId });
    return res.deletedCount === 1;
  }

  async interrupted(): Promise<{ userId: string; brandId: string; montage: MontageVideo }[]> {
    const docs = await montages()
      .find({ $or: [{ 'montage.status': 'processing' }, { 'montage.renders.status': 'rendering' }] })
      .limit(500)
      .toArray();
    return docs.map((d) => ({ userId: d.userId, brandId: d.brandId, montage: d.montage }));
  }
}

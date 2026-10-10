/**
 * Les MONTAGES d'iVision : le service de montage du moteur partagé (`core/src/montage`), sur les
 * marques d'iVision. Une prise de parole importée devient une vidéo sous-titrée, coupée et
 * habillée, prête à publier.
 */
import type { MontageVideo } from '../../../core/src/montage/montage.model';
import { MontageService } from '../../../core/src/montage/montage.service';
import logger from '../config/logger';
import { IvisionMontageStore } from '../stores/montage.store';
import { IvisionVideoStore } from '../stores/video.store';
import { refund } from './billing';

export const montages = new MontageService(new IvisionMontageStore(), new IvisionVideoStore());

/** Un montage payé qui n'aboutit pas : les crédits reviennent. */
export async function refundMontage(userId: string, m: MontageVideo): Promise<void> {
  if (m.paidCredits > 0) await refund(userId, { action: 'motion_video', cost: m.paidCredits, charged: true }, 'Montage iVision en échec — crédits restitués');
}

/** Au démarrage : ce qu'un arrêt du processus a laissé en route. */
export async function recoverMontages(): Promise<void> {
  try {
    const count = await montages.recoverInterrupted(refundMontage);
    if (count) logger.warn('montage.recovered', { event: 'montage.recovered', count });
  } catch (error) {
    logger.error('montage.recover_failed', { event: 'montage.recover_failed', error });
  }
}

/** La vue d'un montage pour l'interface (identique, avec sa marque). */
export const montageView = (brandId: string, m: MontageVideo) => ({ ...m, brandId });

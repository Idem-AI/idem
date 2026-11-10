import { qualityStatus } from '@idem/graphic-engine';
import { animationLib, videoRenderer } from './video/rendering/hyperframes/composition';

/**
 * L'état des moteurs créatifs (interrupteurs du plan qualité, moteur vidéo), écrit au démarrage de l'API d'IDEM et
 * d'iVision : un processus resté sur l'ancien code, ou un interrupteur oublié, se lit dans le journal.
 */
export function creativeStatus(): Record<string, boolean | string> {
  return { ...qualityStatus(), videoRenderer: videoRenderer(), videoAnimation: animationLib(), node: process.version };
}

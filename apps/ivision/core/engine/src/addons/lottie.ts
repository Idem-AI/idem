/**
 * Addon Lottie : lottie-web en version « light » (rendu SVG, sans moteur
 * d'expressions). Un fichier importé par l'utilisateur ne peut donc pas exécuter
 * de code ; chaque image est posée par `goToAndStop(trame, true)`.
 */
import lottie from 'lottie-web/build/player/lottie_light';
import { registerAddon } from '../shared';

registerAddon('lottie', lottie as unknown as { loadAnimation(opts: Record<string, unknown>): any });

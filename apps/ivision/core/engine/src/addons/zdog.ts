/**
 * Addon Zdog : objets en pseudo-3D, plats et ronds, rendus en SVG (sans WebGL).
 *
 * Usage vidéo : aucune boucle d'animation (ni `animate`, ni `dragRotate`). Le kit
 * (`kit/Zdog.tsx`) pose la rotation de l'instant puis `updateRenderGraph()`.
 */
import Zdog from 'zdog';
import { registerAddon } from '../shared';

registerAddon('zdog', { Zdog });

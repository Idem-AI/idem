/**
 * Ce que l'interface de création et l'éditeur doivent savoir du moteur vidéo : barème,
 * objectifs, ambiances, styles, directions, choix du kit, types de motion, et les cases de
 * texte de chaque scène avec leur longueur maximale (l'éditeur les borne). Servi tel quel par
 * IDEM (`GET …/videos/options`) et par iVision (`GET /v1/videos/options`).
 */
import { CAPABILITIES } from './video.capabilities';
import { DIRECTION_IDS } from './video.direction';
import { MOTION_STYLES, MUSIC_MOODS, VIDEO_OBJECTIVES, VIDEO_TYPES } from './video.model';
import { pricingTable } from './video.pricing';
import { SCENES } from './video.scenes';
import { TYPE_DEFS } from './video.types';

export function videoOptions() {
  return {
    pricing: pricingTable(),
    objectives: VIDEO_OBJECTIVES,
    moods: MUSIC_MOODS,
    styles: ['auto', ...MOTION_STYLES],
    directions: ['auto', ...DIRECTION_IDS],
    // Les choix du kit (graphe de capacités) : la vidéo dit lesquels sont possibles pour elle.
    kit: Object.fromEntries(
      (['logo', 'background', 'annotate', 'icons'] as const).map((kind) => [kind, CAPABILITIES.filter((n) => n.kind === kind).map((n) => ({ id: n.id.split(':')[1], label: n.label }))])
    ),
    // Les types de motion proposés à la création, avec ce dont ils ont besoin.
    types: VIDEO_TYPES.map((id) => ({ id, icon: TYPE_DEFS[id].icon, style: TYPE_DEFS[id].style, needs: TYPE_DEFS[id].needs, durations: TYPE_DEFS[id].durations })),
    // Les cases de chaque scène et leur longueur maximale : l'éditeur de textes les borne.
    scenes: Object.fromEntries(Object.values(SCENES).map((scene) => [scene.id, scene.slots.map(({ key, max, required }) => ({ key, max, required: !!required }))])),
  };
}

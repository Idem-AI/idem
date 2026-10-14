/**
 * Ce que l'interface de création et l'éditeur doivent savoir du moteur vidéo : barème, objectifs,
 * ambiances musicales, familles de vidéos (de simples indications pour le directeur, jamais des
 * recettes) et voix. Servi tel quel par IDEM (`GET …/videos/options`) et iVision (`GET /v1/videos/options`).
 */
import { MUSIC_MOODS, VIDEO_OBJECTIVES, VIDEO_TYPES } from './contracts/model';
import { pricingTable } from './pricing';
import { VOICE_PERSONAS } from './audio/voice';
import { MOTION_CANVAS_VERSION } from './author/api-reference';

/** L'icône de chaque famille (PrimeIcons), pour les cartes de l'interface. */
const TYPE_ICONS: Record<(typeof VIDEO_TYPES)[number], string> = {
  kinetic: 'pi pi-align-left',
  product: 'pi pi-box',
  promo: 'pi pi-tag',
  footage: 'pi pi-video',
  showcase3d: 'pi pi-objects-column',
  illustrated: 'pi pi-sparkles',
  slideshow: 'pi pi-images',
  logo: 'pi pi-verified',
  mix: 'pi pi-th-large',
};

export function videoOptions() {
  return {
    engine: { name: 'motion-canvas', version: MOTION_CANVAS_VERSION },
    pricing: pricingTable(),
    objectives: VIDEO_OBJECTIVES,
    moods: MUSIC_MOODS,
    types: VIDEO_TYPES.map((id) => ({ id, icon: TYPE_ICONS[id] })),
    voice: { personas: VOICE_PERSONAS.map(({ id, gender, character }) => ({ id, gender, character })) },
  };
}

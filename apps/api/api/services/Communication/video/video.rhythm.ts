/**
 * LES RYTHMES — deux vidéos de la même direction ne battent plus pareil.
 *
 * La direction fixe le vocabulaire (durées d'entrée, décalages) ; le rythme fixe la
 * COURBE de la vidéo : comment se répartit le temps entre les scènes, à quelle
 * vitesse entrent les éléments de chacune, et sur quelle grille de temps tombent les
 * coupes. Cinq profils, classiques du montage :
 *
 *   steady     régulier : chaque scène a son temps de lecture, coupes sur le temps
 *   crescendo  ça s'accélère jusqu'au grand moment, puis la signature respire
 *   staccato   coupes sèches sur chaque temps, textes brefs, médias un peu plus longs
 *   breathe    ample : longues tenues, entrées lentes, coupes à la mesure
 *   drop       une montée lente, puis tout s'accélère au grand moment (le « drop »)
 *
 * Choisi par le modèle dans un menu court (ou par le graphe), jamais le même que les
 * dernières vidéos du projet. Les règles de lecture (video.rules.ts) passent après :
 * un rythme ne raccourcit jamais un texte sous son temps de lecture.
 */
export type RhythmId = 'steady' | 'crescendo' | 'staccato' | 'breathe' | 'drop';

export const RHYTHM_IDS: RhythmId[] = ['steady', 'crescendo', 'staccato', 'breathe', 'drop'];

const MEDIA_SCENES = new Set(['footage', 'gallery', 'product', 'showcase3d', 'lottie']);

export interface RhythmPlan {
  /** Poids de durée par scène (multiplie le temps voulu). */
  weights: number[];
  /** Tempo des entrées par scène (multiplie les durées d'entrée : < 1 = plus vif). */
  paces: number[];
  /** Grille des coupes : 1 = sur chaque temps, 2 = toutes les deux pulsations. */
  step: 1 | 2;
}

/** Le plan de rythme d'une vidéo : poids, tempo des entrées, grille des coupes. */
export function rhythmPlan(id: RhythmId | string | undefined, sceneIds: string[], accentIndex = -1): RhythmPlan {
  const n = sceneIds.length;
  const last = n - 1;
  const accent = accentIndex >= 0 && accentIndex < last ? accentIndex : Math.max(0, Math.floor(last * 0.6));
  const weights = sceneIds.map(() => 1);
  const paces = sceneIds.map(() => 1);
  let step: 1 | 2 = 1;
  switch (id) {
    case 'crescendo':
      sceneIds.forEach((_, i) => {
        if (i === last) return;
        const k = i <= accent ? i / Math.max(1, accent) : 1;
        weights[i] = 1.25 - 0.45 * k;
        paces[i] = 1.15 - 0.35 * k;
      });
      weights[accent] = 1.15;
      weights[last] = 1.25;
      break;
    case 'staccato':
      sceneIds.forEach((id2, i) => {
        if (i === last) return;
        weights[i] = MEDIA_SCENES.has(id2) ? 1.15 : 0.8;
        paces[i] = 0.78;
      });
      break;
    case 'breathe':
      sceneIds.forEach((_, i) => {
        paces[i] = 1.3;
        weights[i] = i === 0 || i === last ? 1.15 : 1;
      });
      step = 2;
      break;
    case 'drop':
      sceneIds.forEach((_, i) => {
        if (i === last) return;
        if (i < accent) {
          weights[i] = 1.25;
          paces[i] = 1.25;
        } else if (i === accent) {
          weights[i] = 0.95;
          paces[i] = 0.7;
        } else {
          weights[i] = 0.8;
          paces[i] = 0.8;
        }
      });
      break;
    default:
      break;
  }
  return { weights, paces, step };
}

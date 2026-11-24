/**
 * Poids des profils perceptifs recalés sur des jugements humains — fichier ÉCRIT par
 * `npm run calibrate:logo -- fit <jugements.json>`. Vide : les poids raisonnés de `perception.ts`.
 */
export const CALIBRATION: { judgments: number; date: string | null; weights: Record<string, Record<string, number>> } = {
  judgments: 0,
  date: null,
  weights: {},
};

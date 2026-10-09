/**
 * Moments sonores : chaque composant déclare, en se rendant, où son mouvement
 * fait du bruit (un titre qui se pose, un prix qui apparaît, une transition).
 * La clé rend la déclaration idempotente : rendre la même image dix fois ne
 * crée pas dix sons.
 */
export type CueKind = 'whoosh' | 'softwhoosh' | 'pop' | 'click' | 'tick' | 'impact' | 'shimmer' | 'riser';

const CUES = new Map<string, { t: number; kind: CueKind; gain: number }>();

export function cue(key: string, t: number, kind: CueKind, gain = 1): void {
  if (!isFinite(t) || t < 0) return;
  CUES.set(key, { t: Math.round(t * 1000) / 1000, kind, gain });
}

export function allCues() {
  return [...CUES.values()].sort((a, b) => a.t - b.t);
}

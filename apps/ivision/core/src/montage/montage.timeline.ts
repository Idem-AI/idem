/**
 * LA LIGNE DE TEMPS DU MONTAGE — des mots aux instants, pour le monteur comme pour la page.
 *
 * Chaque élément vit dans une ZONE de l'écran ; deux éléments d'une même zone ne se chevauchent
 * jamais (le plus tôt garde sa place, l'autre est raccourci ou écarté). Les sous-titres
 * s'effacent pendant un mot-clé ou un chiffre (c'est le même mot, en grand).
 */
import type { MontageElement, MontageElementType, MontageWord } from './montage.model';

export type Zone = 'center' | 'top' | 'lower' | 'full' | 'camera';

export const ZONE_OF: Record<MontageElementType, Zone> = {
  keyword: 'center',
  stat: 'center',
  icon: 'top',
  list: 'top',
  callout: 'top',
  cta: 'top',
  broll: 'full',
  lowerThird: 'lower',
  zoom: 'camera',
};

/** Durée minimale à l'écran (lecture) et temps gardé après le dernier mot. */
const HOLD: Record<MontageElementType, { min: number; after: number; max: number }> = {
  keyword: { min: 0.7, after: 0.35, max: 2.2 },
  stat: { min: 1.6, after: 0.9, max: 3.5 },
  icon: { min: 1.6, after: 1.0, max: 4 },
  list: { min: 3, after: 1.2, max: 9 },
  callout: { min: 2, after: 1.2, max: 5 },
  cta: { min: 3, after: 1.5, max: 6 },
  broll: { min: 1.4, after: 0.2, max: 4.5 },
  lowerThird: { min: 3.2, after: 1.0, max: 5 },
  zoom: { min: 1.1, after: 0.3, max: 2.4 },
};

export type TimedWord = { start: number; end: number } | null;

export interface ElementWindow {
  id: string;
  type: MontageElementType;
  zone: Zone;
  tin: number;
  tout: number;
}

/** Premier et dernier mot non coupés d'un intervalle. */
function bounds(timed: TimedWord[], from: number, to: number): { start: number; end: number } | null {
  let first: { start: number; end: number } | null = null;
  let last: { start: number; end: number } | null = null;
  for (let i = Math.max(0, from); i <= Math.min(timed.length - 1, to); i++) {
    const w = timed[i];
    if (!w) continue;
    first ??= w;
    last = w;
  }
  return first && last ? { start: first.start, end: last.end } : null;
}

/**
 * Les fenêtres d'apparition des éléments actifs, sans chevauchement dans une zone. Les éléments
 * écartés (zone occupée, mots coupés) ne figurent pas dans le résultat.
 */
export function elementWindows(elements: MontageElement[], timed: TimedWord[], durationSec: number): ElementWindow[] {
  const raw = elements
    .filter((e) => !e.off)
    .map((e) => {
      const b = bounds(timed, e.from, e.to);
      if (!b) return null;
      const h = HOLD[e.type];
      const tin = Math.max(0, b.start - 0.06);
      const tout = Math.min(durationSec, tin + Math.min(h.max, Math.max(h.min, b.end + h.after - tin)));
      return { id: e.id, type: e.type, zone: ZONE_OF[e.type], tin, tout };
    })
    .filter((w): w is ElementWindow => !!w && w.tout - w.tin > 0.3)
    .sort((a, b) => a.tin - b.tin);
  const out: ElementWindow[] = [];
  const lastIn: Partial<Record<Zone, ElementWindow>> = {};
  for (const w of raw) {
    const prev = lastIn[w.zone];
    if (prev && w.tin < prev.tout + 0.15) {
      // La zone est prise : l'élément d'avant cède s'il a déjà eu son temps de lecture, sinon on écarte.
      const min = HOLD[prev.type].min;
      if (w.tin - 0.15 - prev.tin >= min) prev.tout = w.tin - 0.15;
      else continue;
    }
    out.push(w);
    lastIn[w.zone] = w;
  }
  return out;
}

/** Les phrases (pour le monteur et la retouche) : coupées à la ponctuation forte ou aux pauses. */
export function sentences(words: MontageWord[], timed: TimedWord[]): { from: number; to: number; start: number; end: number; text: string }[] {
  const out: { from: number; to: number; start: number; end: number; text: string }[] = [];
  let cur: number[] = [];
  const flush = () => {
    const kept = cur.filter((i) => timed[i]);
    if (kept.length) {
      out.push({ from: kept[0], to: kept[kept.length - 1], start: timed[kept[0]]!.start, end: timed[kept[kept.length - 1]]!.end, text: kept.map((i) => words[i].text).join(' ') });
    }
    cur = [];
  };
  words.forEach((w, i) => {
    if (!timed[i]) return;
    const prev = cur.length ? timed[cur[cur.length - 1]] : null;
    if (prev && timed[i]!.start - prev.end > 0.6) flush();
    cur.push(i);
    if (/[.!?…]$/.test(w.text) || cur.length >= 28) flush();
  });
  flush();
  return out;
}

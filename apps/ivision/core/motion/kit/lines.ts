/**
 * DES LIGNES ÉQUILIBRÉES — la coupure d'un texte comme en typographie, dans le navigateur (le texte est une
 * donnée : une retouche le recoupe à la volée).
 *
 *   1. le moins de lignes possible dans la largeur permise ;
 *   2. la largeur la plus serrée qui garde ce nombre de lignes (lignes de longueur voisine, « text-wrap: balance ») ;
 *   3. l'algorithme de Knuth-Plass (`tex-linebreak`, MIT) choisit les coupures à cette largeur, en drapeau
 *      (fer à gauche), sans jamais laisser un mot seul en dernière ligne.
 *
 * Même logique côté serveur : `packages/motion-compiler/src/design/typography.ts#balanceLines` (estimation).
 */
import { breakLines, forcedBreak, MAX_COST } from 'tex-linebreak';

type Measure = (s: string) => number;

/**
 * Les mots d'un texte, la ponctuation haute collée au mot qui la précède (typographie française : « prêt : » ne se
 * coupe jamais avant le deux-points ; « » » et « % » non plus) — et le guillemet ouvrant au mot qui le suit.
 */
function tokens(text: string): string[] {
  const raw = String(text || '').split(/\s+/).filter(Boolean);
  const out: string[] = [];
  for (const w of raw) {
    if (out.length && /^[:;!?»%)\]…]+$/.test(w)) out[out.length - 1] += ` ${w}`;
    else if (out.length && /^[«(\[]$/.test(out[out.length - 1])) out[out.length - 1] += ` ${w}`;
    else out.push(w);
  }
  return out;
}


function greedy(words: string[], width: number, measure: Measure): string[] {
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (!line || measure(next) <= width) line = next;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function knuthPlass(words: string[], width: number, measure: Measure): string[] | null {
  const space = measure(' ') || width * 0.02;
  type Item = { type: 'box'; width: number; text: string } | { type: 'glue'; width: number; stretch: number; shrink: number } | { type: 'penalty'; width: number; cost: number; flagged: boolean };
  const items: Item[] = [];
  words.forEach((w, i) => {
    items.push({ type: 'box', width: measure(w), text: w });
    if (i === words.length - 1) return;
    // Pas d'orphelin : la coupure entre les deux derniers mots est interdite.
    if (i === words.length - 2 && words.length > 2) items.push({ type: 'penalty', width: 0, cost: MAX_COST, flagged: false });
    // Un drapeau : de la marge à droite (étirement) pour que les lignes restent naturelles, jamais justifiées.
    items.push({ type: 'glue', width: space, stretch: space * 0.5 + width * 0.25, shrink: space * 0.2 });
  });
  items.push({ type: 'glue', width: 0, stretch: width * 4, shrink: 0 });
  items.push(forcedBreak() as Item);
  try {
    const bps = breakLines(items as never, width);
    const out: string[] = [];
    for (let k = 1; k < bps.length; k++) {
      const line = items
        .slice(bps[k - 1], bps[k] + 1)
        .filter((x): x is Extract<Item, { type: 'box' }> => x.type === 'box')
        .map((x) => x.text)
        .join(' ');
      if (line) out.push(line);
    }
    return out.length ? out : null;
  } catch {
    return null;
  }
}

/** Les lignes d'un texte dans une largeur (même unité que `measure`). */
export function balanceLines(text: string, maxWidth: number, measure: Measure): string[] {
  const words = tokens(text);
  if (!words.length) return [];
  const first = greedy(words, maxWidth, measure);
  if (first.length <= 1) return first;
  let lo = Math.max(...words.map(measure));
  let hi = maxWidth;
  for (let i = 0; i < 16 && hi - lo > 0.5; i++) {
    const mid = (lo + hi) / 2;
    if (greedy(words, mid, measure).length <= first.length) hi = mid;
    else lo = mid;
  }
  const kp = knuthPlass(words, hi, measure);
  if (kp && kp.length <= first.length && kp.every((l) => measure(l) <= maxWidth + 0.5)) return kp;
  return greedy(words, hi, measure);
}

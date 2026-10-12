/**
 * La palette CATÉGORIELLE des graphiques : les couleurs de la marque, recalées jusqu'à passer les
 * contrôles de la méthode dataviz — calculés, jamais estimés à l'œil.
 *
 *  1. ordre fixe des teintes (la marque d'abord, puis des teintes de référence éprouvées) ;
 *  2. clarté OKLCH dans la bande du mode clair (0,43 – 0,77) ;
 *  3. chroma ≥ 0,10 (en dessous, une teinte se lit comme un gris et ne fait plus son travail d'identité) ;
 *  4. séparation daltonisme : ΔE OKLab ×100 ≥ 8 (plancher 6 avec double codage) entre voisines, sous
 *     protanopie et deutéranopie simulées (Machado-Oliveira-Fernandes 2009, sévérité 1,0) ;
 *     4b. vision normale : ΔE ≥ 15 entre voisines — barrière dure ;
 *  5. contraste de chaque marque ≥ 3:1 sur la surface — sinon un canal de relais (étiquettes directes,
 *     légende) est OBLIGATOIRE, et le composant le sait.
 *
 * Recalage (« snap-to-passing ») : chaque couleur garde sa teinte, sa clarté est déplacée par pas jusqu'à
 * ce que la pire paire voisine passe. Faute de mieux, on retombe sur la palette de référence validée.
 */
import { contrastRatio, ensureContrast, hexToOklch, oklchToHex } from '../../foundation/color';

const BAND: [number, number] = [0.43, 0.77];
const CHROMA_FLOOR = 0.1;
export const CVD_TARGET = 8;
export const CVD_FLOOR = 6;
export const NORMAL_FLOOR = 15;

/** Palette de référence de la compétence dataviz (mode clair), validée en ordre adjacent. */
export const REFERENCE_PALETTE = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'];

const MACHADO: Record<'protan' | 'deutan' | 'tritan', number[][]> = {
  protan: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deutan: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritan: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
};

const s2lin = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
function lin(hex: string): number[] {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => s2lin(parseInt(h.slice(i, i + 2), 16) / 255));
}
function oklabFromLin([r, g, b]: number[]): number[] {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
function simulate(hex: string, kind: keyof typeof MACHADO): number[] {
  const [r, g, b] = lin(hex);
  const M = MACHADO[kind];
  const clamp = (c: number) => Math.max(0, Math.min(1, c));
  return [clamp(M[0][0] * r + M[0][1] * g + M[0][2] * b), clamp(M[1][0] * r + M[1][1] * g + M[1][2] * b), clamp(M[2][0] * r + M[2][1] * g + M[2][2] * b)];
}

/** ΔE OKLab ×100 ; sans `kind`, vision normale. */
export function deltaE(a: string, b: string, kind?: keyof typeof MACHADO): number {
  const la = oklabFromLin(kind ? simulate(a, kind) : lin(a));
  const lb = oklabFromLin(kind ? simulate(b, kind) : lin(b));
  return 100 * Math.hypot(la[0] - lb[0], la[1] - lb[1], la[2] - lb[2]);
}

export type PairMode = 'adjacent' | 'cycle' | 'all';

function pairList(n: number, mode: PairMode): Array<[number, number]> {
  if (mode === 'all') {
    const out: Array<[number, number]> = [];
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) out.push([i, j]);
    return out;
  }
  const out: Array<[number, number]> = Array.from({ length: Math.max(0, n - 1) }, (_, i) => [i, i + 1] as [number, number]);
  if (mode === 'cycle' && n > 2) out.push([n - 1, 0]);
  return out;
}

export interface PaletteReport {
  ok: boolean;
  /** Pire ΔE (protan/deutan) entre voisines. */
  worstCvd: number;
  /** Pire ΔE en vision normale entre voisines. */
  worstNormal: number;
  offBand: string[];
  lowChroma: string[];
  /** Marques sous 3:1 sur la surface : le relais (étiquettes, légende) est obligatoire. */
  lowContrast: string[];
  cvd: 'pass' | 'floor' | 'fail';
}

export function validatePalette(palette: string[], surface: string, mode: PairMode = 'adjacent'): PaletteReport {
  const pairs = pairList(palette.length, mode);
  let worstCvd = 99;
  let worstNormal = 99;
  for (const [i, j] of pairs) {
    worstCvd = Math.min(worstCvd, deltaE(palette[i], palette[j], 'protan'), deltaE(palette[i], palette[j], 'deutan'));
    worstNormal = Math.min(worstNormal, deltaE(palette[i], palette[j]));
  }
  const offBand = palette.filter((c) => {
    const o = hexToOklch(c);
    return !o || o.l < BAND[0] || o.l > BAND[1];
  });
  const lowChroma = palette.filter((c) => (hexToOklch(c)?.c ?? 0) < CHROMA_FLOOR);
  const lowContrast = palette.filter((c) => contrastRatio(c, surface) < 3);
  const cvd = worstCvd >= CVD_TARGET ? 'pass' : worstCvd >= CVD_FLOOR ? 'floor' : 'fail';
  const ok = !offBand.length && !lowChroma.length && cvd !== 'fail' && worstNormal >= NORMAL_FLOOR;
  return { ok, worstCvd: round1(worstCvd), worstNormal: round1(worstNormal), offBand, lowChroma, lowContrast, cvd };
}

const round1 = (v: number) => Math.round(v * 10) / 10;

/** Ramène une couleur dans la bande de clarté et au-dessus du plancher de chroma, teinte gardée. */
export function snapToBand(hex: string, lightness?: number): string {
  const o = hexToOklch(hex);
  if (!o) return hex;
  const l = lightness ?? Math.min(BAND[1] - 0.04, Math.max(BAND[0] + 0.05, o.l));
  let c = Math.max(o.c, CHROMA_FLOOR + 0.015);
  // Rester dans le gamut sRGB : on réduit le chroma tant que la conversion déborde.
  for (let k = 0; k < 24; k++) {
    const candidate = oklchToHex({ l, c, h: o.h });
    const back = hexToOklch(candidate);
    if (back && Math.abs(back.l - l) < 0.03 && Math.abs(back.c - c) < 0.03) return candidate;
    c *= 0.93;
  }
  return oklchToHex({ l, c: Math.max(CHROMA_FLOOR, c), h: o.h });
}

const hueDistance = (a: string, b: string): number => {
  const ha = hexToOklch(a)?.h ?? 0;
  const hb = hexToOklch(b)?.h ?? 0;
  const d = Math.abs(ha - hb) % 360;
  return d > 180 ? 360 - d : d;
};

export interface ChartPalette {
  colors: string[];
  report: PaletteReport;
  /** D'où viennent les couleurs : la marque recalée, complétée, ou la référence. */
  source: 'brand' | 'brand+reference' | 'reference';
}

/**
 * La palette d'un graphique de `count` séries, pour la marque.
 *
 * Une seule série : la couleur de marque recalée (pas de légende, le titre nomme la série). Plusieurs :
 * la marque d'abord, puis les teintes de référence les plus éloignées, dans l'ordre qui maximise la pire
 * paire voisine ; recalage de clarté si une paire échoue ; repli sur la référence validée.
 */
export function chartPalette(brand: { primary: string; accent: string; secondary: string }, count: number, surface: string, mode: PairMode = 'adjacent'): ChartPalette {
  const n = Math.max(1, Math.min(8, count));
  const seeds = [brand.primary, brand.accent, brand.secondary]
    .filter((c) => (hexToOklch(c)?.c ?? 0) >= 0.06)
    .map((c) => snapToBand(c))
    .filter((c, i, all) => all.findIndex((o) => deltaE(o, c) < 18 || hueDistance(o, c) < 22) === i);
  if (n === 1) {
    // Une série n'a pas d'identité à porter : une marque grise garde son gris (contraste assuré), jamais une
    // teinte arbitraire tirée d'un gris.
    const one = seeds[0] ?? ensureContrast(brand.primary, surface, 3);
    return { colors: [one], report: validatePalette([one], surface, mode), source: 'brand' };
  }

  // Les teintes de référence, sans celles qui imitent déjà une couleur de la marque.
  const pool = REFERENCE_PALETTE.filter((ref) => seeds.every((s) => deltaE(ref, s) >= 20 && hueDistance(ref, s) >= 25));
  // Une marque sans couleur exploitable (grise) part de la première teinte de référence.
  const chosen: string[] = seeds.length ? seeds.slice(0, n) : [pool.shift() as string];
  while (chosen.length < n && pool.length) {
    const last = chosen[chosen.length - 1];
    let best = 0;
    let bestScore = -1;
    pool.forEach((cand, i) => {
      const cvd = Math.min(deltaE(cand, last, 'protan'), deltaE(cand, last, 'deutan'));
      const normal = Math.min(...chosen.map((c) => deltaE(cand, c)));
      const score = Math.min(cvd, normal / 2);
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    });
    chosen.push(pool.splice(best, 1)[0]);
  }
  // Une marque dont les couleurs couvrent déjà plusieurs familles épuise le vivier filtré : on complète par
  // les teintes de référence restantes, les plus éloignées d'abord — une série n'est jamais laissée sans couleur.
  if (chosen.length < n) {
    const rest = REFERENCE_PALETTE.filter((ref) => !chosen.includes(ref)).sort((a, b) => Math.min(...chosen.map((c) => deltaE(b, c))) - Math.min(...chosen.map((c) => deltaE(a, c))));
    chosen.push(...rest.slice(0, n - chosen.length));
  }

  // Recalage : on déplace la clarté de la seconde couleur de chaque paire qui échoue.
  let palette = chosen.slice();
  for (let round = 0; round < 6; round++) {
    const report = validatePalette(palette, surface, mode);
    if (report.ok && report.cvd === 'pass') return { colors: palette, report, source: chosen.length > seeds.length ? 'brand+reference' : 'brand' };
    const pairs = pairList(palette.length, mode);
    const worst = pairs
      .map(([i, j]) => ({ j, d: Math.min(deltaE(palette[i], palette[j], 'protan'), deltaE(palette[i], palette[j], 'deutan'), deltaE(palette[i], palette[j]) / 1.9) }))
      .sort((a, b) => a.d - b.d)[0];
    if (!worst) break;
    const o = hexToOklch(palette[worst.j]);
    if (!o) break;
    const nudge = round % 2 === 0 ? -0.09 : 0.09;
    palette = palette.map((c, k) => (k === worst.j ? snapToBand(c, Math.min(BAND[1] - 0.02, Math.max(BAND[0] + 0.02, o.l + nudge))) : c));
  }
  const report = validatePalette(palette, surface, mode);
  if (report.ok) return { colors: palette, report, source: 'brand+reference' };
  const reference = REFERENCE_PALETTE.slice(0, n);
  return { colors: reference, report: validatePalette(reference, surface, mode), source: 'reference' };
}

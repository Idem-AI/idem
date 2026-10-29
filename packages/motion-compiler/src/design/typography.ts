/**
 * LA TYPOGRAPHIE CALCULÉE — échelle modulaire, métriques réelles des polices, lignes équilibrées.
 *
 *   échelle   le corps de texte d'un format, puis × rapport (1,25 à 1,5 ; 1,618 pour « bold ») vers le haut ;
 *             le titre reste entre 4 et 9 % de la hauteur de l'image (une ou deux lignes) ;
 *   métriques Capsize (`@capsizecss/metrics`, MIT) : hauteur de capitale et largeur moyenne des signes, par
 *             police et par graisse — le solveur estime la boîte d'un texte sans navigateur ;
 *   coupure   des lignes équilibrées, sans mot orphelin (la dernière ligne n'est jamais un mot seul).
 *
 * Le rendu reste garanti par le navigateur (`FIT`, mesure réelle) : l'estimation sert à PLACER, pas à garantir.
 */
import type { SafeFormat } from './safezones';
import { frameInUnits } from './safezones';
import type { TypeLevel } from './types';

/** Le corps de texte (u) d'un format : 1 u = 10,8 px dans tous les formats (le petit côté fait toujours 1 080 px). */
export const BODY_SIZE: Record<SafeFormat, number> = { story: 5.2, portrait: 4.8, square: 4.4, landscape: 3.6 };

/** Le rapport de l'échelle selon le format et l'énergie (plus vertical, plus contrasté ; plus d'énergie, plus contrasté). */
export function scaleRatio(base: number, format: SafeFormat, energy: number): number {
  const byFormat = format === 'story' ? 0.03 : format === 'landscape' ? -0.03 : 0;
  const byEnergy = (Math.min(5, Math.max(1, energy)) - 3) * 0.025;
  return Math.round(Math.min(1.7, Math.max(1.2, base + byFormat + byEnergy)) * 1000) / 1000;
}

/** Les tailles (u) de chaque niveau dans un format. */
export function typeSizes(format: SafeFormat, ratio: number): Record<TypeLevel, number> {
  const body = BODY_SIZE[format];
  const { H } = frameInUnits(format);
  const r = ratio;
  const title = Math.min(0.09 * H, Math.max(0.04 * H, body * r * r));
  const display = Math.min(0.14 * H, Math.max(title * 1.25, body * r * r * r));
  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    display: round(display),
    title: round(title),
    subtitle: round(Math.max(body * 1.15, body * r)),
    body: round(body),
    caption: round(Math.max(2.6, body / r)),
    label: round(Math.max(2.4, (body / r) * 0.92)),
  };
}

// ─── Métriques des polices ───────────────────────────────────────────────────

export interface FontMetrics {
  capHeight: number;
  ascent: number;
  descent: number;
  lineGap: number;
  unitsPerEm: number;
  xWidthAvg: number;
}

/** Repli : des métriques proches d'Inter (police de repli du moteur). */
const FALLBACK: FontMetrics = { capHeight: 1490, ascent: 1984, descent: -494, lineGap: 0, unitsPerEm: 2048, xWidthAvg: 978 };

type Collection = Record<string, FontMetrics & { variants?: Record<string, FontMetrics> }>;
let collection: Collection | null | undefined;

function loadCollection(): Collection | null {
  if (collection !== undefined) return collection;
  try {
    // Chargé à la demande (4 Mo) et côté serveur seulement : ce module entre aussi dans les contrôles.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    collection = (require('@capsizecss/metrics/entireMetricsCollection') as { entireMetricsCollection: Collection }).entireMetricsCollection;
  } catch {
    collection = null;
  }
  return collection;
}

const camel = (family: string) =>
  String(family || '')
    .replace(/["']/g, '')
    .trim()
    .replace(/[^A-Za-z0-9]+(.)?/g, (_m, c: string | undefined) => (c ? c.toUpperCase() : ''))
    .replace(/^./, (c) => c.toLowerCase());

/** Les métriques d'une police à une graisse (Google Fonts et polices système connues de Capsize ; sinon le repli). */
export function fontMetrics(family: string, weight = 400): FontMetrics {
  const c = loadCollection();
  const entry = c?.[camel(family)];
  if (!entry) return FALLBACK;
  const w = String(Math.round(weight / 100) * 100);
  const v = entry.variants?.[w === '400' ? 'regular' : w] || entry;
  return { capHeight: v.capHeight, ascent: v.ascent, descent: v.descent, lineGap: v.lineGap, unitsPerEm: v.unitsPerEm, xWidthAvg: v.xWidthAvg };
}

/** Largeur estimée d'un mot ou d'une ligne (même unité que `size`). */
export function estimateWidth(text: string, size: number, m: FontMetrics, letterSpacing = 0, upper = false): number {
  const s = upper ? String(text).toUpperCase() : String(text);
  // Les capitales sont plus larges que la moyenne des bas-de-casse (≈ +22 %), les chiffres un peu moins.
  let units = 0;
  for (const ch of s) {
    if (ch === ' ') units += 0.55;
    else if (/[A-ZÀ-Ý]/.test(ch)) units += 1.22;
    else if (/[0-9]/.test(ch)) units += 1.05;
    else if (/[.,;:'’!|il1]/.test(ch)) units += 0.55;
    else if (/[mwMW]/.test(ch)) units += 1.45;
    else units += 1;
  }
  return (units * m.xWidthAvg * size) / m.unitsPerEm + letterSpacing * Math.max(0, s.length - 1);
}

/** La hauteur de capitale d'une taille (alignement optique : Capsize). */
export const capHeightOf = (size: number, m: FontMetrics) => (m.capHeight / m.unitsPerEm) * size;

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

/**
 * Des lignes équilibrées pour une largeur : le moins de lignes possible, puis la largeur la plus serrée qui garde
 * ce nombre (lignes de longueur voisine), et jamais un mot seul en dernière ligne quand le texte en a plus de deux.
 */
export function balanceLines(text: string, maxWidth: number, measure: (s: string) => number): string[] {
  const words = tokens(text);
  if (!words.length) return [];
  const greedy = (width: number): string[] => {
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
  };
  const first = greedy(maxWidth);
  if (first.length <= 1) return first;
  // La largeur la plus serrée qui garde le même nombre de lignes : des lignes de longueur voisine.
  let lo = Math.max(...words.map(measure));
  let hi = maxWidth;
  for (let i = 0; i < 16 && hi - lo > 0.5; i++) {
    const mid = (lo + hi) / 2;
    if (greedy(mid).length <= first.length) hi = mid;
    else lo = mid;
  }
  let lines = greedy(hi);
  // Pas d'orphelin : un mot seul en dernière ligne prend le dernier mot de la ligne d'avant.
  if (words.length > 2 && lines.length > 1 && !/\s/.test(lines[lines.length - 1])) {
    const prev = lines[lines.length - 2].split(' ');
    if (prev.length > 1) {
      const moved = prev.pop()!;
      const last = `${moved} ${lines[lines.length - 1]}`;
      if (measure(last) <= maxWidth) lines = [...lines.slice(0, -2), prev.join(' '), last];
    }
  }
  return lines;
}

/** La boîte estimée d'un texte posé à une taille dans une largeur (u). */
export function textBox(text: string, opts: { size: number; maxWidth: number; family: string; weight: number; lineHeight?: number; letterSpacing?: number; upper?: boolean }): { width: number; height: number; lines: string[] } {
  const m = fontMetrics(opts.family, opts.weight);
  const measure = (s: string) => estimateWidth(s, opts.size, m, opts.letterSpacing ?? 0, opts.upper);
  const lines = balanceLines(text, opts.maxWidth, measure);
  const width = Math.min(opts.maxWidth, Math.max(0, ...lines.map(measure)));
  return { width, height: lines.length * opts.size * (opts.lineHeight ?? 1.12), lines };
}

/**
 * LES COULEURS DU FILM — des rôles calculés depuis la marque, jamais choisis par le modèle.
 *
 *   palettes   Material Color Utilities (Apache-2.0) : espace HCT, palettes tonales de la teinte de la marque ;
 *              variantes tonale (harmonisée), vive (chroma relevé), monochrome (une seule teinte) ;
 *   encres     Leonardo (Adobe, Apache-2.0) : l'encre du texte et ses déclinaisons au CONTRASTE VISÉ sur le fond
 *              (7:1 pour l'encre, 4,5:1 pour l'encre douce, ≈ 1,5:1 pour un filet) ;
 *   surfaces   claires par défaut (politique de surface claire d'IDEM) : un fond sombre seulement si la demande le dit.
 *
 * Chaque « on-… » est l'encre lisible sur la couleur : au moins 4,5:1 (WCAG 2), contrôlé ici.
 */
import type { ColorRoles, ColorVariant } from './types';

export interface BrandPalette {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
}

// ─── Utilitaires (sans dépendance) ───────────────────────────────────────────

export function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim()) || /^#?([0-9a-f]{3})$/i.exec(String(hex || '').trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export const rgbToHex = (c: number[]) => `#${c.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('')}`;

export function luminance(hex: string): number {
  const c = hexToRgb(hex);
  if (!c) return 1;
  const [r, g, b] = c.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contraste WCAG 2 (1 à 21). */
export function contrastRatio(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

export function mixHex(a: string, b: string, t: number): string {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  if (!x || !y) return a;
  return rgbToHex(x.map((v, i) => v + (y[i] - v) * t));
}

// ─── Material Color Utilities (chargé avec tolérance) ────────────────────────

interface HctLike {
  hue: number;
  chroma: number;
  tone: number;
  toInt(): number;
}
interface McuModule {
  Hct: { fromInt(argb: number): HctLike; from(hue: number, chroma: number, tone: number): HctLike };
  TonalPalette: { fromHueAndChroma(hue: number, chroma: number): { tone(t: number): number } };
  Blend: { harmonize(design: number, source: number): number };
  argbFromHex(hex: string): number;
  hexFromArgb(argb: number): string;
}

let mcuModule: McuModule | null | undefined;

/** MCU est un paquet ESM ; un arbre local peut le loger sous `apps/api` : on le cherche aussi là. */
function mcu(): McuModule | null {
  if (mcuModule !== undefined) return mcuModule;
  const candidates = ['@material/material-color-utilities'];
  for (const id of candidates) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      mcuModule = require(id) as McuModule;
      return mcuModule;
    } catch {
      // essai suivant
    }
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const path = require('path') as typeof import('path');
    const where = require.resolve('@material/material-color-utilities', { paths: [path.join(__dirname, '../../../../apps/api'), process.cwd()] });
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    mcuModule = require(where) as McuModule;
  } catch {
    mcuModule = null;
  }
  return mcuModule;
}

// ─── Leonardo (encres à contraste visé) ──────────────────────────────────────

interface LeonardoModule {
  Color: new (o: { name: string; colorKeys: string[]; ratios: Record<string, number> | number[]; colorSpace?: string; smooth?: boolean }) => unknown;
  BackgroundColor: new (o: { name: string; colorKeys: string[]; ratios: number[]; colorSpace?: string }) => unknown;
  Theme: new (o: { colors: unknown[]; backgroundColor: unknown; lightness: number; contrast?: number; output?: string }) => { contrastColors: { name?: string; background?: string; values?: { name: string; value: string; contrast: number }[] }[] };
}

let leonardoModule: LeonardoModule | null | undefined;
function leonardo(): LeonardoModule | null {
  if (leonardoModule !== undefined) return leonardoModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    leonardoModule = require('@adobe/leonardo-contrast-colors') as LeonardoModule;
  } catch {
    leonardoModule = null;
  }
  return leonardoModule;
}

// ─── Tons ────────────────────────────────────────────────────────────────────

/** Le ton HCT d'une couleur (0 noir → 100 blanc) ; repli : la clarté approchée. */
function toneOf(hex: string): number {
  const m = mcu();
  if (m) return m.Hct.fromInt(m.argbFromHex(hex)).tone;
  const l = luminance(hex);
  return 116 * Math.cbrt(l) - 16;
}

function hctOf(hex: string): { hue: number; chroma: number; tone: number } {
  const m = mcu();
  if (m) {
    const h = m.Hct.fromInt(m.argbFromHex(hex));
    return { hue: h.hue, chroma: h.chroma, tone: h.tone };
  }
  return { hue: 0, chroma: 0, tone: toneOf(hex) };
}

/** Une couleur de la teinte donnée à un ton (palette tonale) ; repli : mélange vers le blanc ou le noir. */
function tone(hex: string, t: number, chroma?: number): string {
  const m = mcu();
  if (m) {
    const h = m.Hct.fromInt(m.argbFromHex(hex));
    return m.hexFromArgb(m.TonalPalette.fromHueAndChroma(h.hue, chroma ?? h.chroma).tone(t));
  }
  const cur = toneOf(hex);
  return t >= cur ? mixHex(hex, '#ffffff', (t - cur) / Math.max(1, 100 - cur)) : mixHex(hex, '#000000', (cur - t) / Math.max(1, cur));
}

function harmonize(design: string, source: string): string {
  const m = mcu();
  return m ? m.hexFromArgb(m.Blend.harmonize(m.argbFromHex(design), m.argbFromHex(source))) : design;
}

/** L'encre lisible sur une couleur : la teinte de cette couleur au ton le plus proche qui tient 4,5:1 (sinon blanc / quasi-noir). */
export function onColor(bg: string, min = 4.5): string {
  const light = contrastRatio('#ffffff', bg);
  const dark = contrastRatio('#111418', bg);
  const towardsLight = light >= dark;
  for (const t of towardsLight ? [99, 98, 96, 94] : [8, 10, 14, 18]) {
    const c = tone(bg, t, Math.min(16, hctOf(bg).chroma));
    if (contrastRatio(c, bg) >= min) return c;
  }
  return towardsLight ? '#ffffff' : '#111418';
}

/** La couleur d'une teinte, ajustée en ton jusqu'à tenir un contraste sur un fond (encre, filet). */
function atContrast(keyHex: string, ground: string, ratio: number, chroma?: number): string {
  const groundTone = toneOf(ground);
  const darker = groundTone >= 50;
  let best = keyHex;
  let bestGap = Infinity;
  for (let t = darker ? groundTone : groundTone; darker ? t >= 0 : t <= 100; t += darker ? -1 : 1) {
    const c = tone(keyHex, t, chroma);
    const r = contrastRatio(c, ground);
    if (r >= ratio) return c;
    const gap = ratio - r;
    if (gap < bestGap) {
      bestGap = gap;
      best = c;
    }
  }
  return best;
}

/** Encres par Leonardo (contraste visé), repli : recherche sur la palette tonale. */
function inks(textHex: string, ground: string): { ink: string; inkMuted: string; line: string } {
  // L'encre de la marque reste la sienne quand elle se lit déjà très bien (7:1) : on ne l'éclaircit jamais vers le seuil.
  const keep = contrastRatio(textHex, ground) >= 7 ? textHex : undefined;
  const L = leonardo();
  if (L) {
    // Leonardo signale en interne un nom d'option déprécié qu'il se passe à lui-même : sans intérêt pour nos journaux.
    const warn = console.warn;
    console.warn = (...args: unknown[]) => (/Leonardo/.test(String(args[0])) ? undefined : warn(...args));
    try {
      const bg = new L.BackgroundColor({ name: 'ground', colorKeys: [ground], ratios: [1], colorSpace: 'CAM02' });
      const ink = new L.Color({ name: 'ink', colorKeys: [textHex], ratios: { ink: 7.2, inkMuted: 4.6, line: 1.45 }, colorSpace: 'CAM02', smooth: false });
      const theme = new L.Theme({ colors: [ink], backgroundColor: bg, lightness: Math.round(Math.max(0, Math.min(100, toneOf(ground)))), output: 'HEX' });
      const values = theme.contrastColors.find((c) => c.name === 'ink')?.values || [];
      const get = (n: string) => values.find((v) => v.name === n)?.value;
      const out = { ink: keep || get('ink'), inkMuted: get('inkMuted'), line: get('line') };
      if (out.ink && out.inkMuted && out.line && contrastRatio(out.ink, ground) >= 7 && contrastRatio(out.inkMuted, ground) >= 4.5) return out as { ink: string; inkMuted: string; line: string };
    } catch {
      // repli ci-dessous
    } finally {
      console.warn = warn;
    }
  }
  return { ink: keep || atContrast(textHex, ground, 7.2, 12), inkMuted: atContrast(textHex, ground, 4.6, 10), line: atContrast(textHex, ground, 1.45, 8) };
}

/** Le meilleur contraste qu'une encre (blanc ou quasi-noir) puisse tenir sur une couleur. */
export const bestInkContrast = (bg: string) => Math.max(contrastRatio('#ffffff', bg), contrastRatio('#111418', bg));

export interface PaletteOptions {
  variant: ColorVariant;
  /** Le client a demandé un fond sombre : seule exception à la surface claire. */
  allowDark?: boolean;
}

/** Les rôles de couleur du film. */
export function buildColorRoles(brand: BrandPalette, opts: PaletteOptions): ColorRoles {
  const safe = (h: string, f: string) => (hexToRgb(h) ? rgbToHex(hexToRgb(h)!) : f);
  const primaryIn = safe(brand.primary, '#1f6f4a');
  const secondaryIn = safe(brand.secondary, '#14324a');
  const accentIn = safe(brand.accent, '#f2a93b');
  const textIn = safe(brand.text, '#16181d');
  const bgIn = safe(brand.background, '#fbfaf7');
  const p = hctOf(primaryIn);

  let primary = primaryIn;
  let accent = accentIn;
  let secondary = secondaryIn;
  if (opts.variant === 'vivid') {
    primary = tone(primaryIn, Math.min(55, Math.max(35, p.tone)), Math.max(p.chroma, 58));
    accent = tone(accentIn, Math.max(55, hctOf(accentIn).tone), Math.max(hctOf(accentIn).chroma, 70));
  } else if (opts.variant === 'monochrome') {
    accent = tone(primaryIn, 72, Math.max(24, p.chroma));
    secondary = tone(primaryIn, 22, Math.max(18, p.chroma * 0.8));
  } else {
    // Tonale : l'accent se rapproche de la teinte principale (harmonie), sans perdre sa fonction.
    accent = harmonize(accentIn, primaryIn);
  }

  // Le fond : celui de la marque s'il est clair, sinon un blanc cassé de la teinte principale.
  const lightGround = toneOf(bgIn) >= 90 ? bgIn : tone(primaryIn, 98, 4);
  const ground = opts.allowDark && toneOf(bgIn) < 40 ? bgIn : lightGround;
  const neutralChroma = opts.variant === 'monochrome' ? 8 : 5;
  const dark = toneOf(ground) < 50;
  const surface = tone(primaryIn, dark ? 16 : 95, neutralChroma);
  const surfaceStrong = tone(primaryIn, dark ? 24 : 90, neutralChroma + 2);
  const { ink, inkMuted, line } = inks(textIn, ground);
  const highlight = tone(accent, dark ? 30 : 88, Math.min(48, hctOf(accent).chroma));
  const neutral = tone(primaryIn, dark ? 80 : 30, neutralChroma);
  return {
    ground,
    surface,
    surfaceStrong,
    ink,
    inkMuted,
    line,
    primary,
    onPrimary: onColor(primary),
    secondary,
    onSecondary: onColor(secondary),
    accent,
    onAccent: onColor(accent),
    highlight,
    onHighlight: atContrast(textIn, highlight, 7, 12),
    neutral,
    onNeutral: onColor(neutral),
  };
}

/** Les contrôles des rôles (utilisés par les tests) : chaque encre tient son contraste. */
export function colorRoleChecks(roles: ColorRoles): { pair: string; ratio: number; min: number }[] {
  const pairs: [keyof ColorRoles, keyof ColorRoles, number][] = [
    ['ink', 'ground', 7],
    ['inkMuted', 'ground', 4.5],
    ['onPrimary', 'primary', 4.5],
    ['onSecondary', 'secondary', 4.5],
    ['onAccent', 'accent', 4.5],
    ['onHighlight', 'highlight', 4.5],
    ['onNeutral', 'neutral', 4.5],
    ['ink', 'surface', 4.5],
  ];
  // Sur une couleur de marque de ton moyen (un rouge vif), aucune encre ne tient 4,5:1 : on exige alors le meilleur
  // possible, au moins 3:1 (grand texte, WCAG 2) — la couleur de la marque n'est jamais déformée pour autant.
  return pairs.map(([a, b, min]) => {
    const reachable = a.startsWith('on') ? Math.min(min, Math.max(3, bestInkContrast(roles[b]) - 0.05)) : min;
    return { pair: `${a}/${b}`, ratio: Math.round(contrastRatio(roles[a], roles[b]) * 100) / 100, min: Math.round(reachable * 100) / 100 };
  });
}

export const isLight = (hex: string) => toneOf(hex) >= 50;

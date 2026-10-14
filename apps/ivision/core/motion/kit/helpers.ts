/**
 * Le KIT TECHNIQUE de `@idem/motion` : des calculs, jamais des compositions.
 *
 * Rien ici ne décide de l'apparence d'une scène : ce sont des outils (mesurer un texte, couvrir un
 * cadre avec une photo, poser des points sur une grille, choisir une encre lisible, caler un geste
 * sur un temps de la musique). Le code d'une scène s'en sert s'il veut, les combine, ou les ignore.
 */
import { useThread, waitFor } from '@motion-canvas/core';
import type { SceneContext, SceneMedia } from './context';

// ─── Géométrie ───────────────────────────────────────────────────────────────

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * La zone sûre : l'image moins une marge (en % du plus petit côté). En format vertical (story), le
 * haut et le bas gardent 9 % de plus, là où les applications posent leurs boutons.
 */
export function safeArea(ctx: Pick<SceneContext, 'width' | 'height' | 'format'>, margin = 6): Box {
  const m = (Math.min(ctx.width, ctx.height) * margin) / 100;
  const extra = ctx.format === 'story' ? ctx.height * 0.09 : 0;
  const width = ctx.width - 2 * m;
  const height = ctx.height - 2 * (m + extra);
  return { x: 0, y: 0, width, height, left: -width / 2, right: width / 2, top: -height / 2, bottom: height / 2 };
}

/** Les centres d'une grille de `cols` × `rows` cellules dans une boîte (par défaut toute l'image). */
export function grid(cols: number, rows: number, box: { width: number; height: number; x?: number; y?: number }, gap = 0): { x: number; y: number; width: number; height: number; col: number; row: number }[] {
  const cw = (box.width - gap * (cols - 1)) / cols;
  const ch = (box.height - gap * (rows - 1)) / rows;
  const out: { x: number; y: number; width: number; height: number; col: number; row: number }[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      out.push({
        x: (box.x ?? 0) - box.width / 2 + cw / 2 + col * (cw + gap),
        y: (box.y ?? 0) - box.height / 2 + ch / 2 + row * (ch + gap),
        width: cw,
        height: ch,
        col,
        row,
      });
    }
  }
  return out;
}

/** `n` points régulièrement répartis sur un cercle de rayon `r` (angle de départ en degrés, 0 = droite). */
export function circlePoints(n: number, r: number, startDeg = -90): { x: number; y: number; angle: number }[] {
  return Array.from({ length: n }, (_, i) => {
    const angle = startDeg + (360 * i) / n;
    const rad = (angle * Math.PI) / 180;
    return { x: Math.cos(rad) * r, y: Math.sin(rad) * r, angle };
  });
}

/** Interpolation linéaire, et sa réciproque bornée. */
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Un nombre pseudo-aléatoire reproductible (même graine → même suite) : jamais `Math.random()`, le rendu doit être identique à l'aperçu. */
export function random(seed: number): () => number {
  let s = Math.floor(seed * 9301 + 49297) % 233280 || 1;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

// ─── Médias ──────────────────────────────────────────────────────────────────

/**
 * La taille à donner à un `<Img>` / `<Video>` pour COUVRIR un cadre (le surplus est rogné par un
 * parent `clip`), ou pour y TENIR entier (`contain`). Dimensions inconnues : la taille du cadre.
 */
export function fitMedia(media: Pick<SceneMedia, 'width' | 'height'>, boxWidth: number, boxHeight: number, mode: 'cover' | 'contain' = 'cover'): { width: number; height: number } {
  if (!media.width || !media.height) return { width: boxWidth, height: boxHeight };
  const scale = mode === 'cover' ? Math.max(boxWidth / media.width, boxHeight / media.height) : Math.min(boxWidth / media.width, boxHeight / media.height);
  return { width: media.width * scale, height: media.height * scale };
}

// ─── Texte ───────────────────────────────────────────────────────────────────

let measureCanvas: CanvasRenderingContext2D | null = null;

/** Largeur d'un texte sur une ligne, en pixels, pour une police et une taille données. */
export function measureText(text: string, fontSize: number, fontFamily: string, fontWeight: number | string = 400, letterSpacing = 0): number {
  measureCanvas ??= document.createElement('canvas').getContext('2d');
  if (!measureCanvas) return text.length * fontSize * 0.55;
  measureCanvas.font = `${fontWeight} ${fontSize}px ${JSON.stringify(fontFamily)}`;
  return measureCanvas.measureText(text).width + letterSpacing * Math.max(0, text.length - 1);
}

/**
 * La plus grande taille de police (entre `min` et `max`) pour qu'un texte tienne en `lines` lignes
 * dans `maxWidth`. Le découpage suit les mots, comme `<Txt textWrap>`.
 */
export function fitFontSize(text: string, opts: { maxWidth: number; max: number; min?: number; lines?: number; fontFamily: string; fontWeight?: number | string; letterSpacing?: number }): number {
  const min = opts.min ?? 12;
  const lines = Math.max(1, opts.lines ?? 1);
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const fits = (size: number) => {
    let used = 1;
    let line = '';
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (measureText(next, size, opts.fontFamily, opts.fontWeight, opts.letterSpacing) <= opts.maxWidth) line = next;
      else {
        if (!line || measureText(w, size, opts.fontFamily, opts.fontWeight, opts.letterSpacing) > opts.maxWidth) return false;
        used++;
        line = w;
      }
    }
    return used <= lines;
  };
  let lo = min;
  let hi = Math.max(min, opts.max);
  if (fits(hi)) return hi;
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) lo = mid;
    else hi = mid;
  }
  return Math.floor(lo);
}

/** Les mots d'un texte (pour les animer un par un). */
export const words = (text: string): string[] => String(text || '').split(/\s+/).filter(Boolean);

// ─── Couleur ─────────────────────────────────────────────────────────────────

function rgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim()) || /^#?([0-9a-f]{3})$/i.exec(String(hex || '').trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function luminance(hex: string): number {
  const c = rgb(hex);
  if (!c) return 1;
  const [r, g, b] = c.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Rapport de contraste WCAG entre deux couleurs hexadécimales (1 à 21). */
export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** Une encre lisible sur un fond : `preferred` si elle atteint `min` (4,5 par défaut), sinon blanc ou quasi-noir. */
export function readableOn(background: string, preferred?: string, min = 4.5): string {
  if (preferred && contrast(preferred, background) >= min) return preferred;
  return contrast('#ffffff', background) >= contrast('#111418', background) ? '#ffffff' : '#111418';
}

/** Mélange de deux couleurs hexadécimales (t = 0 → a, t = 1 → b). */
export function mix(a: string, b: string, t: number): string {
  const x = rgb(a);
  const y = rgb(b);
  if (!x || !y) return a;
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
}

/** Une couleur hexadécimale avec une opacité (`rgba(...)`). */
export function alpha(hex: string, opacity: number): string {
  const c = rgb(hex);
  return c ? `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${clamp(opacity, 0, 1)})` : hex;
}

// ─── Temps ───────────────────────────────────────────────────────────────────

/** L'instant (secondes depuis le début de la scène) du `n`-ième temps de la musique (0 = le premier). */
export function beatTime(ctx: Pick<SceneContext, 'beat'>, n: number): number {
  if (!ctx.beat || !ctx.beat.bpm) return n * 0.5;
  return ctx.beat.first + (n * 60) / ctx.beat.bpm;
}

/** Le temps écoulé depuis le début de la scène, en secondes. */
export const sceneTime = (): number => useThread().time();

/** Attendre jusqu'à un instant de la scène (secondes depuis son début), s'il n'est pas déjà passé. */
export function* waitUntilTime(t: number) {
  const rest = t - useThread().time();
  if (rest > 0) yield* waitFor(rest);
}

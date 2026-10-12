/**
 * Mathématiques de couleur du moteur graphique.
 *
 * Tout est déterministe et sans dépendance : un moteur dont la qualité se GARANTIT par le
 * calcul (contraste WCAG, rampes OKLCH) ne peut pas revenir à un gris à 3,1:1 parce qu'un
 * modèle a trouvé le gris clair élégant. Conversions d'après la spécification OKLab de
 * Björn Ottosson.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface Oklch {
  /** Clarté perceptuelle, 0..1. */
  l: number;
  /** Chroma, 0..~0.4. */
  c: number;
  /** Teinte en degrés, 0..360. */
  h: number;
}

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

export const isHex = (value?: string | null): value is string =>
  /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test((value ?? '').trim());

/** `#abc` → `#aabbcc`, minuscules. Une valeur illisible rend le repli. */
export function normalizeHex(value: string | undefined | null, fallback = '#000000'): string {
  const raw = (value ?? '').trim().replace(/^#/, '');
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
  return /^[0-9a-fA-F]{6}$/.test(full) ? `#${full.toLowerCase()}` : fallback;
}

export function hexToRgb(hex: string): Rgb | null {
  const normalized = hex.trim().replace(/^#/, '');
  const expanded = normalized.length === 3 ? normalized.split('').map((c) => c + c).join('') : normalized;
  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) return null;
  return {
    r: parseInt(expanded.slice(0, 2), 16) / 255,
    g: parseInt(expanded.slice(2, 4), 16) / 255,
    b: parseInt(expanded.slice(4, 6), 16) / 255,
  };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const channel = (value: number) => Math.round(clamp(value, 0, 1) * 255).toString(16).padStart(2, '0');
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

const srgbToLinear = (value: number) => (value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4));
const linearToSrgb = (value: number) => (value <= 0.0031308 ? value * 12.92 : 1.055 * Math.pow(value, 1 / 2.4) - 0.055);

export function rgbToOklch(rgb: Rgb): Oklch {
  const r = srgbToLinear(rgb.r);
  const g = srgbToLinear(rgb.g);
  const b = srgbToLinear(rgb.b);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const okL = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const okA = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const okB = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const chroma = Math.sqrt(okA * okA + okB * okB);
  const hue = chroma < 1e-6 ? 0 : (Math.atan2(okB, okA) * 180) / Math.PI;
  return { l: okL, c: chroma, h: (hue + 360) % 360 };
}

export function oklchToRgb({ l, c, h }: Oklch): Rgb {
  const hRad = (h * Math.PI) / 180;
  const okA = c * Math.cos(hRad);
  const okB = c * Math.sin(hRad);
  const lCubed = Math.pow(l + 0.3963377774 * okA + 0.2158037573 * okB, 3);
  const mCubed = Math.pow(l - 0.1055613458 * okA - 0.0638541728 * okB, 3);
  const sCubed = Math.pow(l - 0.0894841775 * okA - 1.291485548 * okB, 3);
  return {
    r: linearToSrgb(4.0767416621 * lCubed - 3.3077115913 * mCubed + 0.2309699292 * sCubed),
    g: linearToSrgb(-1.2684380046 * lCubed + 2.6097574011 * mCubed - 0.3413193965 * sCubed),
    b: linearToSrgb(-0.0041960863 * lCubed - 0.7034186147 * mCubed + 1.707614701 * sCubed),
  };
}

export const hexToOklch = (hex: string): Oklch | null => {
  const rgb = hexToRgb(hex);
  return rgb ? rgbToOklch(rgb) : null;
};

export const oklchToHex = (oklch: Oklch): string => rgbToHex(oklchToRgb(oklch));

/** Luminance relative WCAG 2.1. */
export function relativeLuminance(input: Rgb | string): number {
  const rgb = typeof input === 'string' ? hexToRgb(input) ?? { r: 1, g: 1, b: 1 } : input;
  return (
    0.2126 * srgbToLinear(clamp(rgb.r, 0, 1)) +
    0.7152 * srgbToLinear(clamp(rgb.g, 0, 1)) +
    0.0722 * srgbToLinear(clamp(rgb.b, 0, 1))
  );
}

/** Rapport de contraste WCAG 2.1 entre deux couleurs hexadécimales, de 1 à 21. */
export function contrastRatio(foreground: string, background: string): number {
  const fg = hexToRgb(foreground);
  const bg = hexToRgb(background);
  if (!fg || !bg) return 1;
  const lf = relativeLuminance(fg);
  const lb = relativeLuminance(bg);
  return (Math.max(lf, lb) + 0.05) / (Math.min(lf, lb) + 0.05);
}

/** Un fond est « sombre » sous cette luminance (seuil de la charte : la surface reste claire sinon). */
export const isDark = (hex: string): boolean => relativeLuminance(hex) < 0.35;

/**
 * Un fond PROFOND — presque noir, ou sombre et presque gris : c'est ce qui fait un « thème sombre ».
 * Un magenta ou un bleu vif (luminance faible mais clarté perceptuelle moyenne) n'en est pas un : c'est
 * un fond de couleur, admis comme expression de la marque.
 */
export function isDeep(hex: string): boolean {
  const o = hexToOklch(hex);
  if (!o) return false;
  return o.l < 0.4 || (o.l < 0.52 && o.c < 0.045);
}

/**
 * Déplace la clarté OKLCH du premier plan, dans le sens qui l'éloigne du fond, jusqu'au seuil.
 * Teinte et chroma sont conservés : la couleur reste celle de la marque. Noir ou blanc en
 * dernier recours.
 */
export function ensureContrast(foregroundHex: string, backgroundHex: string, target = 4.5): string {
  if (contrastRatio(foregroundHex, backgroundHex) >= target) return foregroundHex;
  const foreground = hexToOklch(foregroundHex);
  const background = hexToRgb(backgroundHex);
  if (!foreground || !background) return foregroundHex;
  const direction = relativeLuminance(background) > 0.35 ? -1 : 1;
  for (let step = 1; step <= 40; step++) {
    const candidate = oklchToHex({ ...foreground, l: clamp(foreground.l + direction * step * 0.025, 0, 1) });
    if (contrastRatio(candidate, backgroundHex) >= target) return candidate;
  }
  return direction === -1 ? '#000000' : '#ffffff';
}

/**
 * Encre lisible sur un fond, GARANTIE au seuil demandé : on essaie la couleur d'origine, le sens
 * opposé, puis les extrêmes, et l'on garde le meilleur contraste plutôt qu'un seuil manqué. Sur une
 * couleur de milieu de gamme (un accent terracotta), `ensureContrast` seul échoue dans un sens.
 */
export function readableInk(seedHex: string, backgroundHex: string, target: number): string {
  const lightBg = relativeLuminance(backgroundHex) > 0.35;
  const candidates = [
    ensureContrast(seedHex, backgroundHex, target),
    ensureContrast(lightBg ? '#000000' : '#ffffff', backgroundHex, target),
    '#000000',
    '#ffffff',
  ];
  const passing = candidates.find((hex) => contrastRatio(hex, backgroundHex) >= target);
  if (passing) return passing;
  return candidates.reduce((best, hex) => (contrastRatio(hex, backgroundHex) > contrastRatio(best, backgroundHex) ? hex : best));
}

/** Noir ou blanc, selon ce qui se lit le mieux sur ce fond. */
export const onColor = (backgroundHex: string): string =>
  contrastRatio('#000000', backgroundHex) >= contrastRatio('#ffffff', backgroundHex) ? '#000000' : '#ffffff';

/** Rampe 50→950 en balayant la clarté OKLCH (la forme de Tailwind). */
const RAMP_STOPS: Array<[number, number]> = [
  [50, 0.975],
  [100, 0.94],
  [200, 0.88],
  [300, 0.8],
  [400, 0.71],
  [500, 0.62],
  [600, 0.54],
  [700, 0.45],
  [800, 0.37],
  [900, 0.29],
  [950, 0.2],
];

export function buildRamp(baseHex: string): Record<string, string> {
  const base = hexToOklch(baseHex);
  if (!base) return {};
  const ramp: Record<string, string> = {};
  for (const [stop, lightness] of RAMP_STOPS) {
    // Le chroma doit décroître loin des tons moyens sous peine de sortir du gamut sRGB ; la
    // décroissance est asymétrique : une teinte pâle ne porte presque aucun chroma avant de
    // saturer, une teinte profonde en porte beaucoup.
    const falloff =
      lightness > 0.62
        ? 1 - Math.pow((lightness - 0.62) / 0.38, 1.1) * 0.92
        : 1 - Math.pow((0.62 - lightness) / 0.42, 1.6) * 0.45;
    ramp[String(stop)] = oklchToHex({ l: lightness, c: Math.max(0, base.c * clamp(falloff, 0.06, 1)), h: base.h });
  }
  return ramp;
}

/** Gris teinté vers la teinte de la marque : « le gris de cette marque ». */
export function buildNeutralRamp(brandHue: number, tint = 0.01): Record<string, string> {
  const ramp: Record<string, string> = {};
  for (const [stop, lightness] of RAMP_STOPS) ramp[String(stop)] = oklchToHex({ l: lightness, c: tint, h: brandHue });
  return ramp;
}

/** Rotation de teinte à clarté et chroma constants. */
export function rotateHue(hex: string, degrees: number): string {
  const oklch = hexToOklch(hex);
  return oklch ? oklchToHex({ ...oklch, h: (oklch.h + degrees + 360) % 360 }) : hex;
}

/** Mélange dans l'espace sRGB (comme `color-mix(in srgb)`), `t` = part de `b`. */
export function mixHex(a: string, b: string, t: number): string {
  const ra = hexToRgb(a);
  const rb = hexToRgb(b);
  if (!ra || !rb) return a;
  const k = clamp(t, 0, 1);
  return rgbToHex({ r: ra.r + (rb.r - ra.r) * k, g: ra.g + (rb.g - ra.g) * k, b: ra.b + (rb.b - ra.b) * k });
}

/** `rgba(r,g,b,a)` d'une couleur hexadécimale. */
export function withAlpha(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex) ?? { r: 0, g: 0, b: 0 };
  const c = (v: number) => Math.round(v * 255);
  return `rgba(${c(rgb.r)},${c(rgb.g)},${c(rgb.b)},${Math.round(clamp(alpha, 0, 1) * 1000) / 1000})`;
}

/** Décale la clarté OKLCH (positif = plus clair). */
export function shiftLightness(hex: string, delta: number): string {
  const oklch = hexToOklch(hex);
  return oklch ? oklchToHex({ ...oklch, l: clamp(oklch.l + delta, 0, 1) }) : hex;
}

/** Multiplie le chroma (0 = gris, 1 = inchangé). */
export function scaleChroma(hex: string, factor: number): string {
  const oklch = hexToOklch(hex);
  return oklch ? oklchToHex({ ...oklch, c: Math.max(0, oklch.c * factor) }) : hex;
}

/** Distance perceptuelle approchée entre deux couleurs (norme euclidienne dans OKLab, ×100). */
export function colorDistance(a: string, b: string): number {
  const ca = hexToOklch(a);
  const cb = hexToOklch(b);
  if (!ca || !cb) return 0;
  const lab = (o: Oklch) => ({ l: o.l, a: o.c * Math.cos((o.h * Math.PI) / 180), b: o.c * Math.sin((o.h * Math.PI) / 180) });
  const la = lab(ca);
  const lb = lab(cb);
  return Math.sqrt((la.l - lb.l) ** 2 + (la.a - lb.a) ** 2 + (la.b - lb.b) ** 2) * 100;
}

/** Le plus contrasté des candidats sur ce fond (le premier en cas d'égalité). */
export function bestContrast(background: string, candidates: string[]): string {
  return candidates.reduce((best, hex) => (contrastRatio(hex, background) > contrastRatio(best, background) ? hex : best), candidates[0]);
}

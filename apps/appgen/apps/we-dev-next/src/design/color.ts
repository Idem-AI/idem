/**
 * Colour maths for the design token forge.
 *
 * Everything here is deterministic and dependency-free: the point of the forge
 * is that the design system is *computed*, never asked of the model. A contrast
 * ratio that is calculated cannot be "almost right", which is the single most
 * common failure of model-authored palettes (muted grey body text on a tinted
 * near-white).
 *
 * Conversions follow Björn Ottosson's OKLab specification.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface Oklch {
  /** Perceptual lightness, 0..1 */
  l: number;
  /** Chroma, 0..~0.4 */
  c: number;
  /** Hue in degrees, 0..360 */
  h: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function hexToRgb(hex: string): Rgb | null {
  const normalized = hex.trim().replace(/^#/, '');

  const expanded =
    normalized.length === 3
      ? normalized
          .split('')
          .map((char) => char + char)
          .join('')
      : normalized;

  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) {
    return null;
  }

  return {
    r: parseInt(expanded.slice(0, 2), 16) / 255,
    g: parseInt(expanded.slice(2, 4), 16) / 255,
    b: parseInt(expanded.slice(4, 6), 16) / 255,
  };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const channel = (value: number) =>
    Math.round(clamp(value, 0, 1) * 255)
      .toString(16)
      .padStart(2, '0');

  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

const srgbToLinear = (value: number) =>
  value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);

const linearToSrgb = (value: number) =>
  value <= 0.0031308 ? value * 12.92 : 1.055 * Math.pow(value, 1 / 2.4) - 0.055;

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

/** CSS `oklch()` literal, rounded to keep the injected prompt block small. */
export function formatOklch({ l, c, h }: Oklch): string {
  return `oklch(${(clamp(l, 0, 1) * 100).toFixed(1)}% ${Math.max(0, c).toFixed(3)} ${((h % 360) + 360).toFixed(1)})`;
}

/** WCAG 2.1 relative luminance. */
export function relativeLuminance({ r, g, b }: Rgb): number {
  return (
    0.2126 * srgbToLinear(clamp(r, 0, 1)) +
    0.7152 * srgbToLinear(clamp(g, 0, 1)) +
    0.0722 * srgbToLinear(clamp(b, 0, 1))
  );
}

/** WCAG 2.1 contrast ratio between two hex colours, 1..21. */
export function contrastRatio(foreground: string, background: string): number {
  const fg = hexToRgb(foreground);
  const bg = hexToRgb(background);

  if (!fg || !bg) {
    return 1;
  }

  const lighter = Math.max(relativeLuminance(fg), relativeLuminance(bg));
  const darker = Math.min(relativeLuminance(fg), relativeLuminance(bg));

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Walks the foreground's OKLCH lightness away from the background until the
 * target ratio is met, keeping hue and chroma so the colour stays on-brand.
 * Returns the original when it already passes, black or white when even the
 * extremes cannot reach the target.
 */
export function ensureContrast(foregroundHex: string, backgroundHex: string, target = 4.5): string {
  if (contrastRatio(foregroundHex, backgroundHex) >= target) {
    return foregroundHex;
  }

  const foreground = hexToOklch(foregroundHex);
  const background = hexToRgb(backgroundHex);

  if (!foreground || !background) {
    return foregroundHex;
  }

  // Darken against light backgrounds, lighten against dark ones.
  const direction = relativeLuminance(background) > 0.35 ? -1 : 1;

  for (let step = 1; step <= 40; step++) {
    const candidate = oklchToHex({
      ...foreground,
      l: clamp(foreground.l + direction * step * 0.025, 0, 1),
    });

    if (contrastRatio(candidate, backgroundHex) >= target) {
      return candidate;
    }
  }

  return direction === -1 ? '#000000' : '#ffffff';
}

/** Tailwind-shaped 50..950 ramp built by sweeping OKLCH lightness. */
const RAMP_STOPS: Array<[stop: number, lightness: number]> = [
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

  if (!base) {
    return {};
  }

  const ramp: Record<string, string> = {};

  for (const [stop, lightness] of RAMP_STOPS) {
    // Chroma has to fall off away from the mid tones or the ramp clips out of
    // sRGB. The falloff is asymmetric on purpose: a pale tint holds almost no
    // chroma before it clips, while a deep shade still carries plenty.
    const falloff =
      lightness > 0.62
        ? 1 - Math.pow((lightness - 0.62) / 0.38, 1.1) * 0.92
        : 1 - Math.pow((0.62 - lightness) / 0.42, 1.6) * 0.45;

    ramp[String(stop)] = oklchToHex({
      l: lightness,
      c: Math.max(0, base.c * clamp(falloff, 0.06, 1)),
      h: base.h,
    });
  }

  return ramp;
}

/**
 * Neutral ramp tinted toward the brand hue. A chroma of 0.006-0.014 is enough
 * to read as "the brand's own grey" without becoming a colour of its own.
 */
export function buildNeutralRamp(brandHue: number, tint = 0.01): Record<string, string> {
  const ramp: Record<string, string> = {};

  for (const [stop, lightness] of RAMP_STOPS) {
    ramp[String(stop)] = oklchToHex({ l: lightness, c: tint, h: brandHue });
  }

  return ramp;
}

/** Rotates hue while preserving lightness and chroma. */
export function rotateHue(hex: string, degrees: number): string {
  const oklch = hexToOklch(hex);
  return oklch ? oklchToHex({ ...oklch, h: (oklch.h + degrees + 360) % 360 }) : hex;
}

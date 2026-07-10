import sharp from 'sharp';
import { parse, stringify, INode } from 'svgson';
import logger from '../config/logger';

/**
 * Hybrid logo variation engine.
 *
 * Replaces the old regex-based color substitution with a real pipeline:
 *  1. Parse the SVG into an AST and resolve the EFFECTIVE paint of every element
 *     (presentation attributes, inline styles, <style> blocks, inheritance,
 *     implicit black fills, named colors, rgb()/hsl(), currentColor).
 *  2. Materialize resolved paints as inline styles so transformations are exhaustive.
 *  3. Generate variations with deterministic transforms in OKLCH space
 *     (hue/chroma preserved, lightness adjusted until WCAG contrast is reached).
 *  4. QA: render each variation over its target background with sharp and measure
 *     the fraction of visible pixels. On failure, retry with an aggressive pass,
 *     then optionally delegate to an AI recolor callback (bounded: color mapping only).
 */

// ─── Public types ─────────────────────────────────────────────────────────────

export interface LogoVariationSet {
  lightBackground: string;
  darkBackground: string;
  monochrome: string;
}

export interface LogoVariationsResult {
  withText: LogoVariationSet;
  iconOnly: LogoVariationSet;
}

export type VariantKind = 'lightBackground' | 'darkBackground' | 'monochrome';

export interface AiRecolorRequest {
  svg: string;
  variant: VariantKind;
  background: string;
  issue: string;
}

/** Returns a hex→hex color mapping to fix the variant, or null to skip */
export type AiRecolorCallback = (request: AiRecolorRequest) => Promise<Record<string, string> | null>;

export interface GenerateVariationsOptions {
  aiRecolor?: AiRecolorCallback;
}

// ─── Color parsing ────────────────────────────────────────────────────────────

const NAMED_COLORS: Record<string, string> = {
  black: '#000000', white: '#ffffff', red: '#ff0000', lime: '#00ff00', blue: '#0000ff',
  yellow: '#ffff00', cyan: '#00ffff', aqua: '#00ffff', magenta: '#ff00ff', fuchsia: '#ff00ff',
  gray: '#808080', grey: '#808080', silver: '#c0c0c0', maroon: '#800000', olive: '#808000',
  green: '#008000', teal: '#008080', navy: '#000080', purple: '#800080', orange: '#ffa500',
  gold: '#ffd700', pink: '#ffc0cb', hotpink: '#ff69b4', deeppink: '#ff1493', crimson: '#dc143c',
  darkred: '#8b0000', tomato: '#ff6347', coral: '#ff7f50', orangered: '#ff4500',
  darkorange: '#ff8c00', khaki: '#f0e68c', lavender: '#e6e6fa', indigo: '#4b0082',
  violet: '#ee82ee', orchid: '#da70d6', plum: '#dda0dd', skyblue: '#87ceeb',
  lightblue: '#add8e6', steelblue: '#4682b4', royalblue: '#4169e1', dodgerblue: '#1e90ff',
  cornflowerblue: '#6495ed', deepskyblue: '#00bfff', midnightblue: '#191970',
  darkblue: '#00008b', mediumblue: '#0000cd', turquoise: '#40e0d0', aquamarine: '#7fffd4',
  springgreen: '#00ff7f', seagreen: '#2e8b57', forestgreen: '#228b22', darkgreen: '#006400',
  limegreen: '#32cd32', lightgreen: '#90ee90', yellowgreen: '#9acd32', olivedrab: '#6b8e23',
  brown: '#a52a2a', sienna: '#a0522d', chocolate: '#d2691e', peru: '#cd853f', tan: '#d2b48c',
  beige: '#f5f5dc', ivory: '#fffff0', snow: '#fffafa', whitesmoke: '#f5f5f5',
  gainsboro: '#dcdcdc', lightgray: '#d3d3d3', lightgrey: '#d3d3d3', darkgray: '#a9a9a9',
  darkgrey: '#a9a9a9', dimgray: '#696969', dimgrey: '#696969', slategray: '#708090',
  slategrey: '#708090', lightslategray: '#778899', lightslategrey: '#778899',
  darkslategray: '#2f4f4f', darkslategrey: '#2f4f4f', rebeccapurple: '#663399',
  salmon: '#fa8072', lightsalmon: '#ffa07a', darksalmon: '#e9967a', goldenrod: '#daa520',
  darkgoldenrod: '#b8860b', wheat: '#f5deb3', moccasin: '#ffe4b5', navajowhite: '#ffdead',
  slateblue: '#6a5acd', mediumslateblue: '#7b68ee', darkslateblue: '#483d8b',
  blueviolet: '#8a2be2', darkviolet: '#9400d3', darkorchid: '#9932cc', mediumorchid: '#ba55d3',
  mediumpurple: '#9370db', thistle: '#d8bfd8', powderblue: '#b0e0e6', cadetblue: '#5f9ea0',
  darkcyan: '#008b8b', lightcyan: '#e0ffff', paleturquoise: '#afeeee',
  mediumturquoise: '#48d1cc', darkturquoise: '#00ced1', lightseagreen: '#20b2aa',
  mediumseagreen: '#3cb371', palegreen: '#98fb98', darkolivegreen: '#556b2f',
  greenyellow: '#adff2f', chartreuse: '#7fff00', firebrick: '#b22222', indianred: '#cd5c5c',
  rosybrown: '#bc8f8f', lightcoral: '#f08080', darkkhaki: '#bdb76b', sandybrown: '#f4a460',
  burlywood: '#deb887', lightpink: '#ffb6c1', palevioletred: '#db7093',
  mediumvioletred: '#c71585', lightsteelblue: '#b0c4de', lightskyblue: '#87cefa',
  mediumaquamarine: '#66cdaa', darkseagreen: '#8fbc8f', darkmagenta: '#8b008b',
};

interface Rgb {
  r: number;
  g: number;
  b: number;
}

function hexToRgb(hex: string): Rgb | null {
  let h = hex.replace('#', '').toLowerCase();
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  if (h.length === 8) h = h.substring(0, 6);
  if (h.length !== 6 || /[^0-9a-f]/.test(h)) return null;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function rgbToHexStr(rgb: Rgb): string {
  const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = ((h % 360) + 360) % 360 / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0, g = 0, b = 0;
  if (hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = l - c / 2;
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}

/**
 * Parses any CSS color notation into a normalized 6-digit hex.
 * Returns null for non-color paints (none, url(...), unknown keywords).
 */
export function parseCssColor(value: string): string | null {
  const v = value.trim().toLowerCase();
  if (!v || v === 'none' || v === 'transparent' || v === 'inherit' || v.startsWith('url(')) {
    return null;
  }
  if (v.startsWith('#')) {
    const rgb = hexToRgb(v);
    return rgb ? rgbToHexStr(rgb) : null;
  }
  const rgbMatch = v.match(/^rgba?\(\s*(\d+(?:\.\d+)?)\s*[, ]\s*(\d+(?:\.\d+)?)\s*[, ]\s*(\d+(?:\.\d+)?)/);
  if (rgbMatch) {
    return rgbToHexStr({ r: +rgbMatch[1], g: +rgbMatch[2], b: +rgbMatch[3] });
  }
  const hslMatch = v.match(/^hsla?\(\s*(\d+(?:\.\d+)?)\s*[, ]\s*(\d+(?:\.\d+)?)%\s*[, ]\s*(\d+(?:\.\d+)?)%/);
  if (hslMatch) {
    return rgbToHexStr(hslToRgb(+hslMatch[1], +hslMatch[2] / 100, +hslMatch[3] / 100));
  }
  if (NAMED_COLORS[v]) return NAMED_COLORS[v];
  return null;
}

// ─── OKLCH color space (Björn Ottosson's OKLab) ───────────────────────────────

interface Oklch {
  l: number; // 0..1
  c: number; // 0..~0.4
  h: number; // degrees
}

function srgbToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function linearToSrgb(v: number): number {
  const c = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  return c * 255;
}

function rgbToOklch(rgb: Rgb): Oklch {
  const r = srgbToLinear(rgb.r);
  const g = srgbToLinear(rgb.g);
  const b = srgbToLinear(rgb.b);

  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;

  const c = Math.sqrt(a * a + bb * bb);
  const h = (Math.atan2(bb, a) * 180) / Math.PI;
  return { l: L, c, h: h < 0 ? h + 360 : h };
}

function oklchToRgbUnclamped(lch: Oklch): Rgb {
  const hr = (lch.h * Math.PI) / 180;
  const a = lch.c * Math.cos(hr);
  const bb = lch.c * Math.sin(hr);

  const l = Math.pow(lch.l + 0.3963377774 * a + 0.2158037573 * bb, 3);
  const m = Math.pow(lch.l - 0.1055613458 * a - 0.0638541728 * bb, 3);
  const s = Math.pow(lch.l - 0.0894841775 * a - 1.291485548 * bb, 3);

  return {
    r: linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  };
}

/**
 * Converts OKLCH back to sRGB, reducing chroma progressively when the color
 * falls out of gamut (preserves hue and lightness over saturation).
 */
function oklchToHex(lch: Oklch): string {
  let c = lch.c;
  for (let i = 0; i < 12; i++) {
    const rgb = oklchToRgbUnclamped({ ...lch, c });
    const inGamut =
      rgb.r >= -1 && rgb.r <= 256 && rgb.g >= -1 && rgb.g <= 256 && rgb.b >= -1 && rgb.b <= 256;
    if (inGamut) return rgbToHexStr(rgb);
    c *= 0.8;
  }
  return rgbToHexStr(oklchToRgbUnclamped({ ...lch, c: 0 }));
}

// ─── WCAG contrast ────────────────────────────────────────────────────────────

function relativeLuminance(rgb: Rgb): number {
  const lin = (c: number) => srgbToLinear(c);
  return 0.2126 * lin(rgb.r) + 0.7152 * lin(rgb.g) + 0.0722 * lin(rgb.b);
}

function contrastRatio(a: Rgb, b: Rgb): number {
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

function hexContrast(hexA: string, hexB: string): number {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  if (!a || !b) return 21;
  return contrastRatio(a, b);
}

// ─── Deterministic variant transforms ─────────────────────────────────────────

const DARK_BG = '#1a1a2e';
const LIGHT_BG = '#ffffff';
const NEUTRAL_CHROMA_THRESHOLD = 0.04;
const DARK_MIN_CONTRAST = 2.5;

/**
 * Adjusts a color for dark backgrounds: dark neutrals become white; chromatic
 * colors keep hue/chroma and get their lightness raised until readable.
 */
function transformForDarkBg(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const lch = rgbToOklch(rgb);

  if (lch.c < NEUTRAL_CHROMA_THRESHOLD) {
    // Neutral: dark text/outlines flip to white, light neutrals stay visible as-is
    return lch.l < 0.75 ? '#ffffff' : hex;
  }

  let candidate = hex;
  let l = lch.l;
  while (hexContrast(candidate, DARK_BG) < DARK_MIN_CONTRAST && l < 0.95) {
    l += 0.05;
    candidate = oklchToHex({ ...lch, l });
  }
  return candidate;
}

/** Aggressive dark pass used when the QA render still fails */
function transformForDarkBgAggressive(hex: string): string {
  if (hexContrast(hex, DARK_BG) >= 2) return hex;
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const lch = rgbToOklch(rgb);
  return lch.c < NEUTRAL_CHROMA_THRESHOLD ? '#ffffff' : oklchToHex({ ...lch, l: 0.82 });
}

/**
 * Light backgrounds keep the original colors (the logo was designed for them);
 * the aggressive pass only darkens colors that are invisible against white.
 */
function transformForLightBgAggressive(hex: string): string {
  if (hexContrast(hex, LIGHT_BG) >= 1.4) return hex;
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const lch = rgbToOklch(rgb);
  return lch.c < NEUTRAL_CHROMA_THRESHOLD ? '#333333' : oklchToHex({ ...lch, l: 0.45 });
}

/**
 * Monochrome: grayscale from OKLCH lightness, clamped so every element stays
 * visible on the neutral presentation background while preserving the original
 * lightness hierarchy (clamping is monotonic).
 */
function transformMonochrome(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const lch = rgbToOklch(rgb);
  const l = Math.min(0.72, Math.max(0.15, lch.l));
  return oklchToHex({ l, c: 0, h: 0 });
}

function transformMonochromeAggressive(): string {
  return '#404040';
}

// ─── Minimal CSS parser for <style> blocks ────────────────────────────────────

const PAINT_PROPS = ['fill', 'stroke', 'stop-color', 'color'] as const;
type PaintProp = (typeof PAINT_PROPS)[number];

interface CssRule {
  tag?: string;
  className?: string;
  id?: string;
  declarations: Partial<Record<PaintProp, string>>;
}

function parseCssRules(cssText: string): CssRule[] {
  const rules: CssRule[] = [];
  const cleaned = cssText.replace(/\/\*[\s\S]*?\*\//g, '');
  const ruleRegex = /([^{}]+)\{([^{}]*)\}/g;
  let match: RegExpExecArray | null;

  while ((match = ruleRegex.exec(cleaned)) !== null) {
    const declarations: Partial<Record<PaintProp, string>> = {};
    for (const decl of match[2].split(';')) {
      const [prop, ...rest] = decl.split(':');
      const name = prop?.trim().toLowerCase() as PaintProp;
      const value = rest.join(':').trim().replace(/!important/i, '').trim();
      if (name && value && (PAINT_PROPS as readonly string[]).includes(name)) {
        declarations[name] = value;
      }
    }
    if (Object.keys(declarations).length === 0) continue;

    for (const rawSelector of match[1].split(',')) {
      const selector = rawSelector.trim();
      // Only simple selectors — enough for logo SVGs (SVGO strips classes anyway)
      if (selector.startsWith('.')) rules.push({ className: selector.slice(1), declarations });
      else if (selector.startsWith('#')) rules.push({ id: selector.slice(1), declarations });
      else if (/^[a-zA-Z][\w-]*$/.test(selector)) rules.push({ tag: selector.toLowerCase(), declarations });
    }
  }
  return rules;
}

// ─── Inline style helpers ─────────────────────────────────────────────────────

function parseStyleAttr(style: string | undefined): Map<string, string> {
  const map = new Map<string, string>();
  if (!style) return map;
  for (const decl of style.split(';')) {
    const [prop, ...rest] = decl.split(':');
    const name = prop?.trim().toLowerCase();
    const value = rest.join(':').trim();
    if (name && value) map.set(name, value);
  }
  return map;
}

function serializeStyleAttr(map: Map<string, string>): string {
  return Array.from(map.entries())
    .map(([k, v]) => `${k}:${v}`)
    .join(';');
}

// ─── Paint resolution and materialization ─────────────────────────────────────

const SHAPE_TAGS = new Set(['path', 'rect', 'circle', 'ellipse', 'polygon', 'polyline', 'text', 'tspan']);
const STROKE_ONLY_TAGS = new Set(['line']);
const NON_RENDERED_TAGS = new Set(['defs', 'symbol', 'clippath', 'mask', 'marker', 'pattern', 'style', 'metadata', 'title', 'desc']);
const GRADIENT_TAGS = new Set(['lineargradient', 'radialgradient']);

interface PaintContext {
  fill?: string;
  stroke?: string;
  color?: string;
}

/**
 * Resolves the value of a paint property declared directly on a node,
 * honoring CSS cascade order: inline style > CSS rules (#id > .class > tag) > attribute.
 */
function resolveOwnPaint(node: INode, prop: PaintProp, cssRules: CssRule[]): string | undefined {
  const inline = parseStyleAttr(node.attributes.style).get(prop);
  if (inline) return inline;

  const id = node.attributes.id;
  const classes = (node.attributes.class || '').split(/\s+/).filter(Boolean);
  const tag = node.name.toLowerCase();

  let fromTag: string | undefined;
  let fromClass: string | undefined;
  let fromId: string | undefined;
  for (const rule of cssRules) {
    const value = rule.declarations[prop];
    if (!value) continue;
    if (rule.id && rule.id === id) fromId = value;
    else if (rule.className && classes.includes(rule.className)) fromClass = value;
    else if (rule.tag && rule.tag === tag) fromTag = value;
  }
  if (fromId) return fromId;
  if (fromClass) return fromClass;
  if (fromTag) return fromTag;

  return node.attributes[prop];
}

/**
 * Normalizes a raw paint value to something the engine can transform:
 * concrete hex, 'none', or a passthrough (url(...) refs kept verbatim).
 */
function normalizePaint(raw: string | undefined, context: PaintContext): string | undefined {
  if (raw === undefined) return undefined;
  const v = raw.trim();
  if (!v) return undefined;
  const lower = v.toLowerCase();
  if (lower === 'none' || lower === 'transparent') return 'none';
  if (lower === 'inherit') return undefined;
  if (lower.startsWith('url(')) return v;
  if (lower === 'currentcolor') return context.color || '#000000';
  return parseCssColor(v) || v;
}

/**
 * Walks the AST, resolves effective paints and writes them back as inline
 * styles on paintable elements (highest cascade priority, so later color
 * mapping is exhaustive). Also fixes the implicit-black-fill case.
 */
function materializePaints(node: INode, cssRules: CssRule[], context: PaintContext, rendered: boolean): void {
  const tag = node.name.toLowerCase();
  const isRendered = rendered && !NON_RENDERED_TAGS.has(tag);

  const ownColor = normalizePaint(resolveOwnPaint(node, 'color', cssRules), context);
  const nextContext: PaintContext = { ...context };
  if (ownColor && ownColor !== 'none') nextContext.color = ownColor;

  const ownFill = normalizePaint(resolveOwnPaint(node, 'fill', cssRules), nextContext);
  const ownStroke = normalizePaint(resolveOwnPaint(node, 'stroke', cssRules), nextContext);
  if (ownFill !== undefined) nextContext.fill = ownFill;
  if (ownStroke !== undefined) nextContext.stroke = ownStroke;

  if (tag === 'stop') {
    const rawStop = resolveOwnPaint(node, 'stop-color', cssRules);
    const stopColor = normalizePaint(rawStop, nextContext);
    if (stopColor && stopColor !== 'none' && !stopColor.startsWith('url(')) {
      node.attributes['stop-color'] = stopColor;
      const style = parseStyleAttr(node.attributes.style);
      if (style.has('stop-color')) {
        style.set('stop-color', stopColor);
        node.attributes.style = serializeStyleAttr(style);
      }
    }
  } else if (isRendered && (SHAPE_TAGS.has(tag) || STROKE_ONLY_TAGS.has(tag))) {
    const style = parseStyleAttr(node.attributes.style);

    if (!STROKE_ONLY_TAGS.has(tag)) {
      // SVG default fill is black — materialize it so dark-bg variants can flip it
      const effectiveFill = nextContext.fill === undefined ? '#000000' : nextContext.fill;
      style.set('fill', effectiveFill);
    }
    if (nextContext.stroke && nextContext.stroke !== 'none') {
      style.set('stroke', nextContext.stroke);
    }
    if (style.size > 0) {
      node.attributes.style = serializeStyleAttr(style);
    }
  }

  const childRendered = isRendered && !GRADIENT_TAGS.has(tag);
  for (const child of node.children || []) {
    if (typeof child === 'object') {
      materializePaints(child, cssRules, nextContext, childRendered);
    }
  }
}

function collectStyleText(node: INode, acc: string[]): void {
  if (node.name.toLowerCase() === 'style') {
    for (const child of node.children || []) {
      if (typeof child === 'object' && child.type === 'text' && child.value) {
        acc.push(child.value);
      }
    }
  }
  for (const child of node.children || []) {
    if (typeof child === 'object') collectStyleText(child, acc);
  }
}

// ─── Color mapping over a materialized AST ────────────────────────────────────

type ColorTransform = (hex: string) => string;

/**
 * Applies a color transform to every materialized paint slot:
 * inline style fill/stroke and gradient stop-color attributes.
 */
function applyColorTransform(node: INode, transform: ColorTransform): void {
  const style = parseStyleAttr(node.attributes.style);
  let styleChanged = false;
  for (const prop of ['fill', 'stroke', 'stop-color'] as const) {
    const value = style.get(prop);
    if (value) {
      const hex = parseCssColor(value);
      if (hex) {
        style.set(prop, transform(hex));
        styleChanged = true;
      }
    }
  }
  if (styleChanged) {
    node.attributes.style = serializeStyleAttr(style);
  }

  const stopAttr = node.attributes['stop-color'];
  if (stopAttr) {
    const hex = parseCssColor(stopAttr);
    if (hex) node.attributes['stop-color'] = transform(hex);
  }

  for (const child of node.children || []) {
    if (typeof child === 'object') applyColorTransform(child, transform);
  }
}

function cloneNode(node: INode): INode {
  return JSON.parse(JSON.stringify(node));
}

/** Removes <text>/<tspan> elements; returns true when at least one was removed */
function stripTextElements(node: INode): boolean {
  let removed = false;
  if (node.children) {
    const before = node.children.length;
    node.children = node.children.filter(
      (child) => typeof child !== 'object' || !['text', 'tspan'].includes(child.name.toLowerCase())
    );
    removed = node.children.length !== before;
    for (const child of node.children) {
      if (typeof child === 'object' && stripTextElements(child)) removed = true;
    }
  }
  return removed;
}

function hasShapeContent(node: INode): boolean {
  const tag = node.name.toLowerCase();
  if (NON_RENDERED_TAGS.has(tag)) return false;
  if (SHAPE_TAGS.has(tag) || STROKE_ONLY_TAGS.has(tag) || tag === 'image') return true;
  return (node.children || []).some((child) => typeof child === 'object' && hasShapeContent(child));
}

// ─── QA: render and measure visibility ────────────────────────────────────────

const QA_RENDER_SIZE = 96;
const QA_MIN_VISIBLE_FRACTION = 0.5;
const QA_PIXEL_CONTRAST = 1.25;

/**
 * Renders the SVG and measures the fraction of logo pixels that are visible
 * against the target background. Returns 1 (pass) when rendering fails, so a
 * sharp/librsvg hiccup never blocks the import flow.
 */
async function measureVisibleFraction(svg: string, backgroundHex: string): Promise<number> {
  try {
    const bg = hexToRgb(backgroundHex);
    if (!bg) return 1;

    const { data, info } = await sharp(Buffer.from(svg), { density: 96 })
      .resize(QA_RENDER_SIZE, QA_RENDER_SIZE, { fit: 'inside' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    let logoPixels = 0;
    let visiblePixels = 0;

    for (let i = 0; i < data.length; i += info.channels) {
      const alpha = data[i + 3] / 255;
      if (alpha < 0.1) continue;
      logoPixels++;

      // Composite the pixel over the target background before measuring contrast
      const composited: Rgb = {
        r: data[i] * alpha + bg.r * (1 - alpha),
        g: data[i + 1] * alpha + bg.g * (1 - alpha),
        b: data[i + 2] * alpha + bg.b * (1 - alpha),
      };
      if (contrastRatio(composited, bg) >= QA_PIXEL_CONTRAST) {
        visiblePixels++;
      }
    }

    if (logoPixels === 0) return 0;
    return visiblePixels / logoPixels;
  } catch (error) {
    logger.warn(`Logo variation QA render failed (skipping check): ${(error as Error).message}`);
    return 1;
  }
}

// ─── Variant production ───────────────────────────────────────────────────────

interface VariantSpec {
  kind: VariantKind;
  background: string;
  transform: ColorTransform | null;
  aggressive: ColorTransform;
}

const VARIANT_SPECS: VariantSpec[] = [
  {
    kind: 'lightBackground',
    background: LIGHT_BG,
    transform: null, // original colors — the logo was designed for light backgrounds
    aggressive: transformForLightBgAggressive,
  },
  {
    kind: 'darkBackground',
    background: DARK_BG,
    transform: transformForDarkBg,
    aggressive: transformForDarkBgAggressive,
  },
  {
    kind: 'monochrome',
    background: '#f5f5f5',
    transform: transformMonochrome,
    aggressive: transformMonochromeAggressive,
  },
];

async function produceVariant(
  materializedAst: INode,
  spec: VariantSpec,
  aiRecolor?: AiRecolorCallback
): Promise<string> {
  const ast = cloneNode(materializedAst);
  if (spec.transform) {
    applyColorTransform(ast, spec.transform);
  }
  let svg = stringify(ast);

  let visible = await measureVisibleFraction(svg, spec.background);
  if (visible >= QA_MIN_VISIBLE_FRACTION) return svg;

  // Deterministic aggressive retry
  logger.warn(
    `Logo variation QA failed for ${spec.kind} (visible: ${(visible * 100).toFixed(0)}%), applying aggressive pass`
  );
  const aggressiveAst = cloneNode(ast);
  applyColorTransform(aggressiveAst, spec.aggressive);
  const aggressiveSvg = stringify(aggressiveAst);
  const aggressiveVisible = await measureVisibleFraction(aggressiveSvg, spec.background);

  if (aggressiveVisible > visible) {
    svg = aggressiveSvg;
    visible = aggressiveVisible;
  }
  if (visible >= QA_MIN_VISIBLE_FRACTION || !aiRecolor) return svg;

  // Last resort: bounded AI recolor (color mapping only, geometry untouched)
  try {
    logger.warn(`Logo variation ${spec.kind} still failing QA (${(visible * 100).toFixed(0)}%), requesting AI recolor`);
    const mapping = await aiRecolor({
      svg,
      variant: spec.kind,
      background: spec.background,
      issue: `Only ${(visible * 100).toFixed(0)}% of the logo pixels are visible against ${spec.background}`,
    });
    if (mapping && Object.keys(mapping).length > 0) {
      const normalized = new Map<string, string>();
      for (const [from, to] of Object.entries(mapping)) {
        const fromHex = parseCssColor(from);
        const toHex = parseCssColor(to);
        if (fromHex && toHex) normalized.set(fromHex, toHex);
      }
      const aiAst = cloneNode(ast);
      applyColorTransform(aiAst, (hex) => normalized.get(hex) || hex);
      const aiSvg = stringify(aiAst);
      if ((await measureVisibleFraction(aiSvg, spec.background)) > visible) {
        return aiSvg;
      }
    }
  } catch (error) {
    logger.error(`AI recolor fallback failed for ${spec.kind}:`, error);
  }

  return svg;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generates light/dark/monochrome variations from any SVG logo.
 * Deterministic OKLCH transforms + rendered QA, with an optional AI recolor
 * fallback for degenerate cases. Output shape matches the legacy
 * generateLogoVariationsFromSvg contract.
 */
export async function generateLogoVariations(
  svgContent: string,
  options: GenerateVariationsOptions = {}
): Promise<LogoVariationsResult> {
  const ast = await parse(svgContent);

  const styleTexts: string[] = [];
  collectStyleText(ast, styleTexts);
  const cssRules = styleTexts.length > 0 ? parseCssRules(styleTexts.join('\n')) : [];

  materializePaints(ast, cssRules, {}, true);

  const buildSet = async (sourceAst: INode): Promise<LogoVariationSet> => {
    const [lightBackground, darkBackground, monochrome] = await Promise.all(
      VARIANT_SPECS.map((spec) => produceVariant(sourceAst, spec, options.aiRecolor))
    );
    return { lightBackground, darkBackground, monochrome };
  };

  const withText = await buildSet(ast);

  // Icon-only set: strip <text> elements when the remainder still has shapes
  let iconOnly = withText;
  const iconAst = cloneNode(ast);
  if (stripTextElements(iconAst) && hasShapeContent(iconAst)) {
    iconOnly = await buildSet(iconAst);
  }

  return { withText, iconOnly };
}

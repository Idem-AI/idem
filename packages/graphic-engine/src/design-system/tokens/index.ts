/**
 * Les JETONS d'un livrable : tout ce qu'un algorithme peut décider n'est jamais demandé à un modèle.
 *
 * Palette, rampes, encres, échelle typographique, espaces, rayons, filets sont CALCULÉS à partir de la
 * charte réelle du projet, du style de direction artistique et du format. Rien n'est inventé quand la
 * charte existe : les couleurs et les polices viennent du projet ; ce qui est calculé, ce sont les
 * DÉRIVÉES — rampes, encres lisibles, surfaces — c'est-à-dire précisément ce qu'un modèle approxime.
 *
 * Garanties tenues ici, pas espérées : encre principale ≥ 7:1 sur le fond (AAA), encre secondaire
 * ≥ 4,5:1 (AA), encre posée sur la couleur de marque ≥ 4,5:1. Le fond de page reste CLAIR (politique
 * de surface claire d'IDEM) sauf autorisation explicite (`allowDark`).
 */
import type { FormatId } from '../../contracts/common';
import type { Density, RadiusToken, SpaceToken, StrokeToken, TextSizeToken } from '../../contracts/design-spec';
import {
  buildNeutralRamp,
  buildRamp,
  contrastRatio,
  hexToOklch,
  isDark,
  isHex,
  mixHex,
  normalizeHex,
  readableInk,
} from '../../foundation/color';
import { BrandFonts, fontHeadHtml, fontStack, normalizeFamily } from '../../foundation/fonts';
import { stableHash } from '../../foundation/hash';
import { classifyFont, FontClass } from '../../foundation/typeset';
import { FORMATS, FormatDef } from '../formats';
import { STYLE_DATA, StyleData } from './styles.data';

export interface BrandLogos {
  /** Le logo complet de référence. */
  primary?: string;
  /** Déclinaison faite pour un fond CLAIR (encre sombre). */
  onLight?: string;
  /** Déclinaison faite pour un fond SOMBRE (encre claire). */
  onDark?: string;
  mono?: string;
  icon?: string;
  iconOnLight?: string;
  iconOnDark?: string;
  /** Rapport largeur / hauteur du logo complet (sinon estimé à 3). */
  aspect?: number;
}

/** Un motif de la marque, déposé en SVG répétable : tout rendu qui veut un motif prend celui-là. */
export interface BrandPattern {
  url: string;
  /** Côté de la tuile, px. */
  tile: number;
  ground?: string;
  motif?: string;
}

export interface BrandInput {
  name: string;
  palette?: { primary?: string; secondary?: string; accent?: string; background?: string; text?: string };
  fonts?: BrandFonts;
  logos?: BrandLogos;
  patterns?: BrandPattern[];
}

export interface DirectionInput {
  /** Style du catalogue (`swiss`, `editorial`…) : rayon, ratio typographique, espace de choix. */
  styleId?: string;
  /** Densité imposée (sinon celle du style). */
  density?: Density;
  keywords?: string[];
}

export interface TokenInput {
  brand: BrandInput;
  direction?: DirectionInput;
  format: FormatId;
  /** Fond sombre admis : demande explicite, ou la marque fait elle-même des visuels sombres. */
  allowDark?: boolean;
  /** Toile imposée (graphiques autonomes). */
  size?: { width: number; height: number };
}

export interface TokenColors {
  primary: string;
  secondary: string;
  accent: string;
  /** Fond de page. */
  ground: string;
  /** Un bloc posé sur la page se détache d'un cran, jamais d'une ombre. */
  raised: string;
  sunken: string;
  ink: string;
  muted: string;
  /** Encre tertiaire (≥ 3:1) : grands textes et décors seulement. */
  faint: string;
  rule: string;
  ruleStrong: string;
  brandSoft: string;
  accentSoft: string;
  onBrand: string;
  onAccent: string;
  /** Aplat profond, teinté par la marque (bandeaux, panneaux d'inversion). */
  deep: string;
  onDeep: string;
  brandRamp: Record<string, string>;
  accentRamp: Record<string, string>;
  neutral: Record<string, string>;
  /** Fond de page sombre (seulement si admis). */
  dark: boolean;
  /** Une couleur fluo ne porte jamais un texte ni une grande surface. */
  neonPrimary: boolean;
  neonAccent: boolean;
}

export interface DesignTokens {
  hash: string;
  style: StyleData;
  format: FormatDef;
  density: Density;
  color: TokenColors;
  contrast: { inkOnGround: number; mutedOnGround: number; onBrand: number; onAccent: number };
  font: { display: string; body: string; displayStack: string; bodyStack: string; displayClass: FontClass; bodyClass: FontClass; headHtml: string };
  size: Record<TextSizeToken, number>;
  leading: { tight: number; normal: number; loose: number };
  /** En em. */
  tracking: { tight: number; normal: number; wide: number; wider: number };
  space: Record<SpaceToken, number>;
  radius: Record<RadiusToken, number>;
  stroke: Record<StrokeToken, number>;
  brand: { name: string; logos: BrandLogos; patterns: BrandPattern[] };
  allowDark: boolean;
}

const FALLBACK = { primary: '#1f4e5f', secondary: '#4a5a60', accent: '#c6553d' };
export const DEFAULT_STYLE_ID = 'editorial';

export function resolveStyle(styleId?: string | null): StyleData {
  return STYLE_DATA[String(styleId ?? '').trim()] ?? STYLE_DATA[DEFAULT_STYLE_ID];
}

const isNeon = (hex: string): boolean => {
  const o = hexToOklch(hex);
  return Boolean(o && o.c > 0.2 && o.l > 0.72);
};

const SIZE_STEPS: Record<TextSizeToken, number> = { xs: -2, sm: -1, base: 0, lg: 1, xl: 2, '2xl': 3, '3xl': 4, '4xl': 5, '5xl': 6, '6xl': 7 };

/** Une échelle typographique se CALCULE ; ses extrémités sont bornées pour rester lisibles et tenir dans la toile. */
function typeScale(format: FormatDef, ratio: number): Record<TextSizeToken, number> {
  const out = {} as Record<TextSizeToken, number>;
  let previous = 0;
  for (const [step, k] of Object.entries(SIZE_STEPS) as Array<[TextSizeToken, number]>) {
    const raw = format.base * Math.pow(ratio, k);
    let size = Math.round(Math.min(format.maxSize, Math.max(format.minSize, raw)) * 2) / 2;
    // Deux degrés voisins ne sont jamais égaux : une échelle aplatie par la borne garde ses sauts.
    if (size <= previous) size = previous + Math.max(1, Math.round(format.base * 0.12));
    out[step] = size;
    previous = size;
  }
  return out;
}

const SPACE_STEPS: Record<SpaceToken, number> = { none: 0, '2xs': 0.5, xs: 1, sm: 2, md: 3, lg: 5, xl: 8, '2xl': 12, '3xl': 18 };
const DENSITY_FACTOR: Record<Density, number> = { airy: 1.22, balanced: 1, dense: 0.8 };

export function buildTokens(input: TokenInput): DesignTokens {
  const base = FORMATS[input.format];
  const format: FormatDef = input.size
    ? { ...base, width: input.size.width, height: input.size.height, css: { width: `${input.size.width}px`, height: `${input.size.height}px`, padding: base.css.padding } }
    : base;
  const style = resolveStyle(input.direction?.styleId);
  const density: Density = input.direction?.density ?? style.densities[0] ?? 'balanced';
  const palette = input.brand.palette ?? {};
  const allowDark = input.allowDark === true;

  const primary = normalizeHex(isHex(palette.primary) ? palette.primary : FALLBACK.primary);
  const secondary = normalizeHex(isHex(palette.secondary) ? palette.secondary : isHex(palette.primary) ? palette.primary : FALLBACK.secondary);
  const accent = normalizeHex(isHex(palette.accent) ? palette.accent : isHex(palette.secondary) ? palette.secondary : FALLBACK.accent);
  const brandRamp = buildRamp(primary);
  const accentRamp = buildRamp(accent);
  const neutral = buildNeutralRamp(hexToOklch(primary)?.h ?? 220);

  // La CHARTE impose le fond, jamais le style ; et un fond sombre n'est admis que sur demande.
  const background = isHex(palette.background) ? normalizeHex(palette.background) : undefined;
  const dark = Boolean(background && isDark(background) && allowDark);
  const ground = dark ? (background as string) : background && !isDark(background) ? background : neutral['50'];
  const raised = dark ? neutral['900'] : mixHex(ground, neutral['200'], 0.55);
  const sunken = dark ? neutral['950'] : mixHex(ground, neutral['300'], 0.4);

  const textSeed = isHex(palette.text) ? normalizeHex(palette.text) : dark ? neutral['50'] : neutral['950'];
  const ink = readableInk(textSeed, ground, 7);
  const muted = readableInk(dark ? neutral['300'] : neutral['600'], ground, 4.5);
  const faint = readableInk(dark ? neutral['400'] : neutral['500'], ground, 3);
  const deep = brandRamp['900'] ?? neutral['900'];

  const color: TokenColors = {
    primary,
    secondary,
    accent,
    ground,
    raised,
    sunken,
    ink,
    muted,
    faint,
    rule: dark ? neutral['800'] : mixHex(ground, neutral['300'], 0.75),
    ruleStrong: dark ? neutral['600'] : neutral['500'],
    brandSoft: mixHex(ground, primary, dark ? 0.22 : 0.1),
    accentSoft: mixHex(ground, accent, dark ? 0.22 : 0.12),
    onBrand: readableInk(neutral['50'], primary, 4.5),
    onAccent: readableInk(neutral['50'], accent, 4.5),
    deep,
    onDeep: readableInk(neutral['50'], deep, 7),
    brandRamp,
    accentRamp,
    neutral,
    dark,
    neonPrimary: isNeon(primary),
    neonAccent: isNeon(accent),
  };

  const pairing = (style.pairings[0] ?? '').split('+').map((s) => s.trim());
  const display = normalizeFamily(input.brand.fonts?.display) || pairing[0] || 'Archivo';
  const body = normalizeFamily(input.brand.fonts?.body) || normalizeFamily(input.brand.fonts?.display) || pairing[1] || 'IBM Plex Sans';
  const fonts: BrandFonts = { ...input.brand.fonts, display, body };

  // Une échelle plate paraît inachevée (jamais sous 1,25) ; une carte ou une couverture étroite n'a pas besoin de sauts de géant.
  const ratio = Math.max(1.25, format.family === 'card' || input.format === 'cover-linkedin' ? Math.min(style.typeRatio, 1.333) : style.typeRatio);
  const density$ = DENSITY_FACTOR[density];
  const space = {} as Record<SpaceToken, number>;
  for (const [k, m] of Object.entries(SPACE_STEPS) as Array<[SpaceToken, number]>) space[k] = Math.round(format.unit * m * density$ * 2) / 2;

  const r = style.radius * format.scale * 0.6;
  const radius: Record<RadiusToken, number> = { none: 0, sm: Math.round(r * 0.5), md: Math.round(r), lg: Math.round(r * 1.6), pill: style.radius > 0 ? 999 : 0 };
  const stroke: Record<StrokeToken, number> = {
    none: 0,
    hair: Math.max(0.75, Math.round(format.scale * 10) / 10),
    thin: Math.max(1, Math.round(format.scale * 1.5 * 10) / 10),
    thick: Math.max(2, Math.round(format.scale * 4 * 10) / 10),
  };

  const hash = stableHash({
    palette: [primary, secondary, accent, ground, textSeed],
    fonts: [display, body, fonts.displayCss, fonts.bodyCss],
    style: style.id,
    density,
    format: input.format,
    size: input.size,
    allowDark,
  });

  return {
    hash,
    style,
    format,
    density,
    color,
    contrast: {
      inkOnGround: round1(contrastRatio(ink, ground)),
      mutedOnGround: round1(contrastRatio(muted, ground)),
      onBrand: round1(contrastRatio(color.onBrand, primary)),
      onAccent: round1(contrastRatio(color.onAccent, accent)),
    },
    font: {
      display,
      body,
      displayStack: fontStack(display, 'display'),
      bodyStack: fontStack(body, 'body'),
      displayClass: classifyFont(display),
      bodyClass: classifyFont(body),
      headHtml: fontHeadHtml(fonts),
    },
    size: typeScale(format, ratio),
    leading: { tight: 1.06, normal: 1.3, loose: density === 'dense' ? 1.45 : 1.56 },
    tracking: { tight: -0.02, normal: 0, wide: 0.08, wider: 0.18 },
    space,
    radius,
    stroke,
    brand: { name: input.brand.name, logos: input.brand.logos ?? {}, patterns: input.brand.patterns ?? [] },
    allowDark,
  };
}

const round1 = (v: number): number => Math.round(v * 10) / 10;

/** Résumé d'une ligne pour les journaux : les contrastes sont AU-DESSUS des seuils, et cela se lit. */
export function describeTokens(t: DesignTokens): string {
  return (
    `style=${t.style.id} format=${t.format.id} densité=${t.density} fond=${t.color.dark ? 'sombre' : 'clair'} ` +
    `encre ${t.contrast.inkOnGround}:1 · secondaire ${t.contrast.mutedOnGround}:1 · sur marque ${t.contrast.onBrand}:1 · ` +
    `corps ${t.size.base}px, ${t.size.xs}→${t.size['6xl']}px · rayon ${t.radius.md}px · ${t.font.display} / ${t.font.body}`
  );
}

/** Toutes les couleurs que le rendu peut produire : la palette déclarée et ce qui en DÉRIVE. */
export function tokenPalette(t: DesignTokens): string[] {
  const c = t.color;
  return [...new Set([c.primary, c.secondary, c.accent, c.ground, c.raised, c.sunken, c.ink, c.muted, c.faint, c.rule, c.ruleStrong, c.brandSoft, c.accentSoft, c.onBrand, c.onAccent, c.deep, c.onDeep, ...Object.values(c.brandRamp), ...Object.values(c.accentRamp), ...Object.values(c.neutral)])];
}

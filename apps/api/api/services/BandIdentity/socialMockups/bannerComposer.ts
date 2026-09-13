/**
 * Les bannières de réseaux sociaux, composées pour la marque.
 *
 * Une bannière n'est pas une image quelconque recadrée : chaque réseau pose
 * quelque chose DESSUS (l'avatar de la page, en bas à gauche) et en coupe une
 * partie sur mobile. Une bannière composée sans le savoir perd son logo sous
 * l'avatar ou sa promesse dans la marge coupée. La zone sûre de chaque format
 * est donc déclarée ici, et tout ce qui porte du sens y est posé.
 *
 * Trois compositions, tirées par la graine du projet : deux marques ne
 * reçoivent pas la même bannière, une marque régénérée garde la sienne. Toutes
 * sont faites des seuls ingrédients de la charte — palette, polices, logo,
 * motif — et d'une ligne de promesse.
 */

import { contrastRatio } from '../../design/color';
import { brandMotifs, patternCss } from '../../design/brandMotifs';
import { DocumentDesignSystem } from '../../design/documentDesignSystem';
import { CoverFormat } from './library';

export type BannerFormat = CoverFormat | 'thumbnail' | 'post' | 'square';

export interface BannerBrand {
  brandName: string;
  /** Une ligne, huit mots au plus. */
  promise: string;
  ds: DocumentDesignSystem;
  logos: {
    /** Logo complet à encre foncée, pour fond clair. */
    lightGround?: string;
    /** Logo complet à encre claire, pour fond sombre. */
    darkGround?: string;
    iconLightGround?: string;
    iconDarkGround?: string;
  };
  /** Composition retenue (0, 1 ou 2), tirée de la graine du projet. */
  variant: number;
}

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * Zone où poser ce qui porte du sens, en fractions de la bannière.
 *
 * - Facebook : l'avatar mord le bas gauche ; le mobile ne garde que le centre.
 * - LinkedIn et X : le logo ou l'avatar mord le bas gauche sur un quart de la
 *   largeur. Le contenu est donc tenu à droite.
 * - YouTube : la zone lisible sur tous les écrans fait 1 546 px au centre
 *   d'une image de 2 560 px ; le reste n'existe que sur ordinateur.
 */
const SAFE_AREA: Record<BannerFormat, Box> = {
  'facebook-cover': { left: 0.22, top: 0.16, right: 0.86, bottom: 0.8 },
  'linkedin-cover': { left: 0.3, top: 0.16, right: 0.94, bottom: 0.84 },
  'x-header': { left: 0.32, top: 0.16, right: 0.94, bottom: 0.84 },
  'youtube-banner': { left: 0.24, top: 0.14, right: 0.76, bottom: 0.86 },
  thumbnail: { left: 0.07, top: 0.1, right: 0.93, bottom: 0.9 },
  post: { left: 0.08, top: 0.08, right: 0.92, bottom: 0.92 },
  square: { left: 0.08, top: 0.08, right: 0.92, bottom: 0.92 },
};

/** Formats où quelque chose recouvre le bas gauche : le contenu y est aligné à droite. */
const AVATAR_ON_LEFT = new Set<BannerFormat>(['linkedin-cover', 'x-header']);

const esc = (value: string): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const css = (declarations: Record<string, string | number | undefined>): string =>
  Object.entries(declarations)
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([property, value]) => `${property}:${value}`)
    .join(';');

/** Encre lisible sur un fond : blanc s'il atteint 4,5:1, sinon l'encre de la charte. */
function inkOn(ground: string, ds: DocumentDesignSystem): string {
  if (contrastRatio('#ffffff', ground) >= 4.5) return '#ffffff';
  return contrastRatio(ds.colors.ink, ground) >= 4.5 ? ds.colors.ink : '#111111';
}

function isDark(ground: string): boolean {
  return contrastRatio('#ffffff', ground) >= contrastRatio('#111111', ground);
}

/**
 * La plus grande taille de promesse qui tient dans la boîte, en `maxLines`
 * lignes au plus. L'avance moyenne d'un signe de titrage vaut ~0,52 em : on
 * mesure prudemment, un titre un peu petit se voit moins qu'un titre coupé.
 */
function fitPromise(text: string, boxW: number, boxH: number, maxLines: number): number {
  const chars = Math.max(text.trim().length, 1);
  const leading = 1.08;
  let size = Math.floor(boxH / leading);
  while (size > 8) {
    const perLine = Math.max(1, Math.floor(boxW / (size * 0.52)));
    const lines = Math.ceil(chars / perLine);
    if (lines <= maxLines && lines * size * leading <= boxH) break;
    size -= 1;
  }
  return Math.max(8, size);
}

function logoTag(src: string | undefined, maxW: number, maxH: number, extra = ''): string {
  if (!src) return '';
  return `<img src="${esc(src)}" alt="" style="${css({
    'max-width': `${Math.round(maxW)}px`,
    'max-height': `${Math.round(maxH)}px`,
    width: 'auto',
    height: 'auto',
    'object-fit': 'contain',
    display: 'block',
  })};${extra}">`;
}

/**
 * Le HTML d'une bannière, dimensionné à `width` × `height` pixels CSS.
 *
 * Rendu dans le même document que le mockup qui l'accueille : les polices de
 * la marque y sont chargées une fois, et la bannière n'a pas à passer par un
 * PNG intermédiaire.
 */
export function composeBannerHtml(
  brand: BannerBrand,
  format: BannerFormat,
  width: number,
  height: number
): string {
  const { ds } = brand;
  const safe = SAFE_AREA[format];
  const motifs = brandMotifs(ds);
  const display = `'${ds.fonts.display}', sans-serif`;
  const alignRight = AVATAR_ON_LEFT.has(format);
  const W = width;
  const H = height;
  const promise = brand.promise.trim() || brand.brandName;
  // La trame suit la taille de la bannière : 1 à 3 fois celle d'une vignette.
  const trame = Math.max(1, Math.min(3, H / 140));

  const root = (background: string, inner: string) =>
    `<div style="${css({
      position: 'relative',
      width: `${W}px`,
      height: `${H}px`,
      overflow: 'hidden',
      'background-color': background,
    })}">${inner}</div>`;

  const box = (b: Box, inner: string, extra: Record<string, string> = {}) =>
    `<div style="${css({
      position: 'absolute',
      left: `${b.left * W}px`,
      top: `${b.top * H}px`,
      width: `${(b.right - b.left) * W}px`,
      height: `${(b.bottom - b.top) * H}px`,
      display: 'flex',
      'flex-direction': 'column',
      'justify-content': 'center',
      ...extra,
    })}">${inner}</div>`;

  const promiseTag = (text: string, color: string, boxW: number, boxH: number, maxLines: number, align: string) => {
    const size = fitPromise(text, boxW, boxH, maxLines);
    return `<div style="${css({
      'font-family': display,
      'font-size': `${size}px`,
      'font-weight': 600,
      'line-height': 1.08,
      'letter-spacing': '-0.01em',
      color,
      'text-align': align,
      'text-wrap': 'balance',
    })}">${esc(text)}</div>`;
  };

  // ── VIGNETTE DE VIDÉO ET VISUEL DE SECOURS ──────────────────────────────
  if (format === 'thumbnail' || format === 'post' || format === 'square') {
    const ground = ds.colors.primary;
    const ink = inkOn(ground, ds);
    const dark = isDark(ground);
    const motifInk = contrastRatio(ds.colors.accent, ground) >= 1.6 ? ds.colors.accent : ink;
    const corner = Math.min(W, H) * 0.42;
    const inner =
      `<div style="${css({
        position: 'absolute',
        right: '0',
        top: '0',
        width: `${corner}px`,
        height: `${corner}px`,
        ...patternCss(motifs[0], motifInk, ground, trame),
      })}"></div>` +
      box({ ...safe, bottom: safe.top + 0.18 }, logoTag(dark ? brand.logos.darkGround : brand.logos.lightGround, W * 0.34, H * 0.12), { 'justify-content': 'flex-start' }) +
      box({ ...safe, top: format === 'thumbnail' ? 0.44 : 0.5 }, promiseTag(promise, ink, (safe.right - safe.left) * W, (safe.bottom - (format === 'thumbnail' ? 0.44 : 0.5)) * H, 3, 'left'), { 'justify-content': 'flex-end' });
    return root(ground, inner);
  }

  const safeW = (safe.right - safe.left) * W;
  const safeH = (safe.bottom - safe.top) * H;
  const align = alignRight ? 'right' : 'left';
  const cross = alignRight ? 'flex-end' : 'flex-start';

  switch (((brand.variant % 3) + 3) % 3) {
    // ── 0. APLAT SIGNÉ ─────────────────────────────────────────────────────
    // La primaire en surface, le motif de la charte sur la tranche opposée à
    // l'avatar, le logo et la promesse dans la zone sûre.
    case 0: {
      const ground = ds.colors.primary;
      const ink = inkOn(ground, ds);
      const motifInk =
        contrastRatio(ds.colors.accent, ground) >= 1.6 ? ds.colors.accent : ds.colors.secondary;
      const band = format === 'youtube-banner' ? safe.left - 0.02 : Math.min(0.24, 1 - safe.right + 0.1);
      const bands =
        format === 'youtube-banner'
          ? `<div style="${css({ position: 'absolute', left: '0', top: '0', bottom: '0', width: `${band * W}px`, ...patternCss(motifs[0], motifInk, ground, trame) })}"></div>` +
            `<div style="${css({ position: 'absolute', right: '0', top: '0', bottom: '0', width: `${band * W}px`, ...patternCss(motifs[0], motifInk, ground, trame) })}"></div>`
          : `<div style="${css({ position: 'absolute', [alignRight ? 'left' : 'right']: '0', top: '0', bottom: '0', width: `${band * W}px`, ...patternCss(motifs[0], motifInk, ground, trame) })}"></div>`;
      const content: Box = alignRight
        ? { ...safe, left: Math.max(safe.left, band + 0.04) }
        : format === 'youtube-banner'
          ? safe
          : { ...safe, right: Math.min(safe.right, 1 - band - 0.04) };
      const contentW = (content.right - content.left) * W;
      const logo = logoTag(isDark(ground) ? brand.logos.darkGround : brand.logos.lightGround, contentW * 0.46, safeH * 0.3, 'margin-bottom:' + Math.round(safeH * 0.1) + 'px');
      const inner =
        bands +
        box(content, logo + promiseTag(promise, ink, contentW, safeH * 0.52, 2, align), {
          'align-items': cross,
        });
      return root(ground, inner);
    }

    // ── 1. TYPOGRAPHIQUE ───────────────────────────────────────────────────
    // Fond d'encre profonde : la promesse EST la bannière. Le symbole signe,
    // un seul filet d'accent tient la ligne.
    case 1: {
      const ground = ds.colors.neutral['950'] ?? ds.colors.ink;
      const ink = inkOn(ground, ds);
      const rule = `<div style="${css({ width: `${Math.round(safeW * 0.14)}px`, height: `${Math.max(3, Math.round(H * 0.012))}px`, 'background-color': ds.colors.accent, margin: `${Math.round(safeH * 0.08)}px 0` })}"></div>`;
      const mark = logoTag(brand.logos.iconDarkGround || brand.logos.darkGround, safeW * 0.3, safeH * 0.2);
      const inner = box(
        safe,
        promiseTag(promise, ink, safeW, safeH * 0.62, 2, align) + rule + mark,
        { 'align-items': cross }
      );
      return root(ground, inner);
    }

    // ── 2. CHAMP PARTAGÉ ───────────────────────────────────────────────────
    // Deux champs francs : le logo sur le fond clair de la charte, la
    // promesse sur la primaire. La coupure est droite — c'est une grille.
    default: {
      const split = format === 'youtube-banner' ? 0.5 : alignRight ? 0.52 : 0.46;
      const light = ds.colors.surface;
      const strong = ds.colors.primary;
      const strongInk = inkOn(strong, ds);
      const logoField: Box = alignRight
        ? { left: Math.max(safe.left, 0.02), top: safe.top, right: split - 0.04, bottom: safe.bottom }
        : { left: safe.left, top: safe.top, right: split - 0.04, bottom: safe.bottom };
      const textField: Box = { left: split + 0.05, top: safe.top, right: safe.right, bottom: safe.bottom };
      const logoW = (logoField.right - logoField.left) * W;
      const textW = (textField.right - textField.left) * W;
      const inner =
        `<div style="${css({ position: 'absolute', left: `${split * W}px`, top: '0', right: '0', bottom: '0', 'background-color': strong })}"></div>` +
        box(logoField, logoTag(isDark(light) ? brand.logos.darkGround : brand.logos.lightGround, logoW * 0.78, safeH * 0.46), {
          'align-items': alignRight ? 'flex-end' : 'center',
        }) +
        box(textField, promiseTag(promise, strongInk, textW, safeH * 0.7, 3, 'left'), {
          'align-items': 'flex-start',
        });
      return root(light, inner);
    }
  }
}

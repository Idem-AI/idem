/**
 * LES COMPOSITIONS DE BANNIÈRE — dessinées par le code, dans la grammaire du moteur de visuels
 * partagé (`PosterSpec`, classes `.pv/.stack/.fit/.logo`) : c'est ce qui permet à une bannière
 * d'être ajustée AU MILLIMÈTRE et mesurée exactement comme un flyer (`banner.compose.ts`).
 *
 * Règles communes, celles du moteur de visuels :
 *  - la zone sûre du réseau (`spec.safe`) est la seule boîte où poser ce qui porte du sens ;
 *  - une couleur forte au plus, le motif de la marque (`brandMotifs`) comme seul décor ;
 *  - le logo là où il se lit (cartouche clair sinon), jamais avec un halo ;
 *  - aucun fond sombre : la politique de surface claire s'applique aux livrables de charte.
 */
import { contrastRatio } from '../../design/color';
import { brandMotifs, patternCss } from '../../design/brandMotifs';
import type { DocumentDesignSystem } from '../../design/documentDesignSystem';
import { accentOn, isDarkColor, mix } from '../../../../../ivision/core/src/visual/poster/poster.schemes';
import type { PosterSpec } from '../../../../../ivision/core/src/visual/poster/poster.types';
import { safeBoxPx } from './bannerGeometry';

const esc = (t: string): string =>
  String(t ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
const r = Math.round;

/**
 * Luminance relative WCAG (sRGB linéarisée) — LA MÊME formule que `analyzeLogo` (ses `darkPart` /
 * `lightPart` sont calculés ainsi). Les comparer à une luminance naïve (sans linéarisation, comme
 * `0.2126r+0.7152g+0.0722b` directement sur 0–255) donnait un écart de plusieurs dixièmes sur les
 * tons sombres — assez pour juger un logo lisible sur un fond qui l'efface en réalité.
 */
function relativeLuminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface BannerCtx {
  ds: DocumentDesignSystem;
  /** Quelque chose (avatar, bouton) recouvre le bas gauche : le contenu se tient à droite. */
  avatarLeft: boolean;
  promise: string;
}

// ─── Briques ────────────────────────────────────────────────────────────────

/** Une colonne de texte à hauteur fixe : le rendu y ajuste la taille pour que RIEN ne déborde. */
function stack(box: Box, html: string, opts: { align: 'left' | 'center' | 'right'; justify?: 'start' | 'center' | 'end' }): string {
  const items = opts.align === 'right' ? 'flex-end' : opts.align === 'center' ? 'center' : 'flex-start';
  const justify = opts.justify === 'center' ? 'center' : opts.justify === 'end' ? 'flex-end' : 'flex-start';
  return `<div class="stack" data-stack="promise" style="left:${r(box.x)}px;top:${r(box.y)}px;width:${r(box.w)}px;height:${r(box.h)}px;justify-content:${justify};align-items:${items};text-align:${opts.align};gap:${r(box.h * 0.1)}px">${html}</div>`;
}

/** Le texte ajustable (l'élément que `renderPoster` mesure et réduit jusqu'à ce qu'il tienne). */
const fit = (cls: string, min: number, max: number, style: string, html: string) => `<div class="fit ${cls}" data-min="${r(min)}" data-max="${r(max)}" style="font-size:${r(max)}px;${style}">${html}</div>`;


/** La promesse : la seule phrase d'une bannière, jamais coupée, jamais sur plus de deux lignes. */
const promiseText = (spec: PosterSpec, color: string, text: string, max: number) => fit('headline', 3.2 * spec.u, max * spec.u, `color:${color};font-weight:700;line-height:1.1;letter-spacing:-0.01em;text-wrap:balance`, esc(text));

/** Un filet court de la couleur forte : seul ornement admis en dehors du motif. */
const rule = (spec: PosterSpec, color: string, widthU = 8) => `<div class="rule" style="width:${r(widthU * spec.u)}px;height:${r(Math.max(3, 0.7 * spec.u))}px;background:${color}"></div>`;

const block = (box: Box, bg: string, extra = '') => `<div class="blk" style="position:absolute;left:${r(box.x)}px;top:${r(box.y)}px;width:${r(box.w)}px;height:${r(box.h)}px;background:${bg};${extra}"></div>`;

/** Le motif de la marque, posé comme décor — jamais mesuré, jamais signalé (pas de classe `.fit`). */
function motif(ctx: BannerCtx, box: Box, ink: string, ground: string, scale: number, index = 0): string {
  const name = brandMotifs(ctx.ds)[index % brandMotifs(ctx.ds).length];
  const css = Object.entries(patternCss(name, ink, ground, scale))
    .map(([k, v]) => `${k}:${v}`)
    .join(';');
  return `<div style="position:absolute;left:${r(box.x)}px;top:${r(box.y)}px;width:${r(box.w)}px;height:${r(box.h)}px;${css}"></div>`;
}

/**
 * Le logo (ou, à défaut, le nom de la marque dans sa police de titre) : un cartouche clair
 * l'entoure si le fond ne le laisse pas se lire sans halo.
 */
function logoBlock(spec: PosterSpec, box: { x: number; y: number; h: number; anchor: 'left' | 'right' }, bg: string, ink: string): string {
  const h = box.h;
  if (!spec.logo.url) {
    if (!spec.brandName.trim()) return '';
    const size = r(h * 0.6);
    const pos = box.anchor === 'right' ? `right:${r(spec.width - box.x)}px` : `left:${r(box.x)}px`;
    return `<div class="wordmark" style="position:absolute;${pos};top:${r(box.y)}px;height:${r(h)}px;display:flex;align-items:center;font-size:${size}px;font-weight:800;color:${ink}">${esc(spec.brandName)}</div>`;
  }
  const maxW = 30 * spec.u;
  const w = Math.min(maxW, h * spec.logo.aspect);
  const hh = w / spec.logo.aspect;
  // Lisible sans fond propre si une de ses deux encres se détache (≥ 2:1) du fond réel.
  const parts = [spec.logo.darkPart ?? spec.logo.luminance, spec.logo.lightPart ?? spec.logo.luminance];
  const bgLum = relativeLuminance(bg);
  // Les DEUX encres du logo doivent se détacher du fond (pire cas, comme la mesure du moteur) :
  // un logo bicolore dont une seule encre contraste reste à moitié invisible sans cartouche.
  const readable = parts.every((p) => (Math.max(p, bgLum) + 0.05) / (Math.min(p, bgLum) + 0.05) >= 2);
  const pad = readable ? 0 : r(h * 0.3);
  const outerW = w + pad * 2;
  const left = box.anchor === 'right' ? box.x - outerW : box.x;
  const t = spec.logo.trim;
  const viewBox = t ? `object-view-box:inset(${(t.top * 100).toFixed(2)}% ${(t.right * 100).toFixed(2)}% ${(t.bottom * 100).toFixed(2)}% ${(t.left * 100).toFixed(2)}%);` : '';
  const img = `<img class="logo-img" src="${esc(spec.logo.url)}" alt="${esc(spec.brandName)}" style="display:block;width:${r(w)}px;height:${r(hh)}px;object-fit:contain;${viewBox}" />`;
  return readable
    ? `<div class="logo" style="position:absolute;left:${r(left)}px;top:${r(box.y + (h - hh) / 2)}px">${img}</div>`
    : `<div class="logo" style="position:absolute;left:${r(left)}px;top:${r(box.y + (h - hh) / 2 - pad)}px;padding:${pad}px;border-radius:${r(pad * 0.4)}px;background:#ffffff">${img}</div>`;
}

const pvRoot = (spec: PosterSpec, bg: string, body: string) => `<div class="pv" style="width:${spec.width}px;height:${spec.height}px;background:${bg}">${body}</div>`;

// ─── Les compositions ───────────────────────────────────────────────────────

export interface BannerTemplate {
  id: string;
  label: string;
  render: (spec: PosterSpec, ctx: BannerCtx) => string;
}

/** 1 — Aplat signé : la couleur du fond en surface, un bandeau de motif DANS la zone sûre, logo + promesse à côté. */
const flatSigned: BannerTemplate = {
  id: 'flat-signed',
  label: 'Aplat signé',
  render: (spec, ctx) => {
    const safe = safeBoxPx(spec);
    const bg = spec.scheme.bg;
    const ink = spec.scheme.ink;
    const align = ctx.avatarLeft ? 'right' : 'left';
    // Le bandeau vit DANS la zone sûre, du côté opposé au contenu — jamais dans la marge que
    // l'avatar recouvre : une marge « libre » y serait en réalité masquée par lui.
    const bandW = Math.min(safe.w * 0.26, spec.width * 0.18);
    const gap = safe.w * 0.05;
    const bandBox: Box = { x: align === 'right' ? safe.x : safe.x + safe.w - bandW, y: safe.y, w: bandW, h: safe.h };
    const motifLayer = bandW > 4 ? block(bandBox, spec.scheme.panel) + motif(ctx, bandBox, accentOn(spec.scheme.panel, [spec.palette.accent, spec.palette.secondary], spec.scheme.panelInk), spec.scheme.panel, spec.u * 0.22) : '';
    const content: Box = align === 'right' ? { x: safe.x + bandW + gap, y: safe.y, w: safe.w - bandW - gap, h: safe.h } : { x: safe.x, y: safe.y, w: safe.w - bandW - gap, h: safe.h };
    const logoH = Math.min(content.h * 0.34, 9 * spec.u);
    const logo = logoBlock(spec, { x: align === 'right' ? content.x + content.w : content.x, y: content.y, h: logoH, anchor: align === 'right' ? 'right' : 'left' }, bg, ink);
    const textBox: Box = { x: content.x, y: content.y + logoH + content.h * 0.08, w: content.w, h: content.h - logoH - content.h * 0.08 };
    const body = stack(textBox, promiseText(spec, ink, ctx.promise, 7.5), { align, justify: 'end' });
    return pvRoot(spec, bg, motifLayer + logo + body);
  },
};

/** 2 — Champ partagé : un champ clair pour le logo, un aplat de couleur pour la promesse. */
const splitField: BannerTemplate = {
  id: 'split-field',
  label: 'Champ partagé',
  render: (spec, ctx) => {
    const safe = safeBoxPx(spec);
    // Le champ clair est le fond du gabarit choisi ; le champ fort est son panneau — la paire
    // que `buildSchemes` a déjà vérifiée pour se détacher l'une de l'autre, quel que soit le cran.
    // Tout dérive d'UNE SEULE décision (le champ fort à droite ou à gauche) : logo et texte ne
    // peuvent donc jamais se retrouver sur le fond de l'autre.
    const light = spec.scheme.bg;
    const lightInk = spec.scheme.ink;
    const strong = spec.scheme.panel;
    const strongInk = spec.scheme.panelInk;
    const strongOnRight = !ctx.avatarLeft; // avatar à gauche : le texte fort reste du côté libre, à droite.
    const split = spec.width * (strongOnRight ? 0.58 : 0.42);
    const fill: Box = strongOnRight ? { x: split, y: 0, w: spec.width - split, h: spec.height } : { x: 0, y: 0, w: split, h: spec.height };
    const gap = spec.width * 0.03;
    const lightField: Box = strongOnRight ? { x: safe.x, y: safe.y, w: split - gap - safe.x, h: safe.h } : { x: Math.max(safe.x, split + gap), y: safe.y, w: safe.x + safe.w - Math.max(safe.x, split + gap), h: safe.h };
    const strongField: Box = strongOnRight ? { x: Math.max(safe.x, split + gap), y: safe.y, w: safe.x + safe.w - Math.max(safe.x, split + gap), h: safe.h } : { x: safe.x, y: safe.y, w: split - gap - safe.x, h: safe.h };
    const logoH = Math.min(lightField.h * 0.7, 10 * spec.u);
    const logo = logoBlock(spec, { x: lightField.x + lightField.w / 2 - Math.min(14 * spec.u, lightField.w / 2), y: lightField.y + (lightField.h - logoH) / 2, h: logoH, anchor: 'left' }, light, lightInk);
    const body = stack(strongField, promiseText(spec, strongInk, ctx.promise, 6.4), { align: strongOnRight ? 'left' : 'right', justify: 'center' });
    return pvRoot(spec, light, block(fill, strong) + logo + body);
  },
};

/** 3 — Signature centrée : logo et promesse au centre de la zone sûre, texture discrète en fond — le filet pour les formats très étirés. */
const centerLockup: BannerTemplate = {
  id: 'center-lockup',
  label: 'Signature centrée',
  render: (spec, ctx) => {
    const safe = safeBoxPx(spec);
    const bg = spec.scheme.bg;
    const ink = spec.scheme.ink;
    const texture = isDarkColor(bg) ? mix(bg, '#ffffff', 0.05) : mix(bg, ink, 0.045);
    const back = motif(ctx, { x: 0, y: 0, w: spec.width, h: spec.height }, texture, bg, spec.u * 0.26);
    const logoH = Math.min(safe.h * 0.4, 8.5 * spec.u);
    const logo = logoBlock(spec, { x: safe.x + safe.w / 2 - Math.min(13 * spec.u, safe.w / 2), y: safe.y, h: logoH, anchor: 'left' }, bg, ink);
    const textBox: Box = { x: safe.x, y: safe.y + logoH + safe.h * 0.08, w: safe.w, h: safe.h - logoH - safe.h * 0.08 };
    const body = stack(textBox, promiseText(spec, ink, ctx.promise, 6.2), { align: 'center', justify: 'start' });
    return pvRoot(spec, bg, back + logo + body);
  },
};

/** 4 — Motif en champ : le motif de la marque couvre une large part, la promesse sur un cartouche de surface. */
const motifField: BannerTemplate = {
  id: 'motif-field',
  label: 'Motif en champ',
  render: (spec, ctx) => {
    const safe = safeBoxPx(spec);
    const ink = accentOn(spec.scheme.bg, [spec.palette.secondary, spec.palette.accent], spec.scheme.muted);
    const motifW = ctx.avatarLeft ? spec.width * 0.34 : spec.width * 0.36;
    const motifBox: Box = ctx.avatarLeft ? { x: spec.width - motifW, y: 0, w: motifW, h: spec.height } : { x: 0, y: 0, w: motifW, h: spec.height };
    const panelBox: Box = ctx.avatarLeft ? { x: 0, y: 0, w: spec.width - motifW, h: spec.height } : { x: motifW, y: 0, w: spec.width - motifW, h: spec.height };
    const content: Box = { x: Math.max(safe.x, panelBox.x), y: safe.y, w: Math.min(safe.x + safe.w, panelBox.x + panelBox.w) - Math.max(safe.x, panelBox.x), h: safe.h };
    const align = 'left' as const;
    const logoH = Math.min(content.h * 0.32, 8 * spec.u);
    const logo = logoBlock(spec, { x: content.x, y: content.y, h: logoH, anchor: 'left' }, spec.scheme.panel, spec.scheme.panelInk);
    const textBox: Box = { x: content.x, y: content.y + logoH + content.h * 0.08, w: content.w, h: content.h - logoH - content.h * 0.08 };
    const body = stack(textBox, promiseText(spec, spec.scheme.panelInk, ctx.promise, 6.8), { align, justify: 'end' });
    return pvRoot(spec, spec.scheme.panel, block(panelBox, spec.scheme.panel) + block(motifBox, spec.scheme.bg) + motif(ctx, motifBox, ink, spec.scheme.bg, spec.u * 0.3) + logo + body);
  },
};

/** 5 — Filet minimal : fond clair, un seul filet d'accent, logo et promesse — rien d'autre. */
const minimalRule: BannerTemplate = {
  id: 'minimal-rule',
  label: 'Filet minimal',
  render: (spec, ctx) => {
    const safe = safeBoxPx(spec);
    const bg = spec.scheme.bg;
    const ink = spec.scheme.ink;
    const accent = accentOn(bg, [spec.palette.accent, spec.palette.secondary], spec.scheme.accent);
    const align = ctx.avatarLeft ? 'right' : 'left';
    const logoH = Math.min(safe.h * 0.3, 7.5 * spec.u);
    const logo = logoBlock(spec, { x: align === 'right' ? safe.x + safe.w : safe.x, y: safe.y, h: logoH, anchor: align === 'right' ? 'right' : 'left' }, bg, ink);
    const ruleY = safe.y + logoH + safe.h * 0.08;
    const ruleHtml = `<div style="position:absolute;left:${r(align === 'right' ? safe.x + safe.w - 10 * spec.u : safe.x)}px;top:${r(ruleY)}px">${rule(spec, accent, 10)}</div>`;
    const textBox: Box = { x: safe.x, y: ruleY + 1.4 * spec.u, w: safe.w, h: safe.y + safe.h - (ruleY + 1.4 * spec.u) };
    const body = stack(textBox, promiseText(spec, ink, ctx.promise, 7), { align, justify: 'start' });
    return pvRoot(spec, bg, logo + ruleHtml + body);
  },
};

export const BANNER_TEMPLATES: readonly BannerTemplate[] = [flatSigned, splitField, centerLockup, motifField, minimalRule];


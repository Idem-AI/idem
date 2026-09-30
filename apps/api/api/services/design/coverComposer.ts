/**
 * Les couvertures des livrables (charte, business plan, pitch deck),
 * composées par le code.
 *
 * ── POURQUOI ────────────────────────────────────────────────────────────────
 *
 * La couverture était la seule page encore composée en HTML par un modèle qui
 * raisonne : 18 000 à 40 000 tokens, la minute la plus longue de chaque
 * génération, et un résultat inégal (logo oublié, titre qui déborde, contraste
 * douteux). Tout ce qu'elle porte est pourtant déjà connu — nom, logo, palette,
 * polices, motifs, date — sauf deux lignes : le secteur et la promesse. Le
 * modèle n'écrit donc plus que ces deux lignes (`coverBrief.service.ts`) et la
 * page se dessine ici, instantanément, sans rien pouvoir rater.
 *
 * ── COMMENT ─────────────────────────────────────────────────────────────────
 *
 * Quatre compositions, tirées par la graine du document : deux marques ne
 * reçoivent pas la même couverture, une marque régénérée garde la sienne. Le
 * fond de page reste la SURFACE du design system (politique de surface claire)
 * ; la couleur de marque y occupe un champ, jamais toute la page. Toute encre
 * posée sur une couleur est choisie par contraste.
 *
 * Le HTML respecte le contrat de l'éditeur : les textes visibles sont dans des
 * éléments feuilles (h1, p, span), sans script ni gestionnaire d'événement.
 */

import { createHash } from 'crypto';
import { contrastRatio } from './color';
import { brandMotifs, patternCss } from './brandMotifs';
import { DocumentDesignSystem } from './documentDesignSystem';
import { esc, MM_TO_PX, readableOn, style } from './renderKit';
import { PageFormat } from './sectionRenderer';
import { CoverBrief } from './coverBrief.service';

export type CoverDocument = 'brandbook' | 'businessPlan' | 'pitchDeck';

export interface CoverInput {
  brief: CoverBrief;
  brandName: string;
  ds: DocumentDesignSystem;
  page: PageFormat;
  /** Logo complet : encre foncée (fond clair) et encre claire (fond sombre). */
  logos: { lightGround?: string; darkGround?: string };
  /** Nature du document, par exemple « Charte graphique ». */
  documentLabel: string;
  /** Mois et année, par exemple « septembre 2026 ». */
  dateLabel: string;
  /** Mention complémentaire : version, destinataire. */
  detail?: string;
  /** Composition retenue, tirée de la graine du document. */
  variant: number;
}

const DISPLAY_FALLBACK = "'Helvetica Neue', Arial, sans-serif";

/**
 * Composition d'un projet : la même pour ses trois documents (charte, plan,
 * deck), qui forment ainsi une famille ; différente d'un projet à l'autre.
 */
export function coverVariant(projectKey: string): number {
  return createHash('sha256').update(`cover:${projectKey}`).digest().readUInt32BE(0) % 4;
}

/** Mois et année en français : « septembre 2026 ». */
export function coverDateLabel(date = new Date()): string {
  return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

/**
 * La plus grande taille de titre qui tient dans la boîte, en `maxLines` lignes.
 * Avance moyenne d'un signe de titrage ≈ 0,62 em — mesuré sur des polices de
 * titrage larges (Syne) : à 0,56 un nom long passait sur une ligne de trop. Un
 * titre un peu petit se voit moins qu'un titre coupé.
 */
function fitSize(text: string, boxWpx: number, boxHpx: number, maxLines: number, leading: number, max: number): number {
  const chars = Math.max(text.trim().length, 1);
  let size = Math.min(max, Math.floor(boxHpx / leading));
  while (size > 10) {
    const perLine = Math.max(1, Math.floor(boxWpx / (size * 0.62)));
    const lines = Math.ceil(chars / perLine);
    if (lines <= maxLines && lines * size * leading <= boxHpx) break;
    size -= 1;
  }
  return Math.max(10, size);
}

/** Encre d'accent lisible sur le fond donné, sinon l'encre du fond. */
function accentOn(ds: DocumentDesignSystem, ground: string): string {
  for (const candidate of [ds.colors.accent, ds.colors.primary, ds.colors.secondary]) {
    if (candidate && contrastRatio(candidate, ground) >= 3) return candidate;
  }
  return readableOn(ds, ground);
}

function isDark(ground: string): boolean {
  return contrastRatio('#ffffff', ground) >= contrastRatio('#111111', ground);
}

export function composeCover(input: CoverInput): string {
  const { ds, page, brief } = input;
  const Wmm = Number.parseFloat(page.width);
  const Hmm = Number.parseFloat(page.minHeight);
  const pad = Number.parseFloat(page.padding);
  const landscape = page.orientation === 'landscape';
  const px = (mm: number) => mm * MM_TO_PX;
  const display = `'${ds.fonts.display}', ${DISPLAY_FALLBACK}`;
  const body = `'${ds.fonts.body}', ${DISPLAY_FALLBACK}`;
  const surface = ds.colors.surface;
  const motif = brandMotifs(ds)[0];
  const title = input.brandName.trim() || 'Marque';

  // ── Pièces communes ─────────────────────────────────────────────────────
  const logo = (ground: string, maxWmm: number, maxHmm: number, extra: Record<string, string> = {}): string => {
    const src = isDark(ground) ? input.logos.darkGround || input.logos.lightGround : input.logos.lightGround;
    if (!src) return '';
    return `<img src="${esc(src)}" alt="${esc(title)}"${style({
      display: 'block',
      'max-width': `${maxWmm}mm`,
      'max-height': `${maxHmm}mm`,
      width: 'auto',
      height: 'auto',
      'object-fit': 'contain',
      ...extra,
    })}>`;
  };

  const kicker = (color: string, align = 'left'): string =>
    brief.kicker
      ? `<p${style({
          margin: '0',
          'font-family': body,
          'font-size': `${Math.round(ds.typeScale.sm)}px`,
          'font-weight': 600,
          'letter-spacing': '0.16em',
          'text-transform': 'uppercase',
          color,
          'text-align': align,
        })}>${esc(brief.kicker)}</p>`
      : '';

  const heading = (color: string, boxWmm: number, boxHmm: number, maxLines: number, align = 'left'): string => {
    const size = fitSize(title, px(boxWmm), px(boxHmm), maxLines, 1.02, landscape ? 132 : 112);
    return `<h1${style({
      margin: '0',
      'font-family': display,
      'font-size': `${size}px`,
      'font-weight': 700,
      'line-height': 1.02,
      'letter-spacing': '-0.02em',
      color,
      'text-align': align,
      'text-wrap': 'balance',
    })}>${esc(title)}</h1>`;
  };

  /** La promesse, un mot mis en valeur par l'accent quand il se lit. */
  const promise = (color: string, ground: string, boxWmm: number, align = 'left'): string => {
    if (!brief.promise) return '';
    const size = Math.round(
      Math.min(ds.typeScale['2xl'], fitSize(brief.promise, px(boxWmm), px(landscape ? 26 : 34), 3, 1.25, ds.typeScale['2xl']))
    );
    const accent = accentOn(ds, ground);
    let text = esc(brief.promise);
    if (brief.highlight) {
      const word = esc(brief.highlight);
      const at = text.toLowerCase().indexOf(word.toLowerCase());
      if (at >= 0) {
        text = `${text.slice(0, at)}<span${style({ color: accent, 'font-weight': 600 })}>${text.slice(at, at + word.length)}</span>${text.slice(at + word.length)}`;
      }
    }
    return `<p${style({
      margin: '0',
      'max-width': `${boxWmm}mm`,
      'font-family': body,
      'font-size': `${size}px`,
      'line-height': 1.25,
      color,
      'text-align': align,
      'text-wrap': 'pretty',
    })}>${text}</p>`;
  };

  const meta = (color: string, align = 'left'): string => {
    const parts = [input.documentLabel, input.detail, input.dateLabel].filter(Boolean) as string[];
    return `<p${style({
      margin: '0',
      'font-family': body,
      'font-size': `${Math.round(ds.typeScale.xs)}px`,
      'letter-spacing': '0.08em',
      'text-transform': 'uppercase',
      color,
      'text-align': align,
    })}>${parts.map((part) => `<span>${esc(part)}</span>`).join(`<span${style({ margin: '0 0.7em', opacity: 0.6 })}>·</span>`)}</p>`;
  };

  const rule = (color: string, widthMm: number, heightPx = 3): string =>
    `<div${style({ width: `${widthMm}mm`, height: `${heightPx}px`, 'background-color': color })}></div>`;

  const root = (inner: string, ground = surface): string =>
    `<div data-idem-cover="true"${style({
      position: 'relative',
      width: page.width,
      height: page.minHeight,
      'min-height': page.minHeight,
      overflow: 'hidden',
      'box-sizing': 'border-box',
      'background-color': ground,
      color: ds.colors.ink,
      'font-family': body,
    })}>${inner}</div>`;

  const abs = (box: Record<string, string>, inner: string, extra: Record<string, string | number> = {}): string =>
    `<div${style({ position: 'absolute', 'box-sizing': 'border-box', ...box, ...extra })}>${inner}</div>`;

  const ink = ds.colors.ink;
  const muted = ds.colors.inkMuted;

  switch (((input.variant % 4) + 4) % 4) {
    // ── 0. CHAMP ────────────────────────────────────────────────────────
    // La couleur de marque occupe un champ franc, logo et motif dedans ; le
    // titre et la promesse respirent sur la surface.
    case 0: {
      const field = ds.colors.primary;
      const fieldInk = readableOn(ds, field);
      const motifInk = contrastRatio(ds.colors.accent, field) >= 1.6 ? ds.colors.accent : fieldInk;
      if (landscape) {
        const fieldW = Wmm * 0.36;
        const textW = Wmm - fieldW - 2 * pad - 6;
        return root(
          abs({ left: '0', top: '0', bottom: '0', width: `${fieldW}mm` }, '', { 'background-color': field }) +
            abs({ left: '0', bottom: '0', width: `${fieldW}mm`, height: `${Hmm * 0.34}mm` }, '', {
              ...patternCss(motif, motifInk, field, 2),
              opacity: 0.55,
            }) +
            abs({ left: `${pad}mm`, top: `${pad}mm`, width: `${fieldW - 2 * pad}mm` }, logo(field, fieldW - 2 * pad, Hmm * 0.22)) +
            abs(
              { left: `${fieldW + pad + 6}mm`, top: `${pad}mm`, bottom: `${pad}mm`, width: `${textW}mm` },
              `<div${style({ margin: 'auto 0' })}>
                 ${kicker(accentOn(ds, surface))}
                 <div${style({ margin: `${px(4)}px 0 ${px(6)}px` })}>${heading(ink, textW, Hmm * 0.42, 2)}</div>
                 ${promise(muted, surface, textW * 0.92)}
               </div>
               <div>${rule(ds.colors.rule, 24, 1)}<div${style({ height: `${px(3)}px` })}></div>${meta(muted)}</div>`,
              { display: 'flex', 'flex-direction': 'column' }
            )
        );
      }
      const fieldH = Hmm * 0.38;
      const textW = Wmm - 2 * pad;
      return root(
        abs({ left: '0', right: '0', top: '0', height: `${fieldH}mm` }, '', { 'background-color': field }) +
          abs({ right: '0', top: '0', width: `${Wmm * 0.38}mm`, height: `${fieldH}mm` }, '', {
            ...patternCss(motif, motifInk, field, 2),
            opacity: 0.55,
          }) +
          abs({ left: `${pad}mm`, top: `${pad}mm`, width: `${Wmm * 0.5}mm` }, logo(field, Wmm * 0.45, fieldH * 0.4)) +
          abs(
            { left: `${pad}mm`, right: `${pad}mm`, top: `${fieldH + 14}mm`, bottom: `${pad}mm` },
            `<div${style({ margin: 'auto 0' })}>
               ${kicker(accentOn(ds, surface))}
               <div${style({ margin: `${px(4)}px 0 ${px(8)}px` })}>${heading(ink, textW, Hmm * 0.26, 3)}</div>
               ${promise(muted, surface, textW * 0.9)}
             </div>
             <div>${rule(ds.colors.rule, 30, 1)}<div${style({ height: `${px(3)}px` })}></div>${meta(muted)}</div>`,
            { display: 'flex', 'flex-direction': 'column' }
          )
      );
    }

    // ── 1. TYPOGRAPHIQUE ────────────────────────────────────────────────
    // Le nom EST la couverture : très grand, en bas ; un filet d'accent le
    // coiffe ; le motif tient la tranche.
    case 1: {
      const accent = accentOn(ds, surface);
      const strip = landscape ? 12 : 10;
      const textW = Wmm - 2 * pad - strip - 4;
      return root(
        abs({ right: '0', top: '0', bottom: '0', width: `${strip}mm` }, '', patternCss(motif, ds.colors.primary, surface, 1.6)) +
          abs(
            { left: `${pad}mm`, top: `${pad}mm`, right: `${pad + strip}mm` },
            `${logo(surface, landscape ? 46 : 42, landscape ? 16 : 18)}${kicker(muted, 'right')}`,
            { display: 'flex', 'justify-content': 'space-between', 'align-items': 'flex-start', gap: `${px(6)}px` }
          ) +
          abs(
            { left: `${pad}mm`, bottom: `${pad}mm`, width: `${textW}mm` },
            `${rule(accent, 18, 4)}
             <div${style({ margin: `${px(5)}px 0 ${px(6)}px` })}>${heading(ink, textW, Hmm * (landscape ? 0.4 : 0.42), landscape ? 2 : 3)}</div>
             ${promise(muted, surface, textW * (landscape ? 0.62 : 0.9))}
             <div${style({ height: `${px(8)}px` })}></div>${meta(muted)}`
          )
      );
    }

    // ── 2. CADRE ────────────────────────────────────────────────────────
    // Un cadre fin et ses repères d'angle ; tout est centré, comme une page
    // de titre d'ouvrage.
    case 2: {
      const accent = accentOn(ds, surface);
      const inset = pad * 0.6;
      const tick = (pos: Record<string, string>, borders: Record<string, string>) =>
        abs(pos, '', { width: '7mm', height: '7mm', ...borders });
      const line = `2px solid ${accent}`;
      const textW = Wmm - 2 * pad - 20;
      return root(
        abs({ left: `${inset}mm`, right: `${inset}mm`, top: `${inset}mm`, bottom: `${inset}mm` }, '', {
          border: `1px solid ${ds.colors.rule}`,
        }) +
          tick({ left: `${inset}mm`, top: `${inset}mm` }, { 'border-left': line, 'border-top': line }) +
          tick({ right: `${inset}mm`, top: `${inset}mm` }, { 'border-right': line, 'border-top': line }) +
          tick({ left: `${inset}mm`, bottom: `${inset}mm` }, { 'border-left': line, 'border-bottom': line }) +
          tick({ right: `${inset}mm`, bottom: `${inset}mm` }, { 'border-right': line, 'border-bottom': line }) +
          abs(
            { left: `${pad + 10}mm`, right: `${pad + 10}mm`, top: `${pad}mm`, bottom: `${pad + 8}mm` },
            `${logo(surface, landscape ? 40 : 44, landscape ? 18 : 20, { margin: '0 auto' })}
             <div${style({ height: `${px(landscape ? 6 : 12)}px` })}></div>
             ${kicker(accent, 'center')}
             <div${style({ margin: `${px(4)}px 0 ${px(5)}px` })}>${heading(ink, textW, Hmm * (landscape ? 0.3 : 0.2), 2, 'center')}</div>
             <div${style({ display: 'flex', 'justify-content': 'center', margin: `0 0 ${px(5)}px` })}>${rule(accent, 14, 2)}</div>
             ${promise(muted, surface, textW * 0.75, 'center')}`,
            { display: 'flex', 'flex-direction': 'column', 'justify-content': 'center', 'align-items': 'center', 'text-align': 'center' }
          ) +
          abs({ left: `${pad}mm`, right: `${pad}mm`, bottom: `${inset + 4}mm` }, meta(muted, 'center'))
      );
    }

    // ── 3. BANDEAU ──────────────────────────────────────────────────────
    // Un bandeau de marque en tête, motif et logo dedans, la mention du
    // document à droite ; le nom et la promesse dessous.
    default: {
      const band = ds.colors.primary;
      const bandInk = readableOn(ds, band);
      const motifInk = contrastRatio(ds.colors.accent, band) >= 1.6 ? ds.colors.accent : bandInk;
      const bandH = Hmm * (landscape ? 0.34 : 0.26);
      const textW = Wmm - 2 * pad;
      return root(
        abs({ left: '0', right: '0', top: '0', height: `${bandH}mm` }, '', { 'background-color': band }) +
          abs({ left: `${Wmm * 0.55}mm`, right: '0', top: '0', height: `${bandH}mm` }, '', {
            ...patternCss(motif, motifInk, band, 2),
            opacity: 0.5,
          }) +
          abs(
            { left: `${pad}mm`, right: `${pad}mm`, top: '0', height: `${bandH}mm` },
            `${logo(band, Wmm * 0.34, bandH * 0.5)}${meta(bandInk, 'right')}`,
            { display: 'flex', 'justify-content': 'space-between', 'align-items': 'center', gap: `${px(8)}px` }
          ) +
          abs(
            { left: `${pad}mm`, right: `${pad}mm`, top: `${bandH + (landscape ? 8 : 12)}mm`, bottom: `${pad}mm` },
            `${kicker(accentOn(ds, surface))}
             <div${style({ margin: `${px(4)}px 0 ${px(7)}px` })}>${heading(ink, textW, Hmm * (landscape ? 0.26 : 0.34), landscape ? 2 : 3)}</div>
             ${promise(muted, surface, textW * (landscape ? 0.6 : 0.9))}`,
            { display: 'flex', 'flex-direction': 'column', 'justify-content': 'center' }
          )
      );
    }
  }
}

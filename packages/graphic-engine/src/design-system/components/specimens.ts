/**
 * Les SPÉCIMENS de la charte graphique : ils montrent la marque avec ses VALEURS EXACTES, posées par le
 * code (jamais par un modèle) — nuancier, polices, déclinaisons du logo, échelle typographique, motifs,
 * logo expliqué, parti pris, principes de composition, imagerie, règles.
 *
 * Doctrine reprise du moteur précédent : le contraste d'une teinte est CALCULÉ et affiché ; un logo est
 * posé sur le fond qui correspond à sa déclinaison ; une échelle typographique est composée à la taille
 * que chaque degré vaut dans CE document ; un principe de composition est DÉMONTRÉ avant d'être nommé.
 */
import { contrastRatio, mixHex } from '../../foundation/color';
import { appendStyle, css, esc, escAttr, safeUrl } from '../../foundation/html';
import { estimateWidthPx } from '../../foundation/typeset';
import { fontStack } from '../../foundation/fonts';
import type { CompileContext, Env } from '../../html-css-compiler/context';
import { estimateTextHeight } from '../../html-css-compiler/text';
import { box, ink, label, ruleColor, txt } from './kit';
import { registerComponent } from './registry';
import type { ComponentFor } from './types';
import { motifCss } from '../kit/motifs';
import { readableBrand } from '../look';

const MM = 96 / 25.4;
const mmPx = (mm: number, ctx: CompileContext) => Math.round(mm * MM * Math.max(0.6, ctx.tokens.format.scale));

function inkOn(hex: string): { ink: string; ratio: number } {
  const ink = contrastRatio('#ffffff', hex) >= 4.5 ? '#ffffff' : '#000000';
  return { ink, ratio: Math.round(contrastRatio(ink, hex) * 10) / 10 };
}

/** Une hauteur de démonstration : une part de la hauteur disponible, bornée. */
function demoHeight(ctx: CompileContext, env: Env, share: number, minMm: number, maxMm: number): number {
  const available = env.height ?? ctx.tokens.format.height * 0.7;
  return Math.round(Math.max(minMm * MM, Math.min(maxMm * MM * Math.max(1, ctx.tokens.format.scale), available * share)));
}

const contrastLine = (ctx: CompileContext, env: Env, hex: string): string => {
  const { ratio } = inkOn(hex);
  return `<p data-contrast-of="${escAttr(hex)}" style="${css({ margin: 0, 'font-size': ctx.tokens.size.xs, color: ink(ctx, env, 'muted') })}">${ctx.locale.startsWith('fr') ? 'contraste' : 'contrast'} ${String(ratio).replace('.', ctx.locale.startsWith('fr') ? ',' : '.')}:1</p>`;
};

export const swatches: ComponentFor<'swatches'> = registerComponent({
  id: 'ui.swatches',
  kinds: ['swatches'],
  summary: 'Nuancier : pastilles, bande continue ou rangées ; valeur hexadécimale et contraste calculé.',
  variants: { style: ['chips', 'band', 'rows'] },
  defaults: { style: 'chips' },
  estimate(block, ctx, width, variant) {
    if (variant.style === 'rows') return block.items.length * mmPx(15, ctx);
    return mmPx(variant.style === 'band' ? 34 : 26, ctx) + ctx.tokens.size.sm * 4.5;
  },
  render({ block, ctx, env, variant }) {
    const gap = ctx.tokens.space.md;
    const n = block.items.length;
    const radius = ctx.tokens.radius.md;
    const faint = (hex: string) => contrastRatio(hex, env.surface) < 1.3;
    const name = (item: (typeof block.items)[number], w: number) => `${txt(ctx, { ...env, width: w }, 'small', item.name, { weight: 600 })}${txt(ctx, { ...env, width: w }, 'caption', item.role)}${contrastLine(ctx, env, item.hex)}`;
    if (variant.style === 'rows') {
      return `<div>${block.items
        .map((item) => `<div style="${css({ display: 'grid', 'grid-template-columns': `${mmPx(18, ctx)}px minmax(0, 1fr) auto`, 'align-items': 'center', gap, 'border-top': `${ctx.tokens.stroke.hair}px solid ${ruleColor(ctx, env)}`, padding: `${ctx.tokens.space.sm}px 0` })}"><div style="${box({ background: item.hex, height: mmPx(12, ctx), 'border-radius': radius, border: `${ctx.tokens.stroke.hair}px solid ${ruleColor(ctx, env)}` })}"></div><div>${txt(ctx, { ...env, width: env.width * 0.5 }, 'small', item.name, { weight: 600 })}${txt(ctx, { ...env, width: env.width * 0.5 }, 'caption', item.role)}</div><div style="text-align:right;white-space:nowrap">${txt(ctx, env, 'small', item.hex.toUpperCase(), { weight: 700 })}${contrastLine(ctx, env, item.hex)}</div></div>`)
        .join('')}</div>`;
    }
    const w = (env.width - gap * (n - 1)) / n;
    if (variant.style === 'band') {
      const band = block.items.map((item) => `<div style="${box({ background: item.hex, color: inkOn(item.hex).ink, height: mmPx(34, ctx), display: 'flex', 'align-items': 'flex-end', padding: ctx.tokens.space.sm, 'font-size': ctx.tokens.size.xs, 'font-weight': 700, 'box-shadow': faint(item.hex) ? `inset 0 0 0 1px ${ruleColor(ctx, env)}` : undefined })}">${esc(item.hex.toUpperCase())}</div>`).join('');
      return `<div><div style="${css({ display: 'grid', 'grid-template-columns': `repeat(${n}, minmax(0, 1fr))`, 'border-radius': radius, overflow: 'hidden' })}">${band}</div><div style="${css({ display: 'grid', 'grid-template-columns': `repeat(${n}, minmax(0, 1fr))`, gap, 'margin-top': gap })}">${block.items.map((item) => `<div>${name(item, w)}</div>`).join('')}</div></div>`;
    }
    const cells = block.items
      .map((item) => `<div style="${css({ display: 'flex', 'flex-direction': 'column', gap: 4, 'min-width': 0 })}"><div style="${box({ background: item.hex, color: inkOn(item.hex).ink, height: mmPx(26, ctx), 'border-radius': radius, display: 'flex', 'align-items': 'flex-end', padding: ctx.tokens.space.sm, 'font-size': ctx.tokens.size.xs, 'font-weight': 700, border: `${ctx.tokens.stroke.hair}px solid ${ruleColor(ctx, env)}` })}">${esc(item.hex.toUpperCase())}</div>${name(item, w)}</div>`)
      .join('');
    return `<div style="${css({ display: 'grid', 'grid-template-columns': `repeat(${n}, minmax(0, 1fr))`, gap })}">${cells}</div>`;
  },
});

export const typeSpecimen: ComponentFor<'typeSpecimen'> = registerComponent({
  id: 'ui.type-specimen',
  elastic: { minHeight: (block, ctx) => block.specimens.length * (ctx.tokens.size.xl * 1.3 + ctx.tokens.size.sm * 3) },
  kinds: ['typeSpecimen'],
  summary: 'Spécimen typographique composé DANS la police réelle : rôle, famille, échantillon, alphabet.',
  variants: { style: ['stack', 'side'] },
  defaults: { style: 'stack' },
  estimate(block, ctx) {
    return block.specimens.length * (ctx.tokens.size['2xl'] * 1.3 + ctx.tokens.size.sm * 3.4 + ctx.tokens.space.md * 2);
  },
  render({ block, ctx, env, variant }) {
    const side = variant.style === 'side' && block.specimens.length > 1 && env.width > ctx.tokens.size.base * 36;
    const w = side ? (env.width - ctx.tokens.space.xl) / block.specimens.length : env.width;
    // Une page de charte montre la police EN GRAND ; la hauteur disponible et la largeur la bornent.
    const slide = ctx.tokens.format.family === 'slide';
    const target = slide ? ctx.tokens.size['4xl'] : ctx.tokens.size['2xl'];
    const byHeight = env.height ? env.height / ((side ? 1 : block.specimens.length) * 3.4) : target;
    const items = block.specimens.map((s, i) => {
      const family = fontStack(s.family, i === 0 ? 'display' : 'body');
      const big = Math.min(target, byHeight, Math.floor((w * 0.94) / Math.max(1, estimateWidthPx(s.sample, 1))));
      return `<div style="${box({ 'min-width': 0, 'padding-bottom': side || i === block.specimens.length - 1 ? undefined : ctx.tokens.space.md, 'margin-bottom': side || i === block.specimens.length - 1 ? undefined : ctx.tokens.space.md, 'border-bottom': side || i === block.specimens.length - 1 ? undefined : `${ctx.tokens.stroke.hair}px solid ${ruleColor(ctx, env)}` })}">${txt(ctx, { ...env, width: w }, 'label', `${s.role} — ${s.family}`, { ink: 'kicker' })}<p style="${css({ margin: '6px 0 0', 'font-family': family, 'font-size': Math.max(ctx.tokens.size.lg, big), 'line-height': 1.1, color: ink(ctx, env, 'ink') })}">${esc(s.sample)}</p><p aria-hidden="true" style="${css({ margin: '6px 0 0', 'font-family': family, 'font-size': ctx.tokens.size.sm, color: ink(ctx, env, 'muted'), 'letter-spacing': '0.02em', 'overflow-wrap': 'anywhere' })}">ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789</p></div>`;
    });
    return side ? `<div style="${css({ display: 'grid', 'grid-template-columns': `repeat(${block.specimens.length}, minmax(0, 1fr))`, gap: ctx.tokens.space.xl })}">${items.join('')}</div>` : `<div>${items.join('')}</div>`;
  },
});

const LOGO_GROUND = (ctx: CompileContext, bg: 'light' | 'dark' | 'neutral') => (bg === 'dark' ? ctx.tokens.color.neutral['950'] : bg === 'neutral' ? ctx.tokens.color.neutral['200'] : ctx.tokens.color.neutral['50']);

export const logoDisplay: ComponentFor<'logoDisplay'> = registerComponent({
  id: 'ui.logo-display',
  elastic: { minHeight: (block, ctx) => (block.variants.length === 1 ? ctx.tokens.size.base * 12 : ctx.tokens.size.base * 6) + ctx.tokens.size.xs * 2.4 },
  kinds: ['logoDisplay'],
  summary: 'Déclinaisons du logo, chacune sur le fond qui la met en valeur ; une seule déclinaison = vitrine.',
  variants: { style: ['grid', 'row'] },
  defaults: { style: 'grid' },
  estimate(block, ctx, width, variant) {
    const single = block.variants.length === 1;
    return (single ? mmPx(70, ctx) : mmPx(32, ctx)) * (variant.style === 'grid' && block.variants.length > 3 ? 2 : 1) + ctx.tokens.size.xs * 2.4;
  },
  render({ block, ctx, env, variant }) {
    const n = block.variants.length;
    const single = n === 1;
    const cols = single ? 1 : variant.style === 'row' ? n : Math.min(3, n);
    const gap = ctx.tokens.space.md;
    const height = single ? demoHeight(ctx, env, 0.7, 50, 78) : Math.round(Math.min(mmPx(32, ctx), (env.height ?? 9999) / Math.ceil(n / cols) - ctx.tokens.size.xs * 3));
    const cells = block.variants
      .map((v) => {
        const url = safeUrl(v.url);
        return `<figure style="${css({ margin: 0, display: 'flex', 'flex-direction': 'column', gap: 6, 'min-width': 0 })}"><div style="${box({ background: LOGO_GROUND(ctx, v.background), border: `${ctx.tokens.stroke.hair}px solid ${ruleColor(ctx, env)}`, 'border-radius': ctx.tokens.radius.md, height, display: 'flex', 'align-items': 'center', 'justify-content': 'center', padding: gap })}">${url ? `<img src="${escAttr(url)}" alt="${escAttr(`Logo — ${v.label}`)}" style="${css({ 'max-width': single ? '62%' : '82%', 'max-height': single ? '60%' : '72%', width: 'auto', height: 'auto', display: 'block' })}">` : ''}</div><figcaption>${txt(ctx, env, 'caption', v.label)}</figcaption></figure>`;
      })
      .join('');
    return `<div style="${css({ display: 'grid', 'grid-template-columns': `repeat(${cols}, minmax(0, 1fr))`, gap })}">${cells}</div>`;
  },
});

export const typeScale: ComponentFor<'typeScale'> = registerComponent({
  id: 'ui.type-scale',
  kinds: ['typeScale'],
  summary: 'Échelle typographique composée à la taille réelle de chaque degré dans ce document.',
  variants: { style: ['ladder'] },
  defaults: { style: 'ladder' },
  estimate(block, ctx) {
    return block.levels.reduce((h, l) => h + ctx.tokens.size[l.step] * 1.15 + ctx.tokens.size.xs * 2 + ctx.tokens.space.sm * 2, 0);
  },
  render({ block, ctx, env }) {
    const labelW = Math.round(Math.max(mmPx(22, ctx), env.width * 0.16));
    const sampleW = env.width - labelW - ctx.tokens.space.md;
    return `<div>${block.levels
      .map((level) => {
        const size = ctx.tokens.size[level.step];
        // Un échantillon se lit sur UNE ligne : on l'écourte au dernier mot qui tient, sans le rogner.
        let sample = level.sample;
        while (sample.includes(' ') && estimateWidthPx(sample, size, { weight: level.weight }) > sampleW * 0.97) sample = sample.slice(0, sample.lastIndexOf(' '));
        return `<div style="${css({ display: 'grid', 'grid-template-columns': `${labelW}px minmax(0, 1fr)`, gap: ctx.tokens.space.md, 'align-items': 'baseline', padding: `${ctx.tokens.space.xs}px 0`, 'border-bottom': `${ctx.tokens.stroke.hair}px solid ${ruleColor(ctx, env)}` })}"><div>${txt(ctx, { ...env, width: labelW }, 'label', level.label, { ink: 'kicker' })}<p style="${css({ margin: '2px 0 0', 'font-size': ctx.tokens.size.xs, color: ink(ctx, env, 'muted'), 'font-variant-numeric': 'tabular-nums' })}">${Math.round(size)} px / ${level.weight}</p></div><div style="min-width:0"><p style="${css({ margin: 0, 'font-family': fontStack(level.family, 'display'), 'font-size': size, 'font-weight': level.weight, 'line-height': 1.08, color: ink(ctx, env, 'ink'), 'white-space': 'nowrap' })}">${esc(sample)}</p>${level.usage ? txt(ctx, { ...env, width: sampleW }, 'caption', level.usage) : ''}</div></div>`;
      })
      .join('')}</div>`;
  },
});

export const patternGrid: ComponentFor<'patternGrid'> = registerComponent({
  id: 'ui.pattern-grid',
  kinds: ['patternGrid'],
  summary: 'Motifs de la marque : le vrai fichier répétable quand il existe, son nom et son usage.',
  variants: { style: ['tiles'] },
  defaults: { style: 'tiles' },
  estimate(block, ctx) {
    return mmPx(34, ctx) + ctx.tokens.size.sm * 3.2;
  },
  render({ block, ctx, env }) {
    const n = block.patterns.length;
    const cols = Math.min(4, n);
    const gap = ctx.tokens.space.md;
    const h = Math.round(Math.min(mmPx(34, ctx), (env.height ?? 9999) / Math.ceil(n / cols) - ctx.tokens.size.sm * 3.5));
    return `<div style="${css({ display: 'grid', 'grid-template-columns': `repeat(${cols}, minmax(0, 1fr))`, gap })}">${block.patterns
      .map((p) => {
        const url = safeUrl(p.url);
        // Guillemets SIMPLES dans `url(…)` : des guillemets doubles refermeraient l'attribut `style`.
        const fill = url ? { 'background-color': p.ground, 'background-image': `url('${url.replace(/'/g, '%27')}')`, 'background-size': `${p.tile ?? 48}px ${p.tile ?? 48}px` } : motifCss(p.motif, p.ink, p.ground);
        return `<div style="${css({ display: 'flex', 'flex-direction': 'column', gap: 6, 'min-width': 0 })}"><div style="${box({ height: h, 'border-radius': ctx.tokens.radius.md, border: `${ctx.tokens.stroke.hair}px solid ${ruleColor(ctx, env)}`, ...fill })}"></div>${txt(ctx, env, 'small', p.name, { weight: 600 })}${txt(ctx, env, 'caption', p.note)}</div>`;
      })
      .join('')}</div>`;
  },
});

export const logoStory: ComponentFor<'logoStory'> = registerComponent({
  id: 'ui.logo-story',
  elastic: { minHeight: (_block, ctx) => ctx.tokens.size.base * 12 },
  kinds: ['logoStory'],
  summary: 'Le logo et son explication côte à côte : la forme d’abord, sa raison ensuite.',
  variants: { side: ['left', 'right'] },
  defaults: { side: 'left' },
  estimate(block, ctx, width) {
    return Math.max(mmPx(60, ctx), block.points.reduce((h, p) => h + estimateTextHeight(p.text, 'small', ctx, width * 0.45) + ctx.tokens.size.base * 2, 0));
  },
  render({ block, ctx, env, variant }) {
    const landscape = env.width > ctx.tokens.size.base * 36;
    const half = landscape ? (env.width - ctx.tokens.space.xl) / 2 : env.width;
    const panelH = demoHeight(ctx, env, landscape ? 0.82 : 0.4, 40, 96);
    const url = safeUrl(block.url);
    const panel = `<div style="${box({ background: LOGO_GROUND(ctx, block.background), border: `${ctx.tokens.stroke.hair}px solid ${ruleColor(ctx, env)}`, 'border-radius': ctx.tokens.radius.md, height: panelH, display: 'flex', 'align-items': 'center', 'justify-content': 'center', padding: ctx.tokens.space.lg })}">${url ? `<img src="${escAttr(url)}" alt="${escAttr(`Logo — ${block.label}`)}" style="${css({ 'max-width': '78%', 'max-height': '66%', width: 'auto', height: 'auto', display: 'block' })}">` : ''}</div>`;
    const points = block.points
      .slice(0, 5)
      .map((p, i) => `<div style="${css({ padding: `${ctx.tokens.space.sm}px 0`, 'border-top': i ? `${ctx.tokens.stroke.hair}px solid ${ruleColor(ctx, env)}` : undefined })}">${txt(ctx, { ...env, width: half }, 'subtitle', p.label, { size: 'base' })}${txt(ctx, { ...env, width: half }, 'small', p.text, { ink: 'muted' })}</div>`)
      .join('');
    const parts = variant.side === 'right' ? [`<div>${points}</div>`, panel] : [panel, `<div>${points}</div>`];
    return `<div style="${css({ display: 'grid', 'grid-template-columns': landscape ? 'minmax(0, 1fr) minmax(0, 1fr)' : 'minmax(0, 1fr)', gap: ctx.tokens.space.xl, 'align-items': 'center' })}">${parts.join('')}</div>`;
  },
});

export const artDirectionStance: ComponentFor<'artDirectionStance'> = registerComponent({
  id: 'ui.art-direction-stance',
  kinds: ['artDirectionStance'],
  summary: 'Le parti pris : le nom du style en grand, sa raison, son vocabulaire en moodboard typographique.',
  variants: { layout: ['split', 'stacked'] },
  defaults: { layout: 'split' },
  estimate(block, ctx, width) {
    return ctx.tokens.size['4xl'] * 1.2 + estimateTextHeight(block.rationale, 'body', ctx, width * 0.55) + ctx.tokens.size['2xl'] * 2;
  },
  render({ block, ctx, env, variant }) {
    const split = variant.layout !== 'stacked' && env.width > ctx.tokens.size.base * 36;
    const leftW = split ? env.width * 0.56 : env.width;
    const steps: Array<keyof typeof ctx.tokens.size> = ['2xl', 'base', 'xl', 'lg', '2xl', 'sm', 'xl', 'base'];
    const inks = ['heading', 'muted', 'ink'] as const;
    const keywords = block.keywords
      .slice(0, 8)
      .map((k, i) => `<span style="${css({ 'font-family': i % 2 === 0 ? ctx.tokens.font.displayStack : ctx.tokens.font.bodyStack, 'font-size': ctx.tokens.size[steps[i % steps.length]], 'font-weight': i % 2 === 0 ? 600 : 400, 'line-height': 1.1, color: ink(ctx, env, inks[i % inks.length], true) })}">${esc(k)}</span>`)
      .join('');
    const left = `<div>${txt(ctx, { ...env, width: leftW }, 'display', block.styleName, { size: '4xl', maxLines: 2 })}${appendStyle(txt(ctx, { ...env, width: leftW }, 'body', block.rationale), `margin-top:${ctx.tokens.space.md}px;max-width:${Math.round(ctx.tokens.size.base * 40)}px`)}</div>`;
    const right = `<div style="${css({ display: 'flex', 'flex-wrap': 'wrap', 'column-gap': ctx.tokens.space.md, 'row-gap': ctx.tokens.space.sm, 'align-items': 'baseline' })}">${keywords}</div>`;
    return `<div style="${css({ display: 'grid', 'grid-template-columns': split ? '7fr 5fr' : '1fr', gap: ctx.tokens.space.xl, 'align-items': 'center' })}">${left}${right}</div>`;
  },
});

function compositionDemo(demo: 'grid' | 'density' | 'whitespace' | 'signature', density: 'airy' | 'balanced' | 'dense', ctx: CompileContext, env: Env, height: number): string {
  const brand = ctx.tokens.color.neonPrimary ? ctx.tokens.color.deep : ctx.tokens.color.primary;
  const soft = mixHex(env.surface, brand, 0.1);
  const r = ctx.tokens.radius.sm;
  const frame = (inner: string) => `<div aria-hidden="true" style="${box({ position: 'relative', height, 'border-radius': ctx.tokens.radius.md, border: `${ctx.tokens.stroke.hair}px solid ${ruleColor(ctx, env)}`, background: env.surface, overflow: 'hidden' })}">${inner}</div>`;
  const shape = (decl: Record<string, string>) => `<div style="${css({ position: 'absolute', 'border-radius': r, ...decl })}"></div>`;
  switch (demo) {
    case 'grid':
      return frame(`<div style="${css({ position: 'absolute', inset: '10%', display: 'grid', 'grid-template-columns': 'repeat(12, 1fr)', gap: 3 })}">${Array.from({ length: 12 }, () => `<div style="background:${soft}"></div>`).join('')}</div>${shape({ left: '10%', top: '20%', width: '53%', height: '32%', background: brand })}${shape({ right: '10%', top: '58%', width: '28%', height: '22%', background: ctx.tokens.color.accent })}`);
    case 'density': {
      const bars = density === 'airy' ? 3 : density === 'dense' ? 7 : 5;
      const g = density === 'airy' ? 12 : density === 'dense' ? 3 : 6;
      return frame(`<div style="${css({ position: 'absolute', inset: '12%', display: 'flex', 'flex-direction': 'column', gap: `${g}%` })}">${Array.from({ length: bars }, (_, i) => `<div style="${css({ flex: '1', background: i === 0 ? brand : soft, 'border-radius': r, width: `${100 - (i % 3) * 16}%` })}"></div>`).join('')}</div>`);
    }
    case 'whitespace': {
      const share = density === 'airy' ? 0.36 : density === 'dense' ? 0.72 : 0.54;
      return frame(`${shape({ left: '12%', top: '14%', width: `${Math.round(share * 76)}%`, height: `${Math.round(share * 64)}%`, background: brand })}${shape({ left: '12%', top: `${Math.round(14 + share * 64 + 7)}%`, width: `${Math.round(share * 48)}%`, height: '5%', background: ink(ctx, env, 'muted') })}`);
    }
    default:
      return frame(`${shape({ left: '14%', top: '18%', right: '14%', bottom: '18%', border: `2px solid ${brand}` })}${shape({ left: '44%', top: '40%', right: '-6%', height: '28%', background: ctx.tokens.color.accent, 'border-radius': '0' })}`);
  }
}

export const compositionPrinciples: ComponentFor<'compositionPrinciples'> = registerComponent({
  id: 'ui.composition-principles',
  elastic: { minHeight: (_block, ctx) => ctx.tokens.size.base * 12 },
  kinds: ['compositionPrinciples'],
  summary: 'Principes de composition, chacun démontré aux couleurs de la charte avant d’être nommé.',
  variants: { style: ['columns'] },
  defaults: { style: 'columns' },
  estimate(block, ctx) {
    return mmPx(36, ctx) + ctx.tokens.size.base * 7;
  },
  render({ block, ctx, env }) {
    const cols = env.width > ctx.tokens.size.base * 36 ? block.items.length : 2;
    const w = (env.width - ctx.tokens.space.lg * (cols - 1)) / cols;
    const h = demoHeight(ctx, env, 0.36, 22, 46);
    return `<div style="${css({ display: 'grid', 'grid-template-columns': `repeat(${cols}, minmax(0, 1fr))`, gap: ctx.tokens.space.lg })}">${block.items
      .map((item) => `<div style="${css({ display: 'flex', 'flex-direction': 'column', gap: ctx.tokens.space.xs, 'min-width': 0 })}">${compositionDemo(item.demo, block.density, ctx, env, h)}${txt(ctx, { ...env, width: w }, 'subtitle', item.label, { size: 'base' })}${txt(ctx, { ...env, width: w }, 'small', item.text, { ink: 'muted' })}</div>`)
      .join('')}</div>`;
  },
});

const settingRows = (rows: { label: string; value: string }[], ctx: CompileContext, env: Env): string =>
  rows
    .map((row, i) => `<div style="${css({ display: 'grid', 'grid-template-columns': '30% minmax(0, 1fr)', gap: ctx.tokens.space.md, padding: `${ctx.tokens.space.xs}px 0`, 'border-top': i ? `${ctx.tokens.stroke.hair}px solid ${ruleColor(ctx, env)}` : undefined })}">${txt(ctx, { ...env, width: env.width * 0.3 }, 'small', row.label, { weight: 600 })}${txt(ctx, { ...env, width: env.width * 0.66 }, 'small', row.value, { ink: 'muted' })}</div>`)
    .join('');

export const imageryShowcase: ComponentFor<'imageryShowcase'> = registerComponent({
  id: 'ui.imagery-showcase',
  elastic: { minHeight: (block, ctx) => (block.imageUrl ? ctx.tokens.size.base * 12 : block.rows.length * ctx.tokens.size.base * 2.4) },
  kinds: ['imageryShowcase'],
  summary: 'Le traitement de l’image : une photographie d’univers et ses réglages, ligne par ligne.',
  variants: { side: ['left', 'right'] },
  defaults: { side: 'left' },
  estimate(block, ctx) {
    return block.imageUrl ? mmPx(80, ctx) : block.rows.length * ctx.tokens.size.base * 2.6;
  },
  render({ block, ctx, env, variant }) {
    const landscape = env.width > ctx.tokens.size.base * 36;
    const rowsEnv = { ...env, width: landscape && block.imageUrl ? env.width * 0.52 : env.width };
    const rows = `<div>${settingRows(block.rows, ctx, rowsEnv)}</div>`;
    const url = safeUrl(block.imageUrl);
    if (!url) return rows;
    const h = demoHeight(ctx, env, landscape ? 0.82 : 0.4, 50, 110);
    const img = `<img src="${escAttr(url)}" alt="${escAttr(ctx.locale.startsWith('fr') ? 'Photographie d’univers de la marque' : 'Brand imagery')}" style="${css({ width: '100%', height: h, 'object-fit': 'cover', 'border-radius': ctx.tokens.radius.md, display: 'block' })}">`;
    const parts = variant.side === 'right' ? [rows, img] : [img, rows];
    return `<div style="${css({ display: 'grid', 'grid-template-columns': landscape ? (variant.side === 'right' ? '6fr 5fr' : '5fr 6fr') : '1fr', gap: ctx.tokens.space.xl, 'align-items': 'center' })}">${parts.join('')}</div>`;
  },
});

export const artDirectionRules: ComponentFor<'artDirectionRules'> = registerComponent({
  id: 'ui.art-direction-rules',
  kinds: ['artDirectionRules'],
  summary: 'Les leviers de la direction, puis ce qu’on fait (✓) et ce qu’on évite (✕).',
  variants: { layout: ['split', 'stacked'] },
  defaults: { layout: 'split' },
  estimate(block, ctx) {
    return Math.max(block.rows.length, block.dos.length + block.donts.length) * ctx.tokens.size.base * 2.4;
  },
  render({ block, ctx, env, variant }) {
    const split = variant.layout !== 'stacked' && env.width > ctx.tokens.size.base * 36;
    const half = { ...env, width: split ? (env.width - ctx.tokens.space.xl) / 2 : env.width };
    const list = (title: string, items: string[], mark: string, color: string) =>
      items.length
        ? `<div style="${css({ 'margin-bottom': ctx.tokens.space.md })}">${txt(ctx, half, 'subtitle', title, { size: 'base' })}${items
            .slice(0, 5)
            .map((it) => `<div style="${css({ display: 'grid', 'grid-template-columns': '16px minmax(0, 1fr)', gap: 6, 'margin-top': 4 })}"><span aria-hidden="true" style="${css({ color, 'font-weight': 700 })}">${mark}</span>${txt(ctx, { ...half, width: half.width - 22 }, 'small', it)}</div>`)
            .join('')}</div>`
        : '';
    // Le ✓ est un GLYPHE au corps du texte : il garde la teinte d'emphase, portée au contraste d'un texte
    // (4,5:1) — l'encre d'emphase n'en promet que 3:1, celui d'un trait ou d'un grand titre.
    const check = readableBrand(ink(ctx, env, 'emphasis'), env.surface, 4.5);
    const right = `<div>${list(label(ctx, 'do'), block.dos, '✓', check)}${list(label(ctx, 'dont'), block.donts, '✕', ink(ctx, env, 'muted'))}</div>`;
    return `<div style="${css({ display: 'grid', 'grid-template-columns': split ? 'minmax(0, 1fr) minmax(0, 1fr)' : '1fr', gap: ctx.tokens.space.xl, 'align-items': 'start' })}"><div>${settingRows(block.rows, ctx, half)}</div>${right}</div>`;
  },
});

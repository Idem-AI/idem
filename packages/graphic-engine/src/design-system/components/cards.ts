/**
 * Les blocs en CARTES et en GRILLES : cartes, SWOT, persona, matrice des risques, modèle économique.
 *
 * Une grille de cartes identiques est le tic le plus reconnaissable d'une page générée : la carte mise
 * en avant (`emphasis`) change donc de surface, et le style des cartes (contour, aplat, filet, numéro,
 * barre d'accent, texte seul) varie avec la composition.
 */
import { contrastRatio, mixHex, readableInk } from '../../foundation/color';
import { css, esc } from '../../foundation/html';
import { estimateTextHeight } from '../../html-css-compiler/text';
import type { Env } from '../../html-css-compiler/context';
import { box, ink, label, ruleColor, txt } from './kit';
import { registerComponent } from './registry';
import type { ComponentFor } from './types';

function autoColumns(count: number, width: number, base: number): number {
  const min = base * 13;
  const fit = Math.max(1, Math.floor(width / min));
  const wanted = count <= 3 ? count : count === 4 ? (fit >= 4 ? 4 : 2) : count <= 6 ? 3 : 4;
  return Math.max(1, Math.min(wanted, fit));
}

export const cards: ComponentFor<'cards'> = registerComponent({
  id: 'ui.cards',
  kinds: ['cards'],
  summary: 'Cartes : contour, aplat, filet, numérotées, barre d’accent ou texte seul ; une carte mise en avant.',
  variants: { style: ['outline', 'raised', 'ruled', 'numbered', 'accent-bar', 'plain'], cols: [0, 1, 2, 3, 4] },
  defaults: { style: 'raised', cols: 0 },
  estimate(block, ctx, width, variant) {
    const cols = Number(variant.cols) || autoColumns(block.items.length, width, ctx.tokens.size.base);
    const w = (width - ctx.tokens.space.md * (cols - 1)) / cols - ctx.tokens.space.md * 2;
    const rows: number[] = [];
    block.items.forEach((item, i) => {
      const h = estimateTextHeight(item.title, 'subtitle', ctx, w, 'lg') + estimateTextHeight(item.body, 'small', ctx, w) + ctx.tokens.space.md * 3;
      const r = Math.floor(i / cols);
      rows[r] = Math.max(rows[r] ?? 0, h);
    });
    return rows.reduce((a, b) => a + b, 0) + ctx.tokens.space.md * (rows.length - 1);
  },
  render({ block, ctx, env, variant }) {
    const style = String(variant.style);
    const cols = Number(variant.cols) || autoColumns(block.items.length, env.width, ctx.tokens.size.base);
    const gap = ctx.tokens.space.md;
    const w = (env.width - gap * (cols - 1)) / cols;
    const accent = ink(ctx, env, 'emphasis', true);
    const items = block.items
      .map((item, i) => {
        const emph = item.emphasis === true;
        const filled = emph && (style === 'raised' || style === 'outline' || style === 'accent-bar');
        const surface = filled ? (ctx.tokens.color.neonPrimary ? ctx.tokens.color.deep : ctx.tokens.color.primary) : style === 'raised' ? ctx.tokens.color.raised : env.surface;
        const padded = style === 'raised' || style === 'outline' || style === 'accent-bar' || filled;
        const cEnv: Env = { ...env, surface, width: w - (padded ? ctx.tokens.space.md * 2 : 0) };
        const decl: Record<string, string | number | undefined> = {
          background: surface !== env.surface ? surface : undefined,
          padding: padded ? ctx.tokens.space.md : undefined,
          'border-radius': padded ? ctx.tokens.radius.md : undefined,
          border: style === 'outline' && !filled ? `${ctx.tokens.stroke.hair}px solid ${ruleColor(ctx, env, 'strong')}` : undefined,
          'border-top': style === 'ruled' ? `${emph ? ctx.tokens.stroke.thick : ctx.tokens.stroke.thin}px solid ${emph ? accent : ruleColor(ctx, env, 'strong')}` : undefined,
          'padding-top': style === 'ruled' ? ctx.tokens.space.sm : undefined,
          'border-left': style === 'accent-bar' && !filled ? `${ctx.tokens.stroke.thick}px solid ${accent}` : undefined,
        };
        const number = style === 'numbered' ? txt(ctx, cEnv, 'number', String(i + 1).padStart(2, '0'), { size: 'xl', ink: emph ? 'emphasis' : 'faint' }) : '';
        return `<div style="${box({ display: 'flex', 'flex-direction': 'column', gap: ctx.tokens.space.xs, 'min-width': 0, ...decl })}">${number}${txt(ctx, cEnv, 'subtitle', item.title, { size: 'lg' })}${item.body !== item.title ? txt(ctx, cEnv, 'small', item.body, { ink: filled ? 'ink' : 'muted' }) : ''}</div>`;
      })
      .join('');
    return `<div style="${css({ display: 'grid', 'grid-template-columns': `repeat(${cols}, minmax(0, 1fr))`, gap: `${gap}px`, 'align-items': 'stretch' })}">${items}</div>`;
  },
});

const bullets = (items: string[], ctx: Parameters<typeof txt>[0], env: Env, marker: string): string =>
  `<ul style="${css({ margin: 0, padding: 0, 'list-style': 'none', display: 'flex', 'flex-direction': 'column', gap: 4 })}">${items
    .map((it) => `<li style="${css({ display: 'flex', gap: 8, 'align-items': 'baseline' })}"><span aria-hidden="true" style="${css({ width: 5, height: 5, 'border-radius': '50%', background: marker, 'flex-shrink': 0, transform: 'translateY(-2px)' })}"></span>${txt(ctx, { ...env, width: env.width - 14 }, 'small', it)}</li>`)
    .join('')}</ul>`;

export const swot: ComponentFor<'swot'> = registerComponent({
  id: 'ui.swot',
  kinds: ['swot'],
  summary: 'Matrice SWOT en quatre quadrants teintés : forces, faiblesses, opportunités, menaces.',
  variants: { style: ['tinted', 'ruled'] },
  defaults: { style: 'tinted' },
  minWidth: 320,
  estimate(block, ctx, width) {
    const w = width / 2 - ctx.tokens.space.md * 2;
    const q = (list: string[]) => list.reduce((h, it) => h + estimateTextHeight(it, 'small', ctx, w), 0) + ctx.tokens.size.lg * 2.4 + ctx.tokens.space.md * 2;
    return Math.max(q(block.strengths), q(block.weaknesses)) + Math.max(q(block.opportunities), q(block.threats)) + ctx.tokens.space.sm;
  },
  render({ block, ctx, env, variant }) {
    const c = ctx.tokens.color;
    const tinted = variant.style !== 'ruled';
    const quads: Array<{ key: 'strengths' | 'weaknesses' | 'opportunities' | 'threats'; letter: string; surface: string; items: string[] }> = [
      { key: 'strengths', letter: 'S', surface: tinted ? mixHex(env.surface, c.primary, 0.1) : env.surface, items: block.strengths },
      { key: 'weaknesses', letter: 'W', surface: tinted ? c.raised : env.surface, items: block.weaknesses },
      { key: 'opportunities', letter: 'O', surface: tinted ? mixHex(env.surface, c.accent, 0.12) : env.surface, items: block.opportunities },
      { key: 'threats', letter: 'T', surface: tinted ? c.sunken : env.surface, items: block.threats },
    ];
    const w = (env.width - ctx.tokens.space.sm) / 2;
    const cells = quads
      .map((q) => {
        const qEnv: Env = { ...env, surface: q.surface, width: w - ctx.tokens.space.md * 2 };
        const head = `<div style="${css({ display: 'flex', 'align-items': 'baseline', gap: ctx.tokens.space.sm })}">${txt(ctx, qEnv, 'number', q.letter, { size: 'xl', ink: 'emphasis' })}${txt(ctx, qEnv, 'label', label(ctx, q.key), { ink: 'ink' })}</div>`;
        return `<div style="${box({ background: tinted ? q.surface : undefined, padding: ctx.tokens.space.md, 'border-radius': ctx.tokens.radius.md, 'border-top': tinted ? undefined : `${ctx.tokens.stroke.thin}px solid ${ruleColor(ctx, env, 'strong')}`, display: 'flex', 'flex-direction': 'column', gap: ctx.tokens.space.sm })}">${head}${bullets(q.items, ctx, qEnv, ink(ctx, qEnv, 'emphasis', true))}</div>`;
      })
      .join('');
    return `<div style="${css({ display: 'grid', 'grid-template-columns': 'repeat(2, minmax(0, 1fr))', gap: ctx.tokens.space.sm })}">${cells}</div>`;
  },
});

export const persona: ComponentFor<'persona'> = registerComponent({
  id: 'ui.persona',
  kinds: ['persona'],
  summary: 'Persona : identité, profil, besoins et sa phrase, en une fiche.',
  variants: { style: ['card', 'split'] },
  defaults: { style: 'card' },
  estimate(block, ctx, width) {
    return ctx.tokens.size.xl * 2 + (block.traits?.length ?? 0) * ctx.tokens.size.sm * 1.6 + (block.needs?.length ?? 0) * ctx.tokens.size.sm * 2 + (block.quote ? estimateTextHeight(block.quote, 'quote', ctx, width * 0.8) : 0) + ctx.tokens.space.md * 3;
  },
  render({ block, ctx, env, variant }) {
    const surface = ctx.tokens.color.raised;
    const split = variant.style === 'split' && env.width > ctx.tokens.size.base * 30;
    const inner: Env = { ...env, surface, width: (split ? env.width / 2 : env.width) - ctx.tokens.space.md * 2 };
    const initials = block.name
      .split(/\s+/)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
    const disc = Math.round(ctx.tokens.size.base * 3);
    const brand = ctx.tokens.color.neonPrimary ? ctx.tokens.color.deep : ctx.tokens.color.primary;
    const avatar = `<div aria-hidden="true" style="${css({ width: disc, height: disc, 'border-radius': '50%', background: brand, color: readableInk('#ffffff', brand, 4.5), display: 'flex', 'align-items': 'center', 'justify-content': 'center', 'font-weight': 700, 'font-size': Math.round(disc * 0.36), 'flex-shrink': 0 })}">${esc(initials)}</div>`;
    const identity = `<div style="${css({ display: 'flex', gap: ctx.tokens.space.md, 'align-items': 'center' })}">${avatar}<div>${txt(ctx, inner, 'subtitle', block.name, { size: 'lg' })}${txt(ctx, inner, 'caption', block.role)}</div></div>`;
    const traits = block.traits?.length ? `<div>${txt(ctx, inner, 'label', label(ctx, 'traits'), { ink: 'kicker' })}${bullets(block.traits, ctx, inner, ink(ctx, inner, 'emphasis', true))}</div>` : '';
    const needs = block.needs?.length ? `<div>${txt(ctx, inner, 'label', label(ctx, 'needs'), { ink: 'kicker' })}${bullets(block.needs, ctx, inner, ink(ctx, inner, 'emphasis', true))}</div>` : '';
    const quote = block.quote ? `<blockquote style="${css({ margin: 0, 'border-left': `${ctx.tokens.stroke.thick}px solid ${ink(ctx, inner, 'emphasis', true)}`, 'padding-left': ctx.tokens.space.md })}">${txt(ctx, inner, 'quote', `« ${block.quote} »`, { size: 'base' })}</blockquote>` : '';
    const left = `<div style="${css({ display: 'flex', 'flex-direction': 'column', gap: ctx.tokens.space.md })}">${identity}${quote}</div>`;
    const right = `<div style="${css({ display: 'flex', 'flex-direction': 'column', gap: ctx.tokens.space.md })}">${traits}${needs}</div>`;
    return `<div style="${box({ background: surface, padding: ctx.tokens.space.md, 'border-radius': ctx.tokens.radius.md, display: split ? 'grid' : 'flex', 'grid-template-columns': split ? 'repeat(2, minmax(0, 1fr))' : undefined, 'flex-direction': split ? undefined : 'column', gap: ctx.tokens.space.md })}">${left}${right}</div>`;
  },
});

const LEVEL = { low: 0, medium: 1, high: 2 } as const;

export const riskMatrix: ComponentFor<'riskMatrix'> = registerComponent({
  id: 'ui.risk-matrix',
  kinds: ['riskMatrix'],
  summary: 'Matrice des risques probabilité × impact (une teinte qui fonce avec la gravité) et leurs parades.',
  variants: { style: ['matrix', 'list'] },
  defaults: { style: 'matrix' },
  minWidth: 320,
  estimate(block, ctx, width, variant) {
    const list = block.risks.reduce((h, r) => h + estimateTextHeight(`${r.label} ${r.mitigation ?? ''}`, 'small', ctx, variant.style === 'list' ? width : width * 0.5) + 8, 0);
    return variant.style === 'list' ? list : Math.max(list, ctx.tokens.size.base * 14);
  },
  render({ block, ctx, env, variant }) {
    const ramp = ctx.tokens.color.accentRamp;
    const severity = (r: (typeof block.risks)[number]) => LEVEL[r.likelihood] + LEVEL[r.impact];
    const fillFor = (s: number) => [ramp['100'], ramp['200'], ramp['300'], ramp['500'], ramp['700']][s] ?? ramp['500'];
    const list = `<ol style="${css({ margin: 0, padding: 0, 'list-style': 'none', display: 'flex', 'flex-direction': 'column', gap: ctx.tokens.space.sm })}">${block.risks
      .map((r, i) => {
        const fill = fillFor(severity(r));
        const onFill = readableInk(contrastRatio('#ffffff', fill) > contrastRatio('#000000', fill) ? '#ffffff' : '#111111', fill, 4.5);
        const lEnv: Env = { ...env, width: env.width * (variant.style === 'list' ? 0.9 : 0.46) };
        return `<li style="${css({ display: 'flex', gap: ctx.tokens.space.sm, 'align-items': 'flex-start', 'break-inside': 'avoid' })}"><span aria-hidden="true" style="${css({ 'min-width': 22, height: 22, 'border-radius': 4, background: fill, color: onFill, 'font-weight': 700, 'font-size': 11, display: 'flex', 'align-items': 'center', 'justify-content': 'center', 'flex-shrink': 0 })}">${i + 1}</span><div>${txt(ctx, lEnv, 'small', r.label, { weight: 600 })}${r.mitigation ? txt(ctx, lEnv, 'caption', `${label(ctx, 'mitigation')} : ${r.mitigation}`) : ''}</div></li>`;
      })
      .join('')}</ol>`;
    if (variant.style === 'list') return list;
    const cell = Math.round(Math.min(env.width * 0.46, ctx.tokens.size.base * 24) / 3);
    const grid: string[] = [];
    for (let row = 2; row >= 0; row--) {
      for (let col = 0; col <= 2; col++) {
        const here = block.risks.map((r, i) => ({ r, i })).filter(({ r }) => LEVEL[r.impact] === row && LEVEL[r.likelihood] === col);
        const fill = fillFor(row + col);
        const onFill = readableInk(contrastRatio('#ffffff', fill) > contrastRatio('#000000', fill) ? '#ffffff' : '#111111', fill, 4.5);
        grid.push(`<div style="${css({ background: fill, height: cell, display: 'flex', 'flex-wrap': 'wrap', gap: 3, 'align-content': 'center', 'justify-content': 'center', 'border-radius': 3 })}">${here.map(({ i }) => `<span style="${css({ 'font-weight': 700, 'font-size': Math.max(10, Math.round(cell / 4.2)), color: onFill })}">${i + 1}</span>`).join('')}</div>`);
      }
    }
    const axis = (text: string, vertical = false) => `<p style="${css({ margin: 0, 'font-size': ctx.tokens.size.xs, 'text-transform': 'uppercase', 'letter-spacing': '0.08em', color: ink(ctx, env, 'muted'), 'writing-mode': vertical ? 'vertical-rl' : undefined, transform: vertical ? 'rotate(180deg)' : undefined, 'text-align': 'center' })}">${esc(text)}</p>`;
    const matrix = `<div style="${css({ display: 'grid', 'grid-template-columns': `auto ${cell * 3 + 6}px`, gap: 6, 'align-items': 'center' })}">${axis(`${label(ctx, 'impact')} →`, true)}<div style="${css({ display: 'grid', 'grid-template-columns': `repeat(3, ${cell}px)`, gap: 3 })}">${grid.join('')}</div><div></div>${axis(`${label(ctx, 'likelihood')} →`)}</div>`;
    return `<div style="${css({ display: 'flex', gap: ctx.tokens.space.lg, 'align-items': 'flex-start', 'flex-wrap': 'wrap' })}">${matrix}<div style="${css({ flex: '1 1 220px', 'min-width': 0 })}">${list}</div></div>`;
  },
});

const BMC_ORDER = ['partners', 'activities', 'resources', 'value', 'relations', 'channels', 'segments', 'costs', 'revenues'] as const;

export const businessModel: ComponentFor<'businessModel'> = registerComponent({
  id: 'ui.business-model',
  kinds: ['businessModel'],
  summary: 'Modèle économique en canevas (neuf cases) ; en grille simple s’il manque des cases.',
  variants: { style: ['canvas'] },
  defaults: { style: 'canvas' },
  minWidth: 520,
  estimate(block, ctx) {
    return block.cells.length >= 9 ? ctx.tokens.size.base * 30 : Math.ceil(block.cells.length / 3) * ctx.tokens.size.base * 9;
  },
  render({ block, ctx, env }) {
    const byKey = new Map(block.cells.map((c) => [c.key, c.items]));
    const cellHtml = (key: (typeof BMC_ORDER)[number], area: string, width: number, highlight = false) => {
      const items = byKey.get(key) ?? [];
      const surface = highlight ? mixHex(env.surface, ctx.tokens.color.primary, 0.12) : ctx.tokens.color.raised;
      const cEnv: Env = { ...env, surface, width: width - ctx.tokens.space.sm * 2 };
      return `<div style="${box({ 'grid-area': area, background: surface, padding: ctx.tokens.space.sm, 'border-radius': ctx.tokens.radius.sm, display: 'flex', 'flex-direction': 'column', gap: 4, 'min-width': 0 })}">${txt(ctx, cEnv, 'label', label(ctx, key), { ink: highlight ? 'kicker' : 'muted' })}${items.map((it) => txt(ctx, cEnv, 'small', it)).join('')}</div>`;
    };
    if (block.cells.length < 9) {
      const cols = Math.min(3, block.cells.length);
      const w = env.width / cols;
      return `<div style="${css({ display: 'grid', 'grid-template-columns': `repeat(${cols}, minmax(0, 1fr))`, gap: 6 })}">${BMC_ORDER.filter((k) => byKey.has(k))
        .map((k) => cellHtml(k, 'auto', w, k === 'value'))
        .join('')}</div>`;
    }
    const w5 = env.width / 5;
    const areas = `"p a v r s" "p k v c s" "x x x y y"`;
    return `<div style="${css({ display: 'grid', 'grid-template-columns': 'repeat(5, minmax(0, 1fr))', 'grid-template-rows': 'auto auto auto', 'grid-template-areas': areas, gap: 6 })}">${[
      cellHtml('partners', 'p', w5),
      cellHtml('activities', 'a', w5),
      cellHtml('resources', 'k', w5),
      cellHtml('value', 'v', w5, true),
      cellHtml('relations', 'r', w5),
      cellHtml('channels', 'c', w5),
      cellHtml('segments', 's', w5),
      cellHtml('costs', 'x', w5 * 3),
      cellHtml('revenues', 'y', w5 * 2),
    ].join('')}</div>`;
  },
});

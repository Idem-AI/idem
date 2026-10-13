/**
 * Les blocs de TEXTE : texte courant, citation, hypothèse, sources, texte d'un visuel, figure.
 *
 * Le texte courant n'est jamais un bloc insécable : le paginateur le coupe entre deux paragraphes (ou
 * dans un paragraphe long). Tout le reste se garde d'un seul tenant.
 */
import { mixHex } from '../../foundation/color';
import { appendStyle, css, esc, escAttr, safeUrl } from '../../foundation/html';
import { estimateLines } from '../../foundation/typeset';
import { inkHex } from '../../html-css-compiler/context';
import { estimateTextHeight } from '../../html-css-compiler/text';
import { box, ink, label, px, ruleColor, txt } from './kit';
import { registerComponent } from './registry';
import type { ComponentFor } from './types';

/** Hauteur d'un texte courant estimée par simulation de remplissage (px). */
function proseHeight(text: string, ctx: Parameters<ComponentFor<'prose'>['estimate']>[1], width: number, size = ctx.tokens.size.base): number {
  const lines = estimateLines(text, width, size, { font: ctx.tokens.font.bodyClass });
  return lines * size * ctx.tokens.leading.loose;
}

export const prose: ComponentFor<'prose'> = registerComponent({
  id: 'ui.prose',
  kinds: ['prose'],
  summary: 'Texte courant : paragraphes, premier paragraphe en exergue, lettrine, une ou deux colonnes.',
  variants: { lead: [false, true], dropcap: [false, true], columns: [1, 2], measure: ['full', 'readable'] },
  defaults: { lead: false, dropcap: false, columns: 1, measure: 'readable' },
  estimate(block, ctx, width, variant) {
    const columns = Number(variant.columns) === 2 && width > 460 ? 2 : 1;
    const w = columns === 2 ? (width - ctx.tokens.space.lg) / 2 : Math.min(width, variant.measure === 'readable' ? ctx.tokens.size.base * 38 : width);
    const gap = ctx.tokens.size.base * 0.75;
    const total = block.paragraphs.reduce((h, p, i) => h + proseHeight(p, ctx, w, i === 0 && variant.lead ? ctx.tokens.size.lg : ctx.tokens.size.base) + (i ? gap : 0), 0);
    return columns === 2 ? total / 2 + ctx.tokens.size.base * 2 : total;
  },
  atomic: (_block, variant) => Number(variant.columns) === 2,
  render({ block, ctx, env, variant }) {
    const columns = Number(variant.columns) === 2 && env.width > 460 && block.paragraphs.join(' ').length > 700 ? 2 : 1;
    const measure = variant.measure === 'readable' && columns === 1 ? `${Math.round(ctx.tokens.size.base * 38)}px` : undefined;
    const gap = Math.round(ctx.tokens.size.base * 0.75);
    const paragraphs = block.paragraphs.map((p, i) => {
      const lead = i === 0 && variant.lead === true;
      let html = txt(ctx, env, lead ? 'lede' : 'body', p, lead ? { ink: 'ink' } : {});
      if (i === 0 && variant.dropcap === true && !lead && /^[\p{L}]/u.test(p)) {
        // La lettrine : la première lettre sur trois lignes, à la couleur d'emphase.
        const size = Math.round(px(ctx, 'base') * ctx.tokens.leading.loose * 2.6);
        html = html.replace(/>(\p{L})/u, (_m, letter: string) => `><span style="${css({ float: 'left', 'font-family': ctx.tokens.font.displayStack, 'font-size': size, 'line-height': 0.86, 'font-weight': 700, color: ink(ctx, env, 'emphasis', true), margin: `4px ${Math.round(size * 0.12)}px 0 0` })}">${letter}</span>`);
      }
      return i ? appendStyle(html, `margin-top:${gap}px`) : html;
    });
    const style = css({ 'max-width': measure, 'column-count': columns === 2 ? 2 : undefined, 'column-gap': columns === 2 ? ctx.tokens.space.lg : undefined });
    return `<div style="${style}">${paragraphs.join('')}</div>`;
  },
});

export const quote: ComponentFor<'quote'> = registerComponent({
  id: 'ui.quote',
  kinds: ['quote'],
  summary: 'Citation : grand guillemet, filet d’emphase, encadré ou centrée.',
  variants: { style: ['pull', 'bar', 'boxed', 'centered'] },
  defaults: { style: 'bar' },
  estimate(block, ctx, width) {
    return estimateTextHeight(block.text, 'quote', ctx, width * 0.9) + (block.attribution ? ctx.tokens.size.sm * 2 : 0) + ctx.tokens.space.lg * 2;
  },
  render({ block, ctx, env, variant }) {
    const style = String(variant.style);
    const panel = style === 'boxed' ? ctx.look.panel : env.surface;
    const inner = { ...env, surface: panel, width: env.width - (style === 'boxed' ? ctx.tokens.space.lg * 2 : style === 'bar' ? ctx.tokens.space.md * 2 : 0) };
    const attribution = block.attribution ? txt(ctx, inner, 'caption', `— ${block.attribution}`, { weight: 600, ink: 'muted' }) : '';
    const body = txt(ctx, inner, 'quote', block.text, { align: style === 'centered' ? 'center' : undefined });
    const mark = style === 'pull' || style === 'centered' ? `<p aria-hidden="true" style="${css({ margin: 0, 'font-family': ctx.tokens.font.displayStack, 'font-size': Math.round(px(ctx, '3xl') * 1.4), 'line-height': 0.7, height: Math.round(px(ctx, '3xl') * 0.62), color: ink(ctx, inner, 'emphasis', true), 'text-align': style === 'centered' ? 'center' : undefined })}">“</p>` : '';
    const decl =
      style === 'bar'
        ? { 'border-left': `${ctx.tokens.stroke.thick}px solid ${ink(ctx, env, 'emphasis', true)}`, 'padding-left': ctx.tokens.space.md * 2 }
        : style === 'boxed'
          ? { background: panel, padding: ctx.tokens.space.lg, 'border-radius': ctx.tokens.radius.md }
          : { 'text-align': style === 'centered' ? 'center' : undefined, padding: `${ctx.tokens.space.sm}px 0` };
    return `<figure style="${box({ margin: 0, display: 'flex', 'flex-direction': 'column', gap: ctx.tokens.space.sm, ...decl })}">${mark}<blockquote style="margin:0">${body}</blockquote>${attribution ? `<figcaption>${attribution}</figcaption>` : ''}</figure>`;
  },
});

export const assumption: ComponentFor<'assumption'> = registerComponent({
  id: 'ui.assumption',
  kinds: ['assumption'],
  summary: 'Hypothèse explicite : ce que le plan suppose, et sur quoi il s’appuie.',
  variants: { style: ['callout', 'ruled'] },
  defaults: { style: 'callout' },
  estimate(block, ctx, width) {
    return estimateTextHeight(block.statement, 'subtitle', ctx, width - 40, 'base') + estimateTextHeight(block.basis, 'small', ctx, width - 40) + ctx.tokens.space.md * 4;
  },
  render({ block, ctx, env, variant }) {
    const callout = variant.style !== 'ruled';
    const surface = callout ? ctx.look.panel : env.surface;
    const inner = { ...env, surface, width: env.width - ctx.tokens.space.md * 2 };
    const content = [
      txt(ctx, inner, 'label', label(ctx, 'assumption'), { ink: 'kicker' }),
      txt(ctx, inner, 'subtitle', block.statement, { size: 'base', weight: 600 }),
      `<div style="${css({ display: 'flex', gap: ctx.tokens.space.xs, 'align-items': 'baseline' })}">${txt(ctx, inner, 'caption', `${label(ctx, 'basis')} :`, { weight: 600 })}${txt(ctx, inner, 'small', block.basis, { ink: 'muted' })}</div>`,
    ].join('');
    const decl = callout
      ? { background: surface, padding: `${ctx.tokens.space.md}px ${ctx.tokens.space.md}px`, 'border-left': `${ctx.tokens.stroke.thick}px solid ${ink(ctx, env, 'emphasis', true)}`, 'border-radius': ctx.tokens.radius.sm }
      : { 'border-top': `${ctx.tokens.stroke.thin}px solid ${ruleColor(ctx, env, 'strong')}`, 'padding-top': ctx.tokens.space.sm };
    return `<aside style="${box({ display: 'flex', 'flex-direction': 'column', gap: ctx.tokens.space.xs, ...decl })}">${content}</aside>`;
  },
});

export const sources: ComponentFor<'sources'> = registerComponent({
  id: 'ui.sources',
  kinds: ['sources'],
  summary: 'Références numérotées d’une section sourcée (titre, domaine, à quoi la source a servi).',
  variants: { columns: [1, 2] },
  defaults: { columns: 1 },
  estimate(block, ctx) {
    return block.items.length * (ctx.tokens.size.sm * 1.5 + (ctx.tokens.size.xs * 1.4)) + ctx.tokens.size.sm * 2;
  },
  atomic: () => false,
  render({ block, ctx, env, variant }) {
    const columns = Number(variant.columns) === 2 && env.width > 520 ? 2 : 1;
    const itemEnv = { ...env, width: columns === 2 ? env.width / 2 - ctx.tokens.space.md : env.width };
    const items = block.items
      .map((item) => {
        const head = `<span style="${css({ 'font-variant-numeric': 'tabular-nums', 'font-weight': 600, color: ink(ctx, env, 'emphasis'), 'min-width': '2.2em', display: 'inline-block' })}">[${item.index}]</span>`;
        const title = `<a href="${escAttr(item.url)}" style="${css({ color: inkHex('ink', ctx, env.surface), 'text-decoration': 'none', 'font-weight': 500 })}">${esc(item.title)}</a>`;
        const domain = item.domain ? ` <span style="${css({ color: ink(ctx, env, 'muted') })}">· ${esc(item.domain)}</span>` : '';
        const desc = item.description ? txt(ctx, itemEnv, 'caption', item.description, { ink: 'muted' }) : '';
        return `<li style="${css({ 'break-inside': 'avoid', 'margin-bottom': ctx.tokens.space.xs, 'font-size': ctx.tokens.size.sm, 'line-height': 1.4, 'padding-left': '2.2em', 'text-indent': '-2.2em' })}">${head}${title}${domain}${desc ? `<div style="text-indent:0">${desc}</div>` : ''}</li>`;
      })
      .join('');
    const heading = block.label ? txt(ctx, env, 'label', block.label, { ink: 'kicker' }) : '';
    return `<div>${heading}<ol style="${css({ margin: heading ? `${ctx.tokens.space.xs}px 0 0` : 0, padding: 0, 'list-style': 'none', 'column-count': columns === 2 ? 2 : undefined, 'column-gap': ctx.tokens.space.lg })}">${items}</ol></div>`;
  },
});

export const copy: ComponentFor<'copy'> = registerComponent({
  id: 'ui.copy',
  kinds: ['copy'],
  summary: 'Texte d’un visuel en flux : sur-titre, titre, sous-titre, offre, faits, citation.',
  variants: { align: ['start', 'center'] },
  defaults: { align: 'start' },
  estimate(block, ctx, width) {
    return estimateTextHeight(block.headline, 'title', ctx, width) + (block.subhead ? estimateTextHeight(block.subhead, 'lede', ctx, width) : 0) + (block.body ? estimateTextHeight(block.body, 'body', ctx, width) : 0) + ctx.tokens.space.md * 3;
  },
  render({ block, ctx, env, variant }) {
    const align = variant.align === 'center' ? 'center' : undefined;
    const facts = (block.facts ?? []).map((f) => txt(ctx, env, 'label', f.label ? `${f.label} · ${f.text}` : f.text, { ink: 'ink', align })).join('');
    return `<div style="${css({ display: 'flex', 'flex-direction': 'column', gap: ctx.tokens.space.sm, 'align-items': align === 'center' ? 'center' : undefined })}">${[
      txt(ctx, env, 'kicker', block.kicker, { align }),
      block.offer ? txt(ctx, env, 'number', block.offer, { align }) : '',
      txt(ctx, env, 'title', block.headline, { align }),
      txt(ctx, env, 'lede', block.subhead, { align }),
      txt(ctx, env, 'body', block.body, { align }),
      facts,
      block.quote ? txt(ctx, env, 'quote', `« ${block.quote.text} »`, { align }) + txt(ctx, env, 'caption', block.quote.author, { align }) : '',
      txt(ctx, env, 'note', block.footnote, { align }),
    ].join('')}</div>`;
  },
});

export const figure: ComponentFor<'figure'> = registerComponent({
  id: 'ui.figure',
  elastic: { minHeight: (_block, _ctx, width) => width / 2.6 },
  kinds: ['figure'],
  summary: 'Image avec légende, recadrée sur son sujet.',
  variants: { ratio: [1.6, 1.333, 1, 0.8], frame: [false, true] },
  defaults: { ratio: 1.6, frame: false },
  estimate(block, ctx, width, variant) {
    return width / Number(variant.ratio || 1.6) + (block.caption ? ctx.tokens.size.xs * 2.4 : 0);
  },
  render({ block, ctx, env, variant }) {
    const url = safeUrl(block.url);
    if (!url) return '';
    const ratio = Number(variant.ratio || 1.6);
    const frame = variant.frame === true;
    const img = `<div style="${box({ position: 'relative', width: '100%', 'aspect-ratio': String(ratio), overflow: 'hidden', 'border-radius': ctx.tokens.radius.md, background: mixHex(env.surface, '#000000', 0.06), border: frame ? `${ctx.tokens.stroke.hair}px solid ${ruleColor(ctx, env)}` : undefined })}"><img src="${escAttr(url)}" alt="${escAttr(block.alt)}" style="${css({ position: 'absolute', inset: 0, width: '100%', height: '100%', 'object-fit': 'cover', 'object-position': block.focal ? `${Math.round(block.focal.x * 100)}% ${Math.round(block.focal.y * 100)}%` : undefined, display: 'block' })}"></div>`;
    return `<figure style="${css({ margin: 0 })}">${img}${block.caption ? `<figcaption style="margin-top:${ctx.tokens.space.xs}px">${txt(ctx, env, 'caption', block.caption)}</figcaption>` : ''}</figure>`;
  },
});

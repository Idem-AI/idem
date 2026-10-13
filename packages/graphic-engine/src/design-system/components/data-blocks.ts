/**
 * Les blocs de DONNÉES : chiffres-clés, tableaux, comparaisons, frises, étapes, entonnoirs.
 *
 * Règles communes (compétence dataviz) : le texte porte les encres de texte, jamais la couleur d'une
 * série ; la couleur d'emphase marque (filet, puce, pastille) sans colorer un chiffre ; les colonnes de
 * chiffres s'alignent à droite en chiffres tabulaires ; un ordre (étapes d'un entonnoir) se lit dans UNE
 * teinte qui s'assombrit, jamais dans des couleurs différentes.
 */
import { contrastRatio, mixHex, readableInk } from '../../foundation/color';
import { css, esc } from '../../foundation/html';
import { estimateTextHeight } from '../../html-css-compiler/text';
import { box, ink, looksNumeric, ruleColor, txt } from './kit';
import { registerComponent } from './registry';
import type { ComponentFor } from './types';

// ── Chiffres-clés ──────────────────────────────────────────────────────────────────────────

export const metrics: ComponentFor<'metrics'> = registerComponent({
  id: 'ui.metrics',
  kinds: ['metrics'],
  summary: 'Chiffres-clés : rangée séparée de filets, tuiles, héros + liste, filet d’emphase, liste empilée.',
  variants: { style: ['row', 'tiles', 'hero', 'ruled', 'stacked'], align: ['start', 'center'] },
  defaults: { style: 'ruled', align: 'start' },
  estimate(block, ctx, width, variant) {
    const style = String(variant.style);
    const minTile = ctx.tokens.size.base * 10;
    const perRow = Math.max(1, Math.min(block.items.length, Math.floor(width / minTile)));
    const rows = Math.ceil(block.items.length / perRow);
    const tile = ctx.tokens.size['3xl'] + ctx.tokens.size.sm * 2.6 + ctx.tokens.space.md;
    if (style === 'stacked') return block.items.length * (ctx.tokens.size['2xl'] * 1.3 + ctx.tokens.space.sm);
    if (style === 'hero') return ctx.tokens.size['5xl'] * 1.1 + ctx.tokens.size.sm * 2 + (block.items.length - 1) * ctx.tokens.size.lg * 2.2;
    return rows * tile + (rows - 1) * ctx.tokens.space.md + (style === 'tiles' ? ctx.tokens.space.md * 2 : 0);
  },
  render({ block, ctx, env, variant }) {
    const style = String(variant.style);
    const center = variant.align === 'center' ? 'center' : undefined;
    const accent = ink(ctx, env, 'emphasis', true);
    const gap = ctx.tokens.space.md;

    if (style === 'hero' && block.items.length > 1) {
      const [first, ...rest] = block.items;
      const side = env.width > ctx.tokens.size.base * 34;
      const heroEnv = { ...env, width: side ? env.width * 0.5 : env.width };
      const listEnv = { ...env, width: side ? env.width * 0.46 : env.width };
      const hero = `<div style="${css({ display: 'flex', 'flex-direction': 'column', gap: ctx.tokens.space.xs })}">${txt(ctx, heroEnv, 'number', first.value, { size: '5xl', maxLines: 1, ink: 'heading' })}${txt(ctx, heroEnv, 'small', first.label, { weight: 600 })}${txt(ctx, heroEnv, 'caption', first.note)}</div>`;
      const list = rest
        .map((m) => `<div style="${css({ display: 'flex', 'align-items': 'baseline', gap: ctx.tokens.space.sm, 'border-top': `${ctx.tokens.stroke.hair}px solid ${ruleColor(ctx, env)}`, 'padding-top': ctx.tokens.space.xs })}">${txt(ctx, { ...listEnv, width: listEnv.width * 0.42 }, 'figure', m.value, { size: 'xl', maxLines: 1 })}<div>${txt(ctx, { ...listEnv, width: listEnv.width * 0.55 }, 'small', m.label)}${txt(ctx, listEnv, 'caption', m.note)}</div></div>`)
        .join('');
      return `<div style="${css({ display: 'flex', 'flex-direction': side ? 'row' : 'column', gap: ctx.tokens.space.xl, 'align-items': side ? 'center' : undefined })}">${hero}<div style="${css({ display: 'flex', 'flex-direction': 'column', gap: ctx.tokens.space.sm, flex: '1 1 0%' })}">${list}</div></div>`;
    }

    if (style === 'stacked') {
      return `<div style="${css({ display: 'flex', 'flex-direction': 'column', gap: ctx.tokens.space.sm })}">${block.items
        .map((m) => `<div style="${css({ display: 'grid', 'grid-template-columns': 'minmax(0, 0.42fr) minmax(0, 0.58fr)', gap: ctx.tokens.space.md, 'align-items': 'baseline', 'border-bottom': `${ctx.tokens.stroke.hair}px solid ${ruleColor(ctx, env)}`, 'padding-bottom': ctx.tokens.space.xs })}">${txt(ctx, { ...env, width: env.width * 0.4 }, 'figure', m.value, { size: '2xl', maxLines: 1 })}<div>${txt(ctx, { ...env, width: env.width * 0.55 }, 'small', m.label, { weight: 600 })}${txt(ctx, env, 'caption', m.note)}</div></div>`)
        .join('')}</div>`;
    }

    const minTile = ctx.tokens.size.base * 10;
    const perRow = Math.max(1, Math.min(block.items.length, Math.floor((env.width + gap) / (minTile + gap))));
    const tileWidth = (env.width - gap * (perRow - 1)) / perRow;
    const tiles = block.items.map((m, i) => {
      const surface = style === 'tiles' ? ctx.look.panel : env.surface;
      const tileEnv = { ...env, surface, width: tileWidth - (style === 'tiles' ? ctx.tokens.space.md * 2 : 0) };
      const decl =
        style === 'tiles'
          ? { background: surface, padding: ctx.tokens.space.md, 'border-radius': ctx.tokens.radius.md }
          : style === 'ruled'
            ? { 'border-top': `${ctx.tokens.stroke.thick}px solid ${accent}`, 'padding-top': ctx.tokens.space.sm }
            : { 'border-left': i % perRow === 0 ? undefined : `${ctx.tokens.stroke.hair}px solid ${ruleColor(ctx, env)}`, 'padding-left': i % perRow === 0 ? 0 : gap };
      return `<div style="${box({ display: 'flex', 'flex-direction': 'column', gap: ctx.tokens.space.xs, 'align-items': center ? 'center' : undefined, 'text-align': center, ...decl })}">${txt(ctx, tileEnv, 'figure', m.value, { maxLines: 1, align: center ? 'center' : undefined })}${txt(ctx, tileEnv, 'small', m.label, { weight: 600, align: center ? 'center' : undefined })}${txt(ctx, tileEnv, 'caption', m.note, { align: center ? 'center' : undefined })}</div>`;
    });
    return `<div style="${css({ display: 'grid', 'grid-template-columns': `repeat(${perRow}, minmax(0, 1fr))`, gap: style === 'row' ? `${ctx.tokens.space.md}px ${gap}px` : gap })}">${tiles.join('')}</div>`;
  },
});

// ── Tableaux ───────────────────────────────────────────────────────────────────────────────

const TOTAL_ROW = /^(total|sous-total|ensemble|résultat net|net income|subtotal|grand total|totaux)/i;

export const table: ComponentFor<'table'> = registerComponent({
  id: 'ui.table',
  kinds: ['table'],
  summary: 'Tableau : filets horizontaux, lignes alternées, minimal ou encadré ; chiffres alignés à droite.',
  variants: { style: ['ruled', 'zebra', 'minimal', 'boxed'], density: ['regular', 'compact'] },
  defaults: { style: 'ruled', density: 'regular' },
  minWidth: 260,
  estimate(block, ctx, width, variant) {
    const cols = block.headers.length;
    const size = cols >= 7 ? ctx.tokens.size.xs : cols >= 5 || variant.density === 'compact' ? ctx.tokens.size.sm : ctx.tokens.size.base;
    const pad = variant.density === 'compact' ? size * 0.45 : size * 0.7;
    const colWidth = width / cols;
    const rowHeight = (cells: string[]) => Math.max(...cells.map((c) => Math.max(1, Math.ceil((c.length * size * 0.5) / Math.max(40, colWidth - pad * 2))))) * size * 1.35 + pad * 2;
    return rowHeight(block.headers) + block.rows.reduce((h, r) => h + rowHeight(r), 0) + (block.caption ? ctx.tokens.size.xs * 2.4 : 0);
  },
  atomic: (block) => block.rows.length <= 6,
  render({ block, ctx, env, variant }) {
    const style = String(variant.style);
    const cols = block.headers.length;
    const size = cols >= 7 ? ctx.tokens.size.xs : cols >= 5 || variant.density === 'compact' ? ctx.tokens.size.sm : ctx.tokens.size.base;
    const pad = Math.round((variant.density === 'compact' ? size * 0.45 : size * 0.7) * 10) / 10;
    const numeric = block.headers.map((_, c) => {
      const cells = block.rows.map((r) => r[c] ?? '').filter(Boolean);
      return c > 0 && cells.length > 0 && cells.filter(looksNumeric).length / cells.length >= 0.6;
    });
    const rule = ruleColor(ctx, env);
    const strong = ruleColor(ctx, env, 'strong');
    const headSurface = style === 'boxed' ? mixHex(env.surface, ctx.tokens.color.primary, 0.1) : env.surface;
    const head = block.headers
      .map((h, c) => `<th scope="col" style="${css({ 'text-align': numeric[c] ? 'right' : 'left', padding: `${pad}px ${pad}px`, 'font-size': Math.max(ctx.tokens.format.minSize, size - 1.5), 'font-weight': 600, 'letter-spacing': '0.06em', 'text-transform': 'uppercase', color: ink(ctx, { ...env, surface: headSurface }, 'muted'), 'border-bottom': `${ctx.tokens.stroke.thin}px solid ${strong}`, background: style === 'boxed' ? headSurface : undefined, 'vertical-align': 'bottom' })}">${esc(h)}</th>`)
      .join('');
    const body = block.rows
      .map((row, r) => {
        const total = TOTAL_ROW.test(row[0] ?? '');
        const zebra = style === 'zebra' && r % 2 === 1 ? ctx.tokens.color.raised : undefined;
        const rowSurface = zebra ?? env.surface;
        const cells = block.headers
          .map((_, c) => {
            const value = row[c] ?? '';
            return `<td style="${css({
              'text-align': numeric[c] ? 'right' : 'left',
              padding: `${pad}px ${pad}px`,
              'font-variant-numeric': numeric[c] ? 'tabular-nums lining-nums' : undefined,
              'font-weight': total || (c === 0 && cols > 2) ? 600 : 400,
              color: ink(ctx, { ...env, surface: rowSurface }, 'ink'),
              'border-bottom': style === 'minimal' ? undefined : `${ctx.tokens.stroke.hair}px solid ${rule}`,
              'border-top': total ? `${ctx.tokens.stroke.thin}px solid ${strong}` : undefined,
              'vertical-align': 'top',
              'white-space': numeric[c] ? 'nowrap' : undefined,
            })}">${esc(value)}</td>`;
          })
          .join('');
        return `<tr style="${css({ background: zebra, 'break-inside': 'avoid' })}">${cells}</tr>`;
      })
      .join('');
    const frame = style === 'boxed' ? { border: `${ctx.tokens.stroke.hair}px solid ${strong}`, 'border-radius': ctx.tokens.radius.sm, overflow: 'hidden' } : {};
    const caption = block.caption ? `<p style="${css({ margin: `${ctx.tokens.space.xs}px 0 0`, 'font-size': ctx.tokens.size.xs, color: ink(ctx, env, 'muted'), 'line-height': 1.4 })}">${esc(block.caption)}</p>` : '';
    return `<div><div style="${box({ width: '100%', ...frame })}"><table style="${css({ width: '100%', 'border-collapse': 'collapse', 'font-size': size, 'line-height': 1.35, 'font-family': ctx.tokens.font.bodyStack })}"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>${caption}</div>`;
  },
});

// ── Comparaison ────────────────────────────────────────────────────────────────────────────

export const comparison: ComponentFor<'comparison'> = registerComponent({
  id: 'ui.comparison',
  kinds: ['comparison'],
  summary: 'Comparaison à deux entrées : critères en lignes, options en colonnes, une option mise en avant.',
  variants: { highlight: [0, 1, -1], style: ['grid', 'cards'] },
  defaults: { highlight: 0, style: 'grid' },
  minWidth: 300,
  estimate(block, ctx) {
    return (block.rows.length + 1) * ctx.tokens.size.base * 2.6;
  },
  render({ block, ctx, env, variant }) {
    const hi = Number(variant.highlight);
    const cols = block.columns.length;
    const labelWidth = Math.round(env.width * (cols >= 4 ? 0.24 : 0.3));
    const colWidth = (env.width - labelWidth) / cols;
    const soft = mixHex(env.surface, ctx.tokens.color.primary, 0.1);
    const rule = ruleColor(ctx, env);
    if (variant.style === 'cards') {
      const cards = block.columns
        .map((name, c) => {
          const surface = c === hi ? soft : ctx.tokens.color.raised;
          const cEnv = { ...env, surface, width: colWidth - ctx.tokens.space.md * 2 };
          const lines = block.rows.map((r) => `<div style="${css({ 'border-top': `${ctx.tokens.stroke.hair}px solid ${mixHex(surface, ink(ctx, cEnv, 'ink'), 0.15)}`, 'padding-top': ctx.tokens.space.xs })}">${txt(ctx, cEnv, 'label', r.label)}${txt(ctx, cEnv, 'small', r.values[c])}</div>`).join('');
          return `<div style="${box({ background: surface, padding: ctx.tokens.space.md, 'border-radius': ctx.tokens.radius.md, display: 'flex', 'flex-direction': 'column', gap: ctx.tokens.space.sm, border: c === hi ? `${ctx.tokens.stroke.thin}px solid ${ink(ctx, env, 'emphasis', true)}` : undefined })}">${txt(ctx, cEnv, 'subtitle', name, { size: 'lg' })}${lines}</div>`;
        })
        .join('');
      return `<div style="${css({ display: 'grid', 'grid-template-columns': `repeat(${cols}, minmax(0, 1fr))`, gap: ctx.tokens.space.md })}">${cards}</div>`;
    }
    const head = `<div style="${css({ display: 'grid', 'grid-template-columns': `${labelWidth}px repeat(${cols}, minmax(0, 1fr))` })}"><div></div>${block.columns
      .map((name, c) => `<div style="${box({ padding: `${ctx.tokens.space.sm}px ${ctx.tokens.space.sm}px`, background: c === hi ? soft : undefined, 'border-bottom': `${ctx.tokens.stroke.thin}px solid ${ruleColor(ctx, env, 'strong')}` })}">${txt(ctx, { ...env, surface: c === hi ? soft : env.surface, width: colWidth }, 'subtitle', name, { size: 'base' })}</div>`)
      .join('')}</div>`;
    const rows = block.rows
      .map(
        (r) =>
          `<div style="${css({ display: 'grid', 'grid-template-columns': `${labelWidth}px repeat(${cols}, minmax(0, 1fr))`, 'border-bottom': `${ctx.tokens.stroke.hair}px solid ${rule}`, 'break-inside': 'avoid' })}"><div style="${box({ padding: `${ctx.tokens.space.sm}px ${ctx.tokens.space.sm}px ${ctx.tokens.space.sm}px 0` })}">${txt(ctx, { ...env, width: labelWidth }, 'small', r.label, { weight: 600 })}</div>${r.values
            .map((v, c) => `<div style="${box({ padding: ctx.tokens.space.sm, background: c === hi ? soft : undefined })}">${txt(ctx, { ...env, surface: c === hi ? soft : env.surface, width: colWidth }, 'small', v)}</div>`)
            .join('')}</div>`
      )
      .join('');
    return `<div>${head}${rows}</div>`;
  },
});

// ── Frise chronologique ────────────────────────────────────────────────────────────────────

export const timeline: ComponentFor<'timeline'> = registerComponent({
  id: 'ui.timeline',
  kinds: ['timeline'],
  summary: 'Frise : verticale (dates en marge), horizontale (jalons reliés) ou numérotée.',
  variants: { style: ['vertical', 'horizontal', 'numbered'] },
  defaults: { style: 'vertical' },
  estimate(block, ctx, width, variant) {
    if (variant.style === 'horizontal' && block.steps.length <= 5 && width >= ctx.tokens.size.base * 34) {
      const w = width / block.steps.length;
      return ctx.tokens.size.sm * 3 + Math.max(...block.steps.map((s) => estimateTextHeight(s.title, 'subtitle', ctx, w, 'base') + estimateTextHeight(s.body, 'small', ctx, w))) + 24;
    }
    return block.steps.reduce((h, s) => h + estimateTextHeight(s.title, 'subtitle', ctx, width * 0.7, 'base') + estimateTextHeight(s.body, 'small', ctx, width * 0.7) + ctx.tokens.space.md, 0);
  },
  atomic: (block) => block.steps.length <= 4,
  render({ block, ctx, env, variant }) {
    const accent = ink(ctx, env, 'emphasis', true);
    const rule = ruleColor(ctx, env, 'strong');
    const dot = Math.max(8, Math.round(ctx.tokens.size.base * 0.75));
    const horizontal = variant.style === 'horizontal' && block.steps.length <= 5 && env.width >= ctx.tokens.size.base * 34;
    if (horizontal) {
      const n = block.steps.length;
      const w = env.width / n;
      const items = block.steps
        .map((s, i) => {
          const sEnv = { ...env, width: w - ctx.tokens.space.md };
          return `<li style="${box({ position: 'relative', 'padding-right': ctx.tokens.space.md, display: 'flex', 'flex-direction': 'column', gap: ctx.tokens.space.xs })}">${txt(ctx, sEnv, 'label', s.date, { ink: 'kicker' })}<div aria-hidden="true" style="${css({ position: 'relative', height: dot, margin: `${ctx.tokens.space.xs}px 0` })}"><div style="${css({ position: 'absolute', left: 0, right: i === n - 1 ? '60%' : `-${ctx.tokens.space.md}px`, top: '50%', height: ctx.tokens.stroke.thin, background: rule })}"></div><div style="${css({ position: 'absolute', left: 0, top: 0, width: dot, height: dot, 'border-radius': '50%', background: accent, 'box-shadow': `0 0 0 2px ${env.surface}` })}"></div></div>${txt(ctx, sEnv, 'subtitle', s.title, { size: 'base' })}${txt(ctx, sEnv, 'small', s.body, { ink: 'muted' })}</li>`;
        })
        .join('');
      return `<ol style="${css({ margin: 0, padding: 0, 'list-style': 'none', display: 'grid', 'grid-template-columns': `repeat(${n}, minmax(0, 1fr))` })}">${items}</ol>`;
    }
    const numbered = variant.style === 'numbered';
    const dateWidth = Math.round(env.width * (numbered ? 0.12 : 0.2));
    const items = block.steps
      .map((s, i) => {
        const textEnv = { ...env, width: env.width - dateWidth - ctx.tokens.space.lg };
        const marker = numbered
          ? txt(ctx, { ...env, width: dateWidth }, 'number', String(i + 1).padStart(2, '0'), { size: '2xl' })
          : txt(ctx, { ...env, width: dateWidth }, 'label', s.date, { ink: 'kicker' });
        const line = i < block.steps.length - 1 ? `<div aria-hidden="true" style="${css({ position: 'absolute', left: Math.round(dot / 2 - 0.5), top: dot + 6, bottom: -ctx.tokens.space.md, width: ctx.tokens.stroke.thin, background: rule })}"></div>` : '';
        const rail = numbered ? '' : `<div aria-hidden="true" style="${css({ position: 'relative', width: dot, 'flex-shrink': 0 })}"><div style="${css({ width: dot, height: dot, 'border-radius': '50%', background: accent, 'margin-top': 4 })}"></div>${line}</div>`;
        return `<li style="${css({ display: 'flex', gap: ctx.tokens.space.md, 'padding-bottom': ctx.tokens.space.md, 'break-inside': 'avoid' })}"><div style="${css({ width: dateWidth, 'flex-shrink': 0 })}">${marker}</div>${rail}<div style="${css({ flex: '1 1 0%', 'min-width': 0, display: 'flex', 'flex-direction': 'column', gap: 2 })}">${numbered ? txt(ctx, textEnv, 'label', s.date, { ink: 'kicker' }) : ''}${txt(ctx, textEnv, 'subtitle', s.title, { size: 'base' })}${txt(ctx, textEnv, 'small', s.body, { ink: 'muted' })}</div></li>`;
      })
      .join('');
    return `<ol style="${css({ margin: 0, padding: 0, 'list-style': 'none' })}">${items}</ol>`;
  },
});

// ── Étapes ─────────────────────────────────────────────────────────────────────────────────

export const steps: ComponentFor<'steps'> = registerComponent({
  id: 'ui.steps',
  kinds: ['steps'],
  summary: 'Processus en étapes : flèches enchaînées, cartes numérotées ou échelle verticale.',
  variants: { style: ['arrows', 'numbered', 'ladder'] },
  defaults: { style: 'numbered' },
  estimate(block, ctx, width, variant) {
    if (variant.style === 'ladder') return block.items.reduce((h, s) => h + estimateTextHeight(s.body, 'small', ctx, width * 0.8) + ctx.tokens.size.base * 3, 0);
    const w = width / Math.min(block.items.length, 4);
    return ctx.tokens.size['2xl'] * 1.6 + Math.max(...block.items.map((s) => estimateTextHeight(s.title, 'subtitle', ctx, w, 'base') + estimateTextHeight(s.body, 'small', ctx, w))) + ctx.tokens.space.md * 2;
  },
  render({ block, ctx, env, variant }) {
    const style = String(variant.style);
    const accent = ink(ctx, env, 'emphasis', true);
    const n = block.items.length;
    if (style === 'ladder') {
      const disc = Math.round(ctx.tokens.size.base * 2.2);
      return `<ol style="${css({ margin: 0, padding: 0, 'list-style': 'none', display: 'flex', 'flex-direction': 'column', gap: ctx.tokens.space.sm })}">${block.items
        .map((s, i) => `<li style="${css({ display: 'flex', gap: ctx.tokens.space.md, 'align-items': 'flex-start', 'break-inside': 'avoid' })}"><div aria-hidden="true" style="${css({ width: disc, height: disc, 'flex-shrink': 0, 'border-radius': '50%', border: `${ctx.tokens.stroke.thin}px solid ${accent}`, display: 'flex', 'align-items': 'center', 'justify-content': 'center', 'font-weight': 700, 'font-size': ctx.tokens.size.sm, color: ink(ctx, env, 'ink') })}">${i + 1}</div><div style="${css({ flex: '1 1 0%', 'min-width': 0 })}">${txt(ctx, { ...env, width: env.width - disc - 16 }, 'subtitle', s.title, { size: 'base' })}${txt(ctx, { ...env, width: env.width - disc - 16 }, 'small', s.body, { ink: 'muted' })}</div></li>`)
        .join('')}</ol>`;
    }
    const perRow = Math.min(n, env.width < ctx.tokens.size.base * 30 ? 2 : 4);
    const w = (env.width - ctx.tokens.space.md * (perRow - 1)) / perRow;
    const items = block.items
      .map((s, i) => {
        const arrow = style === 'arrows';
        const surface = arrow ? (i === n - 1 ? mixHex(env.surface, ctx.tokens.color.primary, 0.16) : ctx.tokens.color.raised) : env.surface;
        const sEnv = { ...env, surface, width: w - ctx.tokens.space.md * (arrow ? 2.4 : 0) };
        const shape = arrow
          ? { background: surface, padding: `${ctx.tokens.space.md}px ${ctx.tokens.space.lg}px ${ctx.tokens.space.md}px ${i ? ctx.tokens.space.lg + 6 : ctx.tokens.space.md}px`, 'clip-path': i < n - 1 ? 'polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%, 14px 50%)' : 'polygon(0 0, 100% 0, 100% 100%, 0 100%, 14px 50%)' }
          : { 'border-top': `${ctx.tokens.stroke.thick}px solid ${accent}`, 'padding-top': ctx.tokens.space.sm };
        const num = txt(ctx, sEnv, 'number', String(i + 1).padStart(2, '0'), { size: arrow ? 'xl' : '2xl', ink: arrow ? 'ink' : 'emphasis' });
        return `<li style="${box({ display: 'flex', 'flex-direction': 'column', gap: ctx.tokens.space.xs, 'min-width': 0, ...shape })}">${num}${txt(ctx, sEnv, 'subtitle', s.title, { size: 'base' })}${txt(ctx, sEnv, 'small', s.body, { ink: 'muted' })}</li>`;
      })
      .join('');
    return `<ol style="${css({ margin: 0, padding: 0, 'list-style': 'none', display: 'grid', 'grid-template-columns': `repeat(${perRow}, minmax(0, 1fr))`, gap: style === 'arrows' ? 4 : ctx.tokens.space.md })}">${items}</ol>`;
  },
});

// ── Entonnoir ──────────────────────────────────────────────────────────────────────────────

export const funnel: ComponentFor<'funnel'> = registerComponent({
  id: 'ui.funnel',
  kinds: ['funnel'],
  summary: 'Entonnoir ordonné : une teinte qui s’assombrit étape par étape (jamais des couleurs différentes).',
  variants: { style: ['bars', 'stepped'] },
  defaults: { style: 'bars' },
  estimate(block, ctx) {
    return block.stages.length * (ctx.tokens.size.base * 2.8 + 4);
  },
  render({ block, ctx, env, variant }) {
    const n = block.stages.length;
    const ramp = ctx.tokens.color.brandRamp;
    // Rampe ordinale à teinte unique, du clair au foncé (et l'étape la plus claire reste visible sur le fond).
    const steps = ['300', '400', '500', '600', '700', '800'].slice(Math.max(0, 6 - n));
    const height = Math.round(ctx.tokens.size.base * 2.6);
    const rows = block.stages
      .map((s, i) => {
        const fill = ramp[steps[i]] ?? ctx.tokens.color.primary;
        const width = variant.style === 'stepped' ? 100 - i * (55 / Math.max(1, n - 1)) : 100 - i * (62 / Math.max(1, n - 1));
        const onFill = readableInk(contrastRatio('#ffffff', fill) > contrastRatio('#000000', fill) ? '#ffffff' : '#111111', fill, 4.5);
        const inside = `<span style="${css({ 'font-weight': 700, 'font-size': ctx.tokens.size.base, color: onFill, 'white-space': 'nowrap' })}">${esc(s.value)}</span>`;
        const bar = `<div style="${box({ width: `${Math.round(width)}%`, height, background: fill, margin: variant.style === 'stepped' ? undefined : '0 auto', display: 'flex', 'align-items': 'center', 'justify-content': 'center', 'border-radius': Math.min(ctx.tokens.radius.sm, 4) })}">${inside}</div>`;
        const legend = `<div style="${css({ display: 'flex', 'flex-direction': 'column', 'justify-content': 'center', 'min-width': 0 })}">${txt(ctx, { ...env, width: env.width * 0.34 }, 'small', s.label, { weight: 600 })}${txt(ctx, { ...env, width: env.width * 0.34 }, 'caption', s.note)}</div>`;
        return `<div style="${css({ display: 'grid', 'grid-template-columns': 'minmax(0, 0.64fr) minmax(0, 0.36fr)', gap: ctx.tokens.space.md, 'align-items': 'center' })}">${bar}${legend}</div>`;
      })
      .join('');
    return `<div role="img" aria-label="${esc(block.stages.map((s) => `${s.label} : ${s.value}`).join(' ; '))}" style="${css({ display: 'flex', 'flex-direction': 'column', gap: 4 })}">${rows}</div>`;
  },
});

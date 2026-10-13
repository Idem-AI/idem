/**
 * Les COUVERTURES (charte graphique, business plan, pitch deck), dessinées par le code.
 *
 * Le contenu d'une couverture tient dans un bloc `cover` (nom, sur-titre, promesse, mention du document,
 * détail, date) : le modèle n'en écrit que le sur-titre et la promesse, une fois par projet. Sept
 * compositions, déclinées en portrait (A4) et en paysage (diapositive) : mot-symbole géant, panneau
 * scindé, bandeau de pied, cadre, minimal, grande forme, rail.
 */
import type { NodeT } from '../../contracts/design-spec';
import type { FormatFamily } from '../formats';
import { n } from './build';
import { registerPattern } from './registry';
import type { PatternContext, PatternDef } from './types';

type N = NodeT;

interface CoverRefs {
  name: string;
  kicker?: string;
  promise?: string;
  label?: string;
  detail?: string;
  date?: string;
}

/** Les références du bloc `cover` (sinon le titre, le sur-titre et le chapô de la section). */
function refs(ctx: PatternContext): CoverRefs {
  const block = ctx.section.blocks.find((b) => b.kind === 'cover');
  if (block && block.kind === 'cover') {
    const id = block.id;
    return { name: `${id}.brandName`, kicker: block.kicker ? `${id}.kicker` : undefined, promise: block.promise ? `${id}.promise` : undefined, label: `${id}.documentLabel`, detail: block.detail ? `${id}.detail` : undefined, date: block.dateLabel ? `${id}.dateLabel` : undefined };
  }
  return { name: 'title', kicker: ctx.section.kicker ? 'kicker' : undefined, promise: ctx.section.lede ? 'lede' : undefined };
}

/** La ligne de mentions : document · détail · date, chacune par sa référence (le plan ne recopie aucun mot). */
function details(r: CoverRefs, align?: 'start' | 'center' | 'end'): N {
  const parts = [r.label, r.detail, r.date].filter(Boolean) as string[];
  const items: N[] = [];
  parts.forEach((ref, i) => {
    if (i) items.push(n.label('label', '·', { ink: 'faint' }));
    items.push(n.text('label', ref));
  });
  return n.row(items, { gap: 'sm', align: 'center', wrap: true, justify: align === 'center' ? 'center' : align === 'end' ? 'end' : undefined });
}

const nameSize = (ctx: PatternContext): '5xl' | '6xl' => (ctx.format.orientation === 'portrait' ? '5xl' : '6xl');

function cover(id: string, summary: string, tags: string[], params: PatternDef['params'], build: PatternDef['build'], regions: PatternDef['regions']): void {
  for (const family of ['slide', 'document'] as FormatFamily[]) {
    registerPattern({
      id: `${family === 'slide' ? 'slide' : 'doc'}.cover-${id}`,
      family,
      roles: ['cover'],
      summary,
      tags,
      params,
      fit: () => 1,
      regions,
      build,
    });
  }
}

cover(
  'wordmark',
  'Le nom en mot-symbole géant, la promesse dessous, les mentions en pied ; lisière au motif de la marque.',
  ['bold', 'swiss', 'editorial'],
  { strip: ['pattern', 'grid', 'none'] },
  (ctx) => {
    const r = refs(ctx);
    const top = n.row([n.logo({ height: 'md' }), n.spacer('flex'), ...(r.kicker ? [n.text('kicker', r.kicker, { align: 'end' })] : [])], { align: 'center' });
    const center = n.stack([n.rule({ weight: 'thick', ink: 'emphasis', length: 'short' }), n.text('display', r.name, { size: nameSize(ctx), maxLines: 2 }), ...(r.promise ? [n.text('lede', r.promise, { size: 'xl' })] : [])], { gap: 'lg' });
    const strip = ctx.params.strip;
    const decor = strip === 'none' ? [] : [{ at: { x: 95, y: 0, w: 5, h: 100 }, z: 0, node: strip === 'pattern' ? n.pattern({ opacity: 0.95 }) : n.shape('grid-lines', { tone: 'brand', size: 'fill', seed: 3 }) }];
    return { root: n.stack([top, n.spacer('flex'), center, n.spacer('flex'), details(r)], { grow: true, gap: 'lg' }), decor };
  },
  () => [
    { x: 0, y: 0, w: 100, h: 10, kind: 'header' },
    { x: 0, y: 34, w: 80, h: 36, kind: 'figure' },
    { x: 0, y: 90, w: 60, h: 10, kind: 'aside' },
    { x: 95, y: 0, w: 5, h: 100, kind: 'decor' },
  ]
);

cover(
  'split',
  'Un panneau de couleur à fond perdu porte le logo et le nom ; la promesse et les mentions à côté.',
  ['bold', 'corporate', 'colorful'],
  { panel: ['brand', 'ink'], ratio: [5, 6] },
  (ctx) => {
    const r = refs(ctx);
    const portrait = ctx.format.orientation === 'portrait';
    const panel = n.box([n.stack([n.logo({ height: 'lg', variant: 'auto' }), n.spacer('flex'), n.text('display', r.name, { size: portrait ? '4xl' : '5xl', maxLines: 3 })], { grow: true, gap: 'lg' })], { surface: ctx.params.panel as 'brand' | 'ink', bleed: portrait ? ['t', 'l', 'r'] : ['t', 'l', 'b'], pad: 'xl' });
    const side = n.stack([...(r.kicker ? [n.text('kicker', r.kicker)] : []), ...(r.promise ? [n.text('lede', r.promise, { size: 'xl', ink: 'heading' })] : []), n.spacer('flex'), details(r)], { gap: 'md', grow: true });
    const k = Number(ctx.params.ratio);
    return { root: portrait ? n.stack([n.box([panel], { grow: true }), side], { grow: true, gap: 'xl' }) : n.grid([k, 12 - k], [panel, side], { gap: '2xl', align: 'stretch', grow: true }) };
  },
  (p) => [
    { x: 0, y: 0, w: (Number(p.ratio) / 12) * 100, h: 100, kind: 'band' },
    { x: (Number(p.ratio) / 12) * 100 + 4, y: 10, w: 40, h: 80, kind: 'aside' },
  ]
);

cover(
  'band',
  'Le nom et la promesse en grand ; un bandeau de couleur en pied porte la mention du document et la date.',
  ['corporate', 'structured', 'calm'],
  { band: ['brand', 'ink'] },
  (ctx) => {
    const r = refs(ctx);
    const head = n.stack([n.logo({ height: 'md' }), n.spacer('flex'), ...(r.kicker ? [n.text('kicker', r.kicker)] : []), n.text('display', r.name, { size: nameSize(ctx), maxLines: 2 }), ...(r.promise ? [n.text('lede', r.promise, { size: 'xl' })] : []), n.spacer('xl')], { gap: 'md', grow: true });
    const band = n.box([details(r)], { surface: ctx.params.band as 'brand' | 'ink' | 'brand-soft', bleed: ['l', 'r', 'b'], pad: { t: 'lg', b: 'xl' } });
    return { root: n.stack([head, band], { grow: true }) };
  },
  () => [
    { x: 0, y: 30, w: 80, h: 44, kind: 'figure' },
    { x: 0, y: 84, w: 100, h: 16, kind: 'band' },
  ]
);

cover(
  'frame',
  'Un cadre intérieur ; au centre, le logo, le nom, la promesse et les mentions.',
  ['elegant', 'calm', 'classic'],
  {},
  (ctx) => {
    const r = refs(ctx);
    const inner = n.stack([n.logo({ height: 'lg' }), ...(r.kicker ? [n.text('kicker', r.kicker, { align: 'center' })] : []), n.text('display', r.name, { size: ctx.format.orientation === 'portrait' ? '4xl' : '5xl', align: 'center', maxLines: 2 }), ...(r.promise ? [n.text('lede', r.promise, { align: 'center' })] : []), n.rule({ weight: 'thick', ink: 'emphasis', length: 'xshort' }), details(r, 'center')], { gap: 'lg', align: 'center' });
    return {
      root: n.stack([n.spacer('flex'), inner, n.spacer('flex')], { grow: true, align: 'center' }),
      decor: [{ at: { x: 3, y: ctx.format.orientation === 'portrait' ? 2.4 : 4.5, w: 94, h: ctx.format.orientation === 'portrait' ? 95.2 : 91 }, node: n.box([], { border: { weight: 'thin', ink: 'emphasis' } }) }],
    };
  },
  () => [
    { x: 3, y: 4, w: 94, h: 92, kind: 'decor' },
    { x: 20, y: 25, w: 60, h: 50, kind: 'figure' },
  ]
);

cover(
  'minimal',
  'Le logo en haut à gauche, le nom en bas, la promesse à droite : beaucoup d’air.',
  ['minimal', 'calm', 'swiss'],
  {},
  (ctx) => {
    const r = refs(ctx);
    const portrait = ctx.format.orientation === 'portrait';
    const bottom = portrait
      ? n.stack([n.text('display', r.name, { size: '4xl', maxLines: 3 }), ...(r.promise ? [n.text('lede', r.promise)] : []), details(r)], { gap: 'lg' })
      : n.grid([7, 5], [n.text('display', r.name, { size: '5xl', maxLines: 2 }), n.stack([...(r.promise ? [n.text('lede', r.promise)] : []), details(r)], { gap: 'md', justify: 'end' })], { gap: 'xl', align: 'end' });
    return { root: n.stack([n.row([n.logo({ height: 'md' }), n.spacer('flex'), ...(r.kicker ? [n.text('kicker', r.kicker)] : [])], { align: 'center' }), n.spacer('flex'), bottom], { grow: true, gap: 'lg' }) };
  },
  () => [
    { x: 0, y: 0, w: 30, h: 10, kind: 'header' },
    { x: 0, y: 64, w: 100, h: 36, kind: 'figure' },
  ]
);

cover(
  'shape',
  'Une grande forme du kit qui saigne depuis un angle ; le nom et la promesse dans l’espace opposé.',
  ['playful', 'bold', 'colorful'],
  { shape: ['quarter-circles', 'rings', 'half-discs', 'arcs', 'triangles'], corner: ['tr', 'br'] },
  (ctx) => {
    const r = refs(ctx);
    const content = n.stack([n.logo({ height: 'md' }), n.spacer('flex'), ...(r.kicker ? [n.text('kicker', r.kicker)] : []), n.text('display', r.name, { size: nameSize(ctx), maxLines: 2 }), ...(r.promise ? [n.text('lede', r.promise, { size: 'lg' })] : []), n.spacer('lg'), details(r)], { gap: 'md', grow: true });
    const portrait = ctx.format.orientation === 'portrait';
    const at = ctx.params.corner === 'tr' ? { x: portrait ? 46 : 58, y: -8, w: portrait ? 60 : 48, h: portrait ? 42 : 66 } : { x: portrait ? 46 : 58, y: portrait ? 52 : 40, w: portrait ? 60 : 48, h: portrait ? 52 : 68 };
    return { root: n.grid(portrait ? [12] : [7, 5], portrait ? [content] : [content, n.spacer('none')], { grow: true }), decor: [{ at, z: 0, node: n.shape(ctx.params.shape as 'rings', { tone: 'brand', size: 'fill', seed: ctx.rng.int(1, 999) }) }] };
  },
  (p) => [
    { x: 0, y: 20, w: 56, h: 70, kind: 'figure' },
    { x: 58, y: p.corner === 'tr' ? 0 : 40, w: 42, h: 60, kind: 'decor' },
  ]
);

cover(
  'rail',
  'Un rail vertical de couleur porte la mention du document, tournée ; le reste à droite.',
  ['editorial', 'structured', 'bold'],
  { rail: ['brand', 'ink'] },
  (ctx) => {
    const r = refs(ctx);
    const rail = n.box([n.stack([n.logo({ height: 'sm', variant: 'auto' }), n.spacer('flex'), ...(r.label ? [n.text('label', r.label, { rotate: 'up' })] : [])], { grow: true, align: 'start' })], { surface: ctx.params.rail as 'brand' | 'ink', bleed: ['t', 'l', 'b'], pad: { r: 'lg', b: 'lg' } });
    const main = n.stack([n.spacer('flex'), ...(r.kicker ? [n.text('kicker', r.kicker)] : []), n.text('display', r.name, { size: nameSize(ctx), maxLines: 2 }), ...(r.promise ? [n.text('lede', r.promise, { size: 'lg' })] : []), n.spacer('flex'), n.row([...(r.detail ? [n.text('label', r.detail)] : []), ...(r.date ? [n.text('label', r.date)] : [])], { gap: 'md' })], { gap: 'md', grow: true });
    return { root: n.grid([2, 10], [rail, main], { gap: '2xl', align: 'stretch', grow: true }) };
  },
  () => [
    { x: 0, y: 0, w: 14, h: 100, kind: 'band' },
    { x: 20, y: 30, w: 70, h: 40, kind: 'figure' },
  ]
);

/**
 * Les motifs des TOILES PAYSAGE fixes : diapositives du pitch deck et pages de la charte graphique.
 *
 * Quatorze structures qui changent la SILHOUETTE de la page (ce qu'on reconnaît d'une double page avant
 * d'avoir lu un mot), et non l'ornement d'un en-tête : colonne latérale, empilement, bandeau, centre,
 * rail, deux colonnes, en-tête en pied, cadre, chiffre héros, panneau, magazine, déclaration, angle,
 * triptyque. Chacune a ses paramètres (proportions, côté, surface, disposition du corps).
 *
 * Une diapositive porte environ la moitié de ce que porte une page A4 : un motif dont le corps n'a que
 * la moitié de la largeur ne convient pas à un contenu lourd (`fit` le dit avant le rendu).
 */
import type { Params } from '../../contracts/common';
import type { ContentAnalysis } from '../../composition-engine/analyze';
import type { NodeT } from '../../contracts/design-spec';
import { body, BodyLayout, decor, footer, header, n, share } from './build';
import { registerPattern } from './registry';
import type { PatternContext, PatternDef, Region } from './types';
import type { FormatDef } from '../formats';

type N = NodeT;

/**
 * Ce qu'une toile porte, en pages A4 de matière, pour une part donnée de sa surface. Une diapositive 16:9
 * en porte 0,52 (calibration mesurée) ; une autre page fixe, au prorata de sa surface utile rapportée au
 * carré de son corps de texte — une page A4 de charte en porte environ le double.
 */
const density = (f: Pick<FormatDef, 'mm' | 'pad' | 'base'>): number => {
  const pad = (f.pad * 25.4) / 96;
  return f.mm ? ((f.mm.width - 2 * pad) * (f.mm.height - 2 * pad)) / (f.base * f.base) : 0;
};
const SLIDE_DENSITY = density({ mm: { width: 297, height: 167 }, pad: (14 * 96) / 25.4, base: 16 });
function capacity(bodyShare: number, format?: FormatDef): number {
  const ratio = format?.mm ? density(format) / SLIDE_DENSITY : 1;
  return 0.52 * ratio * bodyShare;
}

/** Un bloc élastique tient encore à cette part de sa taille naturelle (cf. `elastic.minHeight` des composants). */
const ELASTIC_MIN = 0.45;

/**
 * Adéquation selon le poids : 1 quand le contenu remplit 35 à 115 % de la place, en baisse au-delà (la
 * mise à l'échelle mesurée rattrape un léger excès, pas un excès franc). Un bloc ÉLASTIQUE — graphique,
 * spécimen, maquette — prend la place qu'on lui donne : la page le contient dès que le reste et son
 * minimum y tiennent, et il la remplit alors.
 */
function weightFit(a: ContentAnalysis, bodyShare: number, format?: FormatDef): number {
  const cap = capacity(bodyShare, format);
  const need = a.elasticWeight ? Math.max(a.weight - a.elasticWeight * (1 - ELASTIC_MIN), Math.min(a.weight, cap)) : a.weight;
  const ratio = need / cap;
  if (ratio > 1.6) return 0.05;
  if (ratio > 1.35) return 0.35;
  if (ratio > 1.15) return 0.6;
  if (ratio < 0.2) return 0.45;
  return ratio < 0.35 ? 0.7 : 1;
}

const wideHeavy = (a: ContentAnalysis): boolean => a.blocks.some((b) => b.wide && b.weight > 0.3);

function withFooter(ctx: PatternContext, main: N): N {
  const mode = ctx.meta.footer ?? 'full';
  if (mode === 'none') return n.stack([main], { grow: true });
  const foot = mode === 'logo' ? n.row([n.logo({ height: 'sm' })], { role: 'folio' }) : footer(ctx, { index: true });
  return n.stack([main, foot], { grow: true, gap: 'lg' });
}

const layoutOf = (p: Params, fallback: BodyLayout = 'flow'): BodyLayout => (String(p.body ?? fallback) as BodyLayout);

const def = (d: Omit<PatternDef, 'family'>): PatternDef => registerPattern({ family: 'slide', ...d });

def({
  id: 'slide.side',
  summary: 'En-tête dans une colonne latérale (4 ou 5 douzièmes), corps à côté ; miroir possible.',
  tags: ['structured', 'calm', 'editorial', 'swiss'],
  params: { ratio: [4, 5], mirror: [false, true], headerAlign: ['start', 'center', 'end'], body: ['flow', 'grid2'] },
  fit: (a, f) => (a.blocks.some((b) => b.wide && b.kind !== 'chart') ? 0.25 : weightFit(a, 0.58, f)),
  regions: (p) => {
    const r = Number(p.ratio) / 12;
    const h: Region = { x: p.mirror ? 100 - r * 100 : 0, y: 0, w: r * 100, h: 100, kind: 'header' };
    const b: Region = { x: p.mirror ? 0 : r * 100, y: 0, w: 100 - r * 100, h: 100, kind: 'body' };
    return [h, b];
  },
  build(ctx) {
    const r = Number(ctx.params.ratio);
    const head = n.stack([header(ctx, { size: '2xl' })], { justify: String(ctx.params.headerAlign) as 'start' | 'center' | 'end' });
    const main = n.stack([body(ctx, ctx.analysis.blocks, layoutOf(ctx.params), { width: share(ctx, 12 - r) })], { justify: 'center' });
    const cols = ctx.params.mirror ? [12 - r, r] : [r, 12 - r];
    const grid = n.grid(cols, ctx.params.mirror ? [main, head] : [head, main], { gap: 'xl', align: 'stretch', grow: true });
    return { root: withFooter(ctx, grid), decor: decor(ctx, { free: ctx.params.mirror ? 'bl' : 'tr' }) };
  },
});

def({
  id: 'slide.stacked',
  summary: 'En-tête pleine largeur, corps dessous sur la grille (une colonne, deux, ou en rangée).',
  tags: ['structured', 'calm', 'corporate'],
  params: { body: ['flow', 'grid2', 'row'], rule: ['none', 'full'], titleSize: ['2xl', '3xl'] },
  fit: (a, f) => weightFit(a, 0.78, f),
  regions: () => [
    { x: 0, y: 0, w: 100, h: 26, kind: 'header' },
    { x: 0, y: 30, w: 100, h: 70, kind: 'body' },
  ],
  build(ctx) {
    const parts: N[] = [header(ctx, { size: ctx.params.titleSize as '2xl' | '3xl', rule: ctx.params.rule === 'full' ? 'full' : undefined, lede: ctx.analysis.weight < 0.42 })];
    parts.push(n.stack([body(ctx, ctx.analysis.blocks, layoutOf(ctx.params))], { grow: true, justify: 'center' }));
    return { root: withFooter(ctx, n.stack(parts, { gap: 'lg', grow: true })), decor: decor(ctx, { free: 'br' }) };
  },
});

def({
  id: 'slide.banner',
  summary: 'En-tête dans un bandeau à fond perdu en haut de page, corps dessous.',
  tags: ['bold', 'corporate', 'structured'],
  params: { band: ['brand', 'ink', 'brand-soft'], body: ['flow', 'grid2'] },
  fit: (a, f) => weightFit(a, 0.62, f),
  regions: () => [
    { x: 0, y: 0, w: 100, h: 30, kind: 'band' },
    { x: 0, y: 36, w: 100, h: 64, kind: 'body' },
  ],
  build(ctx) {
    const band = n.box([header(ctx, { size: '2xl', lede: false })], { surface: ctx.params.band as 'brand' | 'ink' | 'brand-soft', bleed: ['t', 'l', 'r'], pad: { b: 'lg', t: 'sm' } });
    const lede = ctx.section.lede ? n.text('lede', 'lede') : null;
    const main = n.stack([band, ...(lede ? [lede] : []), n.stack([body(ctx, ctx.analysis.blocks, layoutOf(ctx.params))], { grow: true, justify: 'center' })], { gap: 'lg', grow: true });
    return { root: withFooter(ctx, main), decor: decor(ctx, { free: 'br', bands: true }) };
  },
});

def({
  id: 'slide.centered',
  summary: 'En-tête centré sur une mesure resserrée, corps centré dessous.',
  tags: ['calm', 'minimal', 'elegant'],
  params: { width: [8, 10], body: ['flow', 'row'] },
  fit: (a, f) => (a.dataHeavy && a.weight > 0.35 ? 0.3 : weightFit(a, 0.6, f)),
  regions: (p) => {
    const w = (Number(p.width) / 12) * 100;
    return [
      { x: (100 - w) / 2, y: 6, w, h: 30, kind: 'header' },
      { x: (100 - w) / 2, y: 40, w, h: 56, kind: 'body' },
    ];
  },
  build(ctx) {
    const w = Number(ctx.params.width);
    const side = (12 - w) / 2;
    const inner = n.stack([header(ctx, { align: 'center', size: '2xl' }), body(ctx, ctx.analysis.blocks, layoutOf(ctx.params), { width: share(ctx, w) })], { gap: 'xl', align: 'stretch' });
    const centered = side > 0 ? n.grid([side, w, side], [n.spacer('none'), inner, n.spacer('none')], { gap: 'none' }) : inner;
    return { root: withFooter(ctx, n.stack([n.spacer('flex'), centered, n.spacer('flex')], { grow: true })), decor: decor(ctx, { free: 'bl' }) };
  },
});

def({
  id: 'slide.rail',
  summary: 'Rail vertical à fond perdu portant le titre tourné, corps à droite.',
  tags: ['bold', 'editorial', 'structured'],
  params: { rail: ['brand', 'ink', 'brand-soft'], body: ['flow', 'grid2'] },
  fit: (a, f) => (a.titleLength > 70 ? 0.3 : weightFit(a, 0.8, f)),
  regions: () => [
    { x: 0, y: 0, w: 12, h: 100, kind: 'band' },
    { x: 16, y: 0, w: 84, h: 100, kind: 'body' },
  ],
  build(ctx) {
    const rail = n.box([n.stack([n.text('title', 'title', { size: 'xl', rotate: 'up' })], { grow: true, justify: 'end' })], { surface: ctx.params.rail as 'brand' | 'ink' | 'brand-soft', bleed: ['t', 'l', 'b'], pad: { r: 'md', b: 'lg' }, role: 'header' });
    const head = n.stack([...(ctx.section.kicker ? [n.text('kicker', 'kicker')] : []), ...(ctx.section.lede ? [n.text('lede', 'lede')] : [])], { gap: 'sm' });
    const main = n.stack([head, n.stack([body(ctx, ctx.analysis.blocks, layoutOf(ctx.params), { width: share(ctx, 10) })], { grow: true, justify: 'center' })], { gap: 'lg', grow: true });
    return { root: n.grid([2, 10], [rail, withFooter(ctx, main)], { gap: 'xl', align: 'stretch', grow: true }), decor: decor(ctx, { free: 'tr', bands: true }) };
  },
});

def({
  id: 'slide.split',
  summary: 'En-tête compact, corps en deux colonnes égales équilibrées (filet vertical possible).',
  tags: ['structured', 'editorial', 'dense'],
  params: { divider: [false, true] },
  fit: (a, f) => (a.blocks.length < 2 || a.blocks.some((b) => b.wide && b.weight > 0.25) ? 0.15 : weightFit(a, 0.74, f)),
  regions: () => [
    { x: 0, y: 0, w: 100, h: 18, kind: 'header' },
    { x: 0, y: 22, w: 48, h: 78, kind: 'body' },
    { x: 52, y: 22, w: 48, h: 78, kind: 'body' },
  ],
  build(ctx) {
    // Répartition équilibrée par poids, l'ordre de lecture gardé.
    const blocks = ctx.analysis.blocks;
    const total = blocks.reduce((s, b) => s + b.weight, 0);
    let acc = 0;
    let cut = 1;
    for (let i = 0; i < blocks.length; i++) {
      acc += blocks[i].weight;
      if (acc >= total / 2) {
        cut = Math.max(1, Math.min(blocks.length - 1, Math.abs(acc - total / 2) < blocks[i].weight / 2 ? i + 1 : i || 1));
        break;
      }
    }
    const w = share(ctx, 6);
    const left = body(ctx, blocks.slice(0, cut), 'flow', { width: w });
    const right = body(ctx, blocks.slice(cut), 'flow', { width: w });
    const cols = ctx.params.divider ? n.grid([6, 0.08, 6], [left, n.rule({ vertical: true }), right], { gap: 'lg', grow: true }) : n.grid(2, [left, right], { gap: 'xl', grow: true });
    return { root: withFooter(ctx, n.stack([header(ctx, { size: 'xl', lede: ctx.analysis.weight < 0.4 }), cols], { gap: 'lg', grow: true })), decor: decor(ctx, { free: 'tr' }) };
  },
});

def({
  id: 'slide.base',
  summary: 'Corps en haut, en-tête ancré en BAS de page : la silhouette inversée.',
  tags: ['bold', 'editorial', 'unexpected'],
  params: { rule: [true, false], body: ['flow', 'grid2', 'row'] },
  fit: (a, f) => weightFit(a, 0.6, f),
  regions: () => [
    { x: 0, y: 0, w: 100, h: 62, kind: 'body' },
    { x: 0, y: 70, w: 100, h: 30, kind: 'header' },
  ],
  build(ctx) {
    const top = n.stack([body(ctx, ctx.analysis.blocks, layoutOf(ctx.params))], { grow: true, justify: 'center' });
    const head = n.stack([...(ctx.params.rule ? [n.rule({ weight: 'thin' })] : []), header(ctx, { size: '2xl' })], { gap: 'md' });
    return { root: n.stack([top, head], { gap: 'xl', grow: true }), decor: decor(ctx, { free: 'tr' }) };
  },
});

def({
  id: 'slide.inset',
  summary: 'Tout est posé dans un cadre (aplat ou filet) : la page dans la page.',
  tags: ['calm', 'elegant', 'framed'],
  params: { surface: ['raised', 'none'], body: ['flow', 'grid2'] },
  fit: (a, f) => weightFit(a, 0.62, f),
  regions: () => [{ x: 4, y: 6, w: 92, h: 88, kind: 'body' }],
  build(ctx) {
    const raised = ctx.params.surface === 'raised';
    const panel = n.box([n.stack([header(ctx, { size: '2xl' }), n.stack([body(ctx, ctx.analysis.blocks, layoutOf(ctx.params), { width: share(ctx, 11) })], { grow: true, justify: 'center' })], { gap: 'lg', grow: true })], {
      surface: raised ? 'raised' : undefined,
      border: raised ? undefined : { weight: 'thin', ink: 'emphasis' },
      radius: 'md',
      pad: 'xl',
      grow: true,
    });
    return { root: n.stack([panel], { grow: true }), decor: decor(ctx, { free: 'br', avoidFrame: true }) };
  },
});

def({
  id: 'slide.hero-figure',
  summary: 'Le chiffre-clé, le graphique ou la citation porte la page ; l’en-tête et le reste à côté.',
  tags: ['bold', 'data', 'impact'],
  params: { side: ['left', 'right'] },
  fit: (a, f) => (!a.hero ? 0 : a.blocks.length > 3 ? 0.35 : 0.95),
  regions: (p) => [
    { x: p.side === 'left' ? 0 : 52, y: 0, w: 48, h: 100, kind: 'figure' },
    { x: p.side === 'left' ? 52 : 0, y: 0, w: 48, h: 100, kind: 'header' },
  ],
  build(ctx) {
    const hero = ctx.analysis.hero ?? ctx.analysis.blocks[0];
    const heroVariant = hero.kind === 'metrics' ? { ...ctx.variant(hero, share(ctx, 6)), style: 'hero' } : hero.kind === 'quote' ? { style: 'pull' } : ctx.variant(hero, share(ctx, 6));
    const heroNode = n.stack([n.block(hero.id, { variant: heroVariant })], { justify: 'center' });
    const rest = ctx.analysis.blocks.filter((b) => b.id !== hero.id);
    const side = n.stack([header(ctx, { size: '2xl' }), body(ctx, rest, 'flow', { width: share(ctx, 6) })], { gap: 'lg', justify: 'center' });
    const grid = n.grid(2, ctx.params.side === 'left' ? [heroNode, side] : [side, heroNode], { gap: '2xl', align: 'stretch', grow: true });
    return { root: withFooter(ctx, grid), decor: decor(ctx, { free: ctx.params.side === 'left' ? 'tl' : 'tr' }) };
  },
});

def({
  id: 'slide.panel',
  summary: 'L’en-tête sur un panneau de couleur à fond perdu (gauche), le corps à droite.',
  tags: ['bold', 'corporate', 'colorful'],
  params: { panel: ['brand', 'brand-soft', 'ink'], ratio: [4, 5] },
  fit: (a, f) => (a.blocks.some((b) => b.wide && b.kind !== 'chart' && b.kind !== 'cards') ? 0.3 : weightFit(a, 0.56, f)),
  regions: (p) => [
    { x: 0, y: 0, w: (Number(p.ratio) / 12) * 100, h: 100, kind: 'band' },
    { x: (Number(p.ratio) / 12) * 100 + 4, y: 0, w: 96 - (Number(p.ratio) / 12) * 100, h: 100, kind: 'body' },
  ],
  build(ctx) {
    const r = Number(ctx.params.ratio);
    const panel = n.box([n.stack([header(ctx, { size: '2xl' })], { grow: true, justify: 'center' })], { surface: ctx.params.panel as 'brand' | 'brand-soft' | 'ink', bleed: ['t', 'l', 'b'], pad: { r: 'xl' } });
    const main = withFooter(ctx, n.stack([body(ctx, ctx.analysis.blocks, 'flow', { width: share(ctx, 12 - r) })], { grow: true, justify: 'center' }));
    return { root: n.grid([r, 12 - r], [panel, main], { gap: '2xl', align: 'stretch', grow: true }), decor: decor(ctx, { free: 'tr', bands: true }) };
  },
});

def({
  id: 'slide.magazine',
  summary: 'Grand titre sur huit douzièmes, chapô dans la colonne de droite, corps dessous.',
  tags: ['editorial', 'elegant', 'bold'],
  params: { titleCols: [7, 8], body: ['flow', 'grid2', 'row'] },
  fit: (a, f) => (!a.hasLede ? 0.4 : weightFit(a, 0.64, f)),
  regions: (p) => [
    { x: 0, y: 0, w: (Number(p.titleCols) / 12) * 100, h: 34, kind: 'header' },
    { x: (Number(p.titleCols) / 12) * 100 + 3, y: 10, w: 100 - (Number(p.titleCols) / 12) * 100 - 3, h: 24, kind: 'aside' },
    { x: 0, y: 40, w: 100, h: 60, kind: 'body' },
  ],
  build(ctx) {
    const c = Number(ctx.params.titleCols);
    const title = n.stack([...(ctx.section.kicker ? [n.text('kicker', 'kicker')] : []), n.text('title', 'title', { size: '3xl' })], { gap: 'sm' });
    const lede = ctx.section.lede ? n.stack([n.text('lede', 'lede')], { justify: 'end' }) : n.spacer('none');
    const top = n.grid([c, 12 - c], [title, lede], { gap: 'xl', align: 'end', role: 'header' });
    const main = n.stack([top, ctx.look.accent === 'underline' ? n.rule({ weight: 'thick', ink: 'emphasis', length: 'short' }) : n.rule({ weight: 'hair' }), n.stack([body(ctx, ctx.analysis.blocks, layoutOf(ctx.params))], { grow: true, justify: 'center' })], { gap: 'lg', grow: true });
    return { root: withFooter(ctx, main), decor: decor(ctx, { free: 'br' }) };
  },
});

def({
  id: 'slide.statement',
  summary: 'Une page qui respire : un titre de déclaration, son chapô, un seul bloc.',
  tags: ['bold', 'minimal', 'impact'],
  params: { align: ['start', 'center'] },
  fit: (a, f) => (a.light ? 1 : a.weight < 0.3 ? 0.6 : 0),
  regions: (p) => [{ x: p.align === 'center' ? 12 : 0, y: 20, w: p.align === 'center' ? 76 : 80, h: 60, kind: 'header' }],
  build(ctx) {
    const align = ctx.params.align === 'center' ? 'center' : 'start';
    const inner = n.stack([header(ctx, { titleRole: 'display', size: '4xl', align }), body(ctx, ctx.analysis.blocks, 'flow', { width: share(ctx, 10) })], { gap: 'xl', align: align === 'center' ? 'center' : undefined });
    return { root: withFooter(ctx, n.stack([n.spacer('flex'), inner, n.spacer('flex')], { grow: true })), decor: decor(ctx, { free: align === 'center' ? 'br' : 'tr' }) };
  },
});

def({
  id: 'slide.corner',
  summary: 'En-tête dans le quart haut-gauche, corps pleine largeur dessous, beaucoup d’air à droite.',
  tags: ['calm', 'swiss', 'minimal'],
  params: { body: ['flow', 'grid2', 'row'], headerCols: [6, 7] },
  fit: (a, f) => weightFit(a, 0.66, f),
  regions: (p) => [
    { x: 0, y: 0, w: (Number(p.headerCols) / 12) * 100, h: 32, kind: 'header' },
    { x: 0, y: 40, w: 100, h: 60, kind: 'body' },
  ],
  build(ctx) {
    const c = Number(ctx.params.headerCols);
    const top = n.grid([c, 12 - c], [header(ctx, { size: '2xl' }), n.spacer('none')], { gap: 'xl' });
    return { root: withFooter(ctx, n.stack([top, n.stack([body(ctx, ctx.analysis.blocks, layoutOf(ctx.params))], { grow: true, justify: 'end' })], { gap: 'xl', grow: true })), decor: decor(ctx, { free: 'tr' }) };
  },
});

def({
  id: 'slide.triptych',
  summary: 'En-tête en haut, la matière en trois colonnes égales (cartes, étapes, chiffres).',
  tags: ['structured', 'corporate', 'data'],
  params: { rule: [true, false] },
  fit: (a, f) => {
    const narrow = a.blocks.filter((b) => !b.wide);
    const tri = a.blocks.length === 1 && (a.blocks[0].kind === 'cards' || a.blocks[0].kind === 'steps' || a.blocks[0].kind === 'metrics');
    return tri || narrow.length === 3 ? weightFit(a, 0.7, f) : 0.1;
  },
  regions: () => [
    { x: 0, y: 0, w: 100, h: 24, kind: 'header' },
    { x: 0, y: 30, w: 31, h: 70, kind: 'body' },
    { x: 34.5, y: 30, w: 31, h: 70, kind: 'body' },
    { x: 69, y: 30, w: 31, h: 70, kind: 'body' },
  ],
  build(ctx) {
    const blocks = ctx.analysis.blocks;
    const content =
      blocks.length === 3
        ? body(ctx, blocks, 'cols3')
        : n.stack(blocks.map((b) => n.block(b.id, { variant: { ...ctx.variant(b), ...(b.kind === 'cards' ? { cols: 3 } : {}) } })), { gap: 'md' });
    const parts = [header(ctx, { size: '2xl', rule: ctx.params.rule ? 'full' : undefined }), n.stack([content], { grow: true, justify: 'center' })];
    return { root: withFooter(ctx, n.stack(parts, { gap: 'lg', grow: true })), decor: decor(ctx, { free: 'br' }) };
  },
});

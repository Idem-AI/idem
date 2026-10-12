/**
 * Les motifs des DOCUMENTS PAGINÉS (business plan, rapports) : A4 portrait, en flux.
 *
 * Contrainte propre au flux : la racine est une pile de RANGÉES que le paginateur découpe entre deux
 * pages. Une composition côte à côte n'existe donc qu'À L'INTÉRIEUR d'une rangée (jamais une colonne qui
 * porterait toute la section : ce serait une rangée géante, impossible à couper proprement). Les
 * silhouettes varient par l'ouverture (bandeau, colonne décalée, index en marge, encadré, ouverture
 * aérée, filets, encart latéral, centrage, magazine) et par le rythme des blocs.
 */
import type { NodeT } from '../../contracts/design-spec';
import type { ContentAnalysis } from '../../composition-engine/analyze';
import { body, BodyLayout, decor, footer, header, n, share } from './build';
import { registerPattern } from './registry';
import type { PatternContext, PatternDef } from './types';

type N = NodeT;

const def = (d: Omit<PatternDef, 'family'>): PatternDef => registerPattern({ family: 'document', ...d });
const layoutOf = (ctx: PatternContext): BodyLayout => (String(ctx.params.body ?? 'flow') as BodyLayout);
const two = (n: number): string => String(n).padStart(2, '0');

/** La section se termine par son pied (logo, titre courant), que le paginateur retire s'il resterait seul. */
function close(ctx: PatternContext, rows: N[]): N {
  const mode = ctx.meta.footer ?? 'full';
  const last = mode === 'none' ? [] : [mode === 'logo' ? n.row([n.logo({ height: 'sm' })], { role: 'folio' }) : footer(ctx)];
  return n.stack([...rows, ...last], { gap: 'lg' });
}

/** Les blocs, chacun dans sa propre rangée (ou par paires d'étroits) : ce que le paginateur sait couper. */
function rows(ctx: PatternContext, layout: BodyLayout, width?: number): N[] {
  const b = body(ctx, ctx.analysis.blocks, layout, { width });
  return b.t === 'stack' ? b.children : [b];
}

const any = (): number => 0.8;

def({
  id: 'doc.column',
  summary: 'Ouverture classique (sur-titre, titre, chapô, filet), blocs en une colonne ou par paires.',
  tags: ['calm', 'structured', 'corporate'],
  params: { body: ['flow', 'grid2'], rule: ['full', 'none'] },
  fit: any,
  regions: () => [
    { x: 0, y: 0, w: 100, h: 16, kind: 'header' },
    { x: 0, y: 18, w: 100, h: 82, kind: 'body' },
  ],
  build(ctx) {
    const head = header(ctx, { size: '2xl', rule: ctx.params.rule === 'full' && ctx.look.accent !== 'underline' ? 'full' : undefined });
    return { root: close(ctx, [head, ...rows(ctx, layoutOf(ctx))]), decor: decor(ctx) };
  },
});

def({
  id: 'doc.band',
  summary: 'L’ouverture dans un bandeau de couleur à fond perdu, puis le flux.',
  tags: ['bold', 'corporate', 'colorful'],
  params: { band: ['brand', 'ink', 'brand-soft'], body: ['flow', 'grid2'] },
  fit: any,
  regions: () => [
    { x: 0, y: 0, w: 100, h: 20, kind: 'band' },
    { x: 0, y: 24, w: 100, h: 76, kind: 'body' },
  ],
  build(ctx) {
    const band = n.box([header(ctx, { size: '2xl', lede: false })], { surface: ctx.params.band as 'brand' | 'ink' | 'brand-soft', bleed: ['t', 'l', 'r'], pad: { t: 'xl', b: 'xl' } });
    const lede = ctx.section.lede ? [n.text('lede', 'lede')] : [];
    return { root: close(ctx, [band, ...lede, ...rows(ctx, layoutOf(ctx))]), decor: decor(ctx, { bands: true }) };
  },
});

def({
  id: 'doc.offset',
  summary: 'Colonne de texte décalée : le sur-titre (ou le numéro) en marge, tout le reste dans les 9/12.',
  tags: ['editorial', 'elegant', 'structured'],
  params: { margin: [3, 2] },
  fit: (a: ContentAnalysis) => (a.blocks.some((b) => b.kind === 'businessModel' || (b.kind === 'table' && b.wide)) ? 0.4 : 0.85),
  regions: (p) => [
    { x: 0, y: 0, w: (Number(p.margin) / 12) * 100, h: 12, kind: 'aside' },
    { x: (Number(p.margin) / 12) * 100 + 3, y: 0, w: 97 - (Number(p.margin) / 12) * 100, h: 100, kind: 'body' },
  ],
  build(ctx) {
    const m = Number(ctx.params.margin);
    const cols = [m, 12 - m];
    const side: N[] = [...(ctx.section.kicker ? [n.text('kicker', 'kicker')] : []), ...(ctx.meta.index ? [n.label('number', two(ctx.meta.index), { size: '2xl', ink: ctx.look.accent === 'mark' ? 'emphasis' : 'faint' })] : [])];
    const head = n.grid(cols, [n.stack(side, { gap: 'xs' }), header(ctx, { kicker: false, size: '2xl', mark: false })], { gap: 'lg', role: 'header' });
    const blockRows = rows(ctx, 'flow', share(ctx, 12 - m)).map((row) => (row.t === 'rule' ? row : n.grid(cols, [n.spacer('none'), row], { gap: 'lg' })));
    return { root: close(ctx, [head, ...blockRows]), decor: decor(ctx) };
  },
});

def({
  id: 'doc.indexed',
  summary: 'Un grand numéro de section en marge de l’ouverture ; le corps aligné sur le titre ou pleine largeur.',
  tags: ['structured', 'bold', 'editorial'],
  params: { indent: [true, false] },
  fit: (a: ContentAnalysis) => (a.blocks.length ? 0.8 : 0.3),
  regions: (p) => [
    { x: 0, y: 0, w: 16, h: 14, kind: 'aside' },
    { x: 18, y: 0, w: 82, h: 16, kind: 'header' },
    { x: p.indent ? 18 : 0, y: 20, w: p.indent ? 82 : 100, h: 80, kind: 'body' },
  ],
  build(ctx) {
    const index = ctx.meta.index ? n.label('number', two(ctx.meta.index), { size: '4xl', ink: 'emphasis' }) : n.spacer('none');
    const head = n.grid([2, 10], [index, header(ctx, { size: '2xl', mark: false })], { gap: 'lg', role: 'header', align: 'start' });
    const indent = ctx.params.indent === true;
    const blockRows = rows(ctx, indent ? 'flow' : 'grid2', indent ? share(ctx, 10) : undefined).map((row) => (indent && row.t !== 'rule' ? n.grid([2, 10], [n.spacer('none'), row], { gap: 'lg' }) : row));
    return { root: close(ctx, [head, ...blockRows]), decor: decor(ctx) };
  },
});

def({
  id: 'doc.boxed',
  summary: 'L’ouverture posée dans un encadré (aplat), puis le flux.',
  tags: ['calm', 'corporate', 'soft'],
  params: { surface: ['raised', 'brand-soft'], body: ['flow', 'grid2'] },
  fit: any,
  regions: () => [
    { x: 0, y: 0, w: 100, h: 20, kind: 'band' },
    { x: 0, y: 24, w: 100, h: 76, kind: 'body' },
  ],
  build(ctx) {
    const box = n.box([header(ctx, { size: '2xl' })], { surface: ctx.params.surface as 'raised' | 'brand-soft', pad: 'xl', radius: 'md', role: 'header' });
    return { root: close(ctx, [box, ...rows(ctx, layoutOf(ctx))]), decor: decor(ctx) };
  },
});

def({
  id: 'doc.opener',
  summary: 'Ouverture aérée : du blanc, un titre de déclaration, un filet épais, puis le flux.',
  tags: ['bold', 'editorial', 'impact'],
  params: { space: ['2xl', '3xl'] },
  fit: (a: ContentAnalysis) => (a.light || a.weight < 0.7 ? 0.9 : 0.55),
  regions: () => [
    { x: 0, y: 8, w: 100, h: 22, kind: 'header' },
    { x: 0, y: 34, w: 100, h: 66, kind: 'body' },
  ],
  build(ctx) {
    const head = header(ctx, { titleRole: 'display', size: '3xl' });
    return { root: close(ctx, [n.spacer(ctx.params.space as '2xl' | '3xl'), head, n.rule({ weight: 'thick', ink: 'emphasis' }), ...rows(ctx, 'flow')]), decor: decor(ctx) };
  },
});

def({
  id: 'doc.ruled',
  summary: 'Filet épais en tête, sur-titre posé dessus, filets fins entre les blocs.',
  tags: ['structured', 'swiss', 'dense'],
  params: { body: ['flow', 'grid2'] },
  fit: any,
  regions: () => [
    { x: 0, y: 0, w: 100, h: 2, kind: 'band' },
    { x: 0, y: 3, w: 100, h: 14, kind: 'header' },
    { x: 0, y: 20, w: 100, h: 80, kind: 'body' },
  ],
  build(ctx) {
    const head = n.stack([n.rule({ weight: 'thick', ink: 'ink' }), header(ctx, { size: '2xl' })], { gap: 'sm', role: 'header' });
    const blocks = rows(ctx, layoutOf(ctx));
    const ruled = ctx.look.tension === 'ruled' ? blocks : blocks.flatMap((row, i) => (i ? [n.rule({ weight: 'hair' }), row] : [row]));
    return { root: close(ctx, [head, ...ruled]), decor: decor(ctx) };
  },
});

def({
  id: 'doc.sidebar',
  summary: 'Le premier texte accompagné d’un encart latéral (chiffres, citation ou hypothèse), puis le flux.',
  tags: ['editorial', 'data', 'structured'],
  params: { side: ['right', 'left'] },
  fit: (a: ContentAnalysis) => {
    const text = a.blocks.find((b) => b.kind === 'prose');
    const aside = a.blocks.find((b) => b.kind === 'metrics' || b.kind === 'quote' || b.kind === 'assumption');
    return text && aside ? 0.95 : 0;
  },
  regions: (p) => [
    { x: 0, y: 0, w: 100, h: 16, kind: 'header' },
    { x: p.side === 'left' ? 36 : 0, y: 20, w: 64, h: 40, kind: 'body' },
    { x: p.side === 'left' ? 0 : 70, y: 20, w: 30, h: 40, kind: 'aside' },
    { x: 0, y: 64, w: 100, h: 36, kind: 'body' },
  ],
  build(ctx) {
    const blocks = ctx.analysis.blocks;
    const text = blocks.find((b) => b.kind === 'prose')!;
    const aside = blocks.find((b) => b.kind === 'metrics' || b.kind === 'quote' || b.kind === 'assumption')!;
    const rest = blocks.filter((b) => b.id !== text.id && b.id !== aside.id);
    const asideVariant = aside.kind === 'metrics' ? { style: 'stacked' } : aside.kind === 'quote' ? { style: 'bar' } : ctx.variant(aside, share(ctx, 4));
    const pair = [n.block(text.id, { variant: ctx.variant(text, share(ctx, 8)) }), n.box([n.block(aside.id, { variant: asideVariant })], { surface: 'raised', pad: 'md', radius: 'md' })];
    const row = n.grid(ctx.params.side === 'left' ? [4, 8] : [8, 4], ctx.params.side === 'left' ? pair.reverse() : pair, { gap: 'xl', align: 'start' });
    const restRows = rest.length ? (body(ctx, rest, 'flow') as Extract<N, { t: 'stack' }>).children : [];
    return { root: close(ctx, [header(ctx, { size: '2xl' }), row, ...restRows]), decor: decor(ctx) };
  },
});

def({
  id: 'doc.centered',
  summary: 'Ouverture centrée avec un filet court, corps en colonne.',
  tags: ['elegant', 'calm', 'classic'],
  params: { body: ['flow', 'grid2'] },
  fit: (a: ContentAnalysis) => (a.titleLength > 90 ? 0.4 : 0.75),
  regions: () => [
    { x: 15, y: 0, w: 70, h: 18, kind: 'header' },
    { x: 0, y: 22, w: 100, h: 78, kind: 'body' },
  ],
  build(ctx) {
    const head = n.stack([header(ctx, { size: '2xl', align: 'center', rule: 'none' }), n.rule({ weight: 'thick', ink: 'emphasis', length: 'xshort' })], { gap: 'md', align: 'center', role: 'header' });
    return { root: close(ctx, [head, ...rows(ctx, layoutOf(ctx))]), decor: decor(ctx) };
  },
});

def({
  id: 'doc.magazine',
  summary: 'Titre sur sept douzièmes, chapô aligné en bas dans la colonne de droite, puis le flux.',
  tags: ['editorial', 'bold', 'elegant'],
  params: { body: ['flow', 'grid2'] },
  fit: (a: ContentAnalysis) => (a.hasLede ? 0.85 : 0.2),
  regions: () => [
    { x: 0, y: 0, w: 58, h: 18, kind: 'header' },
    { x: 62, y: 6, w: 38, h: 12, kind: 'aside' },
    { x: 0, y: 22, w: 100, h: 78, kind: 'body' },
  ],
  build(ctx) {
    const title = n.stack([...(ctx.section.kicker ? [n.text('kicker', 'kicker')] : []), n.text('title', 'title', { size: '2xl' })], { gap: 'sm' });
    const head = n.grid([7, 5], [title, ctx.section.lede ? n.stack([n.text('lede', 'lede', { size: 'base' })], { justify: 'end' }) : n.spacer('none')], { gap: 'xl', align: 'end', role: 'header' });
    return { root: close(ctx, [head, n.rule({ weight: ctx.look.accent === 'underline' ? 'thick' : 'thin', ink: ctx.look.accent === 'underline' ? 'emphasis' : undefined }), ...rows(ctx, layoutOf(ctx))]), decor: decor(ctx) };
  },
});

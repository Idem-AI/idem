/**
 * Les motifs de diapositive qui MONTRENT au lieu d'écrire — un par stratégie visuelle de `SlideIntent` :
 *
 *   slide.full-bleed   image en grand, message bref sur un panneau clair (ouverture, vision, problème) ;
 *   slide.illustrated  les points illustrés portent la page (fonctionnalités, bénéfices, difficultés) ;
 *   slide.hub          le message au centre, ses points rayonnent autour (modèle, écosystème, problème) ;
 *   slide.capture      la vraie capture du produit, cadrée, annotée de ses points (solution, produit).
 *
 * Ce sont des références de composition, pas des gabarits obligatoires : le classement les favorise quand
 * l'intention de la page les appelle, et leur `fit` les écarte quand la matière manque (pas d'image, pas de
 * points). Les surfaces restent claires : une image n'impose jamais un thème sombre à la page.
 */
import type { NodeT } from '../../contracts/design-spec';
import type { ContentAnalysis } from '../../composition-engine/analyze';
import { decor, header, n, share } from './build';
import { registerPattern } from './registry';
import { weightFit, withFooter } from './slides';
import type { PatternContext, PatternDef } from './types';

type N = NodeT;
type PointsItem = { label: string; detail?: string; value?: string; icon?: string };

const def = (d: Omit<PatternDef, 'family'>): PatternDef => registerPattern({ family: 'slide', ...d });

const figureOf = (ctx: PatternContext) => ctx.section.blocks.find((b) => b.kind === 'figure');
const pointsOf = (ctx: PatternContext) => ctx.section.blocks.find((b) => b.kind === 'points') as (Extract<PatternContext['section']['blocks'][number], { kind: 'points' }> | undefined);
const others = (ctx: PatternContext, ...skip: Array<string | undefined>) => ctx.analysis.blocks.filter((b) => !skip.includes(b.id));
/** Le poids de ce qui n'est ni l'image ni les points : ce qu'il reste à loger à côté. */
const restWeight = (a: ContentAnalysis, ...kinds: string[]) => a.blocks.filter((b) => !kinds.includes(b.kind)).reduce((s, b) => s + b.weight, 0);
const pointsInfo = (a: ContentAnalysis) => a.blocks.find((b) => b.kind === 'points');
const two = (v: number): string => String(v).padStart(2, '0');

/** Un point posé champ par champ (schéma, annotations) : son icône ou son numéro, son chiffre, son libellé, son détail. */
function pointNode(ctx: PatternContext, blockId: string, item: PointsItem, i: number, align: 'start' | 'end'): N {
  const ref = (field: string) => `${blockId}.items.${i}.${field}`;
  const glyph = item.icon ? ({ t: 'icon', name: item.icon, size: 'md', ink: 'emphasis' } as N) : n.label('number', two(i + 1), { size: 'lg', ink: 'emphasis' });
  const words = n.stack(
    [
      ...(item.value ? [n.text('figure', ref('value'), { size: 'xl', align, maxLines: 1 })] : []),
      n.text('subtitle', ref('label'), { size: 'lg', align }),
      ...(item.detail ? [n.text('small', ref('detail'), { ink: 'muted', align })] : []),
    ],
    { gap: '2xs' }
  );
  const disc = n.box([glyph], { surface: 'brand-soft', radius: 'pill', pad: 'sm' });
  return n.row(align === 'end' ? [words, disc] : [disc, words], { gap: 'md', align: 'center', justify: align === 'end' ? 'end' : 'start' });
}

def({
  id: 'slide.full-bleed',
  needs: ['figure'],
  strategies: ['full-bleed', 'collage'],
  summary: 'L’image occupe la page ; le message bref sur un panneau clair à fond perdu (ou l’image sur sept douzièmes).',
  tags: ['bold', 'impact', 'editorial'],
  params: { layout: ['panel', 'split'], side: ['left', 'right'] },
  fit: (a) => (!a.hasFigure ? 0 : restWeight(a, 'figure') > 0.34 ? 0.2 : 1),
  regions: (p) => {
    const left = p.side === 'left';
    return p.layout === 'panel'
      ? [
          { x: 0, y: 0, w: 100, h: 100, kind: 'figure' },
          { x: left ? 0 : 58, y: 0, w: 42, h: 100, kind: 'header' },
        ]
      : [
          { x: left ? 42 : 0, y: 0, w: 58, h: 100, kind: 'figure' },
          { x: left ? 0 : 62, y: 10, w: 38, h: 80, kind: 'header' },
        ];
  },
  build(ctx) {
    const figure = figureOf(ctx);
    const left = ctx.params.side === 'left';
    const rest = others(ctx, figure?.id);
    const words = n.stack([header(ctx, { titleRole: 'display', size: '3xl' }), ...(rest.length ? [n.stack(rest.map((b) => n.block(b.id, { variant: ctx.variant(b, share(ctx, 5)) })), { gap: 'md' })] : [])], { gap: 'lg' });
    const text = n.stack([words, n.spacer('flex'), n.logo({ height: 'sm' })], { grow: true, gap: 'lg', justify: 'center' });
    if (ctx.params.layout === 'panel') {
      const panel = n.box([text], { surface: 'ground', bleed: left ? ['t', 'l', 'b'] : ['t', 'r', 'b'], pad: left ? { r: 'xl' } : { l: 'xl' }, grow: true });
      const grid = n.grid([5, 7], left ? [panel, n.spacer('none')] : [n.spacer('none'), panel], { gap: 'none', align: 'stretch', grow: true });
      return { root: n.stack([grid], { grow: true }), decor: [{ at: { x: 0, y: 0, w: 100, h: 100 }, z: 0, node: n.image({ ref: figure?.id, grow: true }) }] };
    }
    const photo = n.box([n.image({ ref: figure?.id, grow: true })], { bleed: left ? ['t', 'r', 'b'] : ['t', 'l', 'b'], grow: true, clip: true });
    return { root: n.grid([5, 7], left ? [text, photo] : [photo, text], { gap: '2xl', align: 'stretch', grow: true }) };
  },
});

def({
  id: 'slide.illustrated',
  needs: ['points'],
  strategies: ['illustration'],
  summary: 'Les points illustrés portent la page : une image ou une icône par point, en rangée sous un titre court.',
  tags: ['friendly', 'structured', 'playful', 'calm'],
  params: { head: ['top', 'side'] },
  fit: (a, f) => {
    const p = pointsInfo(a);
    if (!p) return 0;
    return restWeight(a, 'points', 'figure') > 0.3 ? 0.3 : Math.max(0.6, weightFit(a, 0.8, f));
  },
  regions: (p) =>
    p.head === 'side'
      ? [
          { x: 0, y: 0, w: 33, h: 100, kind: 'header' },
          { x: 37, y: 8, w: 63, h: 84, kind: 'body' },
        ]
      : [
          { x: 16.7, y: 0, w: 66.6, h: 28, kind: 'header' },
          { x: 0, y: 34, w: 100, h: 66, kind: 'body' },
        ],
  build(ctx) {
    const points = pointsOf(ctx);
    const rest = others(ctx, points?.id);
    const media = points?.items.some((i) => i.media);
    const side = ctx.params.head === 'side';
    const width = side ? share(ctx, 8) : share(ctx, 12);
    const pointsNode = points ? n.block(points.id, { variant: { style: media ? 'tiles' : side && points.items.length > 3 ? 'list' : 'column', align: 'center' } }) : n.spacer('none');
    const main = n.stack([pointsNode, ...rest.map((b) => n.block(b.id, { variant: ctx.variant(b, width) }))], { gap: 'lg', grow: true, justify: 'center', role: 'body' });
    if (side) {
      const grid = n.grid([4, 8], [n.stack([header(ctx, { size: '2xl' })], { justify: 'center' }), main], { gap: '2xl', align: 'stretch', grow: true });
      return { root: withFooter(ctx, grid), decor: decor(ctx, { free: 'tr' }) };
    }
    // Le titre centré sur une mesure resserrée (huit douzièmes) : il annonce, les points montrent.
    const head = n.grid([2, 8, 2], [n.spacer('none'), header(ctx, { size: '2xl', align: 'center' }), n.spacer('none')], { gap: 'none' });
    return { root: withFooter(ctx, n.stack([head, main], { gap: 'xl', grow: true })), decor: decor(ctx, { free: 'br' }) };
  },
});

def({
  id: 'slide.hub',
  needs: ['points'],
  strategies: ['diagram'],
  summary: 'Le message au centre d’un disque, ses points rayonnent de part et d’autre (schéma de fonctionnement).',
  tags: ['structured', 'bold', 'unexpected'],
  params: { center: ['brand-soft', 'raised'] },
  // Trois à six points sans média (un schéma se lit en icônes), presque rien d'autre, un titre qui tient au centre.
  fit: (a) => (!a.hubPoints ? 0 : restWeight(a, 'points') <= 0.14 && a.titleLength <= 90 ? 1 : 0.15),
  regions: () => [
    { x: 0, y: 14, w: 33, h: 72, kind: 'body' },
    { x: 36, y: 18, w: 28, h: 64, kind: 'header' },
    { x: 67, y: 14, w: 33, h: 72, kind: 'body' },
  ],
  build(ctx) {
    const points = pointsOf(ctx);
    if (!points) return { root: withFooter(ctx, header(ctx)) };
    const items = points.items as PointsItem[];
    const half = Math.ceil(items.length / 2);
    const left = n.stack(items.slice(0, half).map((it, i) => pointNode(ctx, points.id, it, i, 'end')), { gap: 'xl', justify: 'center', role: 'body' });
    const right = n.stack(items.slice(half).map((it, i) => pointNode(ctx, points.id, it, half + i, 'start')), { gap: 'xl', justify: 'center', role: 'body' });
    // Le cœur épouse son titre et se centre dans sa colonne : un disque de sens, pas un panneau étiré.
    const core = n.box([n.stack([...(ctx.section.kicker ? [n.text('kicker', 'kicker', { align: 'center' })] : []), n.text('title', 'title', { size: 'xl', align: 'center', maxLines: 5 })], { gap: 'sm', align: 'center' })], { surface: ctx.params.center as 'brand-soft' | 'raised', radius: 'lg', pad: { x: 'lg', y: '2xl' }, role: 'header' });
    const rest = others(ctx, points.id);
    const grid = n.grid([4, 4, 4], [left, n.stack([core], { justify: 'center', grow: true }), right], { gap: 'xl', align: 'stretch', grow: true });
    const parts: N[] = [grid];
    if (ctx.section.lede) parts.push(n.text('lede', 'lede', { align: 'center' }));
    for (const b of rest) parts.push(n.block(b.id, { variant: ctx.variant(b) }));
    return {
      root: withFooter(ctx, n.stack(parts, { gap: 'lg', grow: true })),
      decor: [{ at: { x: 22, y: 4, w: 56, h: 86 }, z: 0, node: n.shape('rings', { tone: 'soft', opacity: 0.12, size: 'fill', seed: ctx.rng.int(1, 999) }) }],
    };
  },
});

def({
  id: 'slide.capture',
  needs: ['figure'],
  strategies: ['product-capture'],
  summary: 'La vraie capture du produit, encadrée sur sept douzièmes ; le titre et les annotations numérotées à côté.',
  tags: ['structured', 'calm', 'corporate'],
  params: { side: ['left', 'right'] },
  fit: (a) => (!a.hasFigure ? 0 : restWeight(a, 'figure', 'points') > 0.3 ? 0.25 : 0.8),
  regions: (p) => [
    { x: p.side === 'left' ? 0 : 42, y: 6, w: 58, h: 86, kind: 'body' },
    { x: p.side === 'left' ? 62 : 0, y: 6, w: 38, h: 86, kind: 'header' },
  ],
  build(ctx) {
    const figure = figureOf(ctx);
    const points = pointsOf(ctx);
    const left = ctx.params.side === 'left';
    // Un cadre au ratio d'un écran, centré : la capture entière, lue par le HAUT si son ratio diffère
    // (barre, navigation), jamais bordée de vide ni étirée sur la hauteur de la page.
    const shot = n.box([n.image({ ref: figure?.id, fit: 'cover', focal: { x: 0.5, y: 0 }, ratio: 1.6 })], { surface: 'raised', border: { weight: 'thin' }, radius: 'lg', pad: 'sm', clip: true });
    const frame = n.stack([shot], { justify: 'center', grow: true, role: 'body' });
    const rest = others(ctx, figure?.id, points?.id);
    const notes = points ? [n.stack((points.items as PointsItem[]).map((it, i) => pointNode(ctx, points.id, { ...it, icon: undefined }, i, 'start')), { gap: 'md' })] : [];
    const side = n.stack([header(ctx, { size: '2xl' }), ...notes, ...rest.map((b) => n.block(b.id, { variant: ctx.variant(b, share(ctx, 5)) }))], { gap: 'lg', justify: 'center' });
    const grid = n.grid(left ? [7, 5] : [5, 7], left ? [frame, side] : [side, frame], { gap: '2xl', align: 'stretch', grow: true });
    return { root: withFooter(ctx, grid), decor: decor(ctx, { free: left ? 'tr' : 'tl' }) };
  },
});

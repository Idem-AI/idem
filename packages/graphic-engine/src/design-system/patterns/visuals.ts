/**
 * Les motifs des VISUELS (flyers, publications, affiches A4) et des COUVERTURES de réseaux.
 *
 * Le texte d'un visuel tient dans un bloc `copy` (sur-titre, titre, sous-titre, offre, faits, citation) et
 * sa photo dans un bloc `figure` (celle de l'utilisateur, de la marque, de banque ou générée — toujours
 * SANS texte). Un visuel ne porte jamais de bouton ni de mot inventé : seuls les mots du bloc existent.
 *
 * Le texte posé sur une photo est posé sur un VOILE (dégradé à l'encre profonde de la marque) et la page
 * déclare un fond profond : les encres se calculent contre lui, et le contrôle mesure ensuite le contraste
 * réel sur les pixels.
 */
import type { NodeT } from '../../contracts/design-spec';
import type { ContentAnalysis } from '../../composition-engine/analyze';
import type { FormatFamily } from '../formats';
import { decor, n } from './build';
import { registerPattern } from './registry';
import type { PatternContext, PatternDef } from './types';

type N = NodeT;
type TextOpts = Partial<Extract<N, { t: 'text' }>>;

interface Copy {
  id: string;
  has: (field: 'kicker' | 'subhead' | 'body' | 'offer' | 'facts' | 'quote' | 'footnote') => boolean;
  facts: number;
}

function copyOf(ctx: PatternContext): Copy | null {
  const b = ctx.section.blocks.find((x) => x.kind === 'copy');
  if (!b || b.kind !== 'copy') return null;
  return { id: b.id, has: (f) => Boolean((b as Record<string, unknown>)[f]), facts: b.facts?.length ?? 0 };
}

const photoOf = (ctx: PatternContext): string | undefined => ctx.section.blocks.find((b) => b.kind === 'figure')?.id;

const hasCopy = (a: ContentAnalysis): boolean => a.kinds.has('copy');
const hasPhoto = (a: ContentAnalysis): boolean => a.kinds.has('figure');

/** Les mots du visuel, dans l'ordre de lecture ; chaque texte est une référence au bloc. */
function words(ctx: PatternContext, o: { align?: 'start' | 'center' | 'end'; size?: TextOpts['size']; offer?: boolean; subhead?: boolean; facts?: boolean } = {}): N[] {
  const c = copyOf(ctx);
  if (!c) return [n.text('display', 'title', { align: o.align })];
  const out: N[] = [];
  if (c.has('kicker')) out.push(n.text('kicker', `${c.id}.kicker`, { align: o.align }));
  if (o.offer !== false && c.has('offer')) out.push(n.text('number', `${c.id}.offer`, { align: o.align, size: '6xl', maxLines: 1, ink: 'heading' }));
  out.push(n.text('display', `${c.id}.headline`, { align: o.align, size: o.size ?? '5xl', maxLines: 4 }));
  if (o.subhead !== false && c.has('subhead')) out.push(n.text('lede', `${c.id}.subhead`, { align: o.align, size: 'xl' }));
  if (o.facts !== false) for (let i = 0; i < Math.min(3, c.facts); i++) out.push(n.text('label', `${c.id}.facts.${i}.text`, { align: o.align, ink: 'ink', size: 'base' }));
  return out;
}

const vdef = (d: Omit<PatternDef, 'family'>, family: FormatFamily = 'visual'): PatternDef => registerPattern({ family, roles: ['visual'], ...d });

vdef({
  id: 'visual.photo-scrim',
  summary: 'Photo plein cadre, voile en pied, le titre posé dessus ; logo en haut.',
  tags: ['photo', 'bold', 'impact'],
  params: { anchor: ['bottom', 'top'] },
  fit: (a) => (hasPhoto(a) && hasCopy(a) ? 1 : 0),
  regions: (p) => [
    { x: 0, y: 0, w: 100, h: 100, kind: 'figure' },
    { x: 0, y: p.anchor === 'top' ? 8 : 58, w: 90, h: 34, kind: 'header' },
  ],
  build(ctx) {
    const top = ctx.params.anchor === 'top';
    const text = n.stack(words(ctx), { gap: 'md' });
    const root = n.stack(top ? [n.logo({ height: 'lg' }), text, n.spacer('flex')] : [n.logo({ height: 'lg' }), n.spacer('flex'), text], { grow: true, gap: 'lg' });
    return { ground: 'ink', root, decor: [{ at: { x: 0, y: 0, w: 100, h: 100 }, z: 0, node: n.image({ ref: photoOf(ctx), overlay: top ? 'scrim-top' : 'scrim-bottom', grow: true }) }] };
  },
});

vdef({
  id: 'visual.photo-split',
  summary: 'La photo sur une moitié (à fond perdu), le texte sur l’autre, sur le fond ou la couleur de marque.',
  tags: ['photo', 'structured', 'calm'],
  params: { side: ['start', 'end'], panel: ['ground', 'brand'] },
  fit: (a) => (hasPhoto(a) && hasCopy(a) ? 0.95 : 0),
  regions: (p) => [
    { x: p.side === 'start' ? 0 : 50, y: 0, w: 50, h: 100, kind: 'figure' },
    { x: p.side === 'start' ? 54 : 4, y: 10, w: 42, h: 80, kind: 'header' },
  ],
  build(ctx) {
    const portrait = ctx.format.orientation === 'portrait' || ctx.format.height > ctx.format.width * 1.1;
    const start = ctx.params.side === 'start';
    const bleed: Array<'t' | 'r' | 'b' | 'l'> = portrait ? (start ? ['t', 'l', 'r'] : ['b', 'l', 'r']) : start ? ['t', 'l', 'b'] : ['t', 'r', 'b'];
    const photo = n.box([n.image({ ref: photoOf(ctx), grow: true })], { bleed, grow: true, clip: true });
    const text = n.box([n.stack([n.logo({ height: 'md' }), n.spacer('flex'), ...words(ctx, { size: '4xl' })], { gap: 'md', grow: true })], { surface: ctx.params.panel === 'brand' ? 'brand' : undefined, pad: ctx.params.panel === 'brand' ? 'lg' : undefined, grow: true });
    const parts = start ? [photo, text] : [text, photo];
    return { root: portrait ? n.stack(parts, { grow: true, gap: 'xl' }) : n.grid(2, parts, { gap: '2xl', align: 'stretch', grow: true }) };
  },
});

vdef({
  id: 'visual.photo-frame',
  summary: 'La photo encadrée par la marge, arrondie ; le titre dessous ; logo en tête.',
  tags: ['photo', 'calm', 'elegant'],
  params: { ratio: [1.2, 1.5] },
  fit: (a) => (hasPhoto(a) && hasCopy(a) ? 0.85 : 0),
  regions: () => [
    { x: 0, y: 10, w: 100, h: 52, kind: 'figure' },
    { x: 0, y: 66, w: 100, h: 34, kind: 'header' },
  ],
  build(ctx) {
    return { root: n.stack([n.row([n.logo({ height: 'md' })]), n.image({ ref: photoOf(ctx), radius: 'lg', grow: true }), n.stack(words(ctx, { size: '4xl', facts: false }), { gap: 'sm' })], { grow: true, gap: 'lg' }), decor: decor(ctx, { free: 'tr' }) };
  },
});

vdef({
  id: 'visual.type-hero',
  summary: 'Typographie seule : un titre géant, son sur-titre, une forme de la marque dans un angle.',
  tags: ['type', 'bold', 'impact'],
  params: { ground: ['brand', 'ground'], shape: ['rings', 'quarter-circles', 'burst', 'arcs'] },
  fit: (a) => (hasCopy(a) && !hasPhoto(a) ? 1 : 0),
  regions: () => [
    { x: 0, y: 30, w: 90, h: 50, kind: 'header' },
    { x: 60, y: 0, w: 40, h: 40, kind: 'decor' },
  ],
  build(ctx) {
    const root = n.stack([n.logo({ height: 'md' }), n.spacer('flex'), ...words(ctx, { size: '6xl' }), n.spacer('lg')], { grow: true, gap: 'md' });
    return { ground: ctx.params.ground === 'brand' ? 'brand' : undefined, root, decor: [{ at: { x: 58, y: -10, w: 52, h: 46 }, z: 0, node: n.shape(ctx.params.shape as 'rings', { tone: ctx.params.ground === 'brand' ? 'on-brand' : 'brand', opacity: ctx.params.ground === 'brand' ? 0.22 : 0.9, size: 'fill', seed: ctx.rng.int(1, 999) }) }] };
  },
});

vdef({
  id: 'visual.band',
  summary: 'La photo plein cadre, un bandeau de couleur en travers porte le titre.',
  tags: ['photo', 'bold', 'corporate'],
  params: { band: ['brand', 'ink'] },
  fit: (a) => (hasPhoto(a) && hasCopy(a) ? 0.85 : 0),
  regions: () => [
    { x: 0, y: 0, w: 100, h: 100, kind: 'figure' },
    { x: 0, y: 56, w: 100, h: 32, kind: 'band' },
  ],
  build(ctx) {
    const band = n.box([n.stack(words(ctx, { size: '4xl', facts: false }), { gap: 'sm' })], { surface: ctx.params.band as 'brand' | 'ink', bleed: ['l', 'r'], pad: { t: 'lg', b: 'lg' } });
    return { root: n.stack([n.box([n.logo({ height: 'md' })], { surface: 'ground', pad: 'sm', radius: 'sm' }), n.spacer('flex'), band, n.spacer('lg')], { grow: true, align: 'start' }), decor: [{ at: { x: 0, y: 0, w: 100, h: 100 }, z: 0, node: n.image({ ref: photoOf(ctx), grow: true }) }] };
  },
});

vdef({
  id: 'visual.offer',
  summary: 'L’offre en chiffre géant, le titre dessous ; une gerbe de rayons en fond.',
  tags: ['promo', 'bold', 'impact'],
  params: { ground: ['brand', 'accent-soft'] },
  fit: (a) => (hasCopy(a) && !hasPhoto(a) ? 0.3 : 0),
  regions: () => [
    { x: 0, y: 20, w: 90, h: 30, kind: 'figure' },
    { x: 0, y: 54, w: 90, h: 30, kind: 'header' },
  ],
  build(ctx) {
    const c = copyOf(ctx);
    const parts = c?.has('offer') ? words(ctx, { size: '4xl' }) : words(ctx, { size: '6xl' });
    return { ground: ctx.params.ground === 'brand' ? 'brand' : 'accent-soft', root: n.stack([n.logo({ height: 'md' }), n.spacer('flex'), ...parts, n.spacer('flex')], { grow: true, gap: 'md' }), decor: [{ at: { x: -10, y: -10, w: 120, h: 120 }, z: 0, node: n.shape('burst', { tone: ctx.params.ground === 'brand' ? 'on-brand' : 'soft', opacity: 0.14, size: 'fill', seed: ctx.rng.int(1, 999) }) }] };
  },
});

vdef({
  id: 'visual.quote',
  summary: 'Un témoignage : la citation en grand, son auteur, un grand guillemet.',
  tags: ['quote', 'calm', 'warm'],
  params: { ground: ['brand-soft', 'ground'] },
  fit: (a) => (hasCopy(a) && !hasPhoto(a) ? 0.2 : 0),
  regions: () => [{ x: 0, y: 20, w: 92, h: 60, kind: 'header' }],
  build(ctx) {
    const c = copyOf(ctx);
    const quote = c?.has('quote')
      ? [n.label('number', '“', { size: '6xl', ink: 'emphasis' }), n.text('quote', `${c.id}.quote.text`, { size: '3xl' }), n.text('label', `${c.id}.quote.author`)]
      : words(ctx, { size: '4xl' });
    return { ground: ctx.params.ground as 'brand-soft', root: n.stack([n.spacer('flex'), ...quote, n.spacer('flex'), n.logo({ height: 'md' })], { grow: true, gap: 'md' }) };
  },
});

vdef({
  id: 'visual.event',
  summary: 'Un événement : la date en bloc de couleur, le titre, les faits ; photo en fond si elle existe.',
  tags: ['event', 'structured', 'bold'],
  params: { block: ['brand', 'ink'] },
  fit: (a) => (hasCopy(a) && !hasPhoto(a) ? 0.35 : 0),
  regions: () => [
    { x: 0, y: 8, w: 34, h: 20, kind: 'band' },
    { x: 0, y: 34, w: 92, h: 40, kind: 'header' },
  ],
  build(ctx) {
    const c = copyOf(ctx);
    const date = c && c.facts ? n.box([n.text('title', `${c.id}.facts.0.text`, { size: '2xl' })], { surface: ctx.params.block as 'brand' | 'ink', pad: 'md', radius: 'sm' }) : n.spacer('none');
    const kicker = c?.has('kicker') ? [n.text('kicker', `${c.id}.kicker`)] : [];
    const head = c ? [n.text('display', `${c.id}.headline`, { size: '5xl', maxLines: 4 }), ...(c.has('subhead') ? [n.text('lede', `${c.id}.subhead`)] : [])] : [];
    const facts = c ? Array.from({ length: Math.max(0, Math.min(3, c.facts) - 1) }, (_, i) => n.text('label', `${c.id}.facts.${i + 1}.text`, { ink: 'ink' })) : [];
    return { root: n.stack([n.row([date, n.spacer('flex'), n.logo({ height: 'md' })], { align: 'start' }), n.spacer('flex'), ...kicker, ...head, ...facts], { grow: true, gap: 'md' }), decor: decor(ctx, { free: 'br' }) };
  },
});

vdef({
  id: 'visual.geometric',
  summary: 'Une composition géométrique (quarts de cercle, demi-disques) sur une moitié, le titre sur l’autre.',
  tags: ['playful', 'bauhaus', 'colorful'],
  params: { shape: ['quarter-circles', 'half-discs', 'triangles', 'checker'], side: ['end', 'start'] },
  fit: (a) => (hasCopy(a) && !hasPhoto(a) ? 0.8 : 0),
  regions: (p) => [
    { x: p.side === 'end' ? 50 : 0, y: 0, w: 50, h: 100, kind: 'decor' },
    { x: p.side === 'end' ? 0 : 52, y: 20, w: 46, h: 60, kind: 'header' },
  ],
  build(ctx) {
    const portrait = ctx.format.height > ctx.format.width * 1.1;
    const end = ctx.params.side === 'end';
    const at = portrait ? { x: -2, y: end ? 56 : -2, w: 104, h: 46 } : { x: end ? 52 : -2, y: -2, w: 50, h: 104 };
    const text = n.stack([n.logo({ height: 'md' }), n.spacer('flex'), ...words(ctx, { size: '4xl' })], { gap: 'md', grow: true });
    const root = portrait ? n.stack(end ? [text, n.spacer('3xl')] : [n.spacer('3xl'), text], { grow: true }) : n.grid(2, end ? [text, n.spacer('none')] : [n.spacer('none'), text], { grow: true, gap: '2xl' });
    return { root, decor: [{ at, z: 0, node: n.shape(ctx.params.shape as 'quarter-circles', { tone: 'brand', size: 'fill', seed: ctx.rng.int(1, 999) }) }] };
  },
});

vdef({
  id: 'visual.diagonal',
  summary: 'Un pan oblique de couleur traverse la toile ; le titre sur la partie claire.',
  tags: ['dynamic', 'bold'],
  params: {},
  fit: (a) => (hasCopy(a) && !hasPhoto(a) ? 0.55 : 0),
  regions: () => [
    { x: 0, y: 45, w: 100, h: 55, kind: 'decor' },
    { x: 0, y: 8, w: 90, h: 40, kind: 'header' },
  ],
  build(ctx) {
    return { root: n.stack([n.logo({ height: 'md' }), ...words(ctx, { size: '5xl', facts: false }), n.spacer('flex')], { grow: true, gap: 'md' }), decor: [{ at: { x: -2, y: 48, w: 104, h: 54 }, z: 0, node: n.shape('slant', { tone: 'brand', size: 'fill', seed: ctx.rng.int(1, 999) }) }] };
  },
});

vdef({
  id: 'visual.circle-photo',
  summary: 'La photo dans un cercle, le titre à côté (ou dessous en portrait).',
  tags: ['photo', 'friendly', 'warm'],
  params: { side: ['start', 'end'] },
  fit: (a) => (hasPhoto(a) && hasCopy(a) ? 0.75 : 0),
  regions: (p) => [
    { x: p.side === 'start' ? 0 : 52, y: 20, w: 46, h: 60, kind: 'figure' },
    { x: p.side === 'start' ? 52 : 0, y: 25, w: 46, h: 50, kind: 'header' },
  ],
  build(ctx) {
    const portrait = ctx.format.height > ctx.format.width * 1.1;
    const circle = n.image({ ref: photoOf(ctx), radius: 'pill', ratio: 1 });
    const text = n.stack(words(ctx, { size: '4xl' }), { gap: 'md', justify: 'center' });
    const pair = ctx.params.side === 'start' ? [circle, text] : [text, circle];
    return { root: n.stack([n.logo({ height: 'md' }), portrait ? n.stack(pair, { grow: true, gap: 'xl', justify: 'center' }) : n.grid(2, pair, { grow: true, gap: '2xl', align: 'center' })], { grow: true, gap: 'lg' }), decor: decor(ctx, { free: 'br' }) };
  },
});

vdef({
  id: 'visual.minimal',
  summary: 'Beaucoup d’air : un titre mesuré, une ligne d’emphase, le logo en pied.',
  tags: ['minimal', 'calm', 'elegant'],
  params: { align: ['start', 'center'] },
  fit: (a) => (hasCopy(a) && !hasPhoto(a) ? 0.6 : 0),
  regions: (p) => [{ x: p.align === 'center' ? 15 : 0, y: 30, w: 70, h: 36, kind: 'header' }],
  build(ctx) {
    const align = ctx.params.align === 'center' ? 'center' : 'start';
    return { root: n.stack([n.spacer('flex'), ...words(ctx, { size: '3xl', align }), n.rule({ weight: 'thick', ink: 'emphasis', length: 'short' }), n.spacer('flex'), n.logo({ height: 'sm' })], { grow: true, gap: 'md', align: align === 'center' ? 'center' : undefined }), decor: decor(ctx, { free: 'tr' }) };
  },
});

// ── Couvertures de profil (Facebook, LinkedIn, X, YouTube) et photo de profil ───────────────

vdef(
  {
    id: 'banner.logo-left',
    summary: 'Le logo, puis le titre et la signature, dans la zone sûre ; une forme de la marque à droite.',
    tags: ['corporate', 'calm'],
    params: { shape: ['arcs', 'rings', 'quarter-circles', 'stripes'] },
    fit: (a) => (hasCopy(a) && !hasPhoto(a) ? 1 : 0),
    regions: () => [
      { x: 30, y: 20, w: 50, h: 60, kind: 'header' },
      { x: 78, y: 0, w: 22, h: 100, kind: 'decor' },
    ],
    build(ctx) {
      const c = copyOf(ctx);
      const text = n.stack([n.text('title', c ? `${c.id}.headline` : 'title', { size: '2xl', maxLines: 2 }), ...(c?.has('subhead') ? [n.text('lede', `${c.id}.subhead`, { size: 'lg' })] : [])], { gap: 'xs', justify: 'center' });
      return { root: n.row([n.logo({ height: 'lg' }), n.rule({ vertical: true }), text], { gap: 'xl', align: 'center', grow: true }), decor: [{ at: { x: 80, y: -10, w: 24, h: 120 }, z: 0, node: n.shape(ctx.params.shape as 'arcs', { tone: 'brand', size: 'fill', seed: ctx.rng.int(1, 999) }) }] };
    },
  },
  'cover'
);

vdef(
  {
    id: 'banner.centered',
    summary: 'Le titre et la signature centrés, sur la couleur de marque ou le fond.',
    tags: ['bold', 'minimal'],
    params: { ground: ['brand', 'ground'] },
    fit: (a) => (hasCopy(a) && !hasPhoto(a) ? 0.9 : 0),
    regions: () => [{ x: 25, y: 25, w: 50, h: 50, kind: 'header' }],
    build(ctx) {
      const c = copyOf(ctx);
      return { ground: ctx.params.ground === 'brand' ? 'brand' : undefined, root: n.stack([n.spacer('flex'), n.text('title', c ? `${c.id}.headline` : 'title', { size: '2xl', align: 'center', maxLines: 2 }), ...(c?.has('subhead') ? [n.text('lede', `${c.id}.subhead`, { align: 'center' })] : []), n.spacer('flex')], { grow: true, align: 'center', gap: 'xs' }), decor: decor(ctx, { free: 'br' }) };
    },
  },
  'cover'
);

vdef(
  {
    id: 'banner.photo',
    summary: 'La photo plein cadre sous un voile, le titre et le logo dans la zone sûre.',
    tags: ['photo', 'bold'],
    params: {},
    fit: (a) => (hasPhoto(a) && hasCopy(a) ? 1 : 0),
    regions: () => [
      { x: 0, y: 0, w: 100, h: 100, kind: 'figure' },
      { x: 30, y: 30, w: 50, h: 40, kind: 'header' },
    ],
    build(ctx) {
      const c = copyOf(ctx);
      return { ground: 'ink', root: n.row([n.logo({ height: 'lg' }), n.stack([n.text('title', c ? `${c.id}.headline` : 'title', { size: '2xl', maxLines: 2 }), ...(c?.has('subhead') ? [n.text('lede', `${c.id}.subhead`)] : [])], { gap: 'xs' })], { gap: 'xl', align: 'center', grow: true }), decor: [{ at: { x: 0, y: 0, w: 100, h: 100 }, z: 0, node: n.image({ ref: photoOf(ctx), overlay: 'scrim-full', grow: true }) }] };
    },
  },
  'cover'
);

vdef(
  {
    id: 'banner.pattern',
    summary: 'Le motif de la marque à fond perdu, un cartouche clair porte le logo et le titre.',
    tags: ['playful', 'colorful'],
    params: {},
    fit: (a) => (hasCopy(a) && !hasPhoto(a) ? 0.8 : 0),
    regions: () => [
      { x: 0, y: 0, w: 100, h: 100, kind: 'decor' },
      { x: 30, y: 25, w: 46, h: 50, kind: 'header' },
    ],
    build(ctx) {
      const c = copyOf(ctx);
      const card = n.box([n.row([n.logo({ height: 'md' }), n.text('subtitle', c ? `${c.id}.headline` : 'title', { size: 'xl', maxLines: 2 })], { gap: 'lg', align: 'center' })], { surface: 'ground', pad: 'lg', radius: 'md' });
      return { ground: 'brand', root: n.stack([n.spacer('flex'), n.row([card]), n.spacer('flex')], { grow: true }), decor: [{ at: { x: -2, y: -2, w: 104, h: 104 }, z: 0, node: n.pattern({ opacity: 0.35 }) }] };
    },
  },
  'cover'
);

vdef(
  {
    id: 'avatar.logo',
    summary: 'Photo de profil : le symbole de la marque centré, sur sa couleur ou sur le fond clair.',
    tags: ['identity'],
    params: { ground: ['brand', 'ground'] },
    fit: (a, f) => (f.id === 'avatar-square' && !a.blocks.length ? 1 : 0),
    regions: () => [{ x: 20, y: 20, w: 60, h: 60, kind: 'figure' }],
    build(ctx) {
      return { ground: ctx.params.ground === 'brand' ? 'brand' : undefined, root: n.stack([n.spacer('flex'), n.logo({ height: 'xl', variant: 'icon' }), n.spacer('flex')], { grow: true, align: 'center' }) };
    },
  },
  'cover'
);

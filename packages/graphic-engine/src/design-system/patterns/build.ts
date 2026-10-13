/**
 * Les outils des motifs : construire un arbre lisiblement, composer un en-tête, un pied de section, un
 * corps et les décors d'une page.
 *
 * Chaque TENSION et chaque ACCENT du look a ici son lecteur (la variété qu'ils promettent est donc
 * réellement rendue) :
 *   tensions — `hero-space` (le blanc au-dessus de l'en-tête), `corner-anchor` (l'index dans l'angle),
 *     `framed` (un cadre intérieur), `layered` (un aplat décalé sous l'en-tête), `bleed` (une bande à fond
 *     perdu), `diagonal` (un pan oblique), `ruled` (filets forts entre les blocs) ;
 *   accents — `underline` (filet épais sous le titre), `border` (filet vertical d'en-tête), `shape`
 *     (forme du kit dans un angle libre), `pattern` (lisière au motif de la marque), `mark` (grand
 *     numéro de section), `dots` (semis de points), `wash` (aplat organique pâle).
 */
import type { DecorItem, NodeT, SpaceToken, ShapeId } from '../../contracts/design-spec';
import type { BlockInfo } from '../../composition-engine/analyze';
import type { PatternContext } from './types';

type N = NodeT;
type Of<T extends N['t']> = Extract<N, { t: T }>;
type Opt<T extends N['t']> = Partial<Omit<Of<T>, 't' | 'children'>>;

export const n = {
  stack: (children: N[], o: Opt<'stack'> = {}): N => ({ t: 'stack', ...o, children: children.filter(Boolean) }),
  row: (children: N[], o: Opt<'row'> = {}): N => ({ t: 'row', ...o, children: children.filter(Boolean) }),
  grid: (cols: number | number[], children: N[], o: Partial<Omit<Of<'grid'>, 't' | 'children' | 'cols'>> = {}): N => ({ t: 'grid', cols, ...o, children: children.filter(Boolean) }),
  box: (children: N[], o: Opt<'box'> = {}): N => ({ t: 'box', ...o, children: children.filter(Boolean) }),
  text: (role: Of<'text'>['role'], ref: string, o: Partial<Omit<Of<'text'>, 't' | 'role' | 'ref'>> = {}): N => ({ t: 'text', role, ref, ...o }),
  label: (role: Of<'text'>['role'], text: string, o: Partial<Omit<Of<'text'>, 't' | 'role' | 'text'>> = {}): N => ({ t: 'text', role, text, ...o }),
  block: (ref: string, o: Partial<Omit<Of<'block'>, 't' | 'ref'>> = {}): N => ({ t: 'block', ref, ...o }),
  rule: (o: Partial<Omit<Of<'rule'>, 't'>> = {}): N => ({ t: 'rule', ...o }),
  spacer: (size: SpaceToken | 'flex' = 'md'): N => (size === 'flex' ? { t: 'spacer', flex: true } : { t: 'spacer', size }),
  logo: (o: Partial<Omit<Of<'logo'>, 't'>> = {}): N => ({ t: 'logo', ...o }),
  shape: (shape: ShapeId, o: Partial<Omit<Of<'shape'>, 't' | 'shape'>> = {}): N => ({ t: 'shape', shape, ...o }),
  image: (o: Partial<Omit<Of<'image'>, 't'>>): N => ({ t: 'image', ...o }),
  pattern: (o: Partial<Omit<Of<'pattern'>, 't'>> = {}): N => ({ t: 'pattern', ...o }),
};

export interface HeaderOptions {
  titleRole?: 'title' | 'display';
  size?: Of<'text'>['size'];
  align?: 'start' | 'center' | 'end';
  kicker?: boolean;
  lede?: boolean;
  /** Filet sous le titre (l'accent `underline` le pose de lui-même). */
  rule?: 'none' | 'short' | 'full';
  gap?: SpaceToken;
  rotate?: 'up';
  /** Le motif affiche déjà le numéro de section : l'accent « marque » ne le répète pas. */
  mark?: boolean;
}

const two = (n: number): string => String(n).padStart(2, '0');

/** L'en-tête : sur-titre, titre, chapô — et les gestes de l'accent et de l'humeur typographique. */
export function header(ctx: PatternContext, o: HeaderOptions = {}): N {
  const { section, look, meta } = ctx;
  const parts: N[] = [];
  if (look.accent === 'mark' && meta.index && o.mark !== false) parts.push(n.label('number', two(meta.index), { size: '4xl', ink: 'emphasis', align: o.align }));
  if (section.kicker && o.kicker !== false) parts.push(n.text('kicker', 'kicker', { align: o.align }));
  parts.push(n.text(o.titleRole ?? 'title', 'title', { size: o.size, align: o.align, ...(o.rotate ? { rotate: o.rotate } : {}) }));
  const rule = o.rule ?? (look.accent === 'underline' ? 'short' : 'none');
  if (rule !== 'none') parts.push(n.rule({ weight: rule === 'short' ? 'thick' : 'thin', ink: rule === 'short' ? 'emphasis' : undefined, length: rule === 'short' ? 'short' : 'full' }));
  if (section.lede && o.lede !== false) {
    const lede = n.text('lede', 'lede', { align: o.align });
    parts.push(look.type.stagger && o.align !== 'center' ? n.box([lede], { pad: { l: 'xl' } }) : lede);
  }
  const stack = n.stack(parts, { gap: o.gap ?? 'sm', role: 'header', align: o.align === 'center' ? 'center' : o.align === 'end' ? 'end' : undefined });
  if (look.accent === 'border' && o.align !== 'center') return n.box([stack], { border: { weight: 'thick', sides: ['l'], ink: 'emphasis' }, pad: { l: 'lg' }, role: 'header' });
  return stack;
}

/** Le pied de section : logo, puis le titre courant (et la mention du document). */
export function footer(ctx: PatternContext, o: { docLabel?: boolean; index?: boolean } = {}): N {
  const { meta, section } = ctx;
  const right = [o.docLabel && meta.documentLabel ? meta.documentLabel : '', o.index && meta.index && meta.total ? `${two(meta.index)} / ${two(meta.total)}` : ''].filter(Boolean).join(' · ');
  return n.row(
    [
      n.logo({ height: 'sm' }),
      n.rule({ vertical: true, weight: 'hair' }),
      n.label('folio', section.title.length > 64 ? `${section.title.slice(0, section.title.lastIndexOf(' ', 60))}…` : section.title),
      right ? n.spacer('flex') : n.spacer('none'),
      right ? n.label('folio', right) : n.spacer('none'),
    ],
    { gap: 'md', align: 'center', role: 'folio' }
  );
}

/** Une rangée de blocs côte à côte (blocs étroits), sinon empilés. */
function blockNode(ctx: PatternContext, b: BlockInfo, width: number, span?: number): N {
  return n.block(b.id, { variant: ctx.variant(b, width), ...(span ? { span } : {}) });
}

export type BodyLayout = 'flow' | 'grid2' | 'lead' | 'row' | 'cols3';

/**
 * Le CORPS : les blocs rangés selon une disposition. Un bloc large prend toute la largeur ; deux blocs
 * étroits voisins partagent une rangée ; un bloc étroit sans voisin est promu pleine largeur (jamais de
 * colonne orpheline, la moitié d'une page laissée blanche).
 */
export function body(ctx: PatternContext, blocks: BlockInfo[], layout: BodyLayout, o: { width?: number; gap?: SpaceToken } = {}): N {
  const width = o.width ?? ctx.format.width - ctx.format.pad * 2;
  const ruled = ctx.look.tension === 'ruled';
  const gap = o.gap ?? (ctx.format.kind === 'flow' ? 'lg' : 'md');
  const withRules = (nodes: N[]): N[] => (ruled ? nodes.flatMap((node, i) => (i ? [n.rule({ weight: 'thin' }), node] : [node])) : nodes);
  if (!blocks.length) return n.stack([], { gap });
  if (layout === 'flow' || blocks.length === 1) return n.stack(withRules(blocks.map((b) => blockNode(ctx, b, width))), { gap, role: 'body' });
  if (layout === 'row' && blocks.length <= 3 && blocks.every((b) => !b.wide)) {
    return n.grid(blocks.length, blocks.map((b) => blockNode(ctx, b, width / blocks.length)), { gap: 'lg', role: 'body', align: 'start' });
  }
  if (layout === 'cols3' && blocks.length >= 3 && blocks.every((b) => !b.wide)) {
    return n.grid(3, blocks.map((b) => blockNode(ctx, b, width / 3)), { gap: 'lg', role: 'body', align: 'start' });
  }
  const rest = layout === 'lead' ? blocks.slice(1) : blocks;
  const rows: N[] = layout === 'lead' ? [blockNode(ctx, blocks[0], width)] : [];
  let pending: BlockInfo | null = null;
  for (const b of rest) {
    if (b.wide) {
      if (pending) rows.push(blockNode(ctx, pending, width));
      pending = null;
      rows.push(blockNode(ctx, b, width));
    } else if (pending) {
      rows.push(n.grid(2, [blockNode(ctx, pending, width / 2), blockNode(ctx, b, width / 2)], { gap: 'lg', align: 'start' }));
      pending = null;
    } else pending = b;
  }
  if (pending) rows.push(blockNode(ctx, pending, width));
  return n.stack(withRules(rows), { gap, role: 'body' });
}

/** L'angle de la page que la composition laisse libre (pour une forme), d'après ses régions. */
export type Corner = 'tl' | 'tr' | 'bl' | 'br';

/**
 * Les DÉCORS de la page, lus dans la tension et l'accent du look. Ils vivent dans les marges ou derrière le
 * contenu à faible opacité, ne portent jamais de sens, et cèdent la place aux bandeaux du motif.
 */
export function decor(ctx: PatternContext, o: { free?: Corner; bands?: boolean; avoidFrame?: boolean } = {}): DecorItem[] {
  const { look, meta, rng, format } = ctx;
  const items: DecorItem[] = [];
  const free = o.free ?? 'br';
  const fixed = format.kind === 'fixed';
  const cornerAt = (c: Corner, w: number, h: number, bleed = 0) => ({ x: c[1] === 'l' ? -bleed : 100 - w + bleed, y: c[0] === 't' ? -bleed : 100 - h + bleed, w, h });

  switch (look.tension) {
    case 'framed':
      if (!o.bands && !o.avoidFrame) items.push({ at: { x: 3.2, y: fixed ? 5 : 2.2, w: 93.6, h: fixed ? 90 : 95.6 }, z: 0, node: n.box([], { border: { weight: 'thin', ink: 'emphasis' } }) });
      break;
    case 'bleed':
      if (!o.bands) items.push({ at: fixed ? { x: 0, y: 0, w: 1.6, h: 100 } : { x: 0, y: 0, w: 100, h: 0.9 }, z: 0, node: n.box([], { surface: 'brand', grow: true }) });
      break;
    case 'diagonal':
      if (fixed) items.push({ at: cornerAt(free, 34, 46, 2), z: 0, node: n.shape('slant', { seed: rng.int(1, 999), tone: 'soft', size: 'fill' }) });
      break;
    case 'layered':
      if (fixed) items.push({ at: { x: 0, y: 0, w: 46, h: 38 }, z: 0, node: n.box([], { surface: 'brand-soft', grow: true }) });
      break;
    case 'corner-anchor': {
      // L'angle porte le numéro… sauf si le pied de page le porte déjà : il porte alors la mention du document.
      const footerShowsIndex = (meta.footer ?? 'full') === 'full' && format.kind === 'fixed';
      const label = footerShowsIndex ? meta.documentLabel ?? '' : meta.index ? `${two(meta.index)}${meta.total ? ` / ${two(meta.total)}` : ''}` : '';
      if (label) items.push({ at: { x: 70, y: fixed ? 5 : 2, w: 26, h: 6 }, z: 1, node: n.label('folio', label, { align: 'end' }) });
      break;
    }
    default:
      break;
  }

  switch (look.accent) {
    case 'shape':
      if (fixed) items.push({ at: cornerAt(free, 24, 34, 4), z: 0, node: n.shape(rng.pick(['rings', 'quarter-circles', 'arcs', 'half-discs', 'contours'] as const), { seed: rng.int(1, 999), tone: rng.pick(['brand', 'soft'] as const), opacity: 0.85, size: 'fill' }) });
      break;
    case 'pattern':
      if (!o.bands) items.push({ at: fixed ? { x: 95.6, y: 0, w: 4.4, h: 100 } : { x: 0, y: 99, w: 100, h: 1 }, z: 0, node: n.pattern({ opacity: 0.9 }) });
      break;
    case 'dots':
      if (fixed) items.push({ at: cornerAt(free, 16, 26, 0), z: 0, node: n.shape('dots-field', { seed: rng.int(1, 999), tone: 'soft', size: 'fill' }) });
      break;
    case 'wash':
      items.push({ at: cornerAt(free, fixed ? 38 : 30, fixed ? 56 : 20, 10), z: 0, node: n.shape('blob', { seed: rng.int(1, 999), tone: 'soft', opacity: 0.7, size: 'fill' }) });
      break;
    default:
      break;
  }
  return items;
}

/** La part de la largeur utile (px) d'une colonne de `fr` sur `total` fr. */
export const share = (ctx: PatternContext, fr: number, total = 12): number => ((ctx.format.width - ctx.format.pad * 2) * fr) / total;

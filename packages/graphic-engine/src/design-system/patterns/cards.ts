/**
 * Les motifs de CARTE DE VISITE : six rectos, quatre versos.
 *
 * Une carte est un GABARIT partagé entre plusieurs porteurs : en mode `markers`, chaque champ sort en
 * `{{champ}}` dans un élément `data-field="champ"` (l'aperçu du formulaire et l'impression interpolent,
 * puis retirent les lignes vides). Aucun champ n'est inventé : seuls ceux du bloc `contact` existent.
 * Les cotes sont physiques (85 × 55 mm) et la zone de sécurité est la marge de la toile.
 */
import type { NodeT } from '../../contracts/design-spec';
import type { ContentAnalysis } from '../../composition-engine/analyze';
import type { CardField } from '../../contracts/content-model';
import { n } from './build';
import { registerPattern } from './registry';
import type { PatternContext, PatternDef } from './types';

type N = NodeT;

const CONTACT_LINES: CardField[] = ['phone', 'mobile', 'email', 'website', 'address', 'linkedin'];

function contact(ctx: PatternContext): { id: string; side: 'front' | 'back'; markers: boolean; has: (f: CardField) => boolean } | null {
  const block = ctx.section.blocks.find((b) => b.kind === 'contact');
  if (!block || block.kind !== 'contact') return null;
  const markers = block.binding === 'markers';
  return { id: block.id, side: block.side, markers, has: (f) => markers || Boolean(block.fields[f]) };
}

/** Un champ : la référence (valeur) et le marqueur (gabarit) ; absent du bloc, il n'existe pas. */
function field(ctx: PatternContext, f: CardField, role: Extract<N, { t: 'text' }>['role'], o: Partial<Extract<N, { t: 'text' }>> = {}): N | null {
  const c = contact(ctx);
  if (!c || !c.has(f)) return null;
  return { t: 'text', role, ref: `${c.id}.fields.${f}`, bind: f, ...o } as N;
}

const lines = (ctx: PatternContext, align?: 'start' | 'center' | 'end'): N[] => CONTACT_LINES.map((f) => field(ctx, f, 'small', { align })).filter((x): x is N => Boolean(x));

/** Un recto ne sert jamais de verso : le côté se lit dans le bloc `contact`. */
const side = (wanted: 'front' | 'back') => (a: ContentAnalysis): number => (a.cardSide === wanted ? 1 : 0);

const def = (d: Omit<PatternDef, 'family' | 'roles'>, s: 'front' | 'back'): PatternDef =>
  registerPattern({ family: 'card', roles: ['card-face'], ...d, id: `card.${s}-${d.id}`, tags: [...d.tags, s] });

const nameNode = (ctx: PatternContext, align?: 'start' | 'center' | 'end', size: 'lg' | 'xl' | '2xl' = 'xl') => field(ctx, 'fullName', 'subtitle', { size, align, weight: 700 });
const titleNode = (ctx: PatternContext, align?: 'start' | 'center' | 'end') => field(ctx, 'jobTitle', 'caption', { align, ink: 'kicker' });

def({ id: 'classic', summary: 'Logo en haut, nom et fonction en bas à gauche, coordonnées en colonne à droite.', tags: ['classic', 'calm'], params: {}, fit: side('front'), regions: () => [{ x: 0, y: 0, w: 30, h: 22, kind: 'header' }, { x: 0, y: 60, w: 48, h: 40, kind: 'figure' }, { x: 55, y: 45, w: 45, h: 55, kind: 'body' }], build: (ctx) => ({ root: n.stack([n.logo({ height: 'lg' }), n.spacer('flex'), n.grid([5, 6], [n.stack([nameNode(ctx), titleNode(ctx)].filter(Boolean) as N[], { gap: 'xs', justify: 'end' }), n.stack(lines(ctx, 'end'), { gap: '2xs', justify: 'end', align: 'end' })], { gap: 'md', align: 'end' })], { grow: true }) }) }, 'front');

def({ id: 'centered', summary: 'Logo, nom et fonction centrés ; coordonnées centrées en pied.', tags: ['elegant', 'calm'], params: {}, fit: side('front'), regions: () => [{ x: 30, y: 4, w: 40, h: 26, kind: 'header' }, { x: 15, y: 36, w: 70, h: 22, kind: 'figure' }, { x: 10, y: 68, w: 80, h: 30, kind: 'body' }], build: (ctx) => ({ root: n.stack([n.logo({ height: 'md' }), n.spacer('flex'), nameNode(ctx, 'center') as N, titleNode(ctx, 'center') as N, n.spacer('flex'), n.stack(lines(ctx, 'center'), { gap: '2xs', align: 'center' })].filter(Boolean), { grow: true, align: 'center', gap: 'xs' }) }) }, 'front');

def(
  {
    id: 'split',
    summary: 'Panneau de couleur à fond perdu avec le logo ; nom, fonction et coordonnées à côté.',
    tags: ['bold', 'colorful'],
    params: { panel: ['brand', 'ink'] },
    fit: side('front'),
    regions: () => [{ x: 0, y: 0, w: 40, h: 100, kind: 'band' }, { x: 46, y: 8, w: 54, h: 84, kind: 'body' }],
    build: (ctx) => ({
      root: n.grid([5, 7], [n.box([n.stack([n.logo({ height: 'lg', variant: 'auto' })], { grow: true, justify: 'center', align: 'center' })], { surface: ctx.params.panel as 'brand' | 'ink', bleed: ['t', 'l', 'b'], pad: 'md' }), n.stack([nameNode(ctx, 'start', 'lg') as N, titleNode(ctx) as N, n.spacer('flex'), ...lines(ctx)].filter(Boolean), { gap: 'xs', grow: true })], { gap: 'lg', align: 'stretch', grow: true }),
    }),
  },
  'front'
);

def({ id: 'rail', summary: 'Un rail de couleur sur le bord ; nom et fonction en haut, coordonnées en pied.', tags: ['structured', 'swiss'], params: {}, fit: side('front'), regions: () => [{ x: 0, y: 0, w: 4, h: 100, kind: 'band' }, { x: 8, y: 8, w: 60, h: 30, kind: 'figure' }, { x: 8, y: 60, w: 84, h: 40, kind: 'body' }], build: (ctx) => ({ root: n.stack([n.row([n.stack([nameNode(ctx) as N, titleNode(ctx) as N].filter(Boolean), { gap: 'xs' }), n.spacer('flex'), n.logo({ height: 'sm' })], { align: 'start' }), n.spacer('flex'), n.grid(2, lines(ctx), { gap: 'xs', rowGap: '2xs' })], { grow: true }), decor: [{ at: { x: 0, y: 0, w: 2.6, h: 100 }, node: n.box([], { surface: 'brand', grow: true }) }] }) }, 'front');

def({ id: 'minimal', summary: 'Le nom en grand, la fonction, les coordonnées sur deux colonnes ; petit logo dans l’angle.', tags: ['minimal', 'swiss'], params: {}, fit: side('front'), regions: () => [{ x: 0, y: 4, w: 70, h: 30, kind: 'figure' }, { x: 80, y: 0, w: 20, h: 18, kind: 'header' }, { x: 0, y: 62, w: 100, h: 38, kind: 'body' }], build: (ctx) => ({ root: n.stack([n.row([n.stack([nameNode(ctx, 'start', '2xl') as N, titleNode(ctx) as N].filter(Boolean), { gap: 'xs' }), n.spacer('flex'), n.logo({ height: 'sm', variant: 'icon' })], { align: 'start' }), n.spacer('flex'), n.rule({ weight: 'hair' }), n.grid(2, lines(ctx), { gap: 'xs', rowGap: '2xs' })], { grow: true, gap: 'sm' }) }) }, 'front');

def(
  {
    id: 'band',
    summary: 'Nom et fonction sur le fond ; un bandeau de couleur en pied porte les coordonnées.',
    tags: ['bold', 'corporate'],
    params: { band: ['brand', 'ink'] },
    fit: side('front'),
    regions: () => [{ x: 0, y: 6, w: 70, h: 34, kind: 'figure' }, { x: 0, y: 62, w: 100, h: 38, kind: 'band' }],
    build: (ctx) => ({ root: n.stack([n.row([n.stack([nameNode(ctx) as N, titleNode(ctx) as N].filter(Boolean), { gap: 'xs' }), n.spacer('flex'), n.logo({ height: 'md' })], { align: 'start' }), n.spacer('flex'), n.box([n.grid(2, lines(ctx), { gap: 'xs', rowGap: '2xs' })], { surface: ctx.params.band as 'brand' | 'ink', bleed: ['l', 'r', 'b'], pad: { t: 'md' } })], { grow: true }) }),
  },
  'front'
);

// ── Versos ─────────────────────────────────────────────────────────────────────────────────

def({ id: 'logo', summary: 'Fond de la couleur de marque, logo centré (et la signature s’il y en a une).', tags: ['bold', 'classic'], params: {}, fit: side('back'), regions: () => [{ x: 25, y: 25, w: 50, h: 50, kind: 'figure' }], build: (ctx) => ({ ground: 'brand', root: n.stack([n.spacer('flex'), n.logo({ height: 'xl', variant: 'auto' }), field(ctx, 'tagline', 'caption', { align: 'center' }) ?? n.spacer('none'), n.spacer('flex')], { grow: true, align: 'center', gap: 'md' }) }) }, 'back');

def({ id: 'pattern', summary: 'Le motif de la marque à fond perdu, le logo dans un cartouche central.', tags: ['playful', 'colorful'], params: {}, fit: side('back'), regions: () => [{ x: 0, y: 0, w: 100, h: 100, kind: 'decor' }, { x: 30, y: 30, w: 40, h: 40, kind: 'figure' }], build: (ctx) => ({ ground: 'brand-soft', root: n.stack([n.spacer('flex'), n.box([n.stack([n.logo({ height: 'lg' }), field(ctx, 'tagline', 'caption', { align: 'center' }) ?? n.spacer('none')], { align: 'center', gap: 'sm' })], { surface: 'ground', pad: 'lg', radius: 'md' }), n.spacer('flex')], { grow: true, align: 'center' }), decor: [{ at: { x: -4, y: -4, w: 108, h: 108 }, node: n.pattern({ opacity: 0.55 }) }] }) }, 'back');

def({ id: 'tagline', summary: 'Fond clair : logo, signature et site, centrés.', tags: ['calm', 'elegant'], params: {}, fit: side('back'), regions: () => [{ x: 20, y: 20, w: 60, h: 60, kind: 'figure' }], build: (ctx) => ({ root: n.stack([n.spacer('flex'), n.logo({ height: 'lg' }), field(ctx, 'tagline', 'small', { align: 'center' }) ?? n.spacer('none'), n.spacer('flex'), field(ctx, 'website', 'caption', { align: 'center', ink: 'kicker' }) ?? n.spacer('none')], { grow: true, align: 'center', gap: 'sm' }) }) }, 'back');

def({ id: 'wordmark', summary: 'Le nom de l’entreprise en grand, le site en pied ; une lisière de couleur.', tags: ['bold', 'swiss'], params: {}, fit: side('back'), regions: () => [{ x: 0, y: 30, w: 90, h: 34, kind: 'figure' }, { x: 0, y: 92, w: 100, h: 8, kind: 'band' }], build: (ctx) => ({ root: n.stack([n.spacer('flex'), field(ctx, 'companyName', 'display', { size: '3xl' }) ?? n.label('display', ctx.meta.brandName || ' ', { size: '3xl' }), field(ctx, 'tagline', 'small') ?? n.spacer('none'), n.spacer('flex'), field(ctx, 'website', 'caption', { ink: 'kicker' }) ?? n.spacer('none')], { grow: true, gap: 'xs' }), decor: [{ at: { x: 0, y: 96, w: 100, h: 4 }, node: n.box([], { surface: 'brand', grow: true }) }] }) }, 'back');

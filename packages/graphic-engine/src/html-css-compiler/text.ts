/**
 * Le texte : un RÔLE (titre, sur-titre, chapô, corps…), traité selon l'humeur typographique du look,
 * dimensionné sur l'échelle du document, ajusté à sa boîte, fini typographiquement.
 *
 * Le texte vient TOUJOURS du contenu, par référence (`title`, `b3.headline`) : le plan graphique ne
 * recopie jamais un mot. La casse est posée en CSS (`text-transform`) : le texte reste celui du contenu,
 * pour la lecture d'écran comme pour le contrôle de fidélité.
 */
import type { SectionContent } from '../contracts/content-model';
import type { NodeT, TextRoleToken, TextSizeToken } from '../contracts/design-spec';
import { css, esc, escAttr } from '../foundation/html';
import { estimateWidthPx, fitFontSize, typographize } from '../foundation/typeset';
import { CompileContext, Env, inkHex, InkSpec } from './context';

type TextNode = Extract<NodeT, { t: 'text' }>;

export interface RoleSpec {
  font: 'display' | 'body';
  size: TextSizeToken;
  weight: number;
  leading: number;
  /** em */
  tracking: number;
  caps: 'none' | 'upper' | 'lower';
  ink: InkSpec;
  tag: string;
  italic?: boolean;
}

export function roleSpec(role: TextRoleToken, ctx: CompileContext): RoleSpec {
  const spec = baseRoleSpec(role, ctx);
  // Une diapositive se lit à distance : ses petits textes montent d'un cran (12,8 px sur une toile de
  // 1 122 px y étaient trop petits ; le corps d'une carte de contenu vaut le corps du texte).
  if (ctx.tokens.format.family === 'slide') {
    const bump: Partial<Record<TextRoleToken, TextSizeToken>> = { small: 'base', caption: 'sm', note: 'sm', tagline: 'base' };
    if (bump[role]) return { ...spec, size: bump[role] as TextSizeToken };
  }
  return spec;
}

function baseRoleSpec(role: TextRoleToken, ctx: CompileContext): RoleSpec {
  const t = ctx.look.type;
  const L = ctx.tokens.leading;
  const T = ctx.tokens.tracking;
  const card = ctx.tokens.format.family === 'card';
  switch (role) {
    case 'overline':
      return { font: 'body', size: 'xs', weight: t.kickerWeight, leading: L.normal, tracking: t.kickerTracking, caps: t.kickerCase, ink: 'kicker', tag: 'p' };
    case 'kicker':
      return { font: 'body', size: card ? 'xs' : 'sm', weight: t.kickerWeight, leading: L.normal, tracking: t.kickerTracking, caps: t.kickerCase, ink: 'kicker', tag: 'p' };
    case 'display':
      return { font: 'display', size: '5xl', weight: t.titleWeight, leading: t.titleLeading, tracking: t.titleTracking, caps: t.titleCase, ink: 'heading', tag: 'h1' };
    case 'title':
      return { font: 'display', size: card ? 'lg' : '3xl', weight: t.titleWeight, leading: t.titleLeading, tracking: t.titleTracking, caps: t.titleCase, ink: 'heading', tag: 'h2' };
    case 'subtitle':
      return { font: 'display', size: card ? 'base' : 'xl', weight: Math.min(700, t.titleWeight), leading: 1.15, tracking: Math.min(0, t.titleTracking), caps: 'none', ink: 'heading', tag: 'h3' };
    case 'lede':
      return { font: 'body', size: 'lg', weight: t.bodyWeight === 300 ? 300 : 400, leading: 1.4, tracking: T.normal, caps: 'none', ink: 'muted', tag: 'p' };
    case 'body':
      return { font: 'body', size: 'base', weight: t.bodyWeight, leading: L.loose, tracking: T.normal, caps: 'none', ink: 'ink', tag: 'p' };
    case 'small':
      return { font: 'body', size: 'sm', weight: t.bodyWeight, leading: L.normal + 0.12, tracking: T.normal, caps: 'none', ink: 'ink', tag: 'p' };
    case 'caption':
      return { font: 'body', size: 'xs', weight: 400, leading: L.normal, tracking: T.normal, caps: 'none', ink: 'muted', tag: 'p' };
    case 'label':
      return { font: 'body', size: 'xs', weight: 600, leading: L.normal, tracking: T.wide, caps: 'upper', ink: 'muted', tag: 'p' };
    case 'figure':
      return { font: 'display', size: card ? 'xl' : '3xl', weight: t.figureWeight, leading: 1, tracking: T.tight, caps: 'none', ink: 'heading', tag: 'p' };
    case 'note':
      return { font: 'body', size: 'xs', weight: 400, leading: L.normal, tracking: T.normal, caps: 'none', ink: 'muted', tag: 'p' };
    case 'quote':
      return { font: 'display', size: 'xl', weight: Math.min(600, Math.max(400, t.titleWeight - 200)), leading: 1.3, tracking: T.normal, caps: 'none', ink: 'heading', tag: 'p', italic: false };
    case 'number':
      return { font: 'display', size: '4xl', weight: t.figureWeight, leading: 0.95, tracking: T.tight, caps: 'none', ink: 'emphasis', tag: 'p' };
    case 'folio':
      return { font: 'body', size: 'xs', weight: 500, leading: L.normal, tracking: T.wide, caps: 'upper', ink: 'muted', tag: 'p' };
    case 'tagline':
      return { font: 'body', size: 'sm', weight: 400, leading: L.normal, tracking: T.normal, caps: 'none', ink: 'muted', tag: 'p' };
    case 'cta':
      return { font: 'body', size: 'base', weight: 600, leading: L.normal, tracking: 0.02, caps: 'none', ink: 'ink', tag: 'p' };
  }
}

/** Une valeur dans le contenu de la section : `title`, `kicker`, `lede` ou `<idBloc>.<chemin>`. */
export function resolveTextRef(ref: string, section: SectionContent): string | undefined {
  if (ref === 'title') return section.title;
  if (ref === 'kicker') return section.kicker;
  if (ref === 'lede') return section.lede;
  const [id, ...path] = ref.split('.');
  let value: unknown = section.blocks.find((b) => b.id === id);
  for (const key of path) {
    if (value === null || value === undefined) return undefined;
    value = Array.isArray(value) ? value[Number(key)] : (value as Record<string, unknown>)[key];
  }
  return typeof value === 'string' ? value : typeof value === 'number' ? String(value) : undefined;
}

const TITLE_ROLES = new Set<TextRoleToken>(['title', 'display', 'figure', 'number', 'subtitle', 'quote']);

/** Taille ajustée : un mot seul ne déborde jamais ; un titre de toile fixe tient en `maxLines` lignes. */
function fittedSize(text: string, role: TextRoleToken, spec: RoleSpec, sizePx: number, ctx: CompileContext, env: Env, maxLines?: number): number {
  const font = spec.font === 'display' ? ctx.tokens.font.displayClass : ctx.tokens.font.bodyClass;
  const opts = { font, weight: spec.weight, tracking: spec.tracking, uppercase: spec.caps === 'upper' };
  // Sur une seule ligne (un chiffre-clé), c'est la chaîne ENTIÈRE qui doit tenir, pas son mot le plus long.
  const longest = maxLines === 1 ? text : text.split(/\s+/).reduce((a, w) => (w.length > a.length ? w : a), '');
  let size = sizePx;
  // Réserve de 4 % : une estimation de chasse reste une estimation (le navigateur ajuste ensuite au pixel).
  while (size > ctx.tokens.format.minSize && estimateWidthPx(longest, size, opts) > env.width * 0.96) size -= 0.5;
  if (TITLE_ROLES.has(role) && maxLines) {
    const box = env.height ?? Number.POSITIVE_INFINITY;
    const fit = fitFontSize(text, env.width * 0.96, box, { max: size, min: Math.max(ctx.tokens.format.minSize, Math.min(size, ctx.tokens.size.lg)), leading: spec.leading, maxLines }, opts);
    size = fit.size;
  }
  return Math.round(size * 2) / 2;
}

export function renderText(node: TextNode, ctx: CompileContext, env: Env): string {
  const spec = roleSpec(node.role, ctx);
  const bound = node.bind && ctx.bindings === 'markers';
  const raw = bound ? `{{${node.bind}}}` : node.text ?? (node.ref ? resolveTextRef(node.ref, ctx.section) : undefined) ?? '';
  if (!raw.trim()) return '';

  const weight = node.weight ?? spec.weight;
  const caps = node.caps ?? spec.caps;
  const tracking = node.tracking ? ctx.tokens.tracking[node.tracking] : spec.tracking;
  const leading = node.leading ? ctx.tokens.leading[node.leading] : spec.leading;
  const isTitle = node.role === 'title' || node.role === 'display';
  const baseSize = ctx.tokens.size[node.size ?? spec.size] * (isTitle ? ctx.look.type.titleScale : 1);
  const fixed = ctx.tokens.format.kind === 'fixed';
  const maxLines = node.maxLines ?? (isTitle ? (fixed ? 3 : 4) : node.role === 'figure' || node.role === 'number' ? 2 : undefined);
  // Un texte tourné court le long de la HAUTEUR : c'est elle qui borne sa ligne. Sinon, seule la LARGEUR
  // décide à la compilation : la hauteur estimée d'une colonne n'est qu'une estimation, et réduire un titre
  // d'après elle le rendait minuscule ; c'est le navigateur qui juge la hauteur, proportionnellement.
  // Il tient sur UNE ligne (`nowrap`), bornée par la hauteur utile de la page quand celle de sa boîte est inconnue.
  const along = env.height ?? (fixed ? ctx.tokens.format.height - ctx.tokens.format.pad * 2 : env.width * 4);
  const fitEnv: Env = node.rotate ? { ...env, width: along, height: env.width } : { ...env, height: undefined };
  const size = bound ? baseSize : fittedSize(raw, node.role, { ...spec, weight, tracking, caps }, baseSize, ctx, fitEnv, node.rotate ? 1 : maxLines);
  const large = size >= 24 || (size >= 18.7 && weight >= 700);
  const color = inkHex(node.ink ?? spec.ink, ctx, env.surface, large);

  let inner = bound ? esc(raw) : esc(typographize(raw, ctx.locale, { bindLastWords: node.role !== 'label' && node.role !== 'kicker' }));
  // Les gestes de l'humeur typographique : le dernier mot en contour, la première lettre ancrée.
  if (!bound && isTitle && (node.emphasis === 'outline' || ctx.look.type.outlineWord)) {
    const words = inner.split(' ');
    if (words.length > 1) {
      const last = words.pop() as string;
      const stroke = Math.max(1, Math.round(size / 28));
      inner = `${words.join(' ')} <span style="${css({ color: 'transparent', '-webkit-text-stroke': `${stroke}px ${color}` })}">${last}</span>`;
    }
  }
  if (!bound && isTitle && ctx.look.type.anchorLetter && /^[\p{L}\p{N}]/u.test(inner)) {
    const letter = Array.from(inner)[0];
    inner = `<span style="${css({ 'font-size': '1.42em', color: inkHex('emphasis', ctx, env.surface, true), 'line-height': 0.8 })}">${letter}</span>${inner.slice(letter.length)}`;
  }
  if (!bound && node.emphasis === 'underline') {
    const thick = Math.max(2, Math.round(size / 9));
    inner = `<span style="${css({ 'text-decoration-line': 'underline', 'text-decoration-thickness': `${thick}px`, 'text-underline-offset': `${Math.round(thick * 1.6)}px`, 'text-decoration-color': inkHex('emphasis', ctx, env.surface, true) })}">${inner}</span>`;
  }

  const rotated = node.rotate ? { 'writing-mode': 'vertical-rl', transform: node.rotate === 'up' ? 'rotate(180deg)' : undefined, 'white-space': 'nowrap' } : {};
  const style = css({
    margin: 0,
    'font-family': spec.font === 'display' ? ctx.tokens.font.displayStack : ctx.tokens.font.bodyStack,
    'font-size': size,
    'font-weight': weight,
    'line-height': leading,
    'letter-spacing': tracking ? `${tracking}em` : undefined,
    'text-transform': caps === 'upper' ? 'uppercase' : caps === 'lower' ? 'lowercase' : undefined,
    'font-style': spec.italic ? 'italic' : undefined,
    color,
    'text-align': node.align === 'center' ? 'center' : node.align === 'end' ? 'right' : undefined,
    'text-wrap': isTitle || node.role === 'subtitle' || node.role === 'quote' ? 'balance' : node.role === 'body' || node.role === 'lede' ? 'pretty' : undefined,
    // Pas de césure automatique : un mot coupé (« li-vré ») n'a pas sa place dans un dossier remis à une banque.
    'overflow-wrap': node.role === 'body' || node.role === 'small' || node.role === 'caption' ? 'break-word' : undefined,
    hyphens: 'manual',
    // Chiffres proportionnels pour un grand nombre isolé (« 121 » ne doit pas paraître lâche) ; les colonnes
    // de chiffres (tableaux, axes) passent en tabulaires dans leurs propres composants.
    'font-variant-numeric': node.role === 'figure' || node.role === 'number' ? 'lining-nums' : undefined,
    'white-space': (node.role === 'figure' || node.role === 'number') && maxLines === 1 ? 'nowrap' : undefined,
    ...rotated,
  });
  // Les textes qui peuvent céder de la taille (titres, chiffres, citations) : le navigateur les ajuste au
  // pixel s'ils débordent de leur boîte ou de leur page, jamais sous leur taille minimale lisible.
  const fit = !bound && (TITLE_ROLES.has(node.role) || maxLines === 1);
  const minSize = Math.max(ctx.tokens.format.minSize, Math.round(Math.min(size, isTitle ? ctx.tokens.size.lg : ctx.tokens.size.base) * 10) / 10);
  const attrs = [
    `style="${style}"`,
    node.id ? `data-el="${escAttr(node.id)}"` : '',
    node.bind ? `data-field="${escAttr(node.bind)}"` : '',
    node.ref ? `data-ref="${escAttr(node.ref)}"` : '',
    fit ? `data-ge-fit data-ge-min="${minSize}"` : '',
    node.rotate && !bound ? 'data-ge-rot' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const tag = node.role === 'display' && ctx.tokens.format.family !== 'document' && ctx.documentType !== 'business-plan' ? 'h1' : spec.tag;
  return `<${tag} ${attrs}>${inner}</${tag}>`;
}

/** Hauteur estimée d'un texte (px), pour la planification des pages fixes. */
export function estimateTextHeight(text: string, role: TextRoleToken, ctx: CompileContext, widthPx: number, size?: TextSizeToken): number {
  const spec = roleSpec(role, ctx);
  const px = ctx.tokens.size[size ?? spec.size] * (role === 'title' || role === 'display' ? ctx.look.type.titleScale : 1);
  const font = spec.font === 'display' ? ctx.tokens.font.displayClass : ctx.tokens.font.bodyClass;
  const fit = fitFontSize(text, widthPx, Number.POSITIVE_INFINITY, { max: px, min: px, leading: spec.leading }, { font, weight: spec.weight, tracking: spec.tracking, uppercase: spec.caps === 'upper' });
  return fit.height;
}

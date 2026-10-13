/**
 * Le COMPILATEUR : un DesignSpec validé devient du HTML, de façon déterministe.
 *
 * Même plan, mêmes jetons, même contenu ⇒ même page (aux variations près du moteur de rendu et des
 * ressources chargées). Aucun modèle n'intervient ici, et aucun HTML n'est écrit par un modèle ailleurs :
 * le compilateur est le seul auteur du balisage.
 *
 * Contrat avec l'export PDF (le paginateur des documents) :
 *  · une RACINE par section ; ses enfants positionnés en absolu sont des DÉCORS (recopiés sur chaque page) ;
 *  · pour une page paginée, les enfants en flux de la racine sont les RANGÉES que le paginateur découpe :
 *    l'écart entre elles est une marge (qu'il sait étirer), jamais un `gap` de la racine ;
 *  · un bloc insécable porte `data-keep-together` ; le pied de section porte `data-idem-folio`.
 */
import type { DecorItem, NodeT, SectionSpec, SpaceToken } from '../contracts/design-spec';
import { COMPONENT_LIBRARY_VERSION, ENGINE_VERSION } from '../version';
import { contrastRatio, mixHex, withAlpha } from '../foundation/color';
import { css, CssValue, esc, escAttr, safeUrl } from '../foundation/html';
import { drawShape, LINE_SHAPES } from '../design-system/kit/shapes';
import { componentFor } from '../design-system/components/registry';
import { iconSvg } from '../capability-registry/local/icons';
import { CompileContext, Env, inkHex, surfaceHex } from './context';
import { estimateTextHeight, renderText, resolveTextRef } from './text';

type Container = Extract<NodeT, { t: 'stack' | 'row' | 'grid' | 'box' }>;

const sp = (ctx: CompileContext, token?: SpaceToken): number => (token ? ctx.tokens.space[token] : 0);

/** Marges intérieures : [haut, droite, bas, gauche] en px. */
function padOf(node: Container, ctx: CompileContext): [number, number, number, number] {
  const pad = node.pad;
  if (!pad) return [0, 0, 0, 0];
  if (typeof pad === 'string') {
    const v = sp(ctx, pad);
    return [v, v, v, v];
  }
  const x = sp(ctx, pad.x);
  const y = sp(ctx, pad.y);
  return [pad.t ? sp(ctx, pad.t) : y, pad.r ? sp(ctx, pad.r) : x, pad.b ? sp(ctx, pad.b) : y, pad.l ? sp(ctx, pad.l) : x];
}

function borderCss(node: Container, ctx: CompileContext, surface: string, parentSurface: string): Record<string, CssValue> {
  if (!node.border || node.border.weight === 'none') return {};
  const width = ctx.tokens.stroke[node.border.weight];
  const color = node.border.ink ? inkHex(node.border.ink, ctx, parentSurface, true) : mixHex(surface, inkHex('ink', ctx, surface), 0.2);
  const line = `${width}px solid ${color}`;
  const sides = node.border.sides ?? ['t', 'r', 'b', 'l'];
  const out: Record<string, CssValue> = {};
  if (sides.length === 4) out.border = line;
  else for (const s of sides) out[{ t: 'border-top', r: 'border-right', b: 'border-bottom', l: 'border-left' }[s]] = line;
  return out;
}

const ALIGN: Record<string, string> = { start: 'flex-start', center: 'center', end: 'flex-end', stretch: 'stretch' };
const JUSTIFY: Record<string, string> = { start: 'flex-start', center: 'center', end: 'flex-end', between: 'space-between' };

/** Largeurs données aux enfants d'un conteneur (px), pour les composants qui en dépendent. */
function childWidths(node: Container, inner: number, ctx: CompileContext): number[] {
  const n = node.children.length;
  if (!n) return [];
  if (node.t === 'grid') {
    const gap = sp(ctx, node.gap ?? 'md');
    const cols = typeof node.cols === 'number' ? Array(node.cols).fill(1) : node.cols;
    const total = cols.reduce((a, b) => a + b, 0);
    const track = (inner - gap * (cols.length - 1)) / total;
    return node.children.map((child, i) => {
      const span = node.spans?.[i] ?? (child.t === 'block' && child.span ? child.span : 1);
      const start = i % cols.length;
      const fr = cols.slice(start, start + span).reduce((a, b) => a + b, 0) || cols[start] || 1;
      return track * fr + gap * (span - 1);
    });
  }
  if (node.t === 'row') {
    const gap = sp(ctx, node.gap ?? 'md');
    return node.children.map(() => (inner - gap * (n - 1)) / n);
  }
  return node.children.map(() => inner);
}

const LOGO_HEIGHT = { sm: 1.5, md: 2.2, lg: 3.2, xl: 4.8 } as const;

/**
 * La hauteur ESTIMÉE d'un nœud dans une largeur donnée (px). Elle sert à dire à chaque composant d'une
 * page fixe la place qui lui revient (un graphique, une vitrine de logo, une rangée de mockups se
 * dimensionnent dessus). Une estimation : la mesure dans Chromium a le dernier mot.
 */
export function estimateHeight(node: NodeT, ctx: CompileContext, width: number, mode: 'natural' | 'min' = 'natural'): number {
  switch (node.t) {
    case 'text': {
      const raw = node.text ?? (node.ref ? resolveTextRef(node.ref, ctx.section) : undefined) ?? '';
      if (!raw.trim()) return 0;
      if (node.rotate) return 0;
      return estimateTextHeight(raw, node.role, ctx, width, node.size);
    }
    case 'block': {
      const block = ctx.section.blocks.find((b) => b.id === node.ref);
      const component = block ? componentFor(block.kind, node.component) : undefined;
      if (!block || !component) return 0;
      if (mode === 'min' && component.elastic) return component.elastic.minHeight(block, ctx, width);
      return component.estimate(block, ctx, width, { ...component.defaults, ...(node.variant ?? {}) });
    }
    case 'rule':
      return node.vertical ? 0 : ctx.tokens.stroke[node.weight ?? 'hair'];
    case 'spacer':
      return node.flex ? 0 : sp(ctx, node.size ?? 'md');
    case 'logo':
      return ctx.tokens.size.base * LOGO_HEIGHT[node.height ?? 'md'];
    case 'shape':
      return node.size === 'fill' || !node.size ? 0 : width * { sm: 0.16, md: 0.3, lg: 0.48 }[node.size];
    case 'image':
      return node.grow ? 0 : node.ratio ? width / node.ratio : 0;
    case 'pattern':
    case 'layer':
    case 'icon':
      return 0;
    default: {
      const [pt, pr, pb, pl] = padOf(node, ctx);
      const inner = Math.max(0, width - pl - pr);
      const widths = childWidths(node, inner, ctx);
      const gap = node.t === 'box' ? 0 : sp(ctx, node.gap ?? 'md');
      const heights = node.children.map((c, i) => estimateHeight(c, ctx, widths[i] ?? inner, mode));
      if (node.t === 'row') return pt + pb + Math.max(0, ...heights);
      if (node.t === 'grid') {
        const cols = typeof node.cols === 'number' ? node.cols : node.cols.length;
        const rows: number[] = [];
        heights.forEach((h, i) => {
          const r = Math.floor(i / Math.max(1, cols));
          rows[r] = Math.max(rows[r] ?? 0, h);
        });
        return pt + pb + rows.reduce((a, b) => a + b, 0) + sp(ctx, node.rowGap ?? node.gap ?? 'md') * Math.max(0, rows.length - 1);
      }
      const visible = heights.filter((h) => h > 0).length;
      return pt + pb + heights.reduce((a, b) => a + b, 0) + gap * Math.max(0, visible - 1);
    }
  }
}

const grows = (node: NodeT): boolean => ('grow' in node && node.grow === true) || (node.t === 'spacer' && node.flex === true);

/** Un nœud qui s'étire sur la hauteur donnée : un composant élastique, une image sans ratio, ou ce qui en contient. */
function isElastic(node: NodeT, ctx: CompileContext): boolean {
  if (node.t === 'block') {
    const block = ctx.section.blocks.find((b) => b.id === node.ref);
    return Boolean(block && componentFor(block.kind, node.component)?.elastic);
  }
  if (node.t === 'image') return !node.ratio;
  if ('children' in node) return node.children.some((c) => isElastic(c, ctx));
  return false;
}

/** Les marqueurs que le paginateur du PDF lit sur les RANGÉES (enfants directs de la racine). */
const ROW_MARKERS = ['data-keep-together', 'data-idem-folio="1"', 'data-keep-with-next'];

/** Les enfants d'un conteneur, compilés. `flowRoot` : racine d'une page paginée (écarts en marges). */
function compileChildren(node: Container, ctx: CompileContext, env: Env, surface: string, inner: number, innerHeight: number | undefined, flowRoot: boolean): string[] {
  const widths = childWidths(node, inner, ctx);
  const gap = node.t === 'box' ? 0 : sp(ctx, node.gap ?? 'md');
  // Dans une pile à hauteur connue, les éléments RIGIDES (textes, tableaux) prennent leur hauteur, et ce
  // qui reste revient aux éléments qui s'étirent (graphique, image, vitrine) : un graphique n'est plus écrasé
  // sous une citation, une vitrine de logo ne reste plus un timbre au milieu d'une page vide.
  let heights: Array<number | undefined> = node.children.map(() => (node.t === 'row' || node.t === 'grid' ? innerHeight : undefined));
  if ((node.t === 'stack' || node.t === 'box') && innerHeight !== undefined) {
    const elastic = node.children.map((c) => !grows(c) && isElastic(c, ctx));
    const own = node.children.map((c, i) => (grows(c) ? 0 : estimateHeight(c, ctx, widths[i] ?? inner, elastic[i] ? 'min' : 'natural')));
    const total = own.reduce((a, b) => a + b, 0) + gap * Math.max(0, node.children.length - 1);
    const sharing = node.children.filter((c, i) => grows(c) || elastic[i]).length;
    const leftover = Math.max(0, innerHeight - total) / Math.max(1, sharing);
    heights = node.children.map((c, i) => Math.max(0, grows(c) ? leftover : elastic[i] ? own[i] + leftover : innerHeight - total + own[i]));
  }
  let placed = 0;
  return node.children
    .map((child, i) => {
      const childEnv: Env = { surface, width: widths[i] ?? inner, height: heights[i] };
      const html = compileNode(child, ctx, childEnv);
      if (!html) return '';
      // Racine d'une page paginée : l'écart est une MARGE, que le paginateur sait étirer. L'enveloppe de la
      // marge EST la rangée que le paginateur lit : elle reprend les marqueurs de ce qu'elle porte (bloc
      // insécable, pied de section, titre à garder avec la suite) — enfouis d'un niveau, il ne les voit pas.
      if (flowRoot) {
        if (placed++ === 0) return html;
        const open = html.slice(0, html.indexOf('>') + 1);
        const markers = ROW_MARKERS.filter((marker) => new RegExp(`\\s${marker.split('=')[0]}(?=[\\s=>/])`).test(open));
        return `<div${markers.map((marker) => ` ${marker}`).join('')} style="${css({ 'margin-top': gap })}">${html}</div>`;
      }
      if (node.t === 'grid') {
        const span = node.spans?.[i] ?? (child.t === 'block' && child.span ? child.span : undefined);
        return span && span > 1 ? `<div style="${css({ 'grid-column': `span ${span}`, 'min-width': 0 })}">${html}</div>` : html;
      }
      return html;
    })
    .filter(Boolean);
}

/** Les marges de page, côté par côté (px) : ce qu'un conteneur à fond perdu doit franchir. */
function pageInsets(ctx: CompileContext): [number, number, number, number] {
  const f = ctx.tokens.format;
  const visual = f.family === 'visual' || f.family === 'cover';
  return visual ? [f.safe.top, f.safe.right, f.safe.bottom, f.safe.left] : [f.pad, f.pad, f.pad, f.pad];
}

function compileContainer(node: Container, ctx: CompileContext, env: Env): string {
  const surface = surfaceHex(node.surface, ctx, env.surface);
  const surfaced = Boolean(node.surface && node.surface !== 'none');
  let [pt, pr, pb, pl] = padOf(node, ctx);
  // À fond perdu : marges négatives jusqu'au bord. Un APLAT (bandeau, rail, panneau) rend ces marges en
  // marge intérieure, pour que son texte reste aligné sur la grille de la page ; un conteneur sans aplat
  // (une photo) remplit tout le fond perdu.
  const bleed = new Set(node.bleed ?? []);
  const [it, ir, ib, il] = pageInsets(ctx);
  const margins = { t: bleed.has('t') ? -it : 0, r: bleed.has('r') ? -ir : 0, b: bleed.has('b') ? -ib : 0, l: bleed.has('l') ? -il : 0 };
  if (surfaced) {
    pt += -margins.t;
    pr += -margins.r;
    pb += -margins.b;
    pl += -margins.l;
  }
  env = { ...env, width: env.width - margins.l - margins.r, height: env.height !== undefined ? env.height - margins.t - margins.b : undefined };
  const bw = node.border && node.border.weight !== 'none' ? ctx.tokens.stroke[node.border.weight] : 0;
  const inner = Math.max(0, env.width - pl - pr - bw * 2);
  const innerHeight = env.height !== undefined ? Math.max(0, env.height - pt - pb - bw * 2) : undefined;
  const gap = node.t === 'box' ? 0 : sp(ctx, node.gap ?? 'md');
  const children = compileChildren(node, ctx, env, surface, inner, innerHeight, false);

  const layout: Record<string, CssValue> =
    node.t === 'stack'
      ? { display: 'flex', 'flex-direction': 'column', gap: gap || undefined, 'align-items': node.align ? ALIGN[node.align] : undefined, 'justify-content': node.justify ? JUSTIFY[node.justify] : undefined }
      : node.t === 'row'
        ? { display: 'flex', 'flex-direction': 'row', gap: gap || undefined, 'align-items': ALIGN[node.align ?? 'start'], 'justify-content': node.justify ? JUSTIFY[node.justify] : undefined, 'flex-wrap': node.wrap ? 'wrap' : undefined }
        : node.t === 'grid'
          ? {
              display: 'grid',
              'grid-template-columns': typeof node.cols === 'number' ? `repeat(${node.cols}, minmax(0, 1fr))` : node.cols.map((c) => `minmax(0, ${c}fr)`).join(' '),
              'column-gap': gap,
              'row-gap': sp(ctx, node.rowGap ?? node.gap ?? 'md'),
              'align-items': ALIGN[node.align ?? 'start'],
            }
          : { display: 'block' };

  const style = css({
    ...layout,
    'box-sizing': 'border-box',
    margin: bleed.size ? `${margins.t}px ${margins.r}px ${margins.b}px ${margins.l}px` : undefined,
    padding: pt || pr || pb || pl ? `${pt}px ${pr}px ${pb}px ${pl}px` : undefined,
    background: node.surface && node.surface !== 'none' ? surface : undefined,
    color: node.surface && node.surface !== 'none' ? inkHex('ink', ctx, surface) : undefined,
    'border-radius': node.radius ? ctx.tokens.radius[node.radius] : undefined,
    ...borderCss(node, ctx, surface, env.surface),
    flex: node.grow ? '1 1 0%' : undefined,
    'min-width': 0,
    'min-height': node.grow ? 0 : undefined,
    overflow: node.clip ? 'hidden' : undefined,
    position: 'relative',
    // Le pied de page garde sa taille quand le corps d'une toile fixe est mis à l'échelle.
    zoom: node.role === 'folio' && ctx.fitScale && ctx.fitScale !== 1 ? Math.round((1 / ctx.fitScale) * 1000) / 1000 : undefined,
  });
  const attrs = [
    `style="${style}"`,
    node.id ? `data-el="${escAttr(node.id)}"` : '',
    node.keep || node.role === 'folio' ? 'data-keep-together' : '',
    node.role ? `data-ge-role="${node.role}"` : '',
    // Le pied de section, marqué : le paginateur le retire quand il serait seul sur une page.
    node.role === 'folio' ? 'data-idem-folio="1"' : '',
    // Repères de la mesure : un texte ne sort jamais de son aplat ; le contenu à fond perdu va jusqu'au bord.
    surfaced ? 'data-ge-surface' : '',
    bleed.size ? 'data-ge-bleed' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return `<div ${attrs}>${children.join('')}</div>`;
}

function compileLogo(node: Extract<NodeT, { t: 'logo' }>, ctx: CompileContext, env: Env): string {
  const logos = ctx.tokens.brand.logos;
  // Un fond sur lequel le blanc se lit mieux que le noir appelle la déclinaison pour fond sombre.
  const darkSurface = contrastRatio('#ffffff', env.surface) > contrastRatio('#000000', env.surface);
  const want = node.variant ?? 'auto';
  const pick =
    want === 'icon'
      ? (darkSurface ? logos.iconOnDark : logos.iconOnLight) ?? logos.icon
      : want === 'mono'
        ? logos.mono
        : want === 'light'
          ? logos.onLight
          : want === 'dark'
            ? logos.onDark
            : darkSurface
              ? logos.onDark ?? logos.mono
              : logos.onLight ?? logos.primary;
  const height = ctx.tokens.size.base * LOGO_HEIGHT[node.height ?? 'md'];
  const url = safeUrl(pick ?? (darkSurface ? undefined : logos.primary));
  if (url) {
    // Dans un conteneur de bloc : l'image garde sa largeur propre (calée à gauche, ou centrée si son parent
    // centre) au lieu d'être étirée sur toute la largeur et recentrée par `object-fit`.
    return `<div data-ge-logo style="line-height:0;min-width:0"${node.id ? ` data-el="${escAttr(node.id)}"` : ''}><img src="${escAttr(url)}" alt="${escAttr(`Logo ${ctx.tokens.brand.name}`)}" style="${css({ display: 'block', height: Math.round(height), width: 'auto', 'max-width': '100%', 'object-fit': 'contain' })}"></div>`;
  }
  // Sans fichier lisible sur ce fond : le nom de la marque, composé en mot-symbole. Jamais un logo inventé.
  if (!ctx.tokens.brand.name.trim()) return '';
  return `<p data-ge-wordmark style="${css({ margin: 0, 'font-family': ctx.tokens.font.displayStack, 'font-weight': 700, 'font-size': Math.round(height * 0.62), 'line-height': 1, 'letter-spacing': '-0.01em', color: inkHex('heading', ctx, env.surface, true), 'white-space': 'nowrap' })}">${esc(ctx.tokens.brand.name)}</p>`;
}

function compileImage(node: Extract<NodeT, { t: 'image' }>, ctx: CompileContext, env: Env): string {
  let url = safeUrl(node.url);
  let alt = node.alt ?? '';
  let blockFocal: { x: number; y: number } | undefined;
  if (!url && node.ref) {
    const block = ctx.section.blocks.find((b) => b.id === node.ref);
    if (block && block.kind === 'figure') {
      url = safeUrl(block.url);
      alt = alt || block.alt;
      blockFocal = block.focal;
    }
  }
  if (!url) return '';
  // Le point d'intérêt de la PHOTO (contenu) l'emporte sur le défaut ; la composition peut l'imposer.
  const focal = node.focal ?? blockFocal ?? { x: 0.5, y: 0.45 };
  const scrim = ctx.tokens.color.deep;
  const overlay =
    node.overlay === 'scrim-bottom'
      ? `linear-gradient(to top, ${withAlpha(scrim, 0.82)} 0%, ${withAlpha(scrim, 0.45)} 38%, ${withAlpha(scrim, 0)} 70%)`
      : node.overlay === 'scrim-top'
        ? `linear-gradient(to bottom, ${withAlpha(scrim, 0.8)} 0%, ${withAlpha(scrim, 0.4)} 36%, ${withAlpha(scrim, 0)} 68%)`
        : node.overlay === 'scrim-full'
          ? withAlpha(scrim, 0.52)
          : node.overlay === 'tint-brand'
            ? withAlpha(ctx.tokens.color.primary, 0.42)
            : '';
  const box = css({
    position: 'relative',
    overflow: 'hidden',
    width: '100%',
    height: node.grow || !node.ratio ? '100%' : undefined,
    'aspect-ratio': node.ratio && !node.grow ? String(Math.round(node.ratio * 1000) / 1000) : undefined,
    'border-radius': node.radius ? ctx.tokens.radius[node.radius] : undefined,
    flex: node.grow ? '1 1 0%' : undefined,
    'min-height': node.grow ? 0 : undefined,
    background: ctx.tokens.color.sunken,
  });
  const img = `<img src="${escAttr(url)}" alt="${escAttr(alt)}" style="${css({ position: 'absolute', inset: 0, width: '100%', height: '100%', 'object-fit': node.fit ?? 'cover', 'object-position': `${Math.round(focal.x * 100)}% ${Math.round(focal.y * 100)}%`, display: 'block' })}">`;
  const veil = overlay ? `<div aria-hidden="true" style="${css({ position: 'absolute', inset: 0, background: overlay, 'mix-blend-mode': node.overlay === 'tint-brand' ? 'multiply' : undefined })}"></div>` : '';
  return `<div data-ge-image${node.id ? ` data-el="${escAttr(node.id)}"` : ''} style="${box}">${img}${veil}</div>`;
}

function shapeColors(tone: Extract<NodeT, { t: 'shape' }>['tone'], ctx: CompileContext, surface: string): { main: string; alt: string } {
  const c = ctx.tokens.color;
  switch (tone ?? 'brand') {
    case 'brand':
      return { main: c.neonPrimary ? c.deep : c.primary, alt: c.accent };
    case 'accent':
      return { main: c.accent, alt: c.primary };
    case 'ink':
      return { main: inkHex('ink', ctx, surface), alt: c.primary };
    case 'soft':
      return { main: mixHex(surface, c.primary, 0.22), alt: mixHex(surface, c.accent, 0.22) };
    case 'on-brand':
      return { main: c.onBrand, alt: mixHex(c.primary, c.onBrand, 0.5) };
  }
}

function compileShape(node: Extract<NodeT, { t: 'shape' }>, ctx: CompileContext, env: Env): string {
  const paint = shapeColors(node.tone, ctx, env.surface);
  // L'épaisseur d'un trait suit la taille RÉELLE de la boîte (trait d'écran, cf. le kit).
  const side = Math.min(env.width, env.height ?? env.width);
  const svg = drawShape(node.shape, node.seed ?? 1, { ...paint, stroke: LINE_SHAPES.has(node.shape) ? Math.round(Math.max(0.75, Math.min(6, side * 0.011)) * 100) / 100 : undefined }, { opacity: node.opacity });
  const share = { sm: 0.16, md: 0.3, lg: 0.48 }[node.size === 'fill' || !node.size ? 'md' : node.size];
  const box = node.size === 'fill' || !node.size ? css({ width: '100%', height: '100%' }) : css({ width: Math.round(env.width * share), height: Math.round(env.width * share), 'flex-shrink': 0 });
  return `<div aria-hidden="true" data-gfx="${node.shape}"${node.id ? ` data-el="${escAttr(node.id)}"` : ''} style="${box}">${svg}</div>`;
}

function compilePattern(node: Extract<NodeT, { t: 'pattern' }>, ctx: CompileContext, env: Env): string {
  const pattern = ctx.tokens.brand.patterns[0];
  const opacity = node.opacity ?? 0.16;
  if (pattern && safeUrl(pattern.url)) {
    // Guillemets SIMPLES dans `url(…)` : des guillemets doubles refermeraient l'attribut `style`.
    return `<div aria-hidden="true" data-ge-pattern style="${css({ width: '100%', height: '100%', opacity, 'background-image': `url('${safeUrl(pattern.url).replace(/'/g, '%27')}')`, 'background-size': `${pattern.tile}px ${pattern.tile}px`, 'background-repeat': 'repeat' })}"></div>`;
  }
  return compileShape({ t: 'shape', shape: 'grid-lines', tone: 'brand', opacity: Math.min(1, opacity * 2), size: 'fill' }, ctx, env);
}

/** Une icône locale (Tabler, sinon Lucide), au trait, à l'encre du fond ; décorative : le mot voisin porte le sens. */
function compileIcon(node: Extract<NodeT, { t: 'icon' }>, ctx: CompileContext, env: Env): string {
  const set = node.set === 'lucide' ? 'lucide' : 'tabler';
  const svg = iconSvg(node.name, set) ?? (set === 'tabler' ? iconSvg(node.name, 'lucide') : null);
  if (!svg) {
    ctx.issues.push({ code: 'icon_missing', severity: 'advisory', message: `Icône « ${node.name} » introuvable dans les jeux locaux.` });
    return '';
  }
  const size = Math.round(ctx.tokens.size.base * { sm: 1.2, md: 1.7, lg: 2.6 }[node.size ?? 'md']);
  const color = inkHex(node.ink ?? 'emphasis', ctx, env.surface, true);
  return `<span aria-hidden="true" data-ge-icon="${escAttr(node.name)}" style="${css({ display: 'inline-flex', width: size, height: size, color, 'flex-shrink': 0 })}">${svg.replace('<svg', `<svg width="${size}" height="${size}"`)}</span>`;
}

function compileRule(node: Extract<NodeT, { t: 'rule' }>, ctx: CompileContext, env: Env): string {
  const weight = ctx.tokens.stroke[node.weight ?? 'hair'];
  const color = node.ink ? inkHex(node.ink, ctx, env.surface, true) : env.surface === ctx.look.ground ? ctx.look.rule : mixHex(env.surface, inkHex('ink', ctx, env.surface), 0.25);
  if (node.vertical) return `<div aria-hidden="true" style="${css({ width: weight, 'align-self': 'stretch', background: color, 'flex-shrink': 0 })}"></div>`;
  const unit = ctx.tokens.size.base;
  const width = node.length === 'short' ? Math.round(unit * 4.2) : node.length === 'xshort' ? Math.round(unit * 2) : undefined;
  return `<div aria-hidden="true" style="${css({ width: width ?? '100%', height: weight, background: color, 'flex-shrink': 0 })}"></div>`;
}

export function compileNode(node: NodeT, ctx: CompileContext, env: Env): string {
  switch (node.t) {
    case 'stack':
    case 'row':
    case 'grid':
    case 'box':
      return compileContainer(node, ctx, env);
    case 'layer': {
      const surface = surfaceHex(node.surface, ctx, env.surface);
      const items = node.items
        .slice()
        .sort((a, b) => (a.z ?? 0) - (b.z ?? 0))
        .map((item) => {
          const childEnv: Env = { surface, width: (env.width * item.at.w) / 100, height: env.height !== undefined ? (env.height * item.at.h) / 100 : undefined };
          const html = compileNode(item.node, ctx, childEnv);
          return html ? `<div style="${css({ position: 'absolute', left: `${item.at.x}%`, top: `${item.at.y}%`, width: `${item.at.w}%`, height: `${item.at.h}%`, 'z-index': item.z ?? 0, display: 'flex', 'flex-direction': 'column' })}">${html}</div>` : '';
        })
        .join('');
      return `<div${node.id ? ` data-el="${escAttr(node.id)}"` : ''} style="${css({ position: 'relative', width: '100%', height: '100%', 'min-height': 0, flex: '1 1 0%', background: node.surface && node.surface !== 'none' ? surface : undefined, overflow: node.clip === false ? undefined : 'hidden' })}">${items}</div>`;
    }
    case 'text':
      return renderText(node, ctx, env);
    case 'block': {
      const block = ctx.section.blocks.find((b) => b.id === node.ref);
      if (!block) {
        ctx.issues.push({ code: 'unknown_block', severity: 'blocking', message: `Bloc « ${node.ref} » introuvable dans la section.`, path: node.ref });
        return '';
      }
      const component = componentFor(block.kind, node.component);
      if (!component) {
        ctx.issues.push({ code: 'no_component', severity: 'blocking', message: `Aucun composant ne sait rendre un bloc « ${block.kind} ».`, path: node.ref });
        return '';
      }
      const variant = { ...component.defaults, ...(node.variant ?? {}) };
      const html = component.render({ block, ctx, env, variant });
      if (!html) return '';
      const atomic = component.atomic?.(block, variant) ?? true;
      return `<div data-ge-block="${escAttr(block.id)}" data-ge-component="${escAttr(component.id)}"${atomic ? ' data-keep-together' : ''} style="min-width:0">${html}</div>`;
    }
    case 'image':
      return compileImage(node, ctx, env);
    case 'shape':
      return compileShape(node, ctx, env);
    case 'icon':
      // Une icône vient du registre de capacités : un rendu fourni par l'hôte, sinon les jeux LOCAUX.
      return ctx.icons?.(node, env) ?? compileIcon(node, ctx, env);
    case 'logo':
      return compileLogo(node, ctx, env);
    case 'rule':
      return compileRule(node, ctx, env);
    case 'spacer':
      return node.flex ? '<div aria-hidden="true" style="flex:1 1 0%;min-height:0"></div>' : `<div aria-hidden="true" style="${css({ height: sp(ctx, node.size ?? 'md'), 'flex-shrink': 0 })}"></div>`;
    case 'pattern':
      return compilePattern(node, ctx, env);
  }
}

/** Les aplats doux (lavis, pan diagonal) servent de fond ; les autres formes et motifs sont de l'ENCRE, jamais sous un texte. */
const GROUND_SHAPES = new Set<string>(['blob', 'slant']);

function isInkDecor(node: NodeT): boolean {
  if (node.t === 'pattern') return (node.opacity ?? 1) > 0.15;
  if (node.t === 'shape') return !GROUND_SHAPES.has(node.shape) && (node.opacity ?? 1) > 0.15;
  return false;
}

function compileDecor(item: DecorItem, index: number, ctx: CompileContext, pageEnv: Env, f: { width: number; height: number }): string {
  const env: Env = { surface: pageEnv.surface, width: (f.width * item.at.w) / 100, height: (f.height * item.at.h) / 100 };
  const html = compileNode(item.node, ctx, env);
  if (!html) return '';
  return `<div aria-hidden="true" data-ge-decor="${index}"${isInkDecor(item.node) ? ' data-ge-ink' : ''} style="${css({ position: 'absolute', left: `${item.at.x}%`, top: `${item.at.y}%`, width: `${item.at.w}%`, height: `${item.at.h}%`, 'z-index': item.z ?? 0, 'pointer-events': 'none', overflow: 'hidden', display: 'flex', 'flex-direction': 'column' })}">${html}</div>`;
}

export interface CompiledSection {
  html: string;
  ground: string;
}

export interface CompileSectionOptions {
  /** Empreinte structurelle, posée sur la racine (`data-ge-fp`). */
  fingerprint?: string;
  specHash?: string;
  /** Échelle d'ajustement d'une toile fixe (réparation mesurée), 1 = aucune. */
  fitScale?: number;
}

export function compileSection(spec: SectionSpec, ctx: CompileContext, options: CompileSectionOptions = {}): CompiledSection {
  const f = ctx.tokens.format;
  const ground = spec.ground && spec.ground !== 'ground' ? surfaceHex(spec.ground, ctx, ctx.look.ground) : ctx.look.ground;
  const fixed = f.kind === 'fixed';
  const visual = f.family === 'visual' || f.family === 'cover';
  const pad = visual ? `${f.safe.top}px ${f.safe.right}px ${f.safe.bottom}px ${f.safe.left}px` : f.css.padding;
  const env: Env = {
    surface: ground,
    width: f.width - (visual ? f.safe.left + f.safe.right : f.pad * 2),
    height: fixed ? f.height - (visual ? f.safe.top + f.safe.bottom : f.pad * 2) : undefined,
  };
  const decor = (spec.decor ?? []).map((item, i) => compileDecor(item, i, ctx, env, f)).join('');
  const root = spec.root;
  const scale = options.fitScale && options.fitScale !== 1 ? options.fitScale : undefined;
  ctx.fitScale = scale;
  // Une page paginée expose ses rangées directement sous la racine (le paginateur les découpe) ; une toile
  // fixe garde son arbre dans un corps qui s'étire sur toute la hauteur utile.
  const content =
    !fixed && root.t === 'stack'
      ? compileChildren(root, ctx, env, ground, env.width, undefined, true).join('')
      : `<div data-ge-body style="${css({ position: 'relative', 'z-index': 1, flex: '1 1 0%', 'min-height': 0, display: 'flex', 'flex-direction': 'column', zoom: scale })}">${compileNode(root, ctx, scale ? { ...env, width: env.width / scale, height: env.height !== undefined ? env.height / scale : undefined } : env)}</div>`;

  const style = css({
    position: 'relative',
    'box-sizing': 'border-box',
    width: f.css.width,
    height: fixed ? f.css.height : undefined,
    'min-height': fixed ? undefined : f.css.height,
    padding: pad,
    background: ground,
    color: inkHex('ink', ctx, ground),
    'font-family': ctx.tokens.font.bodyStack,
    'font-size': ctx.tokens.size.base,
    'line-height': ctx.tokens.leading.normal,
    overflow: fixed ? 'hidden' : undefined,
    display: 'flex',
    'flex-direction': 'column',
    '-webkit-print-color-adjust': 'exact',
    'print-color-adjust': 'exact',
  });
  const attrs = [
    'class="ge-page"',
    `lang="${escAttr(ctx.locale)}"`,
    `data-ge-engine="${ENGINE_VERSION}"`,
    `data-ge-components="${COMPONENT_LIBRARY_VERSION}"`,
    `data-ge-pattern="${escAttr(spec.pattern.id)}"`,
    `data-ge-section="${escAttr(spec.ref)}"`,
    `data-ge-format="${f.id}"`,
    options.specHash ? `data-ge-spec="${escAttr(options.specHash)}"` : '',
    options.fingerprint ? `data-ge-fp="${escAttr(options.fingerprint)}"` : '',
    `style="${style}"`,
  ].filter(Boolean);
  return { html: `<div ${attrs.join(' ')}>${decor}${content}</div>`, ground };
}

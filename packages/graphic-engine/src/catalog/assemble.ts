/**
 * L'ASSEMBLAGE — squelette + habillage + composants → le HTML Tailwind d'une page, avec ses CLÉS de contenu.
 *
 * Tout est fait par le code, sans modèle : les unités de la page (en-tête, blocs) vont dans les zones du squelette,
 * chaque unité est rendue par son composant (les listes déroulées, les clés relatives rendues absolues), les rôles
 * d'habillage et les couleurs de surface sont résolus, le décor est posé. Le résultat est exactement ce qu'écrivait
 * l'auteur libre : il passe par la même chaîne (assainissement, remplissage, Tailwind, contrôle d'affichage), se
 * rejoue sans modèle et s'exporte en PowerPoint.
 *
 * LE LANGAGE DES COMPOSANTS (documenté pour les contributeurs dans le dépôt `idem-templates`) :
 *   {{title}} {{kicker}} {{lede}}        les textes de l'en-tête (et les champs d'une carte : {{fullName}}…)
 *   {{.chemin}}                          un texte du bloc rendu (`{{.caption}}`)
 *   {{$.chemin}} {{$}}                   un texte de l'élément courant d'une liste
 *   [[each items]] … [[/each]]           une liste du bloc (`[[each $.items]]` : la liste de l'élément courant)
 *   [[if .x]] … [[else]] … [[/if]]       présent ? (`$.x`, `.x`, `kicker`, `first`, `last`, `odd`, `even`, `.side=front`, `!x`)
 *   [[s.title]]                          les classes d'un rôle d'habillage, sa taille comprise
 *   [[ink]] [[muted]] [[accent]] [[faint]] [[rule]] [[ruleStrong]] [[fill]] [[onFill]] [[tint]]
 *                                        les couleurs de la marque, justes sur la surface de la zone
 *   [[t.2xl]]                            une taille de l'échelle de la marque (`text-[Npx]`)
 *   [[id]] [[i]] [[i0]] [[i2]] [[n]]     l'identifiant du bloc ; le rang (1…, 0…, 01…) ; la longueur de la liste
 *   [[count items]] [[cols items 3]]     un nombre d'éléments (plafonné) — `grid-cols-[[cols items 3]]`
 *   [[gap]] [[gap-sm]] [[gap-lg]] [[pad]] les espacements de la page (`gap-[Npx]`, `p-[Npx]`)
 *   [[logo]] [[logo-sm]] [[logo-lg]]     le logo de la marque, à la taille de la toile
 *   [[size $.step]] [[weight $.weight]] [[family $.family]] [[ground $.background]] [[level $.impact]]
 *   [[focal .]] [[focal $]]              les données de spécimen et le recadrage d'une photo, par le code
 *   [[at tl|tr|bl|br]]                   (décor) une position absolue dans la marge de la page
 * Les primitives restent celles du moteur : `<idem-chart data-block="[[id]]">`, `<idem-table>`, `<idem-gallery>`,
 * `<idem-pattern-tile data-block="[[id]]" data-index="[[i0]]">`, `<idem-icon name="{{$.icon}}">`, `<img src="{{$.url}}">`.
 */
import type { DocumentType } from '../contracts/common';
import type { Block, SectionContent } from '../contracts/content-model';
import type { FormatDef } from '../design-system/formats';
import type { DesignTokens } from '../design-system/tokens';
import type { ContentMap } from '../runtime/content-map';
import type { ComponentNode, LayoutNode, LayoutZone, NodeVar, PageConfig, SkinNode, SkinRole, ZoneAccept } from './types';
import { SKIN_ROLES } from './types';
import { colorDistance, contrastRatio } from '../foundation/color';

/** La géométrie d'une page : marge et gouttière, d'après le format (des cotes d'impression, pas un gabarit). */
export function pageGeometry(format: FormatDef): { pad: number; gap: number } {
  return { pad: Math.round(format.pad ?? 48), gap: Math.max(12, Math.round((format.unit ?? 4) * 5)) };
}

// ── Les unités de contenu ────────────────────────────────────────────────────────────────────

export type UnitCategory = 'header' | 'media' | 'main' | 'body';

export interface PageUnit {
  /** `header` ou l'identifiant du bloc. */
  id: string;
  /** `header` ou le type du bloc. */
  kind: string;
  category: UnitCategory;
  block?: Block;
  /** Le nombre d'éléments de sa liste principale (bornes des composants). */
  items: number;
}

const MEDIA_KINDS = new Set(['figure', 'mockupShowcase', 'logoDisplay', 'imageryShowcase', 'logoStory']);
const MAIN_KINDS = new Set(['chart', 'table', 'comparison', 'businessModel', 'swot', 'riskMatrix', 'cover', 'copy', 'contact', 'swatches', 'typeSpecimen', 'typeScale', 'patternGrid', 'socialPosts', 'socialBanners']);
const LIST_KEYS = ['items', 'steps', 'stages', 'risks', 'cells', 'variants', 'specimens', 'levels', 'patterns', 'posts', 'banners', 'points', 'rows', 'paragraphs', 'facts', 'series'];

function itemCount(block: Block): number {
  const b = block as unknown as Record<string, unknown>;
  for (const k of LIST_KEYS) if (Array.isArray(b[k])) return (b[k] as unknown[]).length;
  if (block.kind === 'swot') return 4;
  return 1;
}

/**
 * Les unités d'une page. L'en-tête n'existe pas sur une face de carte ni sur un visuel (son titre double le texte du
 * visuel), ni à côté d'un bloc de couverture (qui porte le sien).
 */
export function pageUnits(section: SectionContent): PageUnit[] {
  const units: PageUnit[] = [];
  const noHeader = section.role === 'card-face' || section.role === 'visual' || section.blocks.some((b) => b.kind === 'cover' || b.kind === 'copy' || b.kind === 'contact');
  if (!noHeader) units.push({ id: 'header', kind: 'header', category: 'header', items: 1 });
  for (const block of section.blocks) {
    const imagery = block.kind === 'imageryShowcase' && !block.imageUrl;
    const category: UnitCategory = MEDIA_KINDS.has(block.kind) && !imagery ? 'media' : MAIN_KINDS.has(block.kind) ? 'main' : 'body';
    units.push({ id: block.id, kind: block.kind, category, block, items: itemCount(block) });
  }
  return units;
}

/** Les zones d'un squelette après miroir et réglages continus. */
export function placedZones(layout: LayoutNode, config: Pick<PageConfig, 'mirror' | 'params'>): LayoutZone[] {
  const cols = layout.grid.columns;
  let zones = layout.zones.map((z) => ({ ...z }));
  // `split` : la frontière entre la première zone et sa voisine de droite (mêmes lignes).
  const split = layout.params?.find((p) => p.name === 'split');
  const wanted = config.params?.split;
  if (split && typeof wanted === 'number' && zones.length >= 2) {
    const a = zones[0];
    const span = Math.round(Math.min(split.max, Math.max(split.min, wanted)));
    const oldEnd = a.col + a.span;
    const delta = span - a.span;
    if (delta) {
      zones = zones.map((z, i) => {
        if (i === 0) return { ...z, span };
        const sameRows = z.row < a.row + a.rows && a.row < z.row + z.rows;
        if (sameRows && z.col >= oldEnd) {
          const right = z.col + z.span;
          const col = Math.max(1, Math.min(cols, z.col + delta));
          return z.col === oldEnd || z.col === oldEnd + 1 ? { ...z, col, span: Math.max(1, right - col) } : z;
        }
        return z;
      });
    }
  }
  if (config.mirror && layout.mirrorable) zones = zones.map((z) => ({ ...z, col: cols - (z.col + z.span - 1) + 1 }));
  return zones;
}

/**
 * La répartition des unités dans les zones : l'en-tête dans la zone d'en-tête, les médias dans les zones de média,
 * le premier contenu dans la zone principale, les suivants sur les côtés (puis dans la principale). `error` : ce
 * squelette ne convient pas à ce contenu (une zone obligatoire resterait vide, un média n'a pas de place).
 */
export function assignUnits(layout: LayoutNode, units: PageUnit[], zones: LayoutZone[] = layout.zones): { zones: Map<string, PageUnit[]>; error?: string } {
  const out = new Map<string, PageUnit[]>(zones.map((z) => [z.id, []]));
  const accepts = (z: LayoutZone, a: ZoneAccept) => z.accepts.includes(a);
  const room = (z: LayoutZone) => (z.max ?? 99) > (out.get(z.id)?.length ?? 0);
  const main = zones.find((z) => accepts(z, 'main')) ?? zones.find((z) => accepts(z, 'any')) ?? zones[zones.length - 1];
  const put = (z: LayoutZone, u: PageUnit) => out.get(z.id)!.push(u);
  const blocks = units.filter((u) => u.category !== 'header');
  const cap = layout.capacity;
  if (blocks.length < cap.minBlocks || blocks.length > cap.maxBlocks) return { zones: out, error: `${blocks.length} bloc(s) pour ${cap.minBlocks}–${cap.maxBlocks}` };
  if (cap.kinds?.length && blocks.some((b) => !cap.kinds!.includes(b.kind))) return { zones: out, error: `types de blocs non admis : ${blocks.filter((b) => !cap.kinds!.includes(b.kind)).map((b) => b.kind).join(', ')}` };
  if (cap.avoidKinds?.length && blocks.some((b) => cap.avoidKinds!.includes(b.kind))) return { zones: out, error: 'type de bloc évité par ce squelette' };
  if (cap.maxItems && blocks.reduce((n, b) => n + b.items, 0) > cap.maxItems) return { zones: out, error: `trop d'éléments pour ce squelette (${cap.maxItems} au plus)` };
  const header = units.find((u) => u.category === 'header');
  if (header) {
    const z = zones.find((x) => accepts(x, 'header')) ?? zones.find((x) => accepts(x, 'any')) ?? main;
    put(z, header);
  }
  const rest: PageUnit[] = [];
  const mediaZones = zones.filter((z) => accepts(z, 'media'));
  for (const u of blocks) {
    if (u.category === 'media') {
      const z = mediaZones.find(room);
      if (z) {
        put(z, u);
        continue;
      }
    }
    rest.push(u);
  }
  const sides = zones.filter((z) => z !== main && (accepts(z, 'side') || accepts(z, 'any')) && !accepts(z, 'header'));
  rest.forEach((u, i) => {
    if (i === 0 && room(main)) return put(main, u);
    const side = sides.find(room);
    put(side ?? main, u);
  });
  for (const z of zones) {
    if (!z.optional && !(out.get(z.id)?.length ?? 0)) return { zones: out, error: `zone ${z.id} vide` };
  }
  return { zones: out };
}

// ── Couleurs de surface et rôles d'habillage ─────────────────────────────────────────────────

type Surface = NonNullable<LayoutZone['surface']>;
const COLOR_ROLES = ['ink', 'muted', 'accent', 'faint', 'rule', 'ruleStrong', 'fill', 'onFill', 'tint'] as const;
type ColorRole = (typeof COLOR_ROLES)[number];

/**
 * Les rôles de couleur d'un habillage (`[[accent]]`, `[[ruleStrong]]`, `[[tint]]`…), traduits dans la CHARTE du client.
 * Jusqu'au 11/11/2026 ils renvoyaient tous à la couleur principale : la secondaire et l'accent de la charte
 * n'apparaissaient jamais sur un visuel. Désormais :
 *   - l'accent (sur-titres, index, puces, filets forts) prend la couleur d'ACCENT de la charte, ou sa nuance la plus
 *     proche qui reste lisible (4,5:1 pour un texte, 3:1 pour un filet) ; la principale seulement si aucune ne l'est ;
 *   - la teinte d'une carte mise en avant est celle de l'accent ;
 *   - sur un aplat de la couleur principale ou profond, l'accent reste l'accent quand il s'y lit.
 * Une couleur fluo ne porte jamais un texte.
 */
const ACCENT_STEPS = ['500', '600', '700', '800', '400', '300'];
function readableAccent(tokens: DesignTokens, background: string, target: number): string | null {
  const c = tokens.color;
  if (!c.neonAccent && contrastRatio(c.accent, background) >= target) return 'brand-accent';
  for (const step of ACCENT_STEPS) {
    const shade = c.accentRamp[step];
    if (shade && contrastRatio(shade, background) >= target && colorDistance(shade, c.accent) < 30) return `accent-${step}`;
  }
  return null;
}
const surfaceCache = new Map<string, Record<'light' | 'brand' | 'deep', Record<ColorRole, string>>>();
export function surfaceColors(tokens: DesignTokens): Record<'light' | 'brand' | 'deep', Record<ColorRole, string>> {
  const known = surfaceCache.get(tokens.hash);
  if (known) return known;
  const c = tokens.color;
  const onLight = readableAccent(tokens, c.ground, 4.5);
  const ruleLight = readableAccent(tokens, c.ground, 3);
  const onBrand = readableAccent(tokens, c.primary, 4.5);
  const ruleBrand = readableAccent(tokens, c.primary, 3);
  const onDeep = readableAccent(tokens, c.deep, 4.5);
  const ruleDeep = readableAccent(tokens, c.deep, 3);
  const out = {
    light: { ink: 'text-ink', muted: 'text-muted', accent: onLight ? `text-${onLight}` : 'text-brand-primary', faint: 'text-faint', rule: 'border-rule', ruleStrong: ruleLight ? `border-${ruleLight}` : 'border-brand-primary', fill: 'bg-brand-primary', onFill: 'text-on-brand', tint: 'bg-accent-soft' },
    brand: { ink: 'text-on-brand', muted: 'text-on-brand/80', accent: onBrand ? `text-${onBrand}` : 'text-on-brand', faint: 'text-on-brand/60', rule: 'border-on-brand/30', ruleStrong: ruleBrand ? `border-${ruleBrand}` : 'border-on-brand', fill: 'bg-on-brand', onFill: 'text-brand-primary', tint: 'bg-on-brand/10' },
    deep: { ink: 'text-on-deep', muted: 'text-on-deep/75', accent: onDeep ? `text-${onDeep}` : 'text-on-deep', faint: 'text-on-deep/55', rule: 'border-on-deep/25', ruleStrong: ruleDeep ? `border-${ruleDeep}` : 'border-on-deep', fill: 'bg-brand-primary', onFill: 'text-on-brand', tint: 'bg-on-deep/10' },
  };
  surfaceCache.set(tokens.hash, out);
  return out;
}
const SURFACE_BG: Record<Surface, string> = { none: '', soft: 'bg-brand-soft', raised: 'bg-raised', brand: 'bg-brand-primary text-on-brand', deep: 'bg-deep text-on-deep' };
/** Les unités qui prennent la place restante de leur zone (graphique, tableau, image, galerie, spécimens). */
/** Les blocs dont la hauteur EST le contenu (rangées, aplats) : jamais comprimés quand ils partagent une zone. */
const CONTENT_HEIGHT_KINDS = new Set(['table', 'swatches', 'patternGrid']);
const FILL_KINDS = new Set(['chart', 'table', 'mockupShowcase', 'figure', 'logoDisplay', 'swatches', 'patternGrid', 'imageryShowcase', 'logoStory', 'socialPosts', 'socialBanners']);

/**
 * Une seule taille et un seul interlignage par élément : quand un composant précise une taille (`[[s.title]] [[t.2xl]]`),
 * la dernière l'emporte (en CSS, l'ordre des classes ne compte pas : la plus grande aurait pu gagner).
 */
export function dedupeClasses(html: string): string {
  return html.replace(/\sclass="([^"]*)"/g, (_m, cls: string) => {
    const list = cls.split(/\s+/).filter(Boolean);
    const lastOf = (re: RegExp) => list.map((c, i) => (re.test(c) ? i : -1)).filter((i) => i >= 0).slice(0, -1);
    const drop = new Set([...lastOf(/^text-\[\d+(\.\d+)?px\]$/), ...lastOf(/^leading-\[[^\]]+\]$/)]);
    // Un contenu centré ou calé en bas qui déborde le ferait par le HAUT, hors de la mesure : l'alignement « sûr »
    // le fait déborder vers le bas, où le code le mesure et le ramène à sa taille.
    const SAFE: Record<string, string> = { 'justify-end': 'justify-end-safe', 'justify-center': 'justify-center-safe', 'items-center': 'items-center-safe', 'items-end': 'items-end-safe' };
    const kept = list.filter((c, i) => !drop.has(i) && list.indexOf(c) === i).map((c) => SAFE[c] ?? c);
    return ` class="${kept.join(' ')}"`;
  });
}
const paletteOf = (tokens: DesignTokens, s: Surface | undefined): Record<ColorRole, string> => surfaceColors(tokens)[s === 'brand' ? 'brand' : s === 'deep' ? 'deep' : 'light'];

const SIZE_STEPS = ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl'] as const;

export interface AssemblyContext {
  section: SectionContent;
  map: ContentMap;
  format: FormatDef;
  tokens: DesignTokens;
  documentType: DocumentType;
}

export interface AssemblyChoice {
  layout: LayoutNode;
  skin: SkinNode;
  /** Le composant de chaque unité (identifiant d'unité → composant) ; absent : dessiné par le code. */
  components: Map<string, ComponentNode | undefined>;
  config: PageConfig;
}

/** Le choix retenu pour chaque réglage discret (option demandée, sinon défaut, sinon première). */
function resolveVars(vars: NodeVar[], chosen: Record<string, string>): Map<string, Record<string, string>> {
  const out = new Map<string, Record<string, string>>();
  for (const v of vars) {
    const option = v.options.find((o) => o.id === chosen[v.name]) ?? v.options.find((o) => o.id === v.default) ?? v.options[0];
    out.set(v.name, option.classes ?? {});
  }
  return out;
}

/** Les classes d'habillage, réglages appliqués (`+…` ajoute, sinon remplace) ; et les ajouts par zone et à la page. */
function skinClasses(skin: SkinNode, vars: Map<string, Record<string, string>>): { roles: Record<string, string>; zones: Record<string, string> } {
  const roles: Record<string, string> = { ...skin.classes } as Record<string, string>;
  const zones: Record<string, string> = {};
  for (const classes of vars.values()) {
    for (const [target, value] of Object.entries(classes)) {
      if (target.startsWith('zone:')) zones[target.slice(5)] = `${zones[target.slice(5)] ?? ''} ${value}`.trim();
      else if (value.startsWith('+')) roles[target] = `${roles[target] ?? ''} ${value.slice(1)}`.trim();
      else roles[target] = value;
    }
  }
  return { roles, zones };
}

const px = (n: number) => `${Math.round(n)}px`;

function logoHeight(ctx: AssemblyContext): number {
  if (ctx.documentType === 'flyer' || ctx.documentType === 'chart') return Math.max(28, Math.round(ctx.format.base * 2.6));
  if (ctx.format.family === 'card') return Math.max(22, Math.round(ctx.format.base * 2.2));
  return 36;
}

// ── Le mini-langage des composants ───────────────────────────────────────────────────────────

type Node = { t: 'text'; v: string } | { t: 'dir'; v: string } | { t: 'each'; path: string; body: Node[] } | { t: 'if'; cond: string; then: Node[]; else: Node[] };

function parse(src: string): Node[] {
  const tokens = src.split(/(\[\[[^\]]*\]\])/);
  let i = 0;
  const walk = (until: Array<'/each' | '/if' | 'else'>): { nodes: Node[]; end?: string } => {
    const nodes: Node[] = [];
    while (i < tokens.length) {
      const tok = tokens[i++];
      const m = tok.match(/^\[\[\s*([\s\S]*?)\s*\]\]$/);
      if (!m) {
        if (tok) nodes.push({ t: 'text', v: tok });
        continue;
      }
      const d = m[1];
      if (until.includes(d as '/each')) return { nodes, end: d };
      if (d.startsWith('each ')) {
        const body = walk(['/each']);
        nodes.push({ t: 'each', path: d.slice(5).trim(), body: body.nodes });
      } else if (d.startsWith('if ')) {
        const then = walk(['/if', 'else']);
        const other = then.end === 'else' ? walk(['/if']).nodes : [];
        nodes.push({ t: 'if', cond: d.slice(3).trim(), then: then.nodes, else: other });
      } else nodes.push({ t: 'dir', v: d });
    }
    return { nodes };
  };
  return walk([]).nodes;
}

interface Scope {
  blockId?: string;
  data?: Record<string, unknown>;
  /** La pile des éléments de liste : leur clé (`b2.items.1`), leur donnée, leur rang. */
  items: Array<{ key: string; data: unknown; index: number; length: number }>;
  surface?: Surface;
  /** La largeur de la zone, en part de la page : plafonne le nombre de colonnes (`[[cols …]]`). */
  width?: number;
}

interface Env {
  ctx: AssemblyContext;
  roles: Record<string, string>;
  skin: SkinNode;
  titleScale: number;
  gap: number;
}

function lookup(scope: Scope, path: string): { key: string; data: unknown } | null {
  if (path === '$' || path.startsWith('$.')) {
    const top = scope.items[scope.items.length - 1];
    if (!top) return null;
    const rest = path === '$' ? '' : path.slice(2);
    let data: unknown = top.data;
    for (const p of rest ? rest.split('.') : []) data = data && typeof data === 'object' ? (data as Record<string, unknown>)[p] : undefined;
    return { key: rest ? `${top.key}.${rest}` : top.key, data };
  }
  if (path === '.' || path.startsWith('.')) {
    if (!scope.blockId) return null;
    const rest = path === '.' ? '' : path.slice(1);
    let data: unknown = scope.data;
    for (const p of rest ? rest.split('.') : []) data = data && typeof data === 'object' ? (data as Record<string, unknown>)[p] : undefined;
    return { key: rest ? `${scope.blockId}.${rest}` : scope.blockId, data };
  }
  // Un nom nu : un texte à la racine (en-tête, champ de carte), ou une liste du bloc.
  if (scope.blockId && scope.data && path in scope.data) return lookup(scope, `.${path}`);
  return { key: path, data: undefined };
}

function present(env: Env, scope: Scope, cond: string): boolean {
  const negate = cond.startsWith('!');
  const c = negate ? cond.slice(1).trim() : cond;
  const top = scope.items[scope.items.length - 1];
  let value: boolean;
  if (c === 'first') value = Boolean(top && top.index === 0);
  else if (c === 'last') value = Boolean(top && top.index === top.length - 1);
  else if (c === 'odd') value = Boolean(top && top.index % 2 === 1);
  else if (c === 'even') value = Boolean(top && top.index % 2 === 0);
  else if (c.includes('=')) {
    // Une égalité sur une donnée brute (`.side=front`, `$.background=dark`).
    const [path, wanted] = c.split('=').map((x) => x.trim());
    value = String(rawOf(scope, path) ?? '') === wanted;
  } else {
    const found = lookup(scope, c);
    if (!found) value = false;
    else {
      const d = found.data;
      const raw = d !== undefined && d !== null && d !== '' && d !== false && !(Array.isArray(d) && d.length === 0);
      const keyed = env.ctx.map.entries.has(found.key) || [...env.ctx.map.entries.keys()].some((k) => k.startsWith(`${found.key}.`)) || env.ctx.map.primitives.has(found.key);
      value = raw || keyed;
    }
  }
  return negate ? !value : value;
}

function rawOf(scope: Scope, path: string): unknown {
  return lookup(scope, path)?.data;
}

function directive(env: Env, scope: Scope, d: string): string {
  const { ctx } = env;
  const colors = paletteOf(ctx.tokens, scope.surface);
  const resolveColors = (s: string) => s.replace(/\[\[(\w+)\]\]/g, (m, r: string) => ((COLOR_ROLES as readonly string[]).includes(r) ? colors[r as ColorRole] : m));
  if ((COLOR_ROLES as readonly string[]).includes(d)) return colors[d as ColorRole];
  if (d.startsWith('s.')) {
    const role = d.slice(2) as SkinRole;
    const base = env.roles[role] ?? '';
    const step = (env.skin.sizes as Record<string, string> | undefined)?.[role];
    let size = '';
    if (step && step in ctx.tokens.size) {
      const k = role === 'title' ? env.titleScale : 1;
      size = `text-[${px(ctx.tokens.size[step as keyof typeof ctx.tokens.size] * k)}]`;
    }
    return resolveColors(`${base} ${size}`.trim());
  }
  if (d.startsWith('t.')) {
    const step = d.slice(2);
    return step in ctx.tokens.size ? `text-[${px(ctx.tokens.size[step as keyof typeof ctx.tokens.size])}]` : '';
  }
  const top = scope.items[scope.items.length - 1];
  if (d === 'id') return scope.blockId ?? '';
  if (d === 'i') return String((top?.index ?? 0) + 1);
  if (d === 'i0') return String(top?.index ?? 0);
  if (d === 'i2') return String((top?.index ?? 0) + 1).padStart(2, '0');
  if (d === 'n') return String(top?.length ?? 0);
  const { pad, gap } = pageGeometry(ctx.format);
  if (d === 'gap') return `gap-[${px(env.gap)}]`;
  if (d === 'gap-sm') return `gap-[${px(Math.max(4, env.gap / 2))}]`;
  if (d === 'gap-lg') return `gap-[${px(env.gap * 1.75)}]`;
  if (d === 'pad') return `p-[${px(Math.max(gap, pad * 0.6))}]`;
  if (d === 'logo' || d === 'logo-sm' || d === 'logo-lg') {
    const k = d === 'logo-sm' ? 0.75 : d === 'logo-lg' ? (ctx.format.family === 'card' ? 2.8 : 1.9) : 1;
    const variant = scope.surface === 'brand' || scope.surface === 'deep' ? 'onDark' : 'primary';
    return `<idem-logo variant="${variant}" class="h-[${px(logoHeight(ctx) * k)}]"></idem-logo>`;
  }
  if (d.startsWith('at ')) {
    const where = d.slice(3).trim();
    const s = ctx.format.kind === 'flow' ? { top: 0, right: 0, bottom: 0, left: 0 } : ctx.format.safe;
    const h = logoHeight(ctx);
    const v = (band: number) => px(Math.max(8, (band - h) / 2));
    const cls = [where.includes('t') ? `top-[${v(s.top)}]` : `bottom-[${v(s.bottom)}]`, where.includes('l') ? `left-[${px(s.left)}]` : `right-[${px(s.right)}]`];
    return `absolute z-20 ${cls.join(' ')}`;
  }
  const [name, arg, extra] = d.split(/\s+/);
  if (name === 'count' || name === 'cols') {
    const data = rawOf(scope, arg?.startsWith('.') || arg?.startsWith('$') ? arg : `.${arg}`);
    const n = Array.isArray(data) ? data.length : 0;
    // Une zone étroite n'aligne pas quatre colonnes : le nombre suit sa largeur (un quart de page ≈ une colonne).
    const byWidth = Math.max(1, Math.floor((scope.width ?? 1) * 4.5));
    return String(name === 'cols' ? Math.max(1, Math.min(Number(extra) || 12, n || 1, byWidth)) : n);
  }
  if (name === 'size') {
    const step = String(rawOf(scope, arg) ?? 'base');
    return (SIZE_STEPS as readonly string[]).includes(step) ? `text-[${px(ctx.tokens.size[step as keyof typeof ctx.tokens.size])}]` : '';
  }
  if (name === 'weight') {
    const w = Number(rawOf(scope, arg));
    return Number.isFinite(w) && w >= 100 && w <= 900 ? `font-[${Math.round(w / 100) * 100}]` : '';
  }
  if (name === 'family') {
    const f = String(rawOf(scope, arg) ?? '').toLowerCase();
    return f && f === ctx.tokens.font.display.toLowerCase() ? 'font-display' : f && f === ctx.tokens.font.body.toLowerCase() ? 'font-body' : 'font-display';
  }
  if (name === 'ground') {
    const g = String(rawOf(scope, arg) ?? '');
    return g === 'dark' ? 'bg-deep text-on-deep' : g === 'primary' ? 'bg-brand-primary text-on-brand' : g === 'accent' ? 'bg-brand-accent text-on-accent' : g === 'neutral' ? 'bg-brand-soft text-ink' : 'bg-ground text-ink border-[1px] border-rule';
  }
  if (name === 'level') {
    const l = String(rawOf(scope, arg) ?? '');
    return l === 'high' ? 'opacity-100' : l === 'medium' ? 'opacity-60' : 'opacity-30';
  }
  if (name === 'focal') {
    const f = rawOf(scope, arg === '$' ? '$.focal' : '.focal') as { x?: number; y?: number } | undefined;
    return f && typeof f.x === 'number' && typeof f.y === 'number' ? `object-[${Math.round(f.x * 100)}%_${Math.round(f.y * 100)}%]` : 'object-center';
  }
  // Un nom inconnu ne s'imprime pas (et ne casse rien).
  return '';
}

/** Les clés relatives (`{{.x}}`, `{{$.x}}`) rendues absolues. */
function keys(text: string, scope: Scope): string {
  return text.replace(/\{\{\s*([.$][\w.:-]*|\$)\s*\}\}/g, (m, path: string) => {
    const found = lookup(scope, path);
    return found ? `{{${found.key}}}` : '';
  });
}

function render(env: Env, scope: Scope, nodes: Node[]): string {
  let out = '';
  for (const n of nodes) {
    if (n.t === 'text') out += keys(n.v, scope);
    else if (n.t === 'dir') out += directive(env, scope, n.v);
    else if (n.t === 'if') out += render(env, scope, present(env, scope, n.cond) ? n.then : n.else);
    else {
      const found = lookup(scope, n.path.startsWith('.') || n.path.startsWith('$') ? n.path : `.${n.path}`);
      const list = Array.isArray(found?.data) ? (found!.data as unknown[]) : [];
      list.forEach((data, index) => {
        let item = render(env, { ...scope, items: [...scope.items, { key: `${found!.key}.${index}`, data, index, length: list.length }] }, n.body);
        // Un élément d'une liste DU BLOC (premier niveau) est marqué : la mise en pages du business plan coupe une liste
        // entre deux éléments, en retirant du HTML ceux qui partent sur la page suivante.
        if (!scope.items.length && scope.blockId) item = item.replace(/^(\s*<[a-zA-Z][\w-]*)/, `$1 data-ge-item="${n.path.replace(/^[.$]+/, '')}:${index}"`);
        out += item;
      });
    }
  }
  return out;
}

// ── Le composant dessiné par le code (repli) ─────────────────────────────────────────────────

/**
 * Le rendu de REPLI d'une unité (aucun composant du catalogue ne convient) : chaque texte du bloc, dans l'ordre, en
 * rôles d'habillage — une liste d'objets devient une rangée de cartes. Rien n'est perdu, rien n'est inventé.
 */
export function genericComponent(unit: PageUnit): string {
  if (unit.kind === 'header') return '<div class="flex flex-col [[gap-sm]]">[[if kicker]]<p class="[[s.kicker]]">{{kicker}}</p>[[/if]]<h2 class="[[s.title]]">{{title}}</h2>[[if lede]]<p class="max-w-[60ch] [[s.lede]]">{{lede}}</p>[[/if]]</div>';
  const b = unit.block!;
  if (b.kind === 'chart') return '<div class="flex min-h-0 flex-1 flex-col [[gap-sm]]">[[if .title]]<p class="[[s.heading]]">{{.title}}</p>[[/if]]<idem-chart data-block="[[id]]" class="min-h-0 w-full flex-1 [[ink]]"></idem-chart>[[if .readingKey]]<p class="[[s.caption]]">{{.readingKey}}</p>[[/if]]</div>';
  if (b.kind === 'table') return '<div class="flex flex-col [[gap-sm]]"><idem-table data-block="[[id]]" class="w-full [[t.sm]] [&_th]:bg-brand-primary [&_th]:text-on-brand"></idem-table>[[if .caption]]<p class="[[s.caption]]">{{.caption}}</p>[[/if]]</div>';
  if (b.kind === 'mockupShowcase') return '<idem-gallery data-block="[[id]]" class="h-full w-full"></idem-gallery>';
  if (b.kind === 'figure') return '<figure class="flex h-full min-h-0 flex-col [[gap-sm]]"><img src="{{.url}}" alt="{{.alt}}" class="min-h-0 w-full flex-1 object-cover [[focal .]] [[s.figure]]">[[if .caption]]<figcaption class="[[s.caption]]">{{.caption}}</figcaption>[[/if]]</figure>';
  if (b.kind === 'prose') return '<div class="flex max-w-[68ch] flex-col [[gap-sm]]">[[each paragraphs]]<p class="[[s.body]]">{{$}}</p>[[/each]]</div>';
  if (b.kind === 'quote') return '<blockquote class="flex flex-col [[gap-sm]] border-l-[3px] [[ruleStrong]] pl-[16px]"><p class="[[s.quote]]">{{.text}}</p>[[if .attribution]]<p class="[[s.caption]]">{{.attribution}}</p>[[/if]]</blockquote>';
  if (b.kind === 'swatches') return '<div class="grid grid-cols-[[cols items 4]] [[gap]]">[[each items]]<div class="flex flex-col [[gap-sm]]"><div class="h-[72px] w-full border-[1px] border-rule bg-[{{$.hex}}]"></div><p class="[[s.heading]]">{{$.name}}</p><p class="[[s.caption]] tabular-nums">{{$.hex}}</p>[[if $.role]]<p class="[[s.caption]]">{{$.role}}</p>[[/if]]</div>[[/each]]</div>';
  if (b.kind === 'patternGrid') return '<div class="grid grid-cols-[[cols patterns 3]] [[gap]]">[[each patterns]]<div class="flex flex-col [[gap-sm]]"><idem-pattern-tile data-block="[[id]]" data-index="[[i0]]" class="h-[120px] w-full"></idem-pattern-tile><p class="[[s.label]]">{{$.name}}</p>[[if $.note]]<p class="[[s.caption]]">{{$.note}}</p>[[/if]]</div>[[/each]]</div>';
  if (b.kind === 'logoDisplay') return '<div class="grid h-full grid-cols-[[cols variants 3]] [[gap]]">[[each variants]]<div class="flex flex-col [[gap-sm]]"><div class="flex min-h-[140px] flex-1 items-center justify-center p-[24px] [[ground $.background]]"><img src="{{$.url}}" alt="" class="max-h-[120px] max-w-[80%] object-contain"></div><p class="[[s.label]]">{{$.label}}</p></div>[[/each]]</div>';
  if (b.kind === 'typeScale') return '<div class="flex flex-col [[gap-sm]]">[[each levels]]<div class="flex items-baseline [[gap]] border-b-[1px] [[rule]] pb-[8px]"><p class="w-[18%] shrink-0 [[s.label]]">{{$.label}}</p><p class="[[family $.family]] [[size $.step]] [[weight $.weight]] leading-[1.15] [[ink]]">{{$.sample}}</p></div>[[/each]]</div>';
  if (b.kind === 'typeSpecimen') return '<div class="grid grid-cols-[[cols specimens 2]] [[gap-lg]]">[[each specimens]]<div class="flex flex-col [[gap-sm]]"><p class="[[s.label]]">{{$.role}}</p><p class="[[family $.family]] [[t.5xl]] leading-[1] [[ink]]">{{$.family}}</p><p class="[[family $.family]] [[s.body]]">{{$.sample}}</p></div>[[/each]]</div>';
  if (b.kind === 'cover') return '<div class="flex h-full flex-col justify-between [[gap]]">[[logo-lg]]<div class="flex flex-col [[gap-sm]]">[[if .kicker]]<p class="[[s.kicker]]">{{.kicker}}</p>[[/if]]<h1 class="[[s.title]]">{{.brandName}}</h1>[[if .promise]]<p class="max-w-[40ch] [[s.lede]]">{{.promise}}</p>[[/if]]</div><div class="flex items-end justify-between border-t-[1px] [[rule]] pt-[12px]"><p class="[[s.label]]">{{.documentLabel}}</p><p class="[[s.caption]]">[[if .dateLabel]]{{.dateLabel}}[[/if]] [[if .detail]]{{.detail}}[[/if]]</p></div></div>';
  if (b.kind === 'copy') return '<div class="flex h-full flex-col justify-end [[gap]]">[[if .kicker]]<p class="[[s.kicker]]">{{.kicker}}</p>[[/if]]<h1 class="[[s.title]]">{{.headline}}</h1>[[if .subhead]]<p class="[[s.lede]]">{{.subhead}}</p>[[/if]][[if .body]]<p class="[[s.body]]">{{.body}}</p>[[/if]][[if .offer]]<p class="[[s.value]]">{{.offer}}</p>[[/if]][[each facts]]<p class="[[s.label]]">[[if $.label]]{{$.label}} [[/if]]{{$.text}}</p>[[/each]][[if .quote]]<p class="[[s.quote]]">{{.quote.text}}</p>[[if .quote.author]]<p class="[[s.caption]]">{{.quote.author}}</p>[[/if]][[/if]][[if .footnote]]<p class="[[s.caption]]">{{.footnote}}</p>[[/if]]</div>';
  if (b.kind === 'contact' && b.side === 'front') return '<div class="flex h-full flex-col items-start justify-center [[gap]]">[[logo-lg]][[if tagline]]<p data-field="tagline" class="[[s.lede]]">{{tagline}}</p>[[/if]]</div>';
  if (b.kind === 'contact') return '<div class="flex h-full flex-col justify-center [[gap-sm]]">[[if fullName]]<p data-field="fullName" class="[[s.heading]]">{{fullName}}</p>[[/if]][[if jobTitle]]<p data-field="jobTitle" class="[[s.label]]">{{jobTitle}}</p>[[/if]]<div class="mt-[8px] flex flex-col gap-[2px] [[s.caption]]">[[if phone]]<p data-field="phone">{{phone}}</p>[[/if]][[if mobile]]<p data-field="mobile">{{mobile}}</p>[[/if]][[if email]]<p data-field="email">{{email}}</p>[[/if]][[if website]]<p data-field="website">{{website}}</p>[[/if]][[if address]]<p data-field="address">{{address}}</p>[[/if]][[if linkedin]]<p data-field="linkedin">{{linkedin}}</p>[[/if]]</div></div>';
  return structuralComponent(b);
}

/** Les champs qui portent un chiffre, un titre ou un texte courant (rôle d'habillage de chacun). */
const VALUE_FIELDS = new Set(['value', 'date', 'offer']);
const HEAD_FIELDS = new Set(['title', 'label', 'name', 'headline', 'styleName', 'statement', 'platform']);

/**
 * Le rendu STRUCTUREL d'un bloc sans composant : ses listes d'objets en rangée de cartes (chiffre, titre, texte), ses
 * listes de textes en liste, ses textes simples en paragraphes — dans l'ordre du bloc.
 */
function structuralComponent(block: Block): string {
  const parts: string[] = [];
  const b = block as unknown as Record<string, unknown>;
  for (const [k, v] of Object.entries(b)) {
    if (['id', 'kind', 'origin', 'binding', 'side', 'focal'].includes(k)) continue;
    if (typeof v === 'string') {
      parts.push(`<p class="${HEAD_FIELDS.has(k) ? '[[s.heading]]' : VALUE_FIELDS.has(k) ? '[[s.value]]' : '[[s.body]]'}">{{.${k}}}</p>`);
    } else if (Array.isArray(v) && v.length) {
      if (typeof v[0] === 'string') parts.push(`<ul class="[[s.list]]">[[each ${k}]]<li class="flex [[gap-sm]] [[s.body]]"><span class="[[accent]]">—</span><span>{{$}}</span></li>[[/each]]</ul>`);
      else if (v[0] && typeof v[0] === 'object') {
        const fields = Object.keys(v[0] as object).filter((f) => !['icon', 'media', 'visual', 'emphasis', 'ink', 'ground', 'motif', 'tile', 'likelihood', 'impact', 'step', 'weight', 'demo'].includes(f));
        const cell = fields
          .map((f) => {
            const sample = (v[0] as Record<string, unknown>)[f];
            if (/^(url|logoUrl|imageUrl)$/.test(f)) return `[[if $.${f}]]<img src="{{$.${f}}}" alt="" class="max-h-[120px] w-auto self-start object-contain">[[/if]]`;
            if (Array.isArray(sample)) return `[[if $.${f}]]<ul class="[[s.list]]">[[each $.${f}]]<li class="[[s.caption]]">{{$}}</li>[[/each]]</ul>[[/if]]`;
            const role = VALUE_FIELDS.has(f) ? 's.value' : HEAD_FIELDS.has(f) ? 's.heading' : 's.body';
            return `[[if $.${f}]]<p class="[[${role}]]">{{$.${f}}}</p>[[/if]]`;
          })
          .join('');
        parts.push(`<div class="grid grid-cols-[[cols ${k} 4]] [[gap]]">[[each ${k}]]<div class="flex flex-col [[gap-sm]] [[if $.emphasis]][[s.cardEmph]][[else]][[s.card]][[/if]]">${cell}</div>[[/each]]</div>`);
      }
    }
  }
  return `<div class="flex flex-col [[gap]]">${parts.join('')}</div>`;
}

/** Les clés d'un bloc, dans l'ordre de la carte de contenu. */
function blockKeys(map: ContentMap, blockId: string): string[] {
  return [...map.entries.keys()].filter((k) => k.startsWith(`${blockId}.`));
}

/** Ce que le composant a oublié du bloc (ou de l'en-tête) : posé à la suite, discrètement, pour que rien ne se perde. */
function leftovers(html: string, unit: PageUnit, map: ContentMap): string {
  const used = new Set([...html.matchAll(/\{\{\s*([\w.:-]+)\s*\}\}/g)].map((m) => m[1]));
  if (unit.kind === 'header') return (['kicker', 'title', 'lede'] as const).filter((k) => map.entries.has(k) && !used.has(k)).map((k) => `<p class="[[s.${k === 'title' ? 'title' : k}]]">{{${k}}}</p>`).join('');
  const parts: string[] = [];
  if (map.primitives.has(unit.id) && !html.includes(`data-block="${unit.id}"`) && !html.includes('data-block="[[id]]"')) {
    const b = map.primitives.get(unit.id)!;
    parts.push(b.kind === 'chart' ? `<idem-chart data-block="${unit.id}" class="w-full [[ink]]"></idem-chart>` : b.kind === 'table' ? `<idem-table data-block="${unit.id}" class="w-full [[t.sm]]"></idem-table>` : `<idem-gallery data-block="${unit.id}" class="w-full"></idem-gallery>`);
  }
  const fieldKeys = unit.block?.kind === 'contact' ? [...map.entries.keys()].filter((k) => !k.includes('.') && !['title', 'kicker', 'lede'].includes(k)) : blockKeys(map, unit.id);
  for (const k of fieldKeys) {
    // Une consigne d'image (`visual`) n'est pas un texte ; l'adresse d'une source n'est pas une image.
    if (used.has(k) || /\.(visual|alt)$/.test(k)) continue;
    const e = map.entries.get(k)!;
    if (e.kind === 'url' && unit.kind === 'sources') continue;
    if (e.kind === 'url') parts.push(`<img src="{{${k}}}" alt="" class="max-h-[160px] w-auto object-contain">`);
    else if (e.kind === 'icon') continue;
    else parts.push(`<p class="[[s.caption]]"${unit.block?.kind === 'contact' ? ` data-field="${k}"` : ''}>{{${k}}}</p>`);
  }
  return parts.join('');
}

/**
 * LE CODE FAIT TENIR une zone : toutes ses cotes en pixels (tailles de texte, espacements, hauteurs, logo) sont
 * multipliées par `k`, la composition intacte. Contrairement à un `zoom` CSS, le texte se recompose à la largeur réelle
 * de la zone. Le texte ne descend jamais sous 8 px.
 */
export function scaleSizes(html: string, k: number): string {
  if (!(k > 0 && k < 1)) return html;
  return html.replace(/\sclass="([^"]*)"/g, (_m, cls: string) =>
    ` class="${cls.replace(/(^|\s)(-?[a-z][a-z-]*)-\[(\d+(?:\.\d+)?)px\]/g, (_x, sp: string, prop: string, n: string) => `${sp}${prop}-[${Math.max(prop === 'text' ? 8 : 0, Math.round(Number(n) * k * 10) / 10)}px]`)}"`
  );
}

/**
 * LA HIÉRARCHIE TENUE PAR LE CODE : un texte courant (citation, description, hypothèse…) n'est jamais composé comme le
 * titre. Sa taille est plafonnée à `max(1,6 × corps, 0,72 × titre)` (la règle mesurée par le contrôle d'affichage) —
 * quel que soit le composant choisi, même dans une page au titre réduit (marge, panneau).
 */
export function capPlainText(html: string, base: number, isText: (key: string) => boolean): string {
  const sizeOf = (cls: string) => Number(cls.match(/(?:^|\s)text-\[(\d+(?:\.\d+)?)px\]/)?.[1] ?? 0);
  const title = [...html.matchAll(/class="([^"]*)"[^>]*>\s*\{\{\s*title\s*\}\}/g)].map((m) => sizeOf(m[1])).reduce((a, b) => Math.max(a, b), 0);
  const cap = Math.floor(Math.max(base * 1.6, title * 0.72)) - 1;
  if (cap <= 0) return html;
  return html.replace(/class="([^"]*)"([^>]*>\s*\{\{\s*([\w.:-]+)\s*\}\})/g, (m, cls: string, rest: string, key: string) => {
    if (!isText(key)) return m;
    const size = sizeOf(cls);
    return size > cap ? `class="${cls.replace(/(^|\s)text-\[\d+(?:\.\d+)?px\]/, `$1text-[${cap}px]`)}"${rest}` : m;
  });
}

// ── La page de flux (business plan) ──────────────────────────────────────────────────────────

/** Les unités qu'on ne coupe jamais entre deux pages (une carte de chiffres, une citation, un graphique, une image). */
// Les chiffres-clés n'y sont pas : en rangée, le paginateur ne les coupe déjà pas ; empilés, c'est une liste qui se
// coupe proprement entre deux lignes (sinon, un trou en bas de page). Une persona est une carte : jamais coupée.
const ATOMIC_KINDS = new Set(['header', 'quote', 'assumption', 'chart', 'figure', 'persona', 'swot', 'funnel', 'contact', 'cover', 'copy', 'logoDisplay', 'swatches', 'logoStory', 'artDirectionStance', 'typeSpecimen', 'imageryShowcase']);

/**
 * LA PAGE DE FLUX : une SUITE de blocs de premier niveau, un par unité, dans l'ordre de lecture du squelette.
 *
 * Le paginateur du PDF découpe une page de flux entre ses blocs de premier niveau et ne coupe jamais une rangée de
 * plusieurs éléments côte à côte : des zones en colonnes, enveloppées dans une seule grille, partaient entières à la
 * page suivante (une page presque vide avant) ou y étaient réduites jusqu'à l'illisible (business plan AgriLink,
 * 10/11/2026). Ici, chaque unité est son propre bloc : le texte se coupe à la ligne, un tableau à la rangée, les
 * blocs compacts (chiffres, citation, graphique) restent entiers. Le squelette garde son caractère par la MESURE et le
 * RETRAIT de ses zones : une zone large garde sa largeur et sa position (texte en retrait d'une page « titre en
 * marge », colonne de lecture d'une page « colonne et notes ») ; une zone étroite passe en pleine largeur, à la suite.
 */
/**
 * L'espacement d'une page de flux, compatible avec le paginateur : dans une colonne flex, l'écart vertical
 * (`gap-[N]`) devient une marge entre enfants (`*:not-first:mt-[N]`). Le paginateur réapplique les écarts mesurés en marges
 * en ligne quand il coupe un conteneur : une marge est REMPLACÉE, un `gap` CSS s'y AJOUTAIT (écart compté deux fois,
 * page qui déborde, bloc entier repoussé sur une page insérée — un trou de 60 %).
 */
export function flowSpacing(html: string): string {
  return html.replace(/\sclass="([^"]*)"/g, (m, cls: string) => {
    const list = cls.split(/\s+/).filter(Boolean);
    if (!list.includes('flex-col')) return m;
    const out = list.flatMap((c) => {
      const g = c.match(/^gap(?:-y)?-\[([^\]]+)\]$/);
      // `*:not-first:` (enfants directs sauf le premier) : aucun « > » dans la classe — le découpage des balises le
      // prendrait pour la fin de la balise.
      return g ? [`*:not-first:mt-[${g[1]}]`] : [c];
    });
    return ` class="${out.join(' ')}"`;
  });
}

function flowBlocks(zones: LayoutZone[], assigned: Map<string, PageUnit[]>, cols: number, env: Env, unitHtml: (u: PageUnit, s: Surface | undefined, w: number, alone: boolean) => string, zoneExtra: Record<string, string>): string {
  const ordered = [...zones].sort((a, b) => a.row - b.row || a.col - b.col);
  const blocks: string[] = [];
  void cols;
  for (const z of ordered) {
    const list = assigned.get(z.id) ?? [];
    for (const u of list) {
      const header = u.kind === 'header';
      // TOUJOURS la pleine largeur (demande du 10/11/2026) : sur une page A4 qui se lit de haut en bas, une colonne
      // étroite ou décalée ne laissait que du vide à côté d'elle. Le gabarit garde son caractère par l'en-tête, la
      // typographie, la couleur et le traitement des blocs.
      const measure = 'w-full';
      const surface = z.surface && z.surface !== 'none' ? `${SURFACE_BG[z.surface]} p-[${px(env.gap * (z.inset ?? 1))}]` : '';
      // Une image de flux a une hauteur EXPLICITE (un tiers de page au plus) : sa hauteur ne dépend plus du contexte
      // (« h-full », « flex-1 »), elle est la même à la mesure et dans la page construite par le paginateur — sinon
      // la page débordait et le texte suivant partait sur une page insérée.
      const mediaH = Math.round(Math.min(380, env.ctx.format.height * 0.3));
      const media = u.category === 'media' && u.kind === 'figure' ? `h-[${mediaH}px] overflow-hidden *:h-full [&_figure]:h-full [&_figure]:min-h-0 [&_img]:h-full [&_img]:min-h-0 [&_img]:object-cover` : u.category === 'media' ? '[&_img]:max-h-[380px] [&_img]:object-contain' : '';
      const keep = ATOMIC_KINDS.has(u.kind) ? ' data-keep-together' : '';
      // L'espace AU-DESSUS est intérieur au bloc (padding), jamais une marge : le paginateur mesure la hauteur des
      // blocs et réapplique lui-même les écarts ; une marge externe, comptée deux fois quand une section reprend sur la
      // page entamée de la précédente, faisait déborder la page prévue (un trou de 60 % à la page suivante).
      const space = blocks.length ? `pt-[${px(env.gap * (header ? 1.6 : 1.2))}]` : '';
      blocks.push(`<section data-ge-piece="${u.id}" data-ge-kind="${u.kind}" data-ge-zone="${z.id}"${keep} class="${[measure, space, surface, media, zoneExtra[z.id] ?? ''].filter(Boolean).join(' ')}">${flowSpacing(unitHtml(u, z.surface, 1, true))}</section>`);
    }
  }
  // Un dernier bloc court (citation, hypothèse) ne part jamais seul sur une page : il reste avec celui qui le précède.
  const last = ordered.flatMap((z) => assigned.get(z.id) ?? []).pop();
  if (last && SHORT_TAIL.has(last.kind) && blocks.length >= 2) blocks[blocks.length - 2] = blocks[blocks.length - 2].replace(/^<section /, '<section data-keep-with-next ');
  return blocks.join('');
}

/** Les blocs courts qu'on ne laisse pas seuls en fin de section. */
const SHORT_TAIL = new Set(['quote', 'assumption', 'sources']);

// ── La page ──────────────────────────────────────────────────────────────────────────────────

export interface Assembled {
  /** Le HTML de la page, clés et primitives en place (le « code » gardé et rejouable). */
  html: string;
  /** Les unités de chaque zone. */
  zones: Record<string, string[]>;
  /** Les unités dessinées par le code faute de composant. */
  generic: string[];
}

export function assemblePage(ctx: AssemblyContext, choice: AssemblyChoice, units: PageUnit[] = pageUnits(ctx.section), zoom: Map<string, number> = new Map()): Assembled | { error: string } {
  const { layout, skin, config } = choice;
  // Une toile sans contenu à poser (avatar, face de marque) : la marque seule, au centre.
  if (!units.length) {
    const env0: Env = { ctx, roles: { ...skin.classes } as Record<string, string>, skin, titleScale: 1, gap: pageGeometry(ctx.format).gap };
    const mark = render(env0, { items: [] }, parse('<div class="flex h-full w-full items-center justify-center p-[12%]"><div class="scale-[1.6]">[[logo-lg]]</div></div>'));
    return { html: dedupeClasses(mark), zones: {}, generic: [] };
  }
  const zones = placedZones(layout, config);
  const assigned = assignUnits(layout, units, zones);
  if (assigned.error) return { error: assigned.error };
  const allVars = [...(skin.vars ?? []), ...[...choice.components.values()].flatMap((c) => c?.vars ?? [])];
  const vars = resolveVars(allVars, config.vars ?? {});
  const { roles, zones: zoneExtra } = skinClasses(skin, vars);
  for (const r of SKIN_ROLES) roles[r] = roles[r] ?? '';
  const { pad, gap: baseGap } = pageGeometry(ctx.format);
  const param = (name: string, lo: number, hi: number, d: number) => {
    const v = config.params?.[name];
    return typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d;
  };
  const env: Env = { ctx, roles, skin, titleScale: param('titleScale', 0.8, 1.3, 1), gap: Math.round(baseGap * param('gapScale', 0.6, 1.6, 1)) };
  const generic: string[] = [];
  const unitHtml = (u: PageUnit, surface: Surface | undefined, width: number, alone: boolean): string => {
    const comp = choice.components.get(u.id);
    let src = comp?.html?.trim() ? comp.html : '';
    if (!src) {
      src = genericComponent(u);
      generic.push(u.id);
    }
    const scope: Scope = { blockId: u.block?.id, data: u.block as unknown as Record<string, unknown>, items: [], surface, width };
    const body = render(env, scope, parse(src));
    const rest = render(env, scope, parse(leftovers(body, u, ctx.map)));
    // Seule dans sa zone, l'unité la remplit ; à plusieurs, les graphiques et images prennent la place restante — sans
    // jamais descendre sous une hauteur lisible (28 % de la toile) : écrasé à zéro, un graphique posait son titre et sa
    // légende sur le tableau voisin sans que la zone paraisse déborder. Ainsi, trop de contenu est un VRAI débordement,
    // que la mesure voit (zone réduite, ou composition écartée).
    // Un tableau, un nuancier, une grille de motifs ont la hauteur de leur contenu : partagés, ils ne rétrécissent pas.
    const natural = !alone && CONTENT_HEIGHT_KINDS.has(u.kind);
    const floor = !alone && !natural && FILL_KINDS.has(u.kind) && ctx.format.kind === 'fixed' ? ` min-h-[${Math.round(ctx.format.height * 0.28)}px]` : '';
    const fill = natural ? 'shrink-0' : alone || FILL_KINDS.has(u.kind) ? `min-h-0 flex-1${floor}` : 'shrink-0';
    return `<div data-ge-unit="${u.id}" class="flex min-w-0 flex-col ${fill}">${body}${rest}</div>`;
  };
  const cols = layout.grid.columns;
  const rows = layout.grid.rows;
  const flow = ctx.format.kind === 'flow';
  const zoneHtml = (z: LayoutZone): string => {
    const list = assigned.zones.get(z.id) ?? [];
    if (!list.length && z.optional && !z.keep) return '';
    const place = flow ? `col-start-${z.col} col-span-${z.span}` : `col-start-${z.col} col-span-${z.span} row-start-${z.row} row-span-${z.rows}`;
    const align = z.align === 'center' ? 'justify-center-safe' : z.align === 'end' ? 'justify-end-safe' : 'justify-start';
    const bg = SURFACE_BG[z.surface ?? 'none'];
    const inset = z.inset || (z.surface && z.surface !== 'none' && !z.bleed) ? `p-[${px(env.gap * (z.inset ?? 1))}]` : '';
    const s = ctx.format.safe;
    const bleed = z.bleed && !flow ? [z.col === 1 ? `-ml-[${px(s.left)}]` : '', z.col + z.span - 1 === cols ? `-mr-[${px(s.right)}]` : '', z.row === 1 ? `-mt-[${px(s.top)}]` : '', z.row + z.rows - 1 === rows ? `-mb-[${px(s.bottom)}]` : ''].filter(Boolean).join(' ') : '';
    const units = list.map((u) => unitHtml(u, z.surface, z.span / cols, list.length === 1)).join('');
    // Une zone qui déborde est ramenée à sa taille par le code (mesurée au rendu précédent).
    const k = zoom.get(z.id);
    const inner = k ? scaleSizes(units, k) : units;
    return `<div data-ge-zone="${z.id}" class="${[place, 'relative flex min-h-0 min-w-0 flex-col', align, `gap-[${px(env.gap)}]`, bg, inset, bleed, z.bleed ? 'overflow-hidden' : '', zoneExtra[z.id] ?? ''].filter(Boolean).join(' ')}">${inner}</div>`;
  };
  // Le décor de l'habillage : ni sur une couverture ni sur une face de carte (elles posent leur propre logo).
  const family = flow ? 'document' : ctx.format.family === 'chart' ? 'slide' : ctx.format.family;
  const chromeSrc = ctx.section.role === 'cover' || ctx.section.role === 'card-face' || ctx.section.blocks.some((b) => b.kind === 'cover') ? '' : skin.chrome?.[family as keyof NonNullable<SkinNode['chrome']>] ?? '';
  const chrome = chromeSrc ? render(env, { items: [] }, parse(chromeSrc)) : '';
  // Le fond de page ordinaire est déjà celui de la racine `.ge-page` : la grille ne le repeint pas (une boîte peinte
  // qui ne tient qu'un logo serait prise pour un cadre vide).
  const pageRaw = render(env, { items: [] }, parse(roles.page || ''));
  const page = pageRaw.split(/\s+/).filter((c) => c && c !== 'bg-ground').join(' ');
  const grid = `grid-cols-[repeat(${cols},minmax(0,1fr))]`;
  let html: string;
  if (flow) {
    html = `${chrome ? `<section data-ge-piece="chrome" data-ge-kind="chrome" data-keep-with-next class="w-full">${chrome}</section>` : ''}${flowBlocks(zones, assigned.zones, cols, env, unitHtml, zoneExtra)}`;
  } else {
    const s = ctx.format.safe;
    const padding = `pt-[${px(s.top)}] pr-[${px(s.right)}] pb-[${px(s.bottom)}] pl-[${px(s.left)}]`;
    void pad;
    html = `<div class="relative grid h-full w-full ${grid} grid-rows-[repeat(${rows},minmax(0,1fr))] gap-[${px(env.gap)}] ${padding} ${page}">${zones.map(zoneHtml).join('')}${chrome}</div>`;
  }
  return { html: dedupeClasses(html), zones: Object.fromEntries([...assigned.zones.entries()].map(([k, v]) => [k, v.map((u) => u.id)])), generic };
}

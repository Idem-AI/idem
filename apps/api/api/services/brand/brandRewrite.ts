/**
 * Propagation d'un changement d'identité dans un contenu déjà produit.
 *
 * Les supports d'un projet ne sont pas regénérés quand la marque change : ils
 * sont TRADUITS. Pour chaque jeton (cf. `brandTokens.ts`), l'ancienne valeur
 * devient la nouvelle — la couleur « primaire » d'hier devient la primaire
 * d'aujourd'hui, la rampe 600 d'hier la rampe 600 d'aujourd'hui, la
 * déclinaison « fond sombre » de l'ancien logo celle du nouveau. Aucun modèle
 * n'intervient : la traduction est une table, calculée par le code qui a
 * produit les pages.
 *
 * Ce qui est traduit, dans n'importe quel texte (HTML, SVG, CSS, JS, JSON) :
 *
 *   · les couleurs, sous toutes leurs écritures : `#abc`, `#aabbcc`,
 *     `#aabbccdd` (l'opacité est conservée), `%23aabbcc` (SVG encodé),
 *     `rgb(…)` / `rgba(…)`, en virgules ou en espaces — et la casse d'origine
 *     (une charte affiche « #1F4E5F » en capitales, elle les garde) ;
 *   · les familles de polices, entre guillemets, dans les déclarations
 *     `font-family`, dans les classes Tailwind `font-['Nom_Police']` et dans
 *     les paramètres `family=` des feuilles Google Fonts ;
 *   · les liens de polices d'un document HTML, reconstruits d'un bloc ;
 *   · les logos : URLs, SVG en ligne et leurs `data:` URI.
 *
 * Puis une garantie : un texte lisible AVANT la traduction le reste APRÈS
 * (`repairContrast`). Une nouvelle couleur claire posée sous une encre blanche
 * ne produit pas une page illisible — l'encre est reprise, jamais la couleur.
 */

import { BrandIdentityModel } from '../../models/brand-identity.model';
import { brandFontLinks, normalizeFontFamily } from '../../utils/google-fonts.util';
import { contrastRatio, ensureContrast } from '../design/color';
import {
  BrandTokens,
  computeBrandTokens,
  LOGO_SLOTS,
  normalizeHex,
  resolveLogoSlot,
} from './brandTokens';

export interface BrandRewriteMap {
  /** `#rrggbb` → `#rrggbb`, minuscules. */
  colors: Map<string, string>;
  /** Famille → famille. */
  families: Map<string, string>;
  /** Chaînes exactes : URLs de logo, SVG en ligne, feuilles de polices. */
  literals: Array<[from: string, to: string]>;
  /** Liens `<link>` de polices à reconstruire dans un document HTML. */
  fontLinks?: { oldHrefs: string[]; oldFamilies: string[]; html: string };
  before: BrandTokens;
  after: BrandTokens;
}

export interface RewriteStats {
  colors: number;
  fonts: number;
  logos: number;
  contrastFixes: number;
}

export const emptyStats = (): RewriteStats => ({ colors: 0, fonts: 0, logos: 0, contrastFixes: 0 });

export function addStats(into: RewriteStats, from: RewriteStats): RewriteStats {
  into.colors += from.colors;
  into.fonts += from.fonts;
  into.logos += from.logos;
  into.contrastFixes += from.contrastFixes;
  return into;
}

/**
 * Blanc et noir purs ne sont pas des couleurs de MARQUE : ce sont les encres
 * de secours du design system et les couleurs par défaut de tout HTML. Les
 * traduire repeindrait chaque texte noir d'une page dès que l'encre de la
 * marque change. `repairContrast` garantit la lisibilité à leur place.
 */
const GENERIC_COLORS = new Set(['#ffffff', '#000000']);

function isSameFamily(a: string, b: string): boolean {
  return normalizeFontFamily(a).toLowerCase() === normalizeFontFamily(b).toLowerCase();
}

function toDataUri(svg: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

/**
 * Formes sous lesquelles un logo peut avoir été posé dans une page : la valeur
 * brute (URL ou SVG) et, pour un SVG en ligne, son `data:` URI — c'est ce que
 * `toImgSrc` produit pour une balise `<img>`.
 */
function logoForms(value: string): string[] {
  if (!value) return [];
  if (value.includes('<svg')) return [value, toDataUri(value)];
  return [value];
}

function pushLiteral(literals: Array<[string, string]>, from: string, to: string): void {
  if (!from || !to || from === to) return;
  if (literals.some(([existing]) => existing === from)) return;
  literals.push([from, to]);
  // Une URL signée porte des `&` : dans un attribut HTML elle est écrite `&amp;`.
  if (from.includes('&') && !from.includes('<')) {
    const escapedFrom = from.replace(/&/g, '&amp;');
    if (!literals.some(([existing]) => existing === escapedFrom)) {
      literals.push([escapedFrom, to.replace(/&/g, '&amp;')]);
    }
  }
}

export interface RewriteMapExtras {
  /**
   * Couleurs supplémentaires, nommées, calculées par un autre système (la
   * forge du site). Elles passent APRÈS les jetons du document.
   */
  colors?: { before: Array<[string, string]>; after: Array<[string, string]> };
  literals?: Array<[string, string]>;
}

export function buildBrandRewriteMap(
  beforeBranding: Partial<BrandIdentityModel> | null | undefined,
  afterBranding: Partial<BrandIdentityModel> | null | undefined,
  extras: RewriteMapExtras = {}
): BrandRewriteMap {
  const before = computeBrandTokens(beforeBranding);
  const after = computeBrandTokens(afterBranding);

  // ── Couleurs ─────────────────────────────────────────────────────────
  //
  // Parcours dans l'ordre de PRIORITÉ, en retenant aussi les identités : si la
  // primaire ne change pas mais qu'une teinte de rampe moins prioritaire
  // tombait sur la même valeur, la primaire l'emporte — la valeur reste.
  const decided = new Map<string, string>();
  const register = (beforeList: Array<[string, string]>, afterList: Array<[string, string]>) => {
    const next = new Map(afterList.map(([name, hex]) => [name, normalizeHex(hex)]));
    for (const [name, raw] of beforeList) {
      const from = normalizeHex(raw);
      const to = next.get(name);
      if (!from || !to || decided.has(from)) continue;
      decided.set(from, GENERIC_COLORS.has(from) ? from : to);
    }
  };
  register(before.colors, after.colors);
  if (extras.colors) register(extras.colors.before, extras.colors.after);

  const colors = new Map([...decided].filter(([from, to]) => from !== to));

  // ── Polices ──────────────────────────────────────────────────────────
  const families = new Map<string, string>();
  const pairs: Array<[string, string]> = [
    [before.fonts.display, after.fonts.display],
    [before.fonts.body, after.fonts.body],
  ];
  for (const [from, to] of pairs) {
    if (!from || !to) continue;
    const key = normalizeFontFamily(from);
    if (!key || [...families.keys()].some((known) => isSameFamily(known, key))) continue;
    families.set(key, normalizeFontFamily(to));
  }
  for (const [from, to] of [...families]) if (isSameFamily(from, to)) families.delete(from);

  const literals: Array<[string, string]> = [];

  // Feuilles de polices hébergées (Fontshare, Fontsource, import) : l'ancienne
  // feuille devient la nouvelle feuille du même rôle.
  const oldSheets = [before.fonts.displayCss, before.fonts.bodyCss, before.fonts.sheetUrl];
  const newSheets = [after.fonts.displayCss, after.fonts.bodyCss, after.fonts.sheetUrl];
  oldSheets.forEach((from, index) => {
    const to = newSheets[index];
    if (from && to) pushLiteral(literals, from, to);
  });

  // ── Logos ────────────────────────────────────────────────────────────
  for (const slot of LOGO_SLOTS) {
    const from = resolveLogoSlot(beforeBranding?.logo, slot);
    const to = resolveLogoSlot(afterBranding?.logo, slot);
    if (!from || !to || from === to) continue;
    const fromForms = logoForms(from);
    const toForms = logoForms(to);
    fromForms.forEach((form, index) => {
      // Un SVG en ligne est remplacé par la même FORME : du SVG par du SVG,
      // un data URI par un data URI (ou par l'URL si le nouveau est hébergé).
      pushLiteral(literals, form, toForms[Math.min(index, toForms.length - 1)]);
    });
  }

  for (const [from, to] of extras.literals ?? []) pushLiteral(literals, from, to);

  // Les plus longues d'abord : une URL de déclinaison ne doit pas être entamée
  // par une URL plus courte qui en serait le préfixe.
  literals.sort((a, b) => b[0].length - a[0].length);

  // ── Liens de polices des documents HTML ─────────────────────────────
  const fontsChanged =
    families.size > 0 || oldSheets.some((sheet, index) => (sheet || '') !== (newSheets[index] || ''));
  const fontLinks = fontsChanged
    ? {
        oldHrefs: oldSheets.filter((sheet): sheet is string => !!sheet),
        oldFamilies: [before.fonts.display, before.fonts.body].filter(Boolean),
        html: brandFontLinks(afterBranding?.typography ?? null),
      }
    : undefined;

  return { colors, families, literals, fontLinks, before, after };
}

export function isEmptyRewrite(map: BrandRewriteMap): boolean {
  return map.colors.size === 0 && map.families.size === 0 && map.literals.length === 0 && !map.fontLinks;
}

// ─── Couleurs ───────────────────────────────────────────────────────────────

const HEX_PATTERN = /(#|%23)([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![0-9a-zA-Z_-])/g;
const RGB_PATTERN =
  /\brgba?\(\s*(\d{1,3})\s*[,\s]\s*(\d{1,3})\s*[,\s]\s*(\d{1,3})\s*((?:[,/]\s*[\d.]+%?\s*)?)\)/gi;

function expandShortHex(hex: string): string {
  return hex.length <= 4 ? hex.split('').map((c) => c + c).join('') : hex;
}

function hexToChannels(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

function rewriteColors(input: string, colors: Map<string, string>, stats: RewriteStats): string {
  if (colors.size === 0) return input;

  let output = input.replace(HEX_PATTERN, (match, prefix: string, digits: string) => {
    const expanded = expandShortHex(digits);
    const base = `#${expanded.slice(0, 6).toLowerCase()}`;
    const next = colors.get(base);
    if (!next) return match;
    stats.colors++;
    // L'opacité d'origine est conservée (`#rrggbbaa`, `#rgba`).
    const alpha = expanded.length === 8 ? expanded.slice(6) : '';
    const body = `${next.slice(1)}${alpha}`;
    const upper = digits === digits.toUpperCase() && /[A-F]/.test(digits);
    return `${prefix}${upper ? body.toUpperCase() : body}`;
  });

  output = output.replace(RGB_PATTERN, (match, r: string, g: string, b: string, alpha: string) => {
    const channels = [r, g, b].map(Number);
    if (channels.some((value) => value > 255)) return match;
    const hex = `#${channels.map((value) => value.toString(16).padStart(2, '0')).join('')}`;
    const next = colors.get(hex);
    if (!next) return match;
    stats.colors++;
    const [nr, ng, nb] = hexToChannels(next);
    const usesSpaces = !match.includes(',');
    const fn = match.slice(0, match.indexOf('('));
    return usesSpaces
      ? `${fn}(${nr} ${ng} ${nb}${alpha ? ` ${alpha.trim()}` : ''})`
      : `${fn}(${nr}, ${ng}, ${nb}${alpha ? `, ${alpha.replace(/^[,/]\s*/, '').trim()}` : ''})`;
  });

  return output;
}

// ─── Polices ────────────────────────────────────────────────────────────────

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function rewriteFamilies(input: string, families: Map<string, string>, stats: RewriteStats): string {
  if (families.size === 0) return input;
  let output = input;

  const entries = [...families].sort((a, b) => b[0].length - a[0].length);
  const lookup = (name: string) =>
    entries.find(([from]) => from.toLowerCase() === name.toLowerCase())?.[1];

  // 1. Entre guillemets — CSS, JS, JSON, attributs échappés.
  const alternatives = entries.map(([from]) => escapeRegExp(from)).join('|');
  const quoted = new RegExp(`(['"]|&quot;|&#39;)(${alternatives})\\1`, 'gi');
  output = output.replace(quoted, (match, quote: string, name: string) => {
    const next = lookup(name);
    if (!next) return match;
    stats.fonts++;
    return `${quote}${next}${quote}`;
  });

  // 2. Classes Tailwind arbitraires : font-['Space_Grotesk'].
  const underscored = entries.map(([from]) => escapeRegExp(from.replace(/ /g, '_'))).join('|');
  const tailwind = new RegExp(`(font-\\[['"]?)(${underscored})(['"]?\\])`, 'gi');
  output = output.replace(tailwind, (match, open: string, name: string, close: string) => {
    const next = lookup(name.replace(/_/g, ' '));
    if (!next) return match;
    stats.fonts++;
    return `${open}${next.replace(/ /g, '_')}${close}`;
  });

  // 3. Noms nus dans une déclaration `font-family: Nom, sans-serif`.
  output = output.replace(/(font-family\s*:\s*)([^;"'}<>]+)/gi, (match, head: string, list: string) => {
    let changed = false;
    const next = list
      .split(',')
      .map((part) => {
        const name = part.trim();
        const replacement = lookup(name);
        if (!replacement) return part;
        changed = true;
        return part.replace(name, /\s/.test(replacement) ? `'${replacement}'` : replacement);
      })
      .join(',');
    if (!changed) return match;
    stats.fonts++;
    return `${head}${next}`;
  });

  // 4. Paramètre `family=` des feuilles Google Fonts (`+` ou `%20`). En UNE
  // passe, comme les autres : un échange titre ↔ texte ne doit pas s'annuler.
  const encodedAlternatives = entries
    .map(([from]) => from.split(' ').map(escapeRegExp).join('(?:\\+|%20)'))
    .join('|');
  const param = new RegExp(`(family=)(${encodedAlternatives})(?=[:&"'\\s)]|$)`, 'gi');
  output = output.replace(param, (match, head: string, name: string) => {
    const next = lookup(name.replace(/\+|%20/g, ' '));
    if (!next) return match;
    stats.fonts++;
    return `${head}${encodeURIComponent(next).replace(/%20/g, '+')}`;
  });

  return output;
}

/**
 * Reconstruit les `<link>` de polices d'un document HTML.
 *
 * Remplacer un nom dans une URL Google ne suffit pas quand la source change :
 * une police importée par l'utilisateur ou venue de Fontshare n'existe pas
 * chez Google, et une feuille css2 qui la demande échoue ENTIÈREMENT. Les
 * liens de l'ancienne marque sont donc retirés et ceux de la nouvelle posés à
 * la place du premier, exactement comme le rendu les aurait écrits.
 */
function rewriteFontLinks(input: string, map: BrandRewriteMap, stats: RewriteStats): string {
  const plan = map.fontLinks;
  if (!plan || !input.includes('<link')) return input;

  const oldFamilies = plan.oldFamilies.map((family) =>
    new RegExp(`family=${family.split(' ').map(escapeRegExp).join('(?:\\+|%20)')}(?=[:&"'\\s]|$)`, 'i')
  );

  let placed = false;
  return input.replace(/<link\b[^>]*>/gi, (tag) => {
    const href = (tag.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1] ?? '').replace(/&amp;/g, '&');
    const isOldSheet = plan.oldHrefs.includes(href);
    const isOldGoogle =
      /fonts\.googleapis\.com\/css/i.test(href) && oldFamilies.some((pattern) => pattern.test(href));
    if (!isOldSheet && !isOldGoogle) return tag;
    stats.fonts++;
    if (placed) return '';
    placed = true;
    return plan.html;
  });
}

function rewriteLiterals(input: string, literals: Array<[string, string]>, stats: RewriteStats): string {
  let output = input;
  for (const [from, to] of literals) {
    if (!output.includes(from)) continue;
    const parts = output.split(from);
    stats.logos += parts.length - 1;
    output = parts.join(to);
  }
  return output;
}

// ─── Contraste ──────────────────────────────────────────────────────────────

interface Token {
  kind: 'open' | 'close' | 'void' | 'text' | 'raw';
  raw: string;
  tag?: string;
}

const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr',
]);

function tokenize(html: string): Token[] {
  const tokens: Token[] = [];
  const pattern = /<!--[\s\S]*?-->|<(script|style)\b[\s\S]*?<\/\1\s*>|<\/?([a-zA-Z][\w:-]*)\b[^>]*>/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    if (match.index > cursor) tokens.push({ kind: 'text', raw: html.slice(cursor, match.index) });
    const raw = match[0];
    if (raw.startsWith('<!--') || match[1]) {
      tokens.push({ kind: 'raw', raw });
    } else {
      const tag = match[2].toLowerCase();
      const kind = raw.startsWith('</')
        ? 'close'
        : VOID_TAGS.has(tag) || raw.endsWith('/>')
          ? 'void'
          : 'open';
      tokens.push({ kind, raw, tag });
    }
    cursor = match.index + raw.length;
  }
  if (cursor < html.length) tokens.push({ kind: 'text', raw: html.slice(cursor) });
  return tokens;
}

function styleOf(tagRaw: string): string {
  return tagRaw.match(/\bstyle\s*=\s*(["'])([\s\S]*?)\1/i)?.[2] ?? '';
}

function declaredColor(style: string, property: 'color' | 'background'): string {
  const pattern =
    property === 'color'
      ? /(?:^|;)\s*color\s*:\s*([^;]+)/i
      : /(?:^|;)\s*background(?:-color)?\s*:\s*([^;]+)/i;
  const value = style.match(pattern)?.[1] ?? '';
  const hex = value.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/)?.[0];
  return hex ? normalizeHex(hex) : '';
}

interface Frame {
  index: number;
  tag: string;
  color: string;
  background: string;
}

function walk(tokens: Token[], visit: (textIndex: number, owner: Frame | undefined, color: string, bg: string) => void) {
  const stack: Frame[] = [];
  tokens.forEach((token, index) => {
    if (token.kind === 'open') {
      const style = styleOf(token.raw);
      const parent = stack[stack.length - 1];
      stack.push({
        index,
        tag: token.tag!,
        color: declaredColor(style, 'color') || parent?.color || '',
        background: declaredColor(style, 'background') || parent?.background || '',
      });
    } else if (token.kind === 'close') {
      const at = stack.map((frame) => frame.tag).lastIndexOf(token.tag!);
      if (at !== -1) stack.length = at;
    } else if (token.kind === 'text' && token.raw.trim() && !/^(&nbsp;|\s)+$/.test(token.raw)) {
      const owner = stack[stack.length - 1];
      visit(index, owner, owner?.color ?? '', owner?.background ?? '');
    }
  });
}

function setInlineColor(tagRaw: string, hex: string): string {
  const quoteMatch = tagRaw.match(/\bstyle\s*=\s*(["'])([\s\S]*?)\1/i);
  if (!quoteMatch) return tagRaw.replace(/^(<[a-zA-Z][\w:-]*)/, `$1 style="color:${hex}"`);
  const [whole, quote, style] = quoteMatch;
  const next = /(?:^|;)\s*color\s*:/i.test(style)
    ? style.replace(/((?:^|;)\s*color\s*:\s*)[^;]+/i, `$1${hex}`)
    : `${style.replace(/;?\s*$/, '')};color:${hex}`;
  return tagRaw.replace(whole, `style=${quote}${next}${quote}`);
}

/**
 * Garantit qu'un texte n'est pas MOINS lisible après la traduction qu'avant.
 *
 * `before` et `after` ont la même structure (seules des valeurs de couleur
 * diffèrent) : on les parcourt en parallèle, et pour chaque texte dont le
 * contraste est tombé sous son niveau d'origine — plafonné à 4,5:1 — l'encre
 * de l'élément qui le porte est reprise. La couleur de fond, elle, est la
 * marque : on n'y touche pas.
 */
export function repairContrast(before: string, after: string, stats: RewriteStats): string {
  if (!after.includes('<') || before === after) return after;
  const beforeTokens = tokenize(before);
  const afterTokens = tokenize(after);
  if (beforeTokens.length !== afterTokens.length) return after;

  const previous = new Map<number, number>();
  walk(beforeTokens, (index, _owner, color, bg) => {
    if (color && bg) previous.set(index, contrastRatio(color, bg));
  });

  const fixes = new Map<number, string>();
  walk(afterTokens, (index, owner, color, bg) => {
    const was = previous.get(index);
    if (!owner || !color || !bg || was === undefined) return;
    const target = Math.min(4.5, was);
    if (contrastRatio(color, bg) >= target - 0.05) return;
    // Une encre PURE (blanc ou noir) se remplace par l'extrême opposé : un gris
    // tout juste au seuil paraît terne là où le rendu aurait posé du noir.
    const opposite = color === '#ffffff' ? '#000000' : color === '#000000' ? '#ffffff' : '';
    const candidates = [
      ...(opposite ? [opposite] : []),
      ensureContrast(color, bg, target),
      '#ffffff',
      '#000000',
    ];
    const ink =
      candidates.find((hex) => contrastRatio(hex, bg) >= target) ??
      candidates.reduce((best, hex) => (contrastRatio(hex, bg) > contrastRatio(best, bg) ? hex : best));
    if (!fixes.has(owner.index)) fixes.set(owner.index, ink);
  });

  if (fixes.size === 0) return after;
  stats.contrastFixes += fixes.size;
  return afterTokens
    .map((token, index) => (fixes.has(index) ? setInlineColor(token.raw, fixes.get(index)!) : token.raw))
    .join('');
}

/**
 * Recalcule les mentions « contraste N:1 » des nuanciers (`data-contrast-of`).
 * Même règle que `renderSwatches` : encre blanche si elle passe 4,5:1, noire
 * sinon, et le ratio obtenu.
 */
function refreshContrastLabels(input: string): string {
  if (!input.includes('data-contrast-of')) return input;
  return input.replace(
    /(<[a-z]+\b[^>]*\bdata-contrast-of="(#[0-9a-fA-F]{6})"[^>]*>)([^<]*?)(\d+(?:[.,]\d+)?)(:1)/g,
    (match, open: string, hex: string, before: string, _ratio: string, tail: string) => {
      const ink = contrastRatio('#ffffff', hex) >= 4.5 ? '#ffffff' : '#000000';
      const ratio = Math.round(contrastRatio(ink, hex) * 10) / 10;
      return `${open}${before}${ratio}${tail}`;
    }
  );
}

// ─── Entrées publiques ──────────────────────────────────────────────────────

/** Traduit une chaîne. Rend la chaîne d'origine (même référence) si rien ne change. */
export function rewriteBrandString(input: string, map: BrandRewriteMap, stats: RewriteStats = emptyStats()): string {
  if (!input) return input;
  const recolored = rewriteColors(input, map.colors, stats);
  const readable =
    recolored === input ? recolored : refreshContrastLabels(repairContrast(input, recolored, stats));
  const linked = rewriteFontLinks(readable, map, stats);
  const retyped = rewriteFamilies(linked, map.families, stats);
  const output = rewriteLiterals(retyped, map.literals, stats);
  return output === input ? input : output;
}

/**
 * Traduit toutes les chaînes d'une valeur JSON (sections, visuels, cartes).
 *
 * Les clés d'identité et de date ne sont jamais touchées : un identifiant qui
 * ressemblerait à une couleur (`#cafe12`) doit rester l'identifiant qu'il est.
 */
const PROTECTED_KEYS = new Set(['id', '_id', 'createdAt', 'updatedAt', 'generatedAt', 'key', 'contentId', 'planId', 'flyerId']);

export function rewriteBrandDeep<T>(value: T, map: BrandRewriteMap, stats: RewriteStats = emptyStats()): T {
  const visit = (node: unknown): unknown => {
    if (typeof node === 'string') return rewriteBrandString(node, map, stats);
    if (Array.isArray(node)) {
      let changed = false;
      const next = node.map((item) => {
        const result = visit(item);
        if (result !== item) changed = true;
        return result;
      });
      return changed ? next : node;
    }
    if (node && typeof node === 'object' && !(node instanceof Date)) {
      let changed = false;
      const next: Record<string, unknown> = {};
      for (const [key, child] of Object.entries(node as Record<string, unknown>)) {
        const result = PROTECTED_KEYS.has(key) ? child : visit(child);
        if (result !== child) changed = true;
        next[key] = result;
      }
      return changed ? next : node;
    }
    return node;
  };
  return visit(value) as T;
}

/** Résumé d'une ligne de la table, pour les journaux. */
export function describeRewrite(map: BrandRewriteMap): string {
  return (
    `${map.colors.size} couleur(s), ${map.families.size} police(s), ${map.literals.length} ressource(s)` +
    (map.fontLinks ? ', liens de polices reconstruits' : '')
  );
}

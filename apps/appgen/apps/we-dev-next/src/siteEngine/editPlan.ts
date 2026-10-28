/**
 * LA MODIFICATION D'UN SITE DÉJÀ GÉNÉRÉ — les règles, sans modèle (zéro jeton).
 *
 * Une demande de retouche ne doit toucher QUE ce qui est demandé, au moindre coût :
 *
 *   1. la CIBLE est choisie par l'agent d'aiguillage, qui lit la carte du site (`siteMap.ts`) : sections, en-tête,
 *      pied de page, données (menu, coordonnées), apparence. Seul un texte cité qui n'existe que dans une
 *      section est aiguillé par le code ;
 *   2. ce que la demande AUTORISE (changer une couleur, une police, retirer du contenu, passer en sombre) est
 *      dit par ce même agent, qui a compris la demande — jamais déduit d'une liste de mots ;
 *   3. une retouche de section arrive en blocs RECHERCHER / REMPLACER : seuls les passages modifiés
 *      voyagent, et le reste du fichier ne peut pas changer ;
 *   4. des GARDE-FOUS refusent ce qui n'a pas été demandé : changer la police, les couleurs, le nom du
 *      composant, ou vider une section — le modèle recommence, prévenu, sinon rien n'est modifié.
 */

export const fold = (text: string) =>
  String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, ' ');

// ── Ce que la demande autorise ──────────────────────────────────────────────

/**
 * Ce que la demande autorise, tel que l'agent d'aiguillage l'a compris (« donne plus de peps au site » autorise les
 * couleurs ; « corrige la faute du titre » n'autorise rien de tout cela). Les garde-fous refusent le reste.
 */
export interface EditAllows {
  fonts: boolean;
  colors: boolean;
  /** Retirer une part notable du contenu d'une section. */
  removal: boolean;
  /** Passer le site en thème sombre. */
  dark: boolean;
}

export const NOTHING_ALLOWED: EditAllows = { fonts: false, colors: false, removal: false, dark: false };

// ── Les sections du site ────────────────────────────────────────────────────

export interface SiteFile {
  path: string;
  /** Nom du composant (Hero, Services…, SiteHeader, SiteFooter). */
  name: string;
  page?: string;
}

/** Les composants qu'une retouche peut viser : sections des pages, en-tête, pied de page. */
export function siteComponents(files: Record<string, string>): SiteFile[] {
  const out: SiteFile[] = [];
  for (const path of Object.keys(files)) {
    const section = path.match(/^src\/sections\/([^/]+)\/(\w+)\.tsx$/);
    if (section) out.push({ path, name: section[2], page: section[1] });
    else if (/^src\/components\/site\/(SiteHeader|SiteFooter)\.tsx$/.test(path)) out.push({ path, name: path.match(/(\w+)\.tsx$/)![1] });
  }
  return out;
}

/**
 * Les sections où se trouve, mot pour mot, un texte que la demande cite entre guillemets : un fait donné à l'agent
 * d'aiguillage (la carte ne montre que les premiers textes de chaque section), pas une décision. C'est l'agent qui
 * comprend la demande et choisit où la retouche se fait.
 */
export function quotedOwners(request: string, files: Record<string, string>): Array<{ quote: string; paths: string[] }> {
  const components = siteComponents(files);
  return Array.from(request.matchAll(/[«"“]\s*([^»"”]{4,120}?)\s*[»"”]/g))
    .map((m) => ({ quote: m[1], paths: components.filter((c) => fold(files[c.path]).includes(fold(m[1]))).map((c) => c.path) }))
    .filter((found) => found.paths.length);
}

// ── Le design system ────────────────────────────────────────────────────────

type Json = Record<string, any>;

const get = (obj: Json, path: string): unknown => path.split('.').reduce<any>((node, key) => (node == null ? undefined : node[key]), obj);

/** Les réglages qu'une retouche peut changer (ceux du compilateur), et ceux qu'il faut avoir demandés. */
export const THEME_PATHS = [
  'appearance.density',
  'appearance.colorMode',
  ...['background', 'foreground', 'primary', 'primaryForeground', 'secondary', 'secondaryForeground', 'muted', 'mutedForeground', 'accent', 'accentForeground', 'border', 'input', 'ring', 'card', 'cardForeground'].map((k) => `tokens.colors.${k}`),
  ...['headingFont', 'bodyFont', 'headingFontUrl', 'bodyFontUrl', 'headingWeight', 'bodyWeight', 'baseSize', 'scale', 'headingLineHeight', 'bodyLineHeight', 'headingLetterSpacing', 'headingCase', 'eyebrowCase'].map((k) => `tokens.typography.${k}`),
  ...['base', 'button', 'input', 'card', 'badge'].map((k) => `tokens.radius.${k}`),
  'tokens.borders.width',
  'tokens.elevation.style',
  ...['section', 'gutter', 'contentWidth'].map((k) => `tokens.spacing.${k}`),
  ...['variant', 'size', 'weight', 'case', 'shadow'].map((k) => `components.button.${k}`),
  'components.input.style',
  'components.card.variant',
  'components.card.elevation',
  'components.badge.variant',
  'components.badge.case',
  'motion.durationMs',
  'motion.staggerMs',
  'motion.easing',
  'motion.intensity',
];

/** Les changements de réglage admis pour cette demande ; chaque refus est dit (pour le modèle, au besoin). */
export function guardTheme(allows: EditAllows, set: Record<string, unknown>): { allowed: Record<string, unknown>; refused: string[] } {
  const allowed: Record<string, unknown> = {};
  const refused: string[] = [];
  for (const [path, value] of Object.entries(set)) {
    if (!THEME_PATHS.includes(path)) refused.push(`${path} : réglage inconnu`);
    else if (/typography\.(heading|body)Font/.test(path) && !allows.fonts) refused.push(`${path} : la police n'a pas été demandée`);
    else if (path.startsWith('tokens.colors.') && !allows.colors) refused.push(`${path} : les couleurs n'ont pas été demandées`);
    else if (path === 'appearance.colorMode' && value === 'dark' && !allows.dark) refused.push(`${path} : le thème sombre n'a pas été demandé`);
    else allowed[path] = value;
  }
  return { allowed, refused };
}

/** La configuration avec les réglages changés (copie). */
export function applyTheme(config: Json, set: Record<string, unknown>): Json {
  const next = JSON.parse(JSON.stringify(config)) as Json;
  for (const [path, value] of Object.entries(set)) {
    const keys = path.split('.');
    let node = next;
    for (const key of keys.slice(0, -1)) {
      if (!node[key] || typeof node[key] !== 'object') node[key] = {};
      node = node[key];
    }
    node[keys[keys.length - 1]] = value;
  }
  return next;
}

/** Ce qui a vraiment changé (pour le dire, et ne rien réécrire pour rien). */
export function themeChanges(before: Json, set: Record<string, unknown>): string[] {
  return Object.entries(set)
    .filter(([path, value]) => JSON.stringify(get(before, path)) !== JSON.stringify(value))
    .map(([path]) => path);
}

// ── Les retouches d'un fichier ──────────────────────────────────────────────

export interface Patch {
  search: string;
  replace: string;
}

/**
 * Les blocs d'une réponse :
 *   <<<<<<< SEARCH
 *   (passage exact du fichier)
 *   =======
 *   (son remplacement)
 *   >>>>>>> REPLACE
 */
export function parsePatches(text: string): Patch[] {
  const out: Patch[] = [];
  const re = /<{5,}\s*SEARCH[^\n]*\n([\s\S]*?)\n={5,}[^\n]*\n([\s\S]*?)\n?>{5,}\s*REPLACE/g;
  for (const m of String(text || '').matchAll(re)) out.push({ search: m[1], replace: m[2] });
  return out;
}

/** Le passage cherché, retrouvé tel quel, sinon aux espaces près en début et fin de ligne. */
function locate(code: string, search: string): { start: number; end: number } | null {
  if (!search.trim()) return null;
  const exact = code.indexOf(search);
  if (exact >= 0 && code.indexOf(search, exact + 1) < 0) return { start: exact, end: exact + search.length };
  const lines = code.split('\n');
  const wanted = search.split('\n').map((l) => l.trim());
  while (wanted.length && !wanted[0]) wanted.shift();
  while (wanted.length && !wanted[wanted.length - 1]) wanted.pop();
  if (!wanted.length) return null;
  const hits: number[] = [];
  for (let i = 0; i + wanted.length <= lines.length; i++) {
    if (wanted.every((w, k) => lines[i + k].trim() === w)) hits.push(i);
  }
  if (hits.length !== 1) return null;
  const startLine = hits[0];
  const start = lines.slice(0, startLine).reduce((n, l) => n + l.length + 1, 0);
  const end = start + lines.slice(startLine, startLine + wanted.length).join('\n').length;
  return { start, end };
}

/** Applique les blocs ; un bloc introuvable (ou ambigu) est compté, jamais deviné. */
export function applyPatches(code: string, patches: Patch[]): { code: string; applied: number; missed: string[] } {
  let out = code;
  let applied = 0;
  const missed: string[] = [];
  for (const p of patches) {
    const at = locate(out, p.search);
    if (!at) {
      missed.push(p.search.split('\n').find((l) => l.trim())?.trim().slice(0, 80) || '(vide)');
      continue;
    }
    // L'indentation de la première ligne trouvée est gardée quand le bloc a été retrouvé aux espaces près.
    out = out.slice(0, at.start) + p.replace + out.slice(at.end);
    applied++;
  }
  return { code: out, applied, missed };
}

// ── Les garde-fous ──────────────────────────────────────────────────────────

/** Les classes et valeurs de style d'un fichier (chaînes, gabarits). */
function styleTokens(code: string): string[] {
  const strings = Array.from(code.matchAll(/(["'`])((?:\\.|(?!\1)[^\\])*)\1/g)).map((m) => m[2]);
  return strings.flatMap((s) => s.split(/\s+/)).filter(Boolean);
}

const FONT_CLASS = /^(?:[\w-]+:)*font-(?!(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$)[\w[\]'",-]+$/;
const COLOR_CLASS = /^(?:[\w-]+:)*(?:(?:bg|from|via|to|fill|stroke|ring|outline|decoration|accent|caret|divide|placeholder|shadow)-(?!(none|cover|contain|center|top|bottom|left|right|fixed|local|scroll|repeat|no-repeat|clip|origin|gradient|blend|auto|sm|md|lg|xl|2xl|inner|offset|inset|\d|\[url))[\w[\]#()/.%,-]+|(?:text|border)-(?:primary|secondary|accent|muted|foreground|background|card|white|black|ink|brand|destructive|current|transparent|inherit|\[#|\[rgb|\[hsl|\[oklch|[a-z]+-\d{2,3})[\w[\]#()/.%,-]*)$/;
const HEX = /#[0-9a-fA-F]{3,8}\b/g;

const diff = (before: string[], after: string[]) => {
  const count = (xs: string[]) => xs.reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map<string, number>());
  const a = count(before);
  const b = count(after);
  const added = [...b].filter(([k, n]) => n > (a.get(k) ?? 0)).map(([k]) => k);
  const removed = [...a].filter(([k, n]) => n > (b.get(k) ?? 0)).map(([k]) => k);
  return { added, removed };
};

/**
 * Ce que la retouche a changé SANS que la demande le dise : la police, les couleurs, le nom du composant,
 * ou une section vidée. Chaque problème est une consigne pour le nouvel essai du modèle.
 */
export function guardEdit(before: string, after: string, allows: EditAllows): string[] {
  const problems: string[] = [];
  const tb = styleTokens(before);
  const ta = styleTokens(after);
  if (!allows.fonts) {
    const f = diff(tb.filter((x) => FONT_CLASS.test(x)), ta.filter((x) => FONT_CLASS.test(x)));
    // Une police INTRODUITE (remplacée) : retirer un élément retire aussi sa classe, ce n'est pas changer la police.
    if (f.added.length || (/fontFamily/.test(after) && !/fontFamily/.test(before)))
      problems.push(`La police n'a pas été demandée : garde les classes de police telles quelles (${[...f.removed, ...f.added].slice(0, 4).join(', ') || 'fontFamily'}).`);
  }
  if (!allows.colors) {
    const c = diff(tb.filter((x) => COLOR_CLASS.test(x)), ta.filter((x) => COLOR_CLASS.test(x)));
    const hex = diff(before.match(HEX) ?? [], after.match(HEX) ?? []);
    if (c.added.length || hex.added.length)
      problems.push(`Les couleurs n'ont pas été demandées : ne change aucune couleur (${[...c.removed, ...c.added, ...hex.added].slice(0, 4).join(', ')}).`);
  }
  const name = (code: string) => code.match(/export\s+default\s+function\s+(\w+)/)?.[1];
  if (name(before) && name(after) !== name(before)) problems.push(`Le composant doit garder son nom (export default function ${name(before)}).`);
  if (!allows.removal && after.trim().length < before.trim().length * 0.6)
    problems.push('Ta retouche retire une grande partie de la section, ce qui n’a pas été demandé : ne change que ce qui est demandé.');
  return problems;
}

/**
 * LA MODIFICATION D'UN SITE DÉJÀ GÉNÉRÉ — les règles, sans modèle (zéro jeton).
 *
 * Une demande de retouche ne doit toucher QUE ce qui est demandé, au moindre coût :
 *
 *   1. la CIBLE est choisie par l'agent d'aiguillage, qui lit la carte du site (`siteMap.ts`) : sections, en-tête,
 *      pied de page, données (menu, coordonnées), apparence. Seul un texte cité qui n'existe que dans une
 *      section est aiguillé par le code ;
 *   2. les retouches courantes du design system se font sans modèle (`quickTheme`) ;
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

export const asksFont = (request: string) => /\b(polices?|fonts?|typo|typographie|typeface|caracteres)\b/.test(fold(request));
export const asksColor = (request: string) =>
  /\b(couleurs?|colou?rs?|palette|teintes?|fond|background|rouge|bleu|vert|jaune|noir|blanc|orange|violet|rose|gris|dore|marron|beige|turquoise|red|blue|green|yellow|black|white|purple|pink|grey|gray|gold|brown)\b/.test(fold(request));
export const asksRemoval = (request: string) => /\b(supprim\w*|retir\w*|enlev\w*|remove\w*|delete\w*|cach\w*|masqu\w*|sans)\b/.test(fold(request));
export const asksNewSection = (request: string) =>
  /\b(ajout\w*|cre\w*|add|insert\w*|nouvelle?)\b.{0,30}\b(sections?|blocs?|rubriques?)\b/.test(fold(request)) && !/\bdans (la|le) (section|bloc)\b/.test(fold(request));
export const asksDark = (request: string) => /theme sombre|mode sombre|fond (noir|sombre)|dark (mode|theme|background)|site sombre/.test(fold(request));

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

export type EditRoute =
  | { scope: 'theme' }
  | { scope: 'files'; paths: string[] }
  | { scope: 'new-section'; page: string }
  | null;

/**
 * Le seul aiguillage fait par le code : un texte cité entre guillemets qui n'existe que dans une section (une
 * recherche exacte, pas une devinette). Tout le reste — « la navbar », « le haut de la page », « tu as dupliqué le
 * menu » — passe par l'agent d'aiguillage, qui lit la carte du site (`siteMap.ts`) : des listes de mots-clés
 * envoyaient « navbar » nulle part et faisaient demander à l'utilisateur de nommer la section.
 */
export function routeEdit(request: string, files: Record<string, string>): EditRoute {
  const components = siteComponents(files);
  const quoted = Array.from(request.matchAll(/[«"“]\s*([^»"”]{4,120}?)\s*[»"”]/g)).map((m) => fold(m[1]));
  for (const q of quoted) {
    const owners = components.filter((c) => fold(files[c.path]).includes(q));
    if (owners.length === 1) return { scope: 'files', paths: [owners[0].path] };
  }
  return null;
}

// ── Le design system ────────────────────────────────────────────────────────

type Json = Record<string, any>;

const get = (obj: Json, path: string): unknown => path.split('.').reduce<any>((node, key) => (node == null ? undefined : node[key]), obj);
const clamp = (v: number, min: number, max: number) => Math.round(Math.min(max, Math.max(min, v)) * 1000) / 1000;
const remOf = (v: unknown, fallback: number) => {
  const m = String(v ?? '').match(/^([\d.]+)\s*(rem|px)?$/);
  return m ? (m[2] === 'px' ? Number(m[1]) / 16 : Number(m[1])) : fallback;
};

/**
 * Les retouches courantes du design system, SANS modèle : titres plus petits / plus grands, texte plus
 * petit / plus grand, coins plus ou moins arrondis, site plus aéré / plus compact. `null` : pas reconnue.
 */
export function quickTheme(request: string, config: Json): { set: Record<string, unknown>; fr: string; en: string } | null {
  const t = fold(request);
  const smaller = /\b(petit\w*|reduir\w*|redui\w*|diminu\w*|moins (gros|grand)\w*|smaller|reduce|decrease|less big)\b/.test(t);
  const bigger = /\b(grand\w*|gros\w*|agrandi\w*|augment\w*|plus (gros|grand)\w*|bigger|larger|increase)\b/.test(t) && !smaller;
  const typo = config.tokens?.typography ?? {};

  if (/\b(titres?|headings?|titles?)\b/.test(t) && (smaller || bigger)) {
    const scale = Number(typo.scale ?? 1.2);
    const next = clamp(scale + (smaller ? -0.06 : 0.06), 1.05, 1.5);
    if (next === scale) return null;
    return { set: { 'tokens.typography.scale': next }, fr: smaller ? 'J’ai réduit la taille des titres' : 'J’ai agrandi les titres', en: smaller ? 'I made the headings smaller' : 'I made the headings bigger' };
  }
  if (/\b(textes?|ecriture|paragraphes?|body text|text size)\b/.test(t) && (smaller || bigger) && !/\btitres?\b/.test(t)) {
    const base = remOf(typo.baseSize, 1);
    const next = clamp(base + (smaller ? -0.0625 : 0.0625), 0.875, 1.25);
    if (next === base) return null;
    return { set: { 'tokens.typography.baseSize': `${next}rem` }, fr: smaller ? 'J’ai réduit la taille du texte' : 'J’ai agrandi le texte', en: smaller ? 'I made the text smaller' : 'I made the text bigger' };
  }
  if (/\b(arrondi\w*|coins?|rounded|radius)\b/.test(t)) {
    const square = /\b(carre\w*|droits?|square|sharp|moins arrondi\w*|sans arrondi)\b/.test(t);
    const base = remOf(config.tokens?.radius?.base, 0.5);
    const next = square ? Math.max(0, base / 2) : clamp(base * 1.6 + 0.125, 0.25, 1.5);
    return { set: { 'tokens.radius.base': square && next < 0.1 ? '0' : `${Math.round(next * 1000) / 1000}rem` }, fr: square ? 'J’ai rendu les coins plus droits' : 'J’ai arrondi davantage les coins', en: square ? 'I made the corners sharper' : 'I made the corners rounder' };
  }
  if (/\b(aere\w*|espace\w*|respir\w*|airy|spacious)\b/.test(t) && !/\bmoins\b/.test(t)) {
    return { set: { 'appearance.density': 'spacious' }, fr: 'J’ai aéré le site', en: 'I gave the site more breathing room' };
  }
  if (/\b(compact\w*|serre\w*|moins d espace|denser|tighter)\b/.test(t)) {
    return { set: { 'appearance.density': 'compact' }, fr: 'J’ai resserré le site', en: 'I tightened the site' };
  }
  return null;
}

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
export function guardTheme(request: string, set: Record<string, unknown>): { allowed: Record<string, unknown>; refused: string[] } {
  const allowed: Record<string, unknown> = {};
  const refused: string[] = [];
  for (const [path, value] of Object.entries(set)) {
    if (!THEME_PATHS.includes(path)) refused.push(`${path} : réglage inconnu`);
    else if (/typography\.(heading|body)Font/.test(path) && !asksFont(request)) refused.push(`${path} : la police n'a pas été demandée`);
    else if (path.startsWith('tokens.colors.') && !asksColor(request)) refused.push(`${path} : les couleurs n'ont pas été demandées`);
    else if (path === 'appearance.colorMode' && value === 'dark' && !asksDark(request)) refused.push(`${path} : le thème sombre n'a pas été demandé`);
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
export function guardEdit(before: string, after: string, request: string): string[] {
  const problems: string[] = [];
  const tb = styleTokens(before);
  const ta = styleTokens(after);
  if (!asksFont(request)) {
    const f = diff(tb.filter((x) => FONT_CLASS.test(x)), ta.filter((x) => FONT_CLASS.test(x)));
    // Une police INTRODUITE (remplacée) : retirer un élément retire aussi sa classe, ce n'est pas changer la police.
    if (f.added.length || (/fontFamily/.test(after) && !/fontFamily/.test(before)))
      problems.push(`La police n'a pas été demandée : garde les classes de police telles quelles (${[...f.removed, ...f.added].slice(0, 4).join(', ') || 'fontFamily'}).`);
  }
  if (!asksColor(request)) {
    const c = diff(tb.filter((x) => COLOR_CLASS.test(x)), ta.filter((x) => COLOR_CLASS.test(x)));
    const hex = diff(before.match(HEX) ?? [], after.match(HEX) ?? []);
    if (c.added.length || hex.added.length)
      problems.push(`Les couleurs n'ont pas été demandées : ne change aucune couleur (${[...c.removed, ...c.added, ...hex.added].slice(0, 4).join(', ')}).`);
  }
  const name = (code: string) => code.match(/export\s+default\s+function\s+(\w+)/)?.[1];
  if (name(before) && name(after) !== name(before)) problems.push(`Le composant doit garder son nom (export default function ${name(before)}).`);
  if (!asksRemoval(request) && after.trim().length < before.trim().length * 0.6)
    problems.push('Ta retouche retire une grande partie de la section, ce qui n’a pas été demandé : ne change que ce qui est demandé.');
  return problems;
}

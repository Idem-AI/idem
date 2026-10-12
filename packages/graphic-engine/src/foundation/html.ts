/**
 * Écriture du HTML : l'échappement est la frontière entre du CONTENU et du BALISAGE, et elle n'a
 * pas d'exception. Les styles sont posés en ligne (aucune feuille externe, aucune compilation
 * Tailwind au moment de l'export) : une page qui se rend bien ici se rend bien partout.
 */

export function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function escAttr(value: unknown): string {
  return esc(value).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * Propriétés CSS qui n'ont PAS d'unité. Un entier posé sur une autre propriété devient des
 * pixels : sans cette liste, `line-height:1.4` partait en `1.4px` et `font-weight:700` en
 * `700px` — quatre composants sur sept avaient des lignes superposées, invisible à la lecture.
 */
const UNITLESS = new Set([
  'line-height',
  'font-weight',
  'opacity',
  'z-index',
  'flex',
  'flex-grow',
  'flex-shrink',
  'order',
  'orphans',
  'widows',
  'zoom',
  'column-count',
  'grid-column',
  'grid-row',
  'aspect-ratio',
  'scale',
  'fill-opacity',
  'stroke-opacity',
  'stroke-width',
  '-webkit-line-clamp',
]);

export type CssValue = string | number | false | null | undefined;

/** `{ 'font-size': 12, color: '#000' }` → `font-size:12px;color:#000`. Les valeurs vides sont omises. */
export function css(declarations: Record<string, CssValue>): string {
  const parts: string[] = [];
  for (const [property, value] of Object.entries(declarations)) {
    if (value === undefined || value === null || value === false || value === '') continue;
    const text = typeof value === 'number' ? (UNITLESS.has(property) || value === 0 ? String(value) : `${round(value)}px`) : value;
    parts.push(`${property}:${text}`);
  }
  return parts.join(';');
}

export const round = (value: number, digits = 2): number => {
  const k = Math.pow(10, digits);
  return Math.round(value * k) / k;
};

/**
 * Ajoute des déclarations à la FIN du style de la première balise d'un fragment : elles l'emportent sur
 * celles que la balise porte déjà (un texte pose `margin:0` ; un écart ajouté AVANT serait annulé).
 */
export function appendStyle(html: string, declarations: string): string {
  const open = /^(\s*<[a-zA-Z][\w-]*\b[^>]*?\bstyle=")([^"]*)(")/.exec(html);
  if (open) return `${open[1]}${open[2].replace(/;?\s*$/, ';')}${declarations}${open[3]}${html.slice(open[0].length)}`;
  return html.replace(/^(\s*<[a-zA-Z][\w-]*)/, `$1 style="${declarations}"`);
}

export type AttrValue = string | number | boolean | null | undefined;

export function attrs(map: Record<string, AttrValue>): string {
  let out = '';
  for (const [name, value] of Object.entries(map)) {
    if (value === undefined || value === null || value === false) continue;
    out += value === true ? ` ${name}` : ` ${name}="${escAttr(value)}"`;
  }
  return out;
}

/** Un élément. `inner` est du HTML DÉJÀ valide (jamais du texte brut : passer par `esc`). */
export function el(tag: string, attributes: Record<string, AttrValue> = {}, inner = ''): string {
  return `<${tag}${attrs(attributes)}>${inner}</${tag}>`;
}

/** Une URL est-elle admissible comme source d'image / de feuille de style ? (jamais `javascript:`). */
export function safeUrl(value: unknown): string {
  const url = String(value ?? '').trim();
  if (!url) return '';
  if (/^(https?:\/\/|\/|\.\/|\.\.\/|data:image\/(png|jpe?g|gif|webp|svg\+xml|avif);)/i.test(url)) return url;
  return '';
}

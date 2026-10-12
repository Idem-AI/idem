/**
 * Mesure et finition typographique.
 *
 * Les estimations de largeur servent à CHOISIR (la composition vérifie qu'un contenu tient avant
 * de rendre) ; le verdict reste celui du navigateur (`quality-engine/browser`). Une estimation qui
 * se trompe de quelques pour cent ne produit donc jamais une page fausse : elle coûte une
 * réparation de plus.
 */

export type FontClass = 'sans' | 'serif' | 'mono' | 'condensed' | 'wide' | 'script';

const CLASS_PATTERNS: Array<[FontClass, RegExp]> = [
  ['mono', /mono|courier|consolas|menlo|code|typewriter/i],
  ['script', /script|hand|brush|caveat|pacifico|dancing|satisfy|kalam|marker|sacramento|great vibes|shadows into|gloria|patrick hand/i],
  ['condensed', /condensed|narrow|oswald|bebas|anton|league gothic|fjalla|pathway gothic|big shoulders|teko|antonio|saira extra/i],
  ['wide', /expanded|extended|wide|syncopate|unbounded|krona|michroma|orbitron|dela gothic|lexend zetta|monument/i],
  [
    'serif',
    /serif|georgia|times|garamond|playfair|merriweather|lora|cormorant|baskerville|bodoni|didot|caslon|spectral|fraunces|crimson|cardo|gelasio|newsreader|abril|bitter|slab|zilla|rokkitt|domine|vollkorn|literata|alegreya$|libre franklin$/i,
  ],
];

export function classifyFont(family: string | undefined | null): FontClass {
  const name = String(family ?? '');
  for (const [cls, pattern] of CLASS_PATTERNS) if (pattern.test(name)) return cls;
  return 'sans';
}

/** Chasse moyenne d'un signe (em) en texte courant mélangé, espaces compris. */
const AVG_CHAR_EM: Record<FontClass, number> = { sans: 0.5, serif: 0.47, mono: 0.6, condensed: 0.4, wide: 0.6, script: 0.46 };
const UPPERCASE_FACTOR = 1.28;
const SPACE_EM = 0.28;

export interface TextMetricOptions {
  font?: FontClass;
  /** 100..900. */
  weight?: number;
  /** Interlettrage en em (0.08 = capitales aérées). */
  tracking?: number;
  uppercase?: boolean;
}

function charEm(options: TextMetricOptions): number {
  const base = AVG_CHAR_EM[options.font ?? 'sans'];
  const weight = options.weight ?? 400;
  const weightFactor = 1 + ((weight - 400) / 100) * 0.022;
  return base * weightFactor * (options.uppercase ? UPPERCASE_FACTOR : 1) + (options.tracking ?? 0);
}

export function estimateWidthPx(text: string, sizePx: number, options: TextMetricOptions = {}): number {
  const em = charEm(options);
  const spaces = (text.match(/\s/g) ?? []).length;
  const letters = text.length - spaces;
  return (letters * em + spaces * (SPACE_EM + (options.tracking ?? 0))) * sizePx;
}

/** Nombre de lignes d'un texte dans une boîte, par remplissage glouton (un mot jamais coupé). */
export function estimateLines(text: string, boxWidthPx: number, sizePx: number, options: TextMetricOptions = {}): number {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return 0;
  const space = (SPACE_EM + (options.tracking ?? 0)) * sizePx;
  let lines = 1;
  let used = 0;
  for (const word of words) {
    const width = estimateWidthPx(word, sizePx, options);
    if (used === 0) used = width;
    else if (used + space + width <= boxWidthPx) used += space + width;
    else {
      lines += 1;
      used = width;
    }
  }
  return lines;
}

export interface FitResult {
  size: number;
  lines: number;
  height: number;
  /** Le texte tient-il, au moins à la taille minimale ? */
  fits: boolean;
}

/**
 * La plus grande taille (pas de 0,5 px) à laquelle le texte tient dans la boîte, sans qu'un mot
 * seul ne déborde. Rend la taille minimale, avec `fits: false`, si rien ne tient.
 */
export function fitFontSize(
  text: string,
  boxWidthPx: number,
  boxHeightPx: number,
  limits: { max: number; min: number; leading?: number; maxLines?: number },
  options: TextMetricOptions = {}
): FitResult {
  const leading = limits.leading ?? 1.2;
  const longest = text.split(/\s+/).reduce((m, w) => Math.max(m, w.length), 0);
  for (let size = limits.max; size >= limits.min; size -= 0.5) {
    const longestWord = estimateWidthPx('x'.repeat(longest), size, options);
    if (longestWord > boxWidthPx) continue;
    const lines = estimateLines(text, boxWidthPx, size, options);
    if (limits.maxLines && lines > limits.maxLines) continue;
    const height = lines * size * leading;
    if (height <= boxHeightPx) return { size, lines, height, fits: true };
  }
  const lines = estimateLines(text, boxWidthPx, limits.min, options);
  return { size: limits.min, lines, height: lines * limits.min * leading, fits: false };
}

/** Mots qui ne finissent jamais une ligne : ils restent collés au suivant. */
const BINDING_WORDS = /^(?:&|et|de|du|des|la|le|les|un|une|à|au|aux|en|sur|par|pour|and|of|the|a|an|for|to|in|on|at|or)$/i;

const NBSP = ' ';
const NNBSP = ' ';

/**
 * Finition d'un texte : apostrophes courbes, points de suspension, espaces insécables (français :
 * avant `; ! ? »` fine, avant `:` insécable ; mots-liens collés au suivant) et dernière ligne qui
 * ne reste jamais un mot seul (les deux derniers mots sont liés).
 *
 * Aucune lettre ni aucun chiffre n'est touché : seul l'espacement et la ponctuation changent.
 */
export function typographize(text: string, locale = 'fr', options: { bindLastWords?: boolean } = {}): string {
  let out = String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/(\w)'(\w)/g, '$1’$2')
    .replace(/\.{3}/g, '…')
    .replace(/ -- /g, ' – ');
  if (locale.toLowerCase().startsWith('fr')) {
    out = out
      .replace(/\s*([;!?])/g, `${NNBSP}$1`)
      .replace(/\s*:/g, `${NBSP}:`)
      .replace(/«\s*/g, `«${NNBSP}`)
      .replace(/\s*»/g, `${NNBSP}»`)
      .replace(/(\d)\s+(%|€|\$|F\b|FCFA|XAF|XOF)/g, `$1${NBSP}$2`);
  }
  out = out.replace(/(^|\s)([^\s]{1,4})\s(?=\S)/g, (match, lead: string, word: string) => (BINDING_WORDS.test(word) ? `${lead}${word}${NBSP}` : match));
  if (options.bindLastWords !== false) {
    // Pas de mot seul en dernière ligne… mais jamais une chaîne entièrement insécable (« Des producteurs
    // isolés » ne pourrait plus passer à la ligne et sortirait de sa colonne dès que le texte grandit).
    const bound = out.replace(/(\S) (\S{1,18})$/, `$1${NBSP}$2`);
    if (bound.includes(' ')) out = bound;
  }
  return out;
}

/** Texte comparable : mêmes espaces, mêmes apostrophes, mêmes tirets. Sert aux contrôles de fidélité. */
export function normalizeForCompare(text: string): string {
  return String(text ?? '')
    .replace(/[    ]/g, ' ')
    .replace(/[’‘]/g, "'")
    .replace(/[“”«»]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Les chiffres d'un texte (entiers et décimaux, séparateurs normalisés) : pour garantir qu'aucun n'est inventé. */
export function extractNumbers(text: string): string[] {
  return (String(text ?? '').replace(/[    ](?=\d{3}\b)/g, '').match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => n.replace(',', '.'));
}

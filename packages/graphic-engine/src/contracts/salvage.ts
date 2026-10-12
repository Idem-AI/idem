/**
 * La RÉCUPÉRATION d'une section rendue EN HTML alors qu'on attendait du contenu structuré.
 *
 * Le rédacteur doit renvoyer un objet de section ; il lui arrive de renvoyer la page HTML qu'il composait
 * autrefois. Aucune consigne ne rend l'obéissance CERTAINE, et une section perdue est une page « la
 * génération a échoué » au milieu d'un document qu'un banquier va lire. Le HTML qu'il a produit contient
 * le TEXTE (titres, paragraphes, tableaux, listes) : c'est le travail de fond, et il est payé. Seule la
 * mise en page est à jeter — et c'est précisément ce que le moteur refait.
 *
 * Rien n'est INVENTÉ : pas de titre de remplacement, pas de chiffre reconstitué, pas de graphique (les
 * séries d'un graphique de modèle vivent dans un script : les deviner serait pire que la page perdue).
 */
import type { SectionContent } from './content-model';
import { normalizeSection } from './normalize';

interface HtmlNode {
  tag: string;
  classes: string;
  children: HtmlNode[];
  /** Texte propre au nœud (fragments textuels directs). */
  text: string;
}

const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const DROPPED_TAGS = ['script', 'style', 'svg', 'noscript', 'template'];
const HEADINGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  eacute: 'é', egrave: 'è', agrave: 'à', ccedil: 'ç', ugrave: 'ù',
  ecirc: 'ê', acirc: 'â', icirc: 'î', ocirc: 'ô', ucirc: 'û',
  euro: '€', laquo: '«', raquo: '»', hellip: '…', mdash: '—', ndash: '–',
  rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', deg: '°', times: '×',
};

const decode = (text: string): string =>
  text
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (whole, name: string) => ENTITIES[name.toLowerCase()] ?? whole);

const clean = (text: string): string => decode(text).replace(/\s+/g, ' ').trim();

/** Un arbre minimal, permissif : une balise orpheline est ignorée, jamais fatale. */
function parse(html: string): HtmlNode {
  let source = html;
  for (const tag of DROPPED_TAGS) {
    source = source.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?</${tag}\\s*>`, 'gi'), ' ');
    source = source.replace(new RegExp(`<${tag}\\b[^>]*/?>`, 'gi'), ' ');
  }
  source = source.replace(/<!--[\s\S]*?-->/g, ' ');
  const root: HtmlNode = { tag: 'root', classes: '', children: [], text: '' };
  const stack: HtmlNode[] = [root];
  const token = /<\/?([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^'">])*)\/?>/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = token.exec(source)) !== null) {
    const between = source.slice(cursor, match.index);
    if (between.trim()) stack[stack.length - 1].text += ` ${between}`;
    cursor = match.index + match[0].length;
    const tag = match[1].toLowerCase();
    if (match[0].startsWith('</')) {
      const at = [...stack].reverse().findIndex((node) => node.tag === tag);
      if (at !== -1) stack.length = Math.max(1, stack.length - at - 1);
      continue;
    }
    if (match[0].endsWith('/>') || VOID_TAGS.has(tag)) continue;
    const classes = /class\s*=\s*"([^"]*)"|class\s*=\s*'([^']*)'/i.exec(match[2] ?? '');
    const node: HtmlNode = { tag, classes: (classes?.[1] ?? classes?.[2] ?? '').toLowerCase(), children: [], text: '' };
    stack[stack.length - 1].children.push(node);
    stack.push(node);
  }
  const tail = source.slice(cursor);
  if (tail.trim()) stack[stack.length - 1].text += ` ${tail}`;
  return root;
}

const textOf = (node: HtmlNode): string => clean([node.text, ...node.children.map(textOf)].join(' '));

/** Les éléments SIGNIFIANTS dans l'ordre de lecture : les `div` de mise en page sont traversées. */
function flatten(node: HtmlNode, out: HtmlNode[]): void {
  for (const child of node.children) {
    if (HEADINGS.has(child.tag) || ['p', 'table', 'ul', 'ol', 'blockquote', 'dl'].includes(child.tag)) {
      out.push(child);
      continue;
    }
    flatten(child, out);
    const own = clean(child.text);
    if (own) out.push({ tag: 'p', classes: child.classes, children: [], text: own });
  }
}

function collect(node: HtmlNode, tag: string, out: HtmlNode[] = []): HtmlNode[] {
  for (const child of node.children) {
    if (child.tag === tag) out.push(child);
    else collect(child, tag, out);
  }
  return out;
}

function tableOf(node: HtmlNode): Record<string, unknown> | null {
  const rows = collect(node, 'tr')
    .map((row) => {
      const cells: Array<{ text: string; header: boolean }> = [];
      const walk = (current: HtmlNode): void => {
        for (const child of current.children) {
          if (child.tag === 'td' || child.tag === 'th') cells.push({ text: textOf(child), header: child.tag === 'th' });
          else walk(child);
        }
      };
      walk(row);
      return cells;
    })
    .filter((cells) => cells.length > 0);
  if (!rows.length) return null;
  const headed = rows[0].every((cell) => cell.header);
  const headers = headed ? rows[0].map((c) => c.text) : rows[0].map((_, i) => `Colonne ${i + 1}`);
  const body = (headed ? rows.slice(1) : rows).map((cells) => cells.map((cell) => cell.text));
  if (!body.length) return null;
  const caption = node.children.find((child) => child.tag === 'caption');
  return { kind: 'table', headers, rows: body, ...(caption ? { caption: textOf(caption) } : {}) };
}

/** Une liste devient des cartes quand chaque entrée porte son propre intitulé. */
function listOf(node: HtmlNode): Record<string, unknown> | null {
  const items = collect(node, 'li');
  const texts = items.map(textOf).filter(Boolean);
  if (!texts.length) return null;
  const titled = items
    .map((item) => {
      const lead = item.children.find((child) => ['strong', 'b', 'span', 'h3', 'h4', 'h5', 'h6'].includes(child.tag));
      const title = lead ? textOf(lead) : '';
      const whole = textOf(item);
      const body = title && whole.startsWith(title) ? whole.slice(title.length).trim() : whole;
      return { title, body: body.replace(/^[:—–-]\s*/, '') };
    })
    .filter((entry) => entry.title && entry.body);
  return titled.length === items.length && titled.length >= 2 ? { kind: 'cards', items: titled } : { kind: 'prose', paragraphs: texts };
}

const looksLikeKicker = (node: HtmlNode, text: string): boolean =>
  Boolean(text) && text.length <= 60 && (/uppercase|tracking-wid/.test(node.classes) || (text === text.toUpperCase() && /[A-ZÀ-Ÿ]/.test(text)));

/**
 * La sortie est-elle une PAGE HTML, et non du JSON mal formé ? Un contenu tronqué contient souvent des
 * balises DANS ses chaînes : on exige que la sortie COMMENCE par une balise (clôture de code retirée).
 */
export function looksLikeHtmlPage(raw: unknown): boolean {
  if (typeof raw !== 'string' || !raw) return false;
  return raw.trim().replace(/^```(?:html)?\s*/i, '').trimStart().startsWith('<');
}

/**
 * Une page HTML convertie en section (normalisée). `null` quand il n'y a rien à sauver — l'appelant traite
 * alors la section comme échouée : mieux vaut une page annoncée manquante qu'une page vide.
 */
export function salvageHtmlSection(html: string, fallbackTitle: string, options: { id?: string } = {}): SectionContent | null {
  if (!looksLikeHtmlPage(html)) return null;
  const elements: HtmlNode[] = [];
  flatten(parse(html), elements);

  let kicker: string | undefined;
  let title = '';
  let lede: string | undefined;
  const blocks: Array<Record<string, unknown>> = [];
  let prose: string[] = [];
  let cards: Array<{ title: string; body: string }> = [];
  const flushProse = (): void => {
    if (prose.length) blocks.push({ kind: 'prose', paragraphs: prose });
    prose = [];
  };
  const flushCards = (): void => {
    const full = cards.filter((c) => c.title && c.body);
    if (full.length === 1) blocks.push({ kind: 'prose', paragraphs: [`${full[0].title} — ${full[0].body}`] });
    else if (full.length > 1) blocks.push({ kind: 'cards', items: full });
    cards = [];
  };

  for (const element of elements) {
    const text = textOf(element);
    if (HEADINGS.has(element.tag)) {
      if (!title && Number(element.tag[1]) <= 2 && text) {
        flushProse();
        flushCards();
        title = text;
      } else if (text) {
        flushProse();
        cards.push({ title: text, body: '' });
      }
      continue;
    }
    if (element.tag === 'table' || element.tag === 'ul' || element.tag === 'ol' || element.tag === 'dl' || element.tag === 'blockquote') {
      flushProse();
      flushCards();
      const block = element.tag === 'table' ? tableOf(element) : element.tag === 'blockquote' ? (text ? { kind: 'quote', text } : null) : listOf(element);
      if (block) blocks.push(block);
      continue;
    }
    if (!text) continue;
    // Texte courant : il complète la dernière carte ouverte, sinon il alimente la prose.
    const open = cards[cards.length - 1];
    if (open && !open.body) {
      open.body = text;
      continue;
    }
    flushCards();
    if (!title && !kicker && looksLikeKicker(element, text)) {
      kicker = text;
      continue;
    }
    if (title && !lede && !blocks.length && !prose.length && text.length <= 320) {
      lede = text;
      continue;
    }
    prose.push(text);
  }
  flushProse();
  flushCards();
  if (!title && !blocks.length) return null;
  return normalizeSection({ ...(kicker ? { kicker } : {}), title: title || fallbackTitle, ...(lede ? { lede } : {}), blocks }, { id: options.id }).section;
}

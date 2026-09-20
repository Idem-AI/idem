/**
 * Récupération d'une section rendue EN HTML alors qu'on attendait du contenu
 * structuré.
 *
 * ── POURQUOI CE MODULE EXISTE ───────────────────────────────────────────────
 *
 * Le rédacteur doit renvoyer un objet `SectionContent`. Il lui arrive de
 * renvoyer la page HTML qu'il composait avant que le gabarit n'existe. Les
 * causes se corrigent en amont — consignes contradictoires, mode JSON non
 * transmis — mais aucune correction en amont ne rend l'obéissance CERTAINE :
 * un modèle reste un modèle, et une section perdue est une page « la génération
 * a échoué » au milieu d'un document qu'un banquier va lire.
 *
 * Ce module retire au modèle le pouvoir de faire échouer la section. Le HTML
 * qu'il a produit contient le TEXTE : titres, paragraphes, tableaux, listes.
 * C'est le travail de fond, et il est payé. Seule la mise en page est à jeter —
 * et c'est justement ce que le gabarit refait.
 *
 * ── CE QU'IL NE FAIT PAS ────────────────────────────────────────────────────
 *
 * Il n'INVENTE rien. Pas de titre de remplacement, pas de chiffre reconstitué,
 * pas de graphique : les séries d'un graphe modèle vivent dans un `<script>`
 * Chart.js, et deviner des données à partir de code serait le seul défaut plus
 * grave que la page perdue. Un graphe non récupérable est simplement absent.
 *
 * Le repli n'est donc pas « aussi bon » que la sortie attendue. Il est complet,
 * lisible, à la charte du document, et il ne ment pas.
 */

import { Block, SectionContent } from './sectionContent';

// ---------------------------------------------------------------------------
// Un arbre minimal, sans dépendance
// ---------------------------------------------------------------------------

interface Node {
  tag: string;
  classes: string;
  children: Node[];
  /** Texte propre au nœud (concaténé des fragments textuels directs). */
  text: string;
}

/** Éléments sans fermeture : ils ne doivent jamais empiler un niveau. */
const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

/** Contenus à retirer AVANT l'analyse : ce ne sont pas des mots du document. */
const DROPPED_TAGS = ['script', 'style', 'svg', 'noscript', 'template'];

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  eacute: 'é', egrave: 'è', agrave: 'à', ccedil: 'ç', ugrave: 'ù',
  ecirc: 'ê', acirc: 'â', icirc: 'î', ocirc: 'ô', ucirc: 'û',
  euro: '€', laquo: '«', raquo: '»', hellip: '…', mdash: '—', ndash: '–',
  rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', deg: '°', times: '×',
};

function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (whole, name) => ENTITIES[name.toLowerCase()] ?? whole);
}

const clean = (text: string): string => decodeEntities(text).replace(/\s+/g, ' ').trim();

/**
 * Construit l'arbre.
 *
 * Volontairement permissif : une balise fermante orpheline est ignorée plutôt
 * que de faire échouer l'analyse. Le seul but est de retrouver du texte dans un
 * ordre exploitable — pas de valider du HTML.
 */
export function parseHtmlFragment(html: string): Node {
  let source = html;
  for (const tag of DROPPED_TAGS) {
    source = source.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?</${tag}\\s*>`, 'gi'), ' ');
    source = source.replace(new RegExp(`<${tag}\\b[^>]*/?>`, 'gi'), ' ');
  }
  source = source.replace(/<!--[\s\S]*?-->/g, ' ');

  const root: Node = { tag: 'root', classes: '', children: [], text: '' };
  const stack: Node[] = [root];
  const token = /<\/?([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^'">])*)\/?>/g;

  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = token.exec(source)) !== null) {
    const between = source.slice(cursor, match.index);
    if (between.trim()) {
      const top = stack[stack.length - 1];
      top.text = `${top.text} ${between}`;
    }
    cursor = match.index + match[0].length;

    const tag = match[1].toLowerCase();
    const closing = match[0].startsWith('</');
    const selfClosing = match[0].endsWith('/>') || VOID_TAGS.has(tag);

    if (closing) {
      // Referme jusqu'à la balise correspondante, sans jamais vider la pile.
      const at = [...stack].reverse().findIndex((node) => node.tag === tag);
      if (at !== -1) stack.length = Math.max(1, stack.length - at - 1);
      continue;
    }
    if (selfClosing) continue;

    const classes = /class\s*=\s*"([^"]*)"|class\s*=\s*'([^']*)'/i.exec(match[2] ?? '');
    const node: Node = {
      tag,
      classes: (classes?.[1] ?? classes?.[2] ?? '').toLowerCase(),
      children: [],
      text: '',
    };
    stack[stack.length - 1].children.push(node);
    stack.push(node);
  }

  const tail = source.slice(cursor);
  if (tail.trim()) {
    const top = stack[stack.length - 1];
    top.text = `${top.text} ${tail}`;
  }
  return root;
}

/** Tout le texte visible d'un nœud, dans l'ordre. */
function textOf(node: Node): string {
  const parts: string[] = [node.text];
  for (const child of node.children) parts.push(textOf(child));
  return clean(parts.join(' '));
}

const HEADINGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);

/**
 * Aplatit l'arbre en une suite d'éléments SIGNIFIANTS, dans l'ordre de lecture.
 *
 * Les `div` de mise en page — l'essentiel d'une page Tailwind — sont traversés
 * sans rien produire : elles portent la composition, qui est précisément ce
 * qu'on jette. On ne s'arrête que sur ce qui porte du sens éditorial.
 */
function flatten(node: Node, out: Node[]): void {
  for (const child of node.children) {
    if (HEADINGS.has(child.tag) || ['p', 'table', 'ul', 'ol', 'blockquote', 'dl'].includes(child.tag)) {
      out.push(child);
      continue;
    }
    flatten(child, out);
    // Du texte posé directement dans un conteneur (fréquent dans les cartes) ne
    // doit pas disparaître au motif qu'il n'a pas de <p> autour.
    const own = clean(child.text);
    if (own) out.push({ tag: 'p', classes: child.classes, children: [], text: own });
  }
}

function tableBlock(node: Node): Block | null {
  const rows: Node[] = [];
  const collectRows = (current: Node): void => {
    for (const child of current.children) {
      if (child.tag === 'tr') rows.push(child);
      else collectRows(child);
    }
  };
  collectRows(node);
  if (rows.length === 0) return null;

  const cellsOf = (row: Node): { text: string; header: boolean }[] => {
    const cells: { text: string; header: boolean }[] = [];
    const walk = (current: Node): void => {
      for (const child of current.children) {
        if (child.tag === 'td' || child.tag === 'th') {
          cells.push({ text: textOf(child), header: child.tag === 'th' });
        } else walk(child);
      }
    };
    walk(row);
    return cells;
  };

  const parsed = rows.map(cellsOf).filter((cells) => cells.length > 0);
  if (parsed.length === 0) return null;

  const first = parsed[0];
  const hasHeaderRow = first.every((cell) => cell.header);
  const headers = (hasHeaderRow ? first : first.map((_, i) => `Colonne ${i + 1}`)).map((c) =>
    typeof c === 'string' ? c : c.text
  );
  const body = (hasHeaderRow ? parsed.slice(1) : parsed).map((cells) =>
    cells.map((cell) => cell.text)
  );
  if (body.length === 0) return null;

  // Un tableau dont toutes les lignes n'ont pas la même largeur casse le rendu :
  // on aligne sur l'en-tête plutôt que de livrer une grille trouée.
  const width = headers.length;
  const rectangular = body.map((row) =>
    row.length >= width ? row.slice(0, width) : [...row, ...Array(width - row.length).fill('')]
  );

  const caption = node.children.find((child) => child.tag === 'caption');
  const block: Block = { kind: 'table', headers, rows: rectangular };
  if (caption) (block as { caption?: string }).caption = textOf(caption);
  return block;
}

/** Une liste devient des cartes quand chaque entrée porte son propre intitulé. */
function listBlock(node: Node): Block | null {
  const items: Node[] = [];
  const collect = (current: Node): void => {
    for (const child of current.children) {
      if (child.tag === 'li') items.push(child);
      else collect(child);
    }
  };
  collect(node);
  const texts = items.map(textOf).filter(Boolean);
  if (texts.length === 0) return null;

  const titled = items
    .map((item) => {
      const lead = item.children.find((child) =>
        ['strong', 'b', 'span', 'h3', 'h4', 'h5', 'h6'].includes(child.tag)
      );
      const title = lead ? textOf(lead) : '';
      const whole = textOf(item);
      const body = title && whole.startsWith(title) ? whole.slice(title.length).trim() : whole;
      return { title, body: body.replace(/^[:—–-]\s*/, '') };
    })
    .filter((entry) => entry.title && entry.body);

  if (titled.length === items.length && titled.length >= 2) {
    return { kind: 'cards', items: titled.map(({ title, body }) => ({ title, body })) };
  }
  return { kind: 'prose', paragraphs: texts };
}

/** Un intitulé court, tout en capitales ou marqué comme tel : un sur-titre. */
function looksLikeKicker(node: Node, text: string): boolean {
  if (!text || text.length > 60) return false;
  if (/uppercase|tracking-wid/.test(node.classes)) return true;
  return text === text.toUpperCase() && /[A-ZÀ-Ÿ]/.test(text);
}

/**
 * La sortie est-elle une PAGE HTML, et non du JSON mal formé ?
 *
 * Distinction indispensable : un contenu structuré tronqué contient souvent des
 * balises DANS ses chaînes (« <strong>1 Md XAF</strong> » au fil d'un
 * paragraphe). Le passer au récupérateur produirait des blocs faits de syntaxe
 * JSON — « "kind": "prose" » imprimé dans le document. Pire que la page perdue
 * qu'on cherche à éviter.
 *
 * On exige donc que la sortie COMMENCE par une balise, une fois les clôtures de
 * code retirées. C'est ce que fait un modèle qui compose une page ; ce n'est
 * jamais ce que fait un modèle qui écrit un objet, même en s'arrêtant au milieu.
 */
export function looksLikeHtmlPage(raw: string): boolean {
  if (!raw || typeof raw !== 'string') return false;
  const trimmed = raw.trim().replace(/^```(?:html)?\s*/i, '').trimStart();
  return trimmed.startsWith('<');
}

/**
 * Convertit une page HTML en contenu structuré.
 *
 * Renvoie `null` quand il n'y a rien à sauver — pas de titre ET pas de bloc.
 * L'appelant doit alors traiter la section comme échouée : mieux vaut une page
 * annoncée manquante qu'une page vide sans explication.
 */
export function htmlToSectionContent(html: string, fallbackTitle: string): SectionContent | null {
  if (!html || typeof html !== 'string') return null;

  const elements: Node[] = [];
  flatten(parseHtmlFragment(html), elements);

  let kicker: string | undefined;
  let title = '';
  let lede: string | undefined;
  const blocks: Block[] = [];

  /** Paragraphes en attente : les `p` consécutifs forment UN bloc de prose. */
  let pending: string[] = [];
  const flushProse = (): void => {
    if (pending.length > 0) {
      blocks.push({ kind: 'prose', paragraphs: pending });
      pending = [];
    }
  };

  /** Titres de niveau 3+ suivis de texte : autant de cartes, regroupées. */
  let pendingCards: { title: string; body: string }[] = [];
  const flushCards = (): void => {
    if (pendingCards.length === 0) return;
    if (pendingCards.length === 1) {
      // Une carte seule n'est pas une grille : c'est un paragraphe titré.
      const only = pendingCards[0];
      blocks.push({ kind: 'prose', paragraphs: [`${only.title} — ${only.body}`] });
    } else {
      blocks.push({ kind: 'cards', items: pendingCards });
    }
    pendingCards = [];
  };

  for (const element of elements) {
    const text = textOf(element);

    if (HEADINGS.has(element.tag)) {
      const level = Number(element.tag[1]);
      if (!title && level <= 2 && text) {
        flushProse();
        flushCards();
        title = text;
        continue;
      }
      if (text) {
        flushProse();
        pendingCards.push({ title: text, body: '' });
      }
      continue;
    }

    if (element.tag === 'table') {
      flushProse();
      flushCards();
      const block = tableBlock(element);
      if (block) blocks.push(block);
      continue;
    }

    if (element.tag === 'ul' || element.tag === 'ol' || element.tag === 'dl') {
      flushProse();
      flushCards();
      const block = listBlock(element);
      if (block) blocks.push(block);
      continue;
    }

    if (element.tag === 'blockquote') {
      flushProse();
      flushCards();
      if (text) blocks.push({ kind: 'quote', text });
      continue;
    }

    if (!text) continue;

    // Texte courant. Il complète la dernière carte ouverte, sinon il alimente
    // la prose — ce qui reconstitue le « titre + corps » des grilles de cartes.
    const openCard = pendingCards[pendingCards.length - 1];
    if (openCard && !openCard.body) {
      openCard.body = text;
      continue;
    }
    flushCards();

    if (!title && looksLikeKicker(element, text) && !kicker) {
      kicker = text;
      continue;
    }
    if (title && !lede && blocks.length === 0 && pending.length === 0 && text.length <= 320) {
      lede = text;
      continue;
    }
    pending.push(text);
  }

  flushProse();
  flushCards();

  // Une carte sans corps n'apporte rien et se voit : on la retire ici plutôt
  // que de la laisser produire une case vide dans la grille.
  const cleaned = blocks
    .map((block) =>
      block.kind === 'cards'
        ? { ...block, items: block.items.filter((item) => item.title && item.body) }
        : block
    )
    .filter((block) => (block.kind === 'cards' ? block.items.length >= 2 : true));

  if (!title && cleaned.length === 0) return null;

  return {
    ...(kicker ? { kicker } : {}),
    title: title || fallbackTitle,
    ...(lede ? { lede } : {}),
    blocks: cleaned,
  };
}

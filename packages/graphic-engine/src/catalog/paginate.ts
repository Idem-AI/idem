/**
 * LA MISE EN PAGES DU BUSINESS PLAN — le moteur compose lui-même des pages A4 FIXES (10/11/2026).
 *
 * Avant, une section de business plan était un long flux ; l'aperçu le montrait tel quel et le PDF le faisait
 * re-découper par un paginateur qui décidait seul (coupes, déplacements, réductions, étirements) : l'aperçu et le PDF
 * ne se ressemblaient pas, et les pages se trouaient. Ici, le moteur :
 *
 *   1. MESURE dans Chromium chaque bloc du flux (en-tête, texte, tableau, liste…), ses éléments de liste et les rangées
 *      de ses tableaux ;
 *   2. REMPLIT des pages de hauteur exacte, dans l'ordre : un texte se coupe entre deux paragraphes, une liste entre
 *      deux éléments (jamais au milieu d'une rangée), un tableau entre deux rangées (en-tête répété) ; un graphique, une
 *      image, une citation ou une carte ne se coupe jamais ; un titre n'est jamais seul en bas de page ;
 *   3. CONSTRUIT chaque page A4 (racine fixe `data-ge-page`), que l'aperçu affiche et que le PDF imprime TELLE QUELLE.
 *
 * Tout se fait sur le HTML à clés : la page gardée reste le flux (rejouable sans modèle), la mise en pages se refait.
 */
import { pageDocument, withPage } from '../runtime/browser';

// ── Le HTML, élément par élément ─────────────────────────────────────────────────────────────

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);

/** L'indice juste après la fin de l'élément qui commence à `start` (HTML bien formé, généré par le code). */
export function elementEnd(html: string, start: number): number {
  const re = /<(\/?)([a-zA-Z][\w-]*)\b[^>]*?(\/?)>/g;
  re.lastIndex = start;
  let depth = 0;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    const [, closing, name, selfClose] = m;
    if (!closing && (selfClose || VOID.has(name.toLowerCase()))) {
      if (depth === 0) return re.lastIndex;
      continue;
    }
    depth += closing ? -1 : 1;
    if (depth === 0) return re.lastIndex;
  }
  return html.length;
}

export interface FlowPiece {
  id: string;
  kind: string;
  html: string;
  keepWithNext: boolean;
  keepTogether: boolean;
}

/** Les blocs de premier niveau d'un flux (`<section data-ge-piece>`), dans l'ordre. */
export function flowPieces(template: string): FlowPiece[] {
  const out: FlowPiece[] = [];
  const re = /<section\b[^>]*\bdata-ge-piece="([^"]+)"[^>]*>/g;
  let from = 0;
  for (let m = re.exec(template); m; m = re.exec(template)) {
    if (m.index < from) continue;
    const end = elementEnd(template, m.index);
    const html = template.slice(m.index, end);
    const open = m[0];
    out.push({ id: m[1], kind: open.match(/data-ge-kind="([^"]+)"/)?.[1] ?? '', html, keepWithNext: /\bdata-keep-with-next\b/.test(open) || m[1] === 'header', keepTogether: /\bdata-keep-together\b/.test(open) });
    from = end;
    re.lastIndex = end;
  }
  return out;
}

/** La liste principale d'un bloc : celle qui a le plus d'éléments marqués (`data-ge-item="liste:i"`). */
function primaryLoop(html: string): string | undefined {
  const counts = new Map<string, number>();
  for (const m of html.matchAll(/data-ge-item="([^":]+):\d+"/g)) counts.set(m[1], (counts.get(m[1]) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

/** Retire d'un bloc les éléments de sa liste principale hors de [from, to). */
function keepItems(html: string, loop: string, from: number, to: number): string {
  let out = html;
  const re = new RegExp(`<[a-zA-Z][\\w-]*\\b[^>]*\\bdata-ge-item="${loop}:(\\d+)"[^>]*>`, 'g');
  const spans: Array<[number, number]> = [];
  for (const m of out.matchAll(re)) {
    const i = Number(m[1]);
    if (i >= from && i < to) continue;
    spans.push([m.index!, elementEnd(out, m.index!)]);
  }
  for (const [a, b] of spans.reverse()) out = out.slice(0, a) + out.slice(b);
  return out;
}

// ── La mesure ────────────────────────────────────────────────────────────────────────────────

export interface PieceMetrics {
  id: string;
  height: number;
  /** Le retrait du haut (padding) : retiré quand le bloc ouvre une page. */
  padTop: number;
  /** Éléments de la liste principale (ou rangées du tableau) : haut et bas, relatifs au bloc. */
  segments: Array<{ ref: number; top: number; bottom: number }>;
  /** Ce qui se répète en haut d'un morceau suivant (en-tête de tableau, titre de liste). */
  lead: number;
  mode: 'items' | 'rows' | 'atomic';
  loop?: string;
}

const MEASURE = `(function () {
  var out = [];
  var root = document.querySelector('.ge-page');
  if (!root) return out;
  var kids = root.children;
  for (var k = 0; k < kids.length; k++) {
    var sec = kids[k];
    if (!sec.hasAttribute('data-ge-piece')) continue;
    var r = sec.getBoundingClientRect();
    var cs = getComputedStyle(sec);
    var items = [].slice.call(sec.querySelectorAll('[data-ge-item]')).map(function (el) {
      var q = el.getBoundingClientRect();
      return { key: el.getAttribute('data-ge-item'), top: q.top - r.top, bottom: q.bottom - r.top };
    });
    var table = sec.querySelector('table[data-ge-block]');
    var rows = table ? [].slice.call(table.querySelectorAll('tbody > tr')).map(function (tr, i) {
      var q = tr.getBoundingClientRect();
      return { ref: i, top: q.top - r.top, bottom: q.bottom - r.top };
    }) : [];
    var head = table && table.querySelector('thead') ? table.querySelector('thead').getBoundingClientRect().height : 0;
    var tableTop = table ? table.getBoundingClientRect().top - r.top : 0;
    // Les CHIFFRES trop longs pour leur case (débordent, ou plus de deux lignes) : l'échelle qui les fait tenir.
    var fits = [];
    var figs = [].slice.call(sec.querySelectorAll('[data-ge-k$=".value"], [data-ge-k$=".offer"]'));
    figs.forEach(function (sp) {
      var el = sp.parentElement; if (!el) return;
      var s2 = getComputedStyle(el);
      var lh = parseFloat(s2.lineHeight) || parseFloat(s2.fontSize) * 1.1;
      var lines = Math.round(el.getBoundingClientRect().height / lh);
      var over = el.scrollWidth > el.clientWidth + 1 ? el.clientWidth / el.scrollWidth : 1;
      var k = Math.min(over, lines > 2 ? 2 / lines : 1);
      if (k < 0.98) fits.push({ key: sp.getAttribute('data-ge-k'), scale: Math.max(0.4, Math.floor(k * 0.95 * 100) / 100) });
    });
    // Les chiffres d'un même bloc gardent la même taille : tous à l'échelle du plus long.
    if (fits.length) {
      var low = Math.min.apply(null, fits.map(function (f) { return f.scale; }));
      fits = figs.map(function (sp) { return { key: sp.getAttribute('data-ge-k'), scale: low }; });
    }
    out.push({ id: sec.getAttribute('data-ge-piece'), height: r.height, padTop: parseFloat(cs.paddingTop) || 0, items: items, rows: rows, head: head, tableTop: tableTop, fits: fits });
  }
  return out;
})()`;

/** Mesure les blocs d'un flux déjà rempli (HTML de la page de flux et sa feuille), à la largeur de la page. */
export async function measureFlow(html: string, head: string, width: number, pieces: FlowPiece[]): Promise<PieceMetrics[] & { fits?: Array<{ key: string; scale: number }> }> {
  type Raw = { id: string; height: number; padTop: number; items: Array<{ key: string; top: number; bottom: number }>; rows: Array<{ ref: number; top: number; bottom: number }>; head: number; tableTop: number; fits: Array<{ key: string; scale: number }> };
  const raw = (await withPage(pageDocument(html, head), { width, height: 1200 }, async (page) => {
    // Les graphiques ont une taille fixe (rapport d'aspect) : leur dessin n'est pas attendu pour la mesure.
    return (await page.evaluate(MEASURE)) as Raw[];
  })) as Raw[];
  const byId = new Map(raw.map((r) => [r.id, r]));
  const fits = raw.flatMap((r) => r.fits ?? []);
  const result = pieces.map((p) => {
    const r = byId.get(p.id);
    if (!r) return { id: p.id, height: 0, padTop: 0, segments: [], lead: 0, mode: 'atomic' as const };
    if (p.keepTogether) return { id: p.id, height: r.height, padTop: r.padTop, segments: [], lead: 0, mode: 'atomic' as const };
    // Un tableau : coupé entre ses rangées.
    if (r.rows.length >= 2 && !primaryLoop(p.html)) return { id: p.id, height: r.height, padTop: r.padTop, segments: r.rows, lead: r.tableTop + r.head, mode: 'rows' as const };
    const loop = primaryLoop(p.html);
    if (!loop) return { id: p.id, height: r.height, padTop: r.padTop, segments: [], lead: 0, mode: 'atomic' as const };
    const segs = r.items
      .filter((i) => i.key.startsWith(`${loop}:`))
      .map((i) => ({ ref: Number(i.key.slice(loop.length + 1)), top: i.top, bottom: i.bottom }))
      .sort((a, b) => a.ref - b.ref);
    if (segs.length < 2) return { id: p.id, height: r.height, padTop: r.padTop, segments: [], lead: 0, mode: 'atomic' as const };
    return { id: p.id, height: r.height, padTop: r.padTop, segments: segs, lead: segs[0].top, mode: 'items' as const, loop };
  }) as PieceMetrics[] & { fits?: Array<{ key: string; scale: number }> };
  result.fits = fits;
  return result;
}

/**
 * LE CODE FAIT TENIR LES CHIFFRES : l'élément qui porte la clé reçoit une taille de texte réduite à l'échelle mesurée
 * (« 12 000 – 15 000 » ne s'étale plus sur quatre lignes).
 */
export function fitFigures(template: string, fits: Array<{ key: string; scale: number }>): string {
  let out = template;
  for (const f of fits) {
    const at = out.indexOf(`{{${f.key}}}`);
    if (at < 0) continue;
    const open = out.lastIndexOf('<', at);
    const tagEnd = out.indexOf('>', open);
    if (open < 0 || tagEnd < 0 || tagEnd > at) continue;
    const tag = out.slice(open, tagEnd + 1);
    const resized = tag.replace(/(\s|")text-\[(\d+(?:\.\d+)?)px\]/, (_m, lead: string, n: string) => `${lead}text-[${Math.max(10, Math.round(Number(n) * f.scale))}px]`);
    if (resized !== tag) out = out.slice(0, open) + resized + out.slice(tagEnd + 1);
  }
  return out;
}

// ── Le remplissage des pages (arithmétique pure) ─────────────────────────────────────────────

/** Un morceau de bloc posé sur une page : le bloc entier, ou une plage de ses éléments / rangées. */
export interface Chunk {
  piece: number;
  /** Plage [de, à) dans les segments du bloc ; absente : le bloc entier. */
  range?: [number, number];
}

export interface PackOptions {
  capacity: number;
  /** La plus petite hauteur qu'un morceau peut avoir (ni miette en bas de page, ni miette en haut). */
  minChunk?: number;
}

/**
 * Remplit les pages. Un bloc qui tient est posé ; sinon il se coupe au dernier point de coupe qui tient (entre deux
 * rangées d'une liste, deux rangées d'un tableau) ; un bloc insécable part à la page suivante ; un titre ou un en-tête
 * part avec ce qui le suit. Rend les pages (morceaux) et leur hauteur prévue.
 */
export function packPages(pieces: FlowPiece[], metrics: PieceMetrics[], o: PackOptions): Array<{ chunks: Chunk[]; used: number }> {
  const base = packOnce(pieces, metrics, o.capacity, o);
  // La dernière page d'une section presque vide (< 25 %) : le code essaie de tout faire tenir sur une page de moins en
  // resserrant un peu les pages (au plus 14 % — zoom calculé par pageTemplate), plutôt que d'imprimer une miette.
  const last = base[base.length - 1];
  if (base.length < 2 || !last || last.used >= o.capacity * 0.25) return base;
  for (const k of [1.04, 1.08, 1.11, 1.14]) {
    const tight = packOnce(pieces, metrics, o.capacity * k, o);
    if (tight.length < base.length) return tight;
  }
  return base;
}

function packOnce(pieces: FlowPiece[], metrics: PieceMetrics[], C: number, o: PackOptions): Array<{ chunks: Chunk[]; used: number }> {
  const minChunk = o.minChunk ?? 70;
  const pages: Array<{ chunks: Chunk[]; used: number }> = [];
  let cur: { chunks: Chunk[]; used: number } = { chunks: [], used: 0 };
  const flush = () => {
    if (cur.chunks.length) pages.push(cur);
    cur = { chunks: [], used: 0 };
  };
  /** Hauteur d'un morceau (et de son retrait du haut quand il ouvre la page). */
  const heightOf = (i: number, range?: [number, number]): number => {
    const m = metrics[i];
    if (!range || m.mode === 'atomic') return m.height;
    const [a, b] = range;
    const segs = m.segments;
    const start = a === 0 ? 0 : segs[a].top - m.lead;
    const end = b >= segs.length ? m.height : segs[b - 1].bottom + (m.height - segs[segs.length - 1].bottom);
    return Math.max(0, end - start);
  };
  /** Les points de coupe valides d'un bloc : après le segment j, si le suivant commence sous lui (rangée suivante). */
  const cuts = (i: number, from: number): number[] => {
    const segs = metrics[i].segments;
    const out: number[] = [];
    for (let j = from; j < segs.length - 1; j++) if (segs[j + 1].top >= segs[j].bottom - 1) out.push(j + 1);
    return out;
  };
  type Item = { piece: number; range?: [number, number] };
  const queue: Item[] = pieces.map((_, i) => ({ piece: i }));
  while (queue.length) {
    const it = queue.shift()!;
    const m = metrics[it.piece];
    const first = cur.chunks.length === 0;
    const pad = first && (!it.range || it.range[0] === 0) ? m.padTop : 0;
    const h = heightOf(it.piece, it.range) - pad;
    const room = C - cur.used;
    // Un titre, un en-tête : jamais seul en bas de page — il faut la place pour lui ET un début de ce qui suit.
    const withNext = pieces[it.piece].keepWithNext && queue.length ? Math.min(heightOf(queue[0].piece, queue[0].range), minChunk * 2) : 0;
    if (h + withNext <= room + 0.5) {
      cur.chunks.push({ piece: it.piece, ...(it.range ? { range: it.range } : {}) });
      cur.used += h;
      continue;
    }
    // La FIN d'une section qui déborde de peu (≤ 10 % de page) : elle reste entière sur cette page, que le code
    // resserre, plutôt que de laisser sa queue seule sur une page presque vide.
    if (!first && !queue.length && cur.used + h <= C * 1.06) {
      cur.chunks.push({ piece: it.piece, ...(it.range ? { range: it.range } : {}) });
      cur.used += h;
      continue;
    }
    // Le bloc se coupe-t-il ici ?
    if (m.mode !== 'atomic' && !pieces[it.piece].keepWithNext) {
      const [a, b] = it.range ?? [0, m.segments.length];
      const options = cuts(it.piece, a).filter((c) => c > a && c < b);
      let best: number | undefined;
      // Jamais un élément isolé d'un côté de la coupe (« 4. Usage régulier » seul en haut d'une page).
      const minSide = m.segments.length >= 4 ? 2 : 1;
      for (const c of options) {
        if (c - a < minSide || b - c < minSide) continue;
        const head = heightOf(it.piece, [a, c]) - pad;
        const tail = heightOf(it.piece, [c, b]);
        if (head <= room + 0.5 && head >= minChunk && tail >= minChunk * 0.6) best = c;
      }
      if (best !== undefined) {
        cur.chunks.push({ piece: it.piece, range: [a, best] });
        cur.used += heightOf(it.piece, [a, best]) - pad;
        flush();
        queue.unshift({ piece: it.piece, range: [best, b] });
        continue;
      }
    }
    if (first) {
      // Plus grand qu'une page entière et insécable : posé seul (la page le réduit à sa taille).
      cur.chunks.push({ piece: it.piece, ...(it.range ? { range: it.range } : {}) });
      cur.used += h;
      flush();
      continue;
    }
    flush();
    queue.unshift(it);
  }
  flush();
  return pages;
}

// ── La construction des pages ────────────────────────────────────────────────────────────────

/** Le HTML d'un morceau : le bloc, réduit à sa plage (éléments de liste ou rangées de tableau). */
export function chunkHtml(piece: FlowPiece, m: PieceMetrics, chunk: Chunk, openPage: boolean): string {
  let html = piece.html;
  if (chunk.range && m.mode !== 'atomic') {
    const refs = m.segments.slice(chunk.range[0], chunk.range[1]).map((s) => s.ref);
    const from = Math.min(...refs);
    const to = Math.max(...refs) + 1;
    if (m.mode === 'rows') html = html.replace(/<idem-table\b/, `<idem-table data-rows="${from}-${to}"`);
    else if (m.loop) html = keepItems(html, m.loop, from, to);
  }
  // En haut de page, le bloc perd son retrait du haut (il était là pour le séparer du bloc précédent).
  if (openPage) html = html.replace(/^(<section\b[^>]*\bclass="[^"]*?)\bpt-\[[^\]]+\]/, '$1');
  return html;
}

/** Le gabarit d'une page A4 fixe : la marge d'impression, les morceaux les uns sous les autres. */
export function pageTemplate(chunks: string[], padding: string, fill = 1): string {
  // Une page un peu trop pleine (fin de section gardée avec elle) est RESSERRÉE : un zoom calculé, qui garde la pleine
  // largeur (le texte se recompose) et la marge du bas.
  const zoom = fill > 1 ? Math.max(0.84, Math.floor((0.99 / fill) * 100) / 100) : 1;
  const body = zoom < 1 ? `<div class="flex w-full flex-col [zoom:${zoom}]">${chunks.join('')}</div>` : chunks.join('');
  return `<div data-ge-page-body class="flex h-full w-full flex-col p-[${padding}]">${body}</div>`;
}

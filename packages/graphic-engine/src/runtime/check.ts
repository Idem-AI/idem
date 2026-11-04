/**
 * LE SEUL CONTRÔLE : la page s'affiche-t-elle ?
 *
 * Chromium (le même moteur que l'impression PDF) ouvre la page. Une page qui ne se charge pas, une racine sans
 * taille, une toile où rien n'est visible, un TEXTE COUPÉ par le bord — les quatre sur une toile fixe, la gauche
 * et la droite sur une page de flux, dont seule la hauteur grandit — (il ne s'affiche
 * pas en entier) ou RECOUVERT par une forme, une image, un aplat (il ne se lit pas) est une ERREUR TECHNIQUE : elle part en correction. Rien d'autre n'est jugé : ni contraste, ni
 * équilibre, ni goût. C'est l'auteur qui décide de la page.
 */
import fs from 'fs';
import path from 'path';
import { pageDocument, withPage } from './browser';
import { engineHost } from '../host';
import type { FormatDef } from '../design-system/formats';

export interface RenderCheck {
  ok: boolean;
  /** L'erreur, en une phrase lisible par l'auteur qui la corrigera. */
  error?: string;
  width?: number;
  height?: number;
  png?: Buffer;
  /** Le navigateur lui-même manque (lancement impossible) : ce n'est pas la faute de la page, rien à corriger. */
  infra?: boolean;
  /** L'erreur est un texte coupé par le bord (la page s'affiche presque entière). */
  cut?: boolean;
  /**
   * Le contenu déborde d'une toile fixe vers le bas ou la droite : l'échelle qui le fait tenir (0 < fit < 1). Le
   * moteur l'applique lui-même (`[zoom:…]`), sans demander au modèle d'estimer des hauteurs.
   */
  fit?: number;
  /** Par zone d'une page assemblée (`data-ge-zone`) : l'échelle qui fait tenir son contenu dans la zone (< 1 : déborde). */
  zoneFits?: Record<string, number>;
  /** Les mesures de la page (`measure: true`) : servent à choisir entre des variantes, jamais à refuser une page. */
  metrics?: import('@idem/design-tools').PageMetrics;
}

/**
 * LA MESURE D'UNE PAGE (plan qualité créative) : la hiérarchie typographique (plus grand corps / corps médian), le
 * nombre de tailles, la part couverte par du contenu, le plus grand élément, et les rectangles du titre, du logo et du
 * visuel principal (pour la saliency). Lue après rendu, quand la page s'affiche.
 */
export const MEASURE = `(function () {
  var root = document.querySelector('.ge-page');
  if (!root) return null;
  var box = root.getBoundingClientRect();
  var area = Math.max(1, box.width * box.height);
  var sizes = [], weights = [];
  var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  var seen = new Set();
  while (walker.nextNode()) {
    var t = walker.currentNode;
    var el = t.parentElement;
    if (!el || seen.has(el) || !(t.textContent || '').trim()) continue;
    seen.add(el);
    var r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    var fs = parseFloat(getComputedStyle(el).fontSize) || 0;
    if (!fs) continue;
    sizes.push(Math.round(fs));
    weights.push((t.textContent || '').trim().length);
  }
  var distinct = Array.from(new Set(sizes));
  var weighted = [];
  sizes.forEach(function (s, i) { for (var k = 0; k < Math.min(50, weights[i]); k++) weighted.push(s); });
  weighted.sort(function (a, b) { return a - b; });
  var median = weighted.length ? weighted[Math.floor(weighted.length / 2)] : 16;
  var largest = distinct.length ? Math.max.apply(null, distinct) : median;
  // La couverture : les rectangles des éléments porteurs (texte, média), à la grille de 32 × 32 cases.
  var G = 32, cells = new Uint8Array(G * G), biggest = 0;
  function mark(r) {
    var x0 = Math.max(0, Math.floor((r.left - box.left) / box.width * G)), x1 = Math.min(G, Math.ceil((r.right - box.left) / box.width * G));
    var y0 = Math.max(0, Math.floor((r.top - box.top) / box.height * G)), y1 = Math.min(G, Math.ceil((r.bottom - box.top) / box.height * G));
    for (var y = y0; y < y1; y++) for (var x = x0; x < x1; x++) cells[y * G + x] = 1;
  }
  var media = Array.from(root.querySelectorAll('img,svg,canvas,video,[data-ge-chart],[data-ge-gallery]'));
  media.forEach(function (m) { var r = m.getBoundingClientRect(); if (r.width * r.height > 4) { mark(r); biggest = Math.max(biggest, r.width * r.height / area); } });
  seen.forEach(function (el) { var r = el.getBoundingClientRect(); mark(r); biggest = Math.max(biggest, r.width * r.height / area); });
  var covered = 0; for (var i = 0; i < cells.length; i++) covered += cells[i];
  function rel(el) { if (!el) return null; var r = el.getBoundingClientRect(); return { x: (r.left - box.left) / box.width, y: (r.top - box.top) / box.height, w: r.width / box.width, h: r.height / box.height }; }
  var regions = {};
  var title = root.querySelector('[data-ge-key="title"]') || Array.from(seen).sort(function (a, b) { return parseFloat(getComputedStyle(b).fontSize) - parseFloat(getComputedStyle(a).fontSize); })[0];
  if (title) regions.title = rel(title);
  var logo = root.querySelector('[data-ge-logo], img[src*="logo"]');
  if (logo) regions.logo = rel(logo);
  var main = media.sort(function (a, b) { var p = a.getBoundingClientRect(), q = b.getBoundingClientRect(); return q.width * q.height - p.width * p.height; })[0];
  if (main && main !== logo) regions.visual = rel(main);
  return { sizes: distinct.length, hierarchy: Math.round(largest / Math.max(1, median) * 100) / 100, coverage: Math.round(covered / cells.length * 1000) / 1000, focalArea: Math.round(biggest * 1000) / 1000, regions: regions };
})()`;

/** Ce que chaque zone d'une page assemblée doit réduire pour tenir dans sa case de la grille. */
const ZONE_FITS = `(function () {
  var out = {};
  document.querySelectorAll('[data-ge-zone]').forEach(function (z) {
    var box = z.getBoundingClientRect();
    if (box.width < 2 || box.height < 2) return;
    var bottom = box.top, right = box.left;
    var tw = document.createTreeWalker(z, NodeFilter.SHOW_TEXT);
    for (var n = tw.nextNode(); n; n = tw.nextNode()) {
      if (!n.textContent.trim()) continue;
      var rg = document.createRange(); rg.selectNodeContents(n); var r = rg.getBoundingClientRect();
      if (r.width && r.height) { bottom = Math.max(bottom, r.bottom); right = Math.max(right, r.right); }
    }
    z.querySelectorAll('img,canvas,[data-ge-chart],[data-ge-gallery],table').forEach(function (m) { var q = m.getBoundingClientRect(); if (q.width && q.height) { bottom = Math.max(bottom, q.bottom); right = Math.max(right, q.right); } });
    var need = Math.max((bottom - box.top) / box.height, (right - box.left) / box.width);
    out[z.getAttribute('data-ge-zone')] = need > 1.005 ? Math.floor((0.985 / need) * 1000) / 1000 : 1;
  });
  return out;
})()`;

/**
 * L'ÉTENDUE du contenu d'une toile fixe : l'échelle qui ramène tout le texte et toutes les images à l'intérieur.
 * Rien à faire si le contenu tient, ni s'il déborde par le haut ou la gauche (une réduction ne le ramènerait pas).
 */
const EXTENT = `(function () {
  var root = document.querySelector('.ge-page');
  var box = root.getBoundingClientRect();
  var bottom = box.top, right = box.left, top = box.bottom, left = box.right;
  function take(r) { if (r.width < 1 || r.height < 1) return; bottom = Math.max(bottom, r.bottom); right = Math.max(right, r.right); top = Math.min(top, r.top); left = Math.min(left, r.left); }
  var tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (var n = tw.nextNode(); n; n = tw.nextNode()) {
    if (!n.textContent.trim() || !n.parentElement || n.parentElement.closest('svg,template')) continue;
    var rg = document.createRange(); rg.selectNodeContents(n); take(rg.getBoundingClientRect());
  }
  root.querySelectorAll('img,canvas,[data-ge-chart],[data-ge-gallery]').forEach(function (m) { var q = m.getBoundingClientRect(); if (q.width * q.height < box.width * box.height * 0.6) take(q); });
  if (top < box.top - 2 || left < box.left - 2) return 0;
  var need = Math.max((bottom - box.top) / box.height, (right - box.left) / box.width);
  return need > 1.005 ? 0.985 / need : 1;
})()`;

/** Chart.js, pour DESSINER les graphiques de la page avant la photographie (le relecteur doit les voir). */
let chartJs: string | null | undefined;
function chartJsSource(): string | null {
  if (chartJs === undefined) {
    try {
      chartJs = fs.readFileSync(path.join(path.dirname(require.resolve('chart.js')), 'chart.umd.min.js'), 'utf8');
    } catch {
      chartJs = null;
    }
  }
  return chartJs;
}

const BUILD_CHARTS = `(function () {
  if (!window.Chart) return 0;
  var n = 0;
  document.querySelectorAll('canvas[data-idem-chart]').forEach(function (c) {
    try { var cfg = JSON.parse(c.getAttribute('data-idem-chart')); cfg.options = cfg.options || {}; cfg.options.animation = false; cfg.options.responsive = true; cfg.options.maintainAspectRatio = false; new window.Chart(c, cfg); n++; } catch (e) {}
  });
  return n;
})()`;

const PROBE = `(function () {
  var root = document.querySelector('.ge-page');
  if (!root) return { error: 'the page root is missing' };
  var box = root.getBoundingClientRect();
  if (box.width < 2 || box.height < 2) return { error: 'the page has no size (' + Math.round(box.width) + 'x' + Math.round(box.height) + ')' };
  var visible = 0;
  var all = root.querySelectorAll('*');
  for (var i = 0; i < all.length && visible < 3; i++) {
    var el = all[i];
    var cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) continue;
    var r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    if (r.right <= box.left || r.left >= box.right || r.bottom <= box.top || r.top >= box.bottom) continue;
    var tag = el.tagName.toLowerCase();
    if (tag === 'img' || tag === 'svg' || tag === 'video' || tag === 'canvas') { visible++; continue; }
    for (var c = el.firstChild; c; c = c.nextSibling) if (c.nodeType === 3 && c.textContent.trim()) { visible++; break; }
  }
  if (!visible) return { error: 'nothing is visible inside the canvas (no text, image or drawing within ' + Math.round(box.width) + 'x' + Math.round(box.height) + ' px)' };
  // Un texte coupé par le bord ne s'affiche pas (en entier). Page FIXE : les quatre bords. Page de FLUX
  // (business plan) : la hauteur grandit, mais la largeur est celle du papier — un tableau ou une rangée de
  // chiffres plus large que la page sort du PDF par la droite, colonnes décalées et chiffres rognés.
  var fixed = root.getAttribute('data-ge-fixed') === '1';
  {
    var cut = [];
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (var n = walker.nextNode(); n && cut.length < 4; n = walker.nextNode()) {
      if (!n.textContent.trim() || !n.parentElement || n.parentElement.closest('svg,template')) continue;
      var cs = getComputedStyle(n.parentElement);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      var range = document.createRange();
      range.selectNodeContents(n);
      var r = range.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      if (fixed && (r.bottom > box.bottom + 2 || r.top < box.top - 2) || r.right > box.right + 2 || r.left < box.left - 2) cut.push('"' + n.textContent.trim().slice(0, 40) + '" (' + Math.round(Math.max(fixed ? r.bottom - box.bottom : 0, r.right - box.right, fixed ? box.top - r.top : 0, box.left - r.left)) + ' px outside)');
    }
    if (cut.length) return { error: fixed
      ? 'text is cut off by the edge of the canvas: ' + cut.join(', ') + ' — the content must fit inside ' + Math.round(box.width) + 'x' + Math.round(box.height) + ' px (less space for decoration, smaller or fewer elements; never remove a content key)'
      : 'text is cut off by the edge of the canvas: ' + cut.join(', ') + ' — the page is ' + Math.round(box.width) + ' px wide and may grow downwards only: wrap wide tables and rows of figures (fewer columns, stacked rows, smaller figures, no fixed widths or negative margins); never remove a content key' };
  }
  // Un texte RECOUVERT par un élément peint (forme, image, aplat) ne se lit pas.
  var unlock = document.createElement('style');
  unlock.textContent = '.ge-page, .ge-page * { pointer-events: auto !important; }';
  document.head.appendChild(unlock);
  // Une couleur peinte, quelle que soit sa notation (rgb, color(srgb …), oklab…) : seule une alpha nulle ne peint pas.
  function opaque(c) {
    if (!c || c === 'transparent') return false;
    var a = c.match(/rgba\\([^)]*,\\s*([\\d.]+)\\)/) || c.match(/\\/\\s*([\\d.]+%?)\\s*\\)$/);
    if (!a) return true;
    var v = parseFloat(a[1]) / (/%$/.test(a[1]) ? 100 : 1);
    return v > 0.04;
  }
  function paints(el) {
    var cs = getComputedStyle(el);
    if (parseFloat(cs.opacity) < 0.04) return false;
    var tag = el.tagName.toLowerCase();
    if (tag === 'img' || tag === 'svg' || tag === 'video' || tag === 'figure' || tag === 'canvas') return true;
    if (cs.backgroundImage && cs.backgroundImage !== 'none') return true;
    return opaque(cs.backgroundColor);
  }
  var covered = [];
  var tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (var t = tw.nextNode(); t && covered.length < 4; t = tw.nextNode()) {
    var host = t.parentElement;
    if (!t.textContent.trim() || !host || host.closest('svg,template,[data-ge-gallery]')) continue;
    var hs = getComputedStyle(host);
    if (hs.visibility === 'hidden' || hs.display === 'none' || parseFloat(hs.opacity) === 0) continue;
    var rg = document.createRange();
    rg.selectNodeContents(t);
    var rr = rg.getBoundingClientRect();
    if (rr.width < 2 || rr.height < 2) continue;
    var hits = 0, probes = 0;
    [0.2, 0.5, 0.8].forEach(function (fx) {
      var x = rr.left + rr.width * fx, y = rr.top + rr.height / 2;
      if (x < box.left || x > box.right || y < box.top || y > box.bottom) return;
      probes++;
      var top = document.elementFromPoint(x, y);
      if (top && top !== host && !host.contains(top) && !top.contains(host) && paints(top)) hits++;
    });
    // Un texte court (« 2028 ») peut être caché par un seul rond : un point touché suffit.
    if (probes && (hits >= 2 || (hits >= 1 && t.textContent.trim().length <= 8))) covered.push('"' + t.textContent.trim().slice(0, 40) + '"');
  }
  unlock.remove();
  if (covered.length) return { error: 'text is covered by another element (a shape, panel or image on top of it): ' + covered.join(', ') + ' — nothing may sit on top of a text; move or remove the shape, never the text' };
  return { width: box.width, height: box.height };
})()`;

/**
 * L'ORDRE DE LA PAGE, mesuré — ce qui rend une page désordonnée ou amateur, quel que soit le modèle :
 *
 *   - un texte posé sur un autre texte ;
 *   - un actif de la marque (logo, déclinaison) rogné par le bord, par son conteneur ou par `object-cover` ;
 *   - un actif de la marque trop petit sur la page qui existe pour le montrer ;
 *   - un cadre vide (carte, pastille, avatar, emplacement) : une forme peinte qui ne porte rien et ne sert de fond
 *     à rien ;
 *   - un semis de formes décoratives (fausse grille, faux schéma, ronds) au-delà de quelques repères.
 *
 * Chaque mesure renvoie la page à l'auteur avec une consigne ; la mise en page reste la sienne.
 */
export interface QualityFrame {
  /** Les adresses des actifs de la marque montrés par la page (logo, déclinaisons). */
  assets?: string[];
  /** Le plus grand actif doit couvrir au moins cette part de la largeur OU de la hauteur de la page. */
  minAssetSide?: number;
  /** Les aplats vides sont le contenu (nuancier, spécimens) : pas de contrôle des cadres vides. */
  allowEmptyShapes?: boolean;
  /** Le rôle des textes de la page, par clé : un texte simple (`text`) ne se compose jamais comme le titre. */
  roles?: Record<string, 'title' | 'text'>;
  /** Les couleurs d'un nuancier : chacune doit être PEINTE (un aplat), pas seulement écrite. */
  swatches?: string[];
  /** La clé du nom de chaque couleur (même ordre) : il se pose SUR ou CONTRE son aplat. */
  swatchKeys?: string[][];
  /** Le fond pour lequel chaque logo est fait : un logo « fond sombre » se pose sur un aplat sombre. */
  grounds?: Array<{ src: string; ground: 'light' | 'dark' }>;
  /** Fond sombre de page admis (demande explicite) ; sinon la page reste claire. */
  allowDark?: boolean;
  /** L'adresse du logo « sur fond sombre » : sur un aplat sombre, c'est lui ; sur fond clair, jamais lui. */
  logoOnDark?: string;
}

export const QUALITY = (f: QualityFrame) => `(function (f) {
  var root = document.querySelector('.ge-page');
  var box = root.getBoundingClientRect();
  var pageArea = box.width * box.height;
  var errors = [];
  function short(t) { return '"' + t.trim().replace(/\\s+/g, ' ').slice(0, 36) + '"'; }
  function visible(el) {
    for (var e = el; e && e !== document.body; e = e.parentElement) {
      var cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.04) return false;
    }
    return true;
  }
  // 1. Texte sur texte : deux lignes de deux éléments distincts qui se chevauchent.
  var lines = [];
  var tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (var t = tw.nextNode(); t && lines.length < 600; t = tw.nextNode()) {
    var host = t.parentElement;
    if (!t.textContent.trim() || !host || host.closest('svg,template,[data-ge-gallery],[data-ge-chart]') || !visible(host)) continue;
    var rg = document.createRange();
    rg.selectNodeContents(t);
    var rs = rg.getClientRects();
    for (var i = 0; i < rs.length; i++) if (rs[i].width > 2 && rs[i].height > 2) lines.push({ r: rs[i], host: host, text: t.textContent });
  }
  var clash = [];
  for (var a = 0; a < lines.length && clash.length < 3; a++) {
    for (var b = a + 1; b < lines.length; b++) {
      var A = lines[a], B = lines[b];
      if (A.host === B.host || A.host.contains(B.host) || B.host.contains(A.host)) continue;
      var w = Math.min(A.r.right, B.r.right) - Math.max(A.r.left, B.r.left);
      var h = Math.min(A.r.bottom, B.r.bottom) - Math.max(A.r.top, B.r.top);
      if (w <= 0 || h <= 0) continue;
      var smaller = Math.min(A.r.width * A.r.height, B.r.width * B.r.height);
      if (w * h > smaller * 0.25) { clash.push(short(A.text) + ' over ' + short(B.text)); break; }
    }
  }
  if (clash.length) errors.push('texts are written on top of each other: ' + clash.join('; ') + ' — give each text its own space (stack or separate the zones)');
  // 1 bis. Un texte LONG se lit au corps du texte, sur une largeur de lecture : un paragraphe composé à la taille d'un
  // titre, ou serré dans une colonne étroite, s'étire sur des pages (business plan) ou déborde (slide).
  var base = parseFloat(getComputedStyle(root).fontSize) || 16;
  var seen = [], loud = [], narrow = [];
  lines.forEach(function (ln) {
    var block = ln.host;
    while (block !== root && getComputedStyle(block).display.indexOf('inline') === 0) block = block.parentElement;
    if (seen.indexOf(block) >= 0) return;
    seen.push(block);
    var words = (block.textContent || '').trim().split(/\\s+/).filter(Boolean).length;
    if (words < 30) return;
    var size = parseFloat(getComputedStyle(ln.host).fontSize) || base;
    var r = block.getBoundingClientRect();
    if (size > base * 1.45) loud.push(short(block.textContent) + ' (' + words + ' words at ' + Math.round(size) + ' px)');
    else if (r.width < box.width * 0.3 && words > 45) narrow.push(short(block.textContent) + ' (' + words + ' words in ' + Math.round(r.width) + ' px)');
  });
  if (loud.length) errors.push('a long text is set at title size: ' + loud.slice(0, 2).join('; ') + ' — set paragraphs at the body size (' + Math.round(base) + ' px); only titles, short statements and figures are large');
  if (narrow.length) errors.push('a long text is squeezed into a narrow column: ' + narrow.slice(0, 2).join('; ') + ' — give paragraphs a reading width (about half the page or more)');
  // 1 ter. Un texte posé SUR un mockup, un graphique ou un logo les cache : chacun a sa place.
  var shown = [];
  root.querySelectorAll('[data-ge-gallery],[data-ge-chart],img[data-ge-logo]').forEach(function (m) { if (visible(m)) shown.push(m); });
  (f.assets || []).forEach(function (src) { root.querySelectorAll('img').forEach(function (img) { if (img.getAttribute('src') === src && visible(img)) shown.push(img); }); });
  var over = [];
  lines.forEach(function (ln) {
    if (over.length >= 2) return;
    shown.forEach(function (m) {
      if (m.contains(ln.host)) return;
      var q = m.getBoundingClientRect();
      var w = Math.min(ln.r.right, q.right) - Math.max(ln.r.left, q.left);
      var h = Math.min(ln.r.bottom, q.bottom) - Math.max(ln.r.top, q.top);
      if (w > 0 && h > 0 && w * h > ln.r.width * ln.r.height * 0.3 && over.indexOf(short(ln.text)) < 0) over.push(short(ln.text));
    });
  });
  if (over.length) errors.push('text is written over a mockup, chart or logo: ' + over.slice(0, 2).join(', ') + ' — give the text its own zone beside or above it');
  // 1 ter bis. Un texte à CHEVAL sur le bord d'un aplat (un titre qui traverse des blocs de couleur) : ni dedans, ni
  // dehors, il se lit mal et paraît posé par erreur.
  var straddle = [];
  var panels = [];
  root.querySelectorAll('*').forEach(function (el) {
    if (el === root || !visible(el)) return;
    var cs = getComputedStyle(el);
    var c = cs.backgroundColor;
    var painted = cs.backgroundImage !== 'none' || (c && c !== 'transparent' && !/rgba\\([^)]*,\\s*0(\\.0+)?\\)/.test(c));
    if (!painted || el.closest('[data-ge-chart],[data-ge-gallery],[data-ge-pattern]:not(.ge-page),[data-ge-pattern-tile],table')) return;
    var q = el.getBoundingClientRect();
    if (q.width * q.height < pageArea * 0.01 || q.width * q.height > pageArea * 0.9) return;
    panels.push({ el: el, q: q });
  });
  lines.forEach(function (ln) {
    if (straddle.length >= 2) return;
    panels.forEach(function (p) {
      if (p.el.contains(ln.host)) return;
      var r = ln.r, q = p.q;
      var w = Math.min(r.right, q.right) - Math.max(r.left, q.left), h = Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top);
      if (w <= 0 || h <= 0) return;
      var part = (w * h) / (r.width * r.height);
      // Le moindre empiètement visible (4 % de la ligne, ou 6 px) suffit : un titre qui mord un aplat est une faute.
      if ((part > 0.04 || w >= 6) && part < 0.88 && straddle.indexOf(short(ln.text)) < 0) straddle.push(short(ln.text));
    });
  });
  if (straddle.length) errors.push('text straddles the edge of a coloured block: ' + straddle.join(', ') + ' — put the text fully inside the block or fully outside it, never across its edge');
  // 1 ter ter. Les chiffres d'un tableau ne se coupent jamais sur deux lignes : le tableau est trop étroit.
  var wrapped = [];
  root.querySelectorAll('td,th').forEach(function (cell) {
    if (wrapped.length >= 2 || !visible(cell)) return;
    var txt = (cell.textContent || '').trim();
    if (!/^[-+−]?[\\d\\s.,%]+[A-Za-z%€$]{0,4}$/.test(txt) || txt.length < 4) return;
    var rg = document.createRange(); rg.selectNodeContents(cell);
    var rows = {};
    [].slice.call(rg.getClientRects()).forEach(function (q) { if (q.width > 1) rows[Math.round(q.top)] = 1; });
    if (Object.keys(rows).length > 1) wrapped.push('"' + txt.slice(0, 20) + '"');
  });
  if (wrapped.length) errors.push('figures of a table wrap onto two lines: ' + wrapped.join(', ') + ' — give the table more width (full width, or fewer columns side by side), never squeeze it into a narrow column');
  // 1 quater. La hiérarchie : un texte simple (légende, libellé, description, paragraphe) n'est jamais composé comme le
  // titre, et le titre reste le texte dominant.
  if (f.roles) {
    var titleSize = 0, loudest = null, loudSize = 0;
    root.querySelectorAll('[data-ge-k]').forEach(function (sp) {
      if (!visible(sp)) return;
      var role = f.roles[sp.getAttribute('data-ge-k')];
      var size = parseFloat(getComputedStyle(sp).fontSize) || 0;
      if (role === 'title') titleSize = Math.max(titleSize, size);
      else if (role === 'text' && size > loudSize) { loudSize = size; loudest = sp; }
    });
    if (loudest && loudSize > Math.max(base * 1.6, titleSize * 0.72)) errors.push('a plain text is set like a title: ' + short(loudest.textContent) + ' at ' + Math.round(loudSize) + ' px' + (titleSize ? ' (the title is ' + Math.round(titleSize) + ' px)' : '') + ' — set labels, captions and descriptions small (' + Math.round(base) + '–' + Math.round(base * 1.3) + ' px); only the title is large');
  }
  // 1 quinquies. Le nuancier : chaque couleur est peinte en aplat, pas seulement écrite.
  if (f.swatches && f.swatches.length) {
    var painted = [];
    root.querySelectorAll('*').forEach(function (el) {
      var q = el.getBoundingClientRect();
      if (q.width < 24 || q.height < 24 || !visible(el)) return;
      var m = (getComputedStyle(el).backgroundColor.match(/[\\d.]+/g) || []).map(Number);
      if (m.length >= 3) painted.push(m[0] + ',' + m[1] + ',' + m[2]);
    });
    var missingHex = f.swatches.filter(function (hex) {
      var h = hex.replace('#', '');
      if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
      var rgb = [0, 2, 4].map(function (i) { return parseInt(h.slice(i, i + 2), 16); }).join(',');
      return painted.indexOf(rgb) < 0;
    });
    if (missingHex.length) errors.push('the palette colours are written but not shown: ' + missingHex.slice(0, 4).join(', ') + ' — paint each colour as a large block (class bg-[' + missingHex[0] + ']) with its name and code beside it');
    else {
      // Chaque couleur a SON grand aplat ; son nom et son code sont dessus ou contre lui.
      var minSide = Math.min(box.width, box.height) * 0.14;
      var tiny = [], far = [];
      f.swatches.forEach(function (hex, i) {
        var h = hex.replace('#', ''); if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
        var rgb = [0, 2, 4].map(function (k) { return parseInt(h.slice(k, k + 2), 16); }).join(',');
        var best = null, area = 0;
        root.querySelectorAll('*').forEach(function (el) {
          if (!visible(el)) return;
          var m = (getComputedStyle(el).backgroundColor.match(/[\\d.]+/g) || []).map(Number);
          if (m.length < 3 || m.slice(0, 3).join(',') !== rgb) return;
          var q = el.getBoundingClientRect();
          if (q.width * q.height > area) { area = q.width * q.height; best = q; }
        });
        if (!best) return;
        if (Math.min(best.width, best.height) < minSide) tiny.push(hex);
        ((f.swatchKeys || [])[i] || []).forEach(function (key) {
          var sp = root.querySelector('[data-ge-k="' + key + '"]');
          if (!sp || !visible(sp)) return;
          var t = sp.getBoundingClientRect();
          var dx = Math.max(0, best.left - t.right, t.left - best.right), dy = Math.max(0, best.top - t.bottom, t.top - best.bottom);
          if (Math.max(dx, dy) > Math.max(48, Math.min(best.width, best.height) * 0.6) && far.indexOf(hex) < 0) far.push(hex);
        });
      });
      if (tiny.length) errors.push('the palette swatches are too small: ' + tiny.slice(0, 3).join(', ') + ' — each colour is a LARGE block (at least ' + Math.round(minSide) + ' px on its short side); the colours are the subject of this page');
      if (far.length) errors.push('a colour name or code is far from its colour block: ' + far.slice(0, 3).join(', ') + ' — put each name and code on its block or right against it');
    }
  }
  // 2. Les actifs de la marque : entiers, jamais rognés ni recadrés.
  var assets = [];
  root.querySelectorAll('img').forEach(function (img) {
    var src = img.getAttribute('src') || '';
    if (img.hasAttribute('data-ge-logo') || (f.assets || []).indexOf(src) >= 0) assets.push(img);
  });
  var cropped = [];
  var biggest = 0;
  assets.forEach(function (img) {
    if (!visible(img)) return;
    var r = img.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return;
    var l = Math.max(r.left, box.left), tp = Math.max(r.top, box.top), rr = Math.min(r.right, box.right), bt = Math.min(r.bottom, box.bottom);
    for (var e = img.parentElement; e && e !== root.parentElement; e = e.parentElement) {
      var cs = getComputedStyle(e);
      if (cs.overflow === 'visible' && cs.overflowX === 'visible' && cs.overflowY === 'visible') continue;
      var er = e.getBoundingClientRect();
      l = Math.max(l, er.left); tp = Math.max(tp, er.top); rr = Math.min(rr, er.right); bt = Math.min(bt, er.bottom);
    }
    var shown = Math.max(0, rr - l) * Math.max(0, bt - tp);
    var fit = getComputedStyle(img).objectFit;
    if (shown < r.width * r.height * 0.97 || fit === 'cover' || fit === 'none') cropped.push(img.hasAttribute('data-ge-logo') ? 'the logo' : 'a brand asset image');
    if (!img.hasAttribute('data-ge-logo')) biggest = Math.max(biggest, Math.min(1, Math.max(r.width / box.width, r.height / box.height)));
  });
  if (cropped.length) errors.push('the brand asset is cropped (' + cropped.slice(0, 2).join(', ') + ' cut by the edge, its container or object-cover) — show it WHOLE with object-contain, inside the canvas');
  var shownAssets = assets.filter(function (img) { return !img.hasAttribute('data-ge-logo') && visible(img); }).length;
  // Chaque actif de la page, à une taille lisible (pas un seul sur trois).
  var hidden = (f.assets || []).filter(function (src) {
    return !assets.some(function (img) { var q = img.getBoundingClientRect(); return img.getAttribute('src') === src && visible(img) && Math.max(q.width, q.height) >= 48; });
  });
  if ((f.assets || []).length && !shownAssets) errors.push('the brand asset image is not shown — place it with <img src="{{…url}}" class="object-contain">, whole and readable');
  else if (hidden.length) errors.push(hidden.length + ' brand asset image(s) of this page are missing or tiny — show EVERY logo variant of the CONTENT with its <img src="{{…url}}">, each at least 120 px');
  else if (f.minAssetSide && (f.assets || []).length && biggest < f.minAssetSide) errors.push('the brand asset is the subject of this page but is shown small (' + Math.round(biggest * 100) + '% of the page) — make it at least ' + Math.round(f.minAssetSide * 100) + '% of the page width or height');
  // Le fond du logo : la déclinaison « fond sombre » sur un aplat sombre, « fond clair » sur un fond clair.
  function lum(c) { var m = (c.match(/[\\d.]+/g) || []).map(Number); if (m.length < 3) return 1; return (0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]) / 255; }
  function groundOf(el) {
    for (var e = el.parentElement; e; e = e.parentElement) { var cs = getComputedStyle(e); if (opaqueBg(cs.backgroundColor)) return lum(cs.backgroundColor); }
    return 1;
  }
  function opaqueBg(c) { if (!c || c === 'transparent') return false; var a = c.match(/rgba\\([^)]*,\\s*([\\d.]+)\\)/); return !a || parseFloat(a[1]) > 0.5; }
  (f.grounds || []).forEach(function (g) {
    root.querySelectorAll('img').forEach(function (img) {
      if (img.getAttribute('src') !== g.src || !visible(img)) return;
      var L = groundOf(img);
      if (g.ground === 'dark' && L > 0.45) errors.push('the dark-ground logo sits on a light ground — put it on a dark panel (bg-ink or a deep brand colour) sized around the logo');
      if (g.ground === 'light' && L < 0.35) errors.push('the light-ground logo sits on a dark ground — put it on the light page ground');
    });
  });
  // Le repère logo (<idem-logo>) : sur un aplat sombre, la déclinaison claire ; sur fond clair, jamais elle.
  if (f.logoOnDark) {
    root.querySelectorAll('img[data-ge-logo]').forEach(function (img) {
      if (!visible(img)) return;
      var L = groundOf(img), onDark = img.getAttribute('src') === f.logoOnDark;
      if (L < 0.45 && !onDark && errors.indexOf('the logo sits on a dark ground — use <idem-logo variant="onDark">') < 0) errors.push('the logo sits on a dark ground — use <idem-logo variant="onDark">');
      if (L > 0.6 && onDark && errors.indexOf('the light logo sits on a light ground — use <idem-logo variant="primary">') < 0) errors.push('the light logo sits on a light ground — use <idem-logo variant="primary">');
    });
  }
  // Une image coupée par le bord de la page.
  if (root.getAttribute('data-ge-fixed') === '1') {
    root.querySelectorAll('img').forEach(function (img) {
      if (!visible(img) || img.closest('[data-ge-pattern]:not(.ge-page),[data-ge-pattern-tile]')) return;
      var q = img.getBoundingClientRect();
      var area = q.width * q.height;
      if (area < 400 || area > pageArea * 0.6) return;
      var vis = Math.max(0, Math.min(q.right, box.right) - Math.max(q.left, box.left)) * Math.max(0, Math.min(q.bottom, box.bottom) - Math.max(q.top, box.top));
      if (vis < area * 0.95 && errors.indexOf('an image is cut by the page edge — keep every image inside the page') < 0) errors.push('an image is cut by the page edge — keep every image inside the page');
    });
  }
  // Une image cassée (adresse illisible) laisse un cadre vide.
  root.querySelectorAll('img').forEach(function (img) {
    if (visible(img) && img.complete && img.naturalWidth === 0 && /^data:/.test(img.getAttribute('src') || '') && errors.indexOf('an image is broken') < 0) errors.push('an image is broken');
  });
  // La politique de surface claire : pas de page sombre (un panneau sombre, oui, quand un logo l'exige).
  if (!f.allowDark) {
    var darkArea = 0;
    var rootBg = getComputedStyle(root).backgroundColor;
    if (opaqueBg(rootBg) && lum(rootBg) < 0.3) darkArea = pageArea;
    root.querySelectorAll('*').forEach(function (el) {
      if (darkArea >= pageArea * 0.55) return;
      var cs = getComputedStyle(el);
      if (!opaqueBg(cs.backgroundColor) || lum(cs.backgroundColor) >= 0.3 || !visible(el)) return;
      var q = el.getBoundingClientRect();
      if (q.width * q.height >= pageArea * 0.55) darkArea = q.width * q.height;
    });
    if (darkArea >= pageArea * 0.55) errors.push('the page is dark — brand pages stay on a light ground; use a dark panel only around a dark-ground logo');
  }
  // 3. Les cadres vides et le semis de formes : une forme peinte qui ne porte rien et ne sert de fond à rien.
  // Ce qu'une forme peut porter en fond : un texte, ou un média d'une taille réelle (une pastille d'icône ne suffit pas).
  var media = [];
  root.querySelectorAll('img,svg,canvas,video,[data-ge-chart],[data-ge-pattern]:not(.ge-page),[data-ge-pattern-tile],[data-ge-gallery]').forEach(function (m) { if (visible(m)) media.push(m.getBoundingClientRect()); });
  function opaque(c) {
    if (!c || c === 'transparent') return false;
    var a = c.match(/rgba\\([^)]*,\\s*([\\d.]+)\\)/) || c.match(/\\/\\s*([\\d.]+%?)\\s*\\)$/);
    if (!a) return true;
    var v = parseFloat(a[1]) / (/%$/.test(a[1]) ? 100 : 1);
    return v > 0.04;
  }
  function paints(el, cs) {
    if (cs.backgroundImage && cs.backgroundImage !== 'none') return true;
    if (opaque(cs.backgroundColor)) return true;
    return ['Top', 'Right', 'Bottom', 'Left'].some(function (s) { return parseFloat(cs['border' + s + 'Width']) > 0 && cs['border' + s + 'Style'] !== 'none'; });
  }
  var empty = [], decor = 0;
  var swatchRgb = (f.swatches || []).map(function (hex) { var h = hex.replace('#', ''); if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join(''); return [0, 2, 4].map(function (i) { return parseInt(h.slice(i, i + 2), 16); }).join(','); });
  root.querySelectorAll('*').forEach(function (el) {
    // (la racine porte elle-même data-ge-pattern="authored" : seuls les ancêtres SOUS elle comptent)
    var inPrimitive = el.closest('svg,[data-ge-chart],[data-ge-pattern]:not(.ge-page),[data-ge-pattern-tile],[data-ge-gallery],[data-ge-logo],table');
    if (el === root || (inPrimitive && inPrimitive !== root && root.contains(inPrimitive))) return;
    var tag = el.tagName.toLowerCase();
    if (['img', 'svg', 'canvas', 'video', 'hr', 'br'].indexOf(tag) >= 0) return;
    if (!visible(el)) return;
    var cs = getComputedStyle(el);
    if (!paints(el, cs)) return;
    var r = el.getBoundingClientRect();
    if (Math.min(r.width, r.height) < 6) return;
    if ((el.textContent || '').trim()) return;
    // Un aplat du nuancier EST le contenu (sa couleur est l'une de la palette).
    if (Math.min(r.width, r.height) >= Math.min(box.width, box.height) * 0.1 && swatchRgb.indexOf(((cs.backgroundColor.match(/[\\d.]+/g) || []).slice(0, 3).map(Number)).join(',')) >= 0) return;
    // Une pastille d'icône seule dans une grande carte ne la remplit pas : seul un média d'une taille réelle compte.
    var holds = false;
    el.querySelectorAll('img,svg,canvas,video').forEach(function (m) { var q = m.getBoundingClientRect(); if (q.width * q.height >= r.width * r.height * 0.08) holds = true; });
    if (holds) return;
    var inside = function (q) { var cx = q.left + q.width / 2, cy = q.top + q.height / 2; return cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom; };
    var backs = lines.some(function (ln) { return inside(ln.r); }) || media.some(function (q) { return inside(q) && q.width * q.height >= r.width * r.height * 0.08; });
    if (backs) return;
    decor++;
    // Un cadre vide est COMPACT (carte, pastille, avatar, zone d'image) ; une bande ou un filet de marque est allongé.
    var compact = Math.max(r.width, r.height) / Math.min(r.width, r.height) <= 4;
    // Un GRAND aplat de couleur de la marque est un geste de mise en page (couverture, bandeau) ; une grande boîte
    // claire et neutre, ou un simple contour, est un emplacement réservé.
    var large = r.width * r.height >= pageArea * 0.15;
    var rgb = (cs.backgroundColor.match(/[\\d.]+/g) || []).map(Number);
    var neutral = cs.backgroundImage === 'none' && (!opaque(cs.backgroundColor) || (rgb.length >= 3 && Math.max(rgb[0], rgb[1], rgb[2]) - Math.min(rgb[0], rgb[1], rgb[2]) < 40 && (rgb[0] + rgb[1] + rgb[2]) / 3 > 200));
    if (large && !neutral) return;
    if (!f.allowEmptyShapes && compact && r.width * r.height >= pageArea * 0.012 && Math.min(r.width, r.height) >= 24) empty.push(Math.round(r.width) + 'x' + Math.round(r.height));
  });
  if (empty.length) errors.push('empty frames: ' + empty.length + ' painted box(es) (' + empty.slice(0, 3).join(', ') + ' px) hold nothing — remove them or put the content they stand for inside (no placeholder, no empty card, avatar or image zone)');
  else if (!f.allowEmptyShapes && decor > 10) errors.push('decoration noise: ' + decor + ' empty decorative shapes (dots, cells, rings, fake diagram) — keep at most a few brand marks; the content alone builds the page');
  return errors;
})(${JSON.stringify(f)})`;

export async function checkRender(html: string, head: string, format: FormatDef, o: { lang?: string; shoot?: boolean; quality?: QualityFrame; measure?: boolean } = {}): Promise<RenderCheck> {
  try {
    return await withPage(pageDocument(html, head, { lang: o.lang, background: '#ffffff' }), { width: format.width, height: format.height }, async (page) => {
      // Les graphiques sont dessinés (Chart.js) avant toute mesure et toute photographie : vides, ils passaient pour
      // des cadres vides aux yeux du relecteur.
      if (await page.$('canvas[data-idem-chart]')) {
        const source = engineHost().chartScript?.() ?? chartJsSource();
        if (source) {
          await page.addScriptTag({ content: source });
          await page.evaluate(BUILD_CHARTS);
        }
      }
      const probe = (await page.evaluate(PROBE)) as { error?: string; width?: number; height?: number };
      const zoneFits = (await page.$('[data-ge-zone]')) ? ((await page.evaluate(ZONE_FITS)) as Record<string, number>) : undefined;
      if (!probe.error && o.quality) {
        const faults = (await page.evaluate(QUALITY(o.quality))) as string[];
        if (faults.length) probe.error = faults.join(' | ');
      }
      // Texte coupé, recouvert, page désordonnée : la page s'affiche presque entière — gardée comme repli si la
      // correction échoue (livrée signalée plutôt que perdue).
      const cut = Boolean(probe.error && /cut off by the edge|covered by another element|on top of each other|brand asset|empty frames|decoration noise|long text|written over a mockup|set like a title|palette colours|logo sits on|cut by the page edge|image is broken|page is dark|straddles the edge|table wrap|logo sits on|light logo sits|swatches are too small|far from its colour/.test(probe.error));
      if (probe.error && !cut) return { ok: false, error: probe.error, ...(zoneFits ? { zoneFits } : {}) };
      // Un débordement d'une toile fixe : l'échelle qui le fait tenir, pour que le moteur l'applique lui-même.
      let fit: number | undefined;
      if (probe.error && /cut off by the edge/.test(probe.error) && format.kind === 'fixed') {
        const scale = Number(await page.evaluate(EXTENT));
        if (scale > 0 && scale < 1) fit = Math.floor(scale * 1000) / 1000;
      }
      let png: Buffer | undefined;
      const metrics = o.measure && !probe.error ? ((await page.evaluate(MEASURE).catch(() => null)) as RenderCheck['metrics'] | null) ?? undefined : undefined;
      if (o.shoot || o.measure) {
        const target = await page.$('.ge-page');
        if (target) png = Buffer.from(await target.screenshot({ type: 'png' }));
      }
      // Un texte coupé : la photographie est gardée (la page servira de repli si la correction échoue).
      if (cut) return { ok: false, cut: true, error: probe.error, ...(fit ? { fit } : {}), ...(zoneFits ? { zoneFits } : {}), ...(png ? { png } : {}) };
      return { ok: true, width: Math.round(probe.width ?? 0), height: Math.round(probe.height ?? 0), ...(png ? { png } : {}), ...(metrics ? { metrics } : {}) };
    });
  } catch (error) {
    const message = String((error as Error)?.message ?? error);
    if (/launch|Could not find (Chrome|Chromium|expected browser)|ECONNREFUSED|Target closed|Protocol error|Navigation timeout/i.test(message)) return { ok: true, infra: true, error: message.slice(0, 200) };
    return { ok: false, error: `the page could not be rendered: ${String((error as Error)?.message ?? error).slice(0, 200)}` };
  }
}

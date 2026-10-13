/**
 * La MESURE et l'AJUSTEMENT d'une page rendue, dans le vrai Chromium : ce que le lecteur verra, constaté
 * et corrigé au pixel, pas supposé.
 *
 * Ajustement (dans cet ordre, chaque étape remesurée) :
 *  1. un texte marqué `data-ge-fit` (titre, chiffre, citation) qui déborde de sa boîte est réduit jusqu'à
 *     tenir — jamais sous sa taille minimale lisible ;
 *  2. un aplat (`data-ge-surface`) garde son texte à l'intérieur : ses grands textes cèdent d'abord ;
 *  3. une toile fixe qui déborde réduit d'abord ses plus grands titres (le titre cède avant le contenu) ;
 *  4. une diapositive trop vide agrandit son corps (au plus 130 %), tant qu'elle ne déborde pas.
 *
 * Mesure : débordements (le contenu à fond perdu est mesuré contre le bord de la page), texte hors de son
 * aplat, chevauchements, remplissage (sur les éléments qui portent du contenu, pas sur les conteneurs
 * extensibles), contraste lu sur les couleurs calculées, polices et images chargées, silhouette mesurée.
 *
 * Le script exécuté dans la page est une chaîne (jamais transpilée) : cf. `browser.ts`.
 */
import type { FormatDef } from '../design-system/formats';
import { pageDocument, withPage, BrowserOptions } from './browser';

export interface Measurement {
  width: number;
  height: number;
  /** Dépassement vertical du contenu sous la zone utile (px), toiles fixes. */
  overflowPx: number;
  /** Dépassement horizontal (px), partout : texte plus large que sa boîte, contenu hors de la page. */
  overflowX: number;
  /** Texte sorti de son aplat (px). */
  panelOverflow: number;
  /** Part de la hauteur utile occupée par le contenu, 0..1. */
  fill: number;
  /** La plus grande bande verticale vide (fraction de la hauteur utile) : ce que l'œil voit comme un trou. */
  emptiness: number;
  minContrast: number;
  lowContrast: Array<{ text: string; ratio: number; need: number }>;
  overlaps: number;
  /** Les décors d'encre (formes, motifs) posés sur un texte : leurs indices dans `SectionSpec.decor`. */
  decorOverText: number[];
  missingImages: number;
  fontsLoaded: boolean;
  silhouette: string;
  contentHeight: number;
  usableHeight: number;
  /** Ce que l'ajustement a fait : pas de réduction, agrandissement (%), échelle finale des textes du corps, textes ramenés au contraste. */
  fitted: { shrunk: number; grown: number; textScale: number; recolored?: number };
}

export const RUNTIME_SCRIPT = `(function () {
  if (window.__ge) { return true; }
  var ge = window.__ge = {};
  function page() { return document.querySelector('.ge-page'); }
  function isDecor(el) { return !!(el.closest && el.closest('[data-ge-decor]')); }
  function ownText(el) { for (var i = 0; i < el.childNodes.length; i++) { var n = el.childNodes[i]; if (n.nodeType === 3 && n.textContent.trim()) { return true; } } return false; }
  function leaves(root) {
    var all = root.querySelectorAll('*'), out = [];
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (isDecor(el)) { continue; }
      var tag = el.tagName.toLowerCase();
      if (ownText(el) || tag === 'img' || tag === 'svg' || tag === 'table' || el.hasAttribute('data-ge-image')) {
        if (tag !== 'svg' && el.closest('svg')) { continue; }
        out.push(el);
      }
    }
    return out;
  }
  function box(p) {
    var pr = p.getBoundingClientRect(), cs = getComputedStyle(p);
    return { pr: pr, top: pr.top + (parseFloat(cs.paddingTop) || 0), bottom: pr.bottom - (parseFloat(cs.paddingBottom) || 0), left: pr.left + (parseFloat(cs.paddingLeft) || 0), right: pr.right - (parseFloat(cs.paddingRight) || 0) };
  }
  /** Un élément haut et étroit (titre tourné d'un rail, filet vertical) : il ne remplit pas la page aux yeux du lecteur. */
  function column(r, b) { return r.height > (b.bottom - b.top) * 0.6 && r.width < (b.right - b.left) * 0.2; }
  function overflowOf(p, fixed) {
    var b = box(p), ls = leaves(p), maxB = b.top, minT = b.bottom, fillB = b.top, fillT = b.bottom, ox = 0;
    for (var i = 0; i < ls.length; i++) {
      var r = ls[i].getBoundingClientRect();
      if (r.width < 0.5 || r.height < 0.5) { continue; }
      var bleed = !!ls[i].closest('[data-ge-bleed]');
      var limitR = bleed ? b.pr.right : b.right, limitL = bleed ? b.pr.left : b.left;
      if (r.bottom > maxB) { maxB = r.bottom; }
      if (r.top < minT) { minT = r.top; }
      if (!column(r, b)) { fillB = Math.max(fillB, r.bottom); fillT = Math.min(fillT, r.top); }
      ox = Math.max(ox, r.right - limitR, limitL - r.left);
    }
    var fits = p.querySelectorAll('p, h1, h2, h3, span, td, th, figcaption');
    for (var k = 0; k < fits.length; k++) { var t = fits[k]; if (!isDecor(t) && t.clientWidth > 0 && t.scrollWidth > t.clientWidth + 1) { ox = Math.max(ox, t.scrollWidth - t.clientWidth); } }
    var limitBottom = b.bottom;
    var over = 0;
    for (var j = 0; j < ls.length; j++) {
      var rr = ls[j].getBoundingClientRect();
      if (rr.width < 0.5 || rr.height < 0.5) { continue; }
      var lim = ls[j].closest('[data-ge-bleed]') ? b.pr.bottom : limitBottom;
      over = Math.max(over, rr.bottom - lim);
    }
    var usable = b.bottom - b.top;
    return { overflowPx: Math.max(0, Math.round(over)), overflowX: Math.max(0, Math.round(ox)), fill: usable > 0 ? Math.max(0, Math.min(1.5, (Math.min(fillB, b.bottom + 2000) - Math.min(fillT, b.bottom)) / usable)) : 1, contentHeight: Math.round(maxB - b.top), usableHeight: Math.round(usable) };
  }
  function panelOverflow(p) {
    var panels = p.querySelectorAll('[data-ge-surface]'), worst = 0, worstEl = null;
    for (var i = 0; i < panels.length; i++) {
      var pn = panels[i], r = pn.getBoundingClientRect(), ls = leaves(pn);
      for (var j = 0; j < ls.length; j++) {
        var q = ls[j].getBoundingClientRect();
        if (q.width < 0.5 || q.height < 0.5) { continue; }
        var d = Math.max(q.bottom - r.bottom, q.right - r.right, r.left - q.left, r.top - q.top);
        if (d > worst) { worst = d; worstEl = pn; }
      }
    }
    return { px: Math.max(0, Math.round(worst)), el: worstEl };
  }
  function px(el) { return parseFloat(getComputedStyle(el).fontSize) || 0; }
  function setPx(el, v) { el.style.fontSize = (Math.round(v * 10) / 10) + 'px'; }
  /** Les textes d'une portée (hors pied de page et décors), avec leur taille de départ mémorisée. */
  function textsOf(scope) {
    var all = scope.querySelectorAll('[style*="font-size"]'), out = [];
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      // Un texte tourné est déjà calé sur la hauteur de la page (étape 1 bis) : il ne suit pas l'échelle.
      if (isDecor(el) || el.closest('[data-ge-role="folio"]') || el.closest('svg') || el.closest('[data-ge-rot]')) { continue; }
      if (!el.hasAttribute('data-ge-fs')) { el.setAttribute('data-ge-fs', String(px(el))); }
      out.push(el);
    }
    return out;
  }
  /**
   * Mise à l'échelle PROPORTIONNELLE des textes d'une portée : la hiérarchie est conservée (le titre reste le
   * plus grand), et les aplats à fond perdu gardent leurs marges (un zoom global les décollerait du bord).
   */
  function scaleTexts(scope, k, minPx) {
    var ts = textsOf(scope);
    for (var i = 0; i < ts.length; i++) {
      var el = ts[i], base = parseFloat(el.getAttribute('data-ge-fs')) || px(el);
      var floor = Math.min(base, Math.max(minPx, parseFloat(el.getAttribute('data-ge-min')) * 0.9 || 0));
      setPx(el, Math.max(floor, base * k));
    }
  }
  /** La plus grande bande verticale vide du corps (fraction de la hauteur utile) : ce que l'œil voit comme un trou. */
  function emptiness(p) {
    var b = box(p), body = p.querySelector('[data-ge-body]') || p, ls = leaves(body), spans = [];
    for (var i = 0; i < ls.length; i++) {
      if (ls[i].closest('[data-ge-role="folio"]')) { continue; }
      var r = ls[i].getBoundingClientRect();
      if (r.height < 0.5 || r.width < 0.5 || column(r, b)) { continue; }
      spans.push([Math.max(b.top, r.top), Math.min(b.bottom, r.bottom)]);
    }
    var folio = body.querySelector('[data-ge-role="folio"]');
    var bottom = folio ? folio.getBoundingClientRect().top : b.bottom;
    spans.sort(function (a, c) { return a[0] - c[0]; });
    var cursor = b.top, gap = 0;
    for (var j = 0; j < spans.length; j++) { if (spans[j][0] > cursor) { gap = Math.max(gap, spans[j][0] - cursor); } cursor = Math.max(cursor, spans[j][1]); }
    gap = Math.max(gap, bottom - cursor);
    var usable = b.bottom - b.top;
    return usable > 0 ? Math.max(0, gap / usable) : 0;
  }
  ge.fit = function (opts) {
    var p = page(); if (!p) { return null; }
    var shrunk = 0, grown = 0, guard, k = 1;
    var minPx = opts.minPx || 8;
    // 1. Un texte plus large que sa boîte (un mot long, un chiffre sur une ligne) cède de la taille, seul.
    var fits = p.querySelectorAll('[data-ge-fit]');
    for (var i = 0; i < fits.length; i++) {
      var el = fits[i], min = parseFloat(el.getAttribute('data-ge-min')) || minPx;
      guard = 0;
      while (el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1 && px(el) > min + 0.2 && guard++ < 60) { setPx(el, Math.max(min, px(el) * 0.96)); shrunk++; }
    }
    // 1 bis. Un texte tourné court le long de la hauteur : plus haut que la page, il cède seul (sinon il
    // allonge son rail, pousse le pied de page dehors, et c'est toute la page qui rétrécirait).
    var rots = p.querySelectorAll('[data-ge-rot]'), pb = box(p);
    for (var ri = 0; ri < rots.length; ri++) {
      var rel = rots[ri], rmin = parseFloat(rel.getAttribute('data-ge-min')) || minPx, panel = rel.closest('[data-ge-surface]'), pcs = panel ? getComputedStyle(panel) : null;
      var room = (pb.bottom - pb.top) - (pcs ? (parseFloat(pcs.paddingTop) || 0) + (parseFloat(pcs.paddingBottom) || 0) : 0);
      guard = 0;
      while (rel.getBoundingClientRect().height > room - 1 && px(rel) > rmin + 0.2 && guard++ < 60) { setPx(rel, Math.max(rmin, px(rel) * 0.96)); shrunk++; }
    }
    // 2. Un aplat garde son texte : ses textes cèdent ensemble, proportionnellement.
    var panels = p.querySelectorAll('[data-ge-surface]');
    for (var q = 0; q < panels.length; q++) {
      var pk = 1;
      guard = 0;
      while (guard++ < 14) {
        var r = panels[q].getBoundingClientRect(), ls = leaves(panels[q]), over = 0;
        for (var j = 0; j < ls.length; j++) { var lr = ls[j].getBoundingClientRect(); if (lr.height > 0.5) { over = Math.max(over, lr.bottom - r.bottom, lr.right - r.right); } }
        if (over <= 1 || pk <= 0.72) { break; }
        pk = Math.round(pk * 0.95 * 100) / 100; scaleTexts(panels[q], pk, minPx); shrunk++;
      }
    }
    if (opts.fixed) {
      // 3. La page déborde : tous ses textes cèdent ensemble (la hiérarchie tient).
      guard = 0;
      var o = overflowOf(p, true);
      while (o.overflowPx > 1 && k > (opts.floor || 0.74) && guard++ < 14) { k = Math.round(k * 0.95 * 100) / 100; scaleTexts(p, k, minPx); shrunk++; o = overflowOf(p, true); }
      // 4. Une diapositive trop vide grandit, tant qu'elle ne déborde pas.
      if (opts.grow && k === 1 && o.overflowPx <= 1 && emptiness(p) > 0.26) {
        var best = 1;
        for (var z = 1.05; z <= 1.61; z += 0.05) {
          var zz = Math.round(z * 100) / 100;
          scaleTexts(p, zz, minPx);
          var oz = overflowOf(p, true);
          if (oz.overflowPx > 1 || oz.overflowX > 1 || panelOverflow(p).px > 1) { break; }
          best = zz;
          if (emptiness(p) < 0.16) { break; }
        }
        scaleTexts(p, best, minPx);
        if (best > 1) { grown = Math.round((best - 1) * 100); k = best; }
      }
    }
    return { shrunk: shrunk, grown: grown, textScale: k };
  };
  // Les mesures élémentaires, pour les contrôles et le diagnostic d'une page.
  ge.debug = { overflowOf: overflowOf, panelOverflow: panelOverflow, emptiness: emptiness, scaleTexts: scaleTexts, page: page };
  ge.measure = function (opts) {
    var p = page(); if (!p) { return null; }
    var pr = p.getBoundingClientRect();
    var o = overflowOf(p, opts.fixed), po = panelOverflow(p);
    function parse(c) { var m = c.match(/rgba?\\(([^)]+)\\)/); if (!m) { return null; } var q = m[1].split(',').map(function (x) { return parseFloat(x); }); return { r: q[0], g: q[1], b: q[2], a: q.length > 3 ? q[3] : 1 }; }
    function lum(c) { var f = function (v) { v = v / 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); }
    function ratio(a, b) { var la = lum(a), lb = lum(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); }
    function bg(el) { var n = el; while (n) { var c = parse(getComputedStyle(n).backgroundColor || ''); if (c && c.a > 0.6) { return c; } if (n === p) { break; } n = n.parentElement; } return parse(getComputedStyle(p).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 }; }
    var photo = !!p.querySelector('[data-ge-decor] [data-ge-image]');
    var texts = p.querySelectorAll('p, h1, h2, h3, li, td, th, figcaption, blockquote, span, a');
    var minC = 21, low = [];
    for (var k = 0; k < texts.length; k++) {
      var e = texts[k];
      if (isDecor(e) || !ownText(e)) { continue; }
      var s = getComputedStyle(e);
      var fg = parse(s.color); if (!fg || fg.a === 0) { continue; }
      var surfaced = e.closest('[data-ge-surface]');
      if (photo && !surfaced) { continue; }
      var size = parseFloat(s.fontSize), weight = parseInt(s.fontWeight, 10) || 400;
      var need = (size >= 24 || (size >= 18.66 && weight >= 700)) ? 3 : 4.5;
      var cr = ratio(fg, bg(e));
      if (cr < minC) { minC = cr; }
      if (cr < need - 0.05) { low.push({ text: (e.textContent || '').trim().slice(0, 60), ratio: Math.round(cr * 100) / 100, need: need }); }
    }
    var blocks = p.querySelectorAll('[data-ge-block], [data-ge-role="header"]');
    var rects = [];
    for (var b = 0; b < blocks.length; b++) { if (!isDecor(blocks[b])) { rects.push({ el: blocks[b], r: blocks[b].getBoundingClientRect() }); } }
    // Un corps sans bloc (points posés champ par champ, capture encadrée) occupe aussi la page : il compte.
    var bodies = p.querySelectorAll('[data-ge-role="body"]');
    for (var q = 0; q < bodies.length; q++) { if (!isDecor(bodies[q]) && !bodies[q].querySelector('[data-ge-block]')) { rects.push({ el: bodies[q], r: bodies[q].getBoundingClientRect() }); } }
    var overlaps = 0;
    for (var x = 0; x < rects.length; x++) for (var y = x + 1; y < rects.length; y++) {
      var A = rects[x], B = rects[y];
      if (A.el.contains(B.el) || B.el.contains(A.el)) { continue; }
      var ix = Math.min(A.r.right, B.r.right) - Math.max(A.r.left, B.r.left), iy = Math.min(A.r.bottom, B.r.bottom) - Math.max(A.r.top, B.r.top);
      if (ix > 3 && iy > 3) { overlaps++; }
    }
    var COLS = 12, ROWS = 8, cells = []; for (var c0 = 0; c0 < COLS * ROWS; c0++) { cells.push('.'); }
    for (var z = 0; z < rects.length; z++) {
      var R = rects[z].r, code = rects[z].el.getAttribute('data-ge-role') === 'header' ? 'H' : 'B';
      var x0 = Math.max(0, Math.floor((R.left - pr.left) / pr.width * COLS)), x1 = Math.min(COLS, Math.ceil((R.right - pr.left) / pr.width * COLS));
      var y0 = Math.max(0, Math.floor((R.top - pr.top) / pr.height * ROWS)), y1 = Math.min(ROWS, Math.ceil((R.bottom - pr.top) / pr.height * ROWS));
      for (var yy = y0; yy < y1; yy++) for (var xx = x0; xx < x1; xx++) { if (cells[yy * COLS + xx] !== 'H') { cells[yy * COLS + xx] = code; } }
    }
    // Un décor d'encre posé sur un texte (sa boîte couvre plus d'un dixième de celle du texte). Un texte posé
    // sur un aplat opaque le masque : il ne compte pas.
    function onSurface(el) { var n = el; while (n && n !== p) { var c = parse(getComputedStyle(n).backgroundColor || ''); if (c && c.a > 0.6) { return true; } n = n.parentElement; } return false; }
    var inks = p.querySelectorAll('[data-ge-decor][data-ge-ink]'), decorHits = [], words = [];
    if (inks.length) { var all = leaves(p); for (var w = 0; w < all.length; w++) { if (ownText(all[w]) && !onSurface(all[w])) { words.push(all[w].getBoundingClientRect()); } } }
    for (var d = 0; d < inks.length; d++) {
      var D = inks[d].getBoundingClientRect();
      for (var t = 0; t < words.length; t++) {
        var T = words[t], wx = Math.min(D.right, T.right) - Math.max(D.left, T.left), wy = Math.min(D.bottom, T.bottom) - Math.max(D.top, T.top);
        if (wx > 3 && wy > 3 && wx * wy > 0.1 * T.width * T.height) { decorHits.push(parseInt(inks[d].getAttribute('data-ge-decor'), 10)); break; }
      }
    }
    var imgs = p.querySelectorAll('img'), missing = 0;
    for (var m2 = 0; m2 < imgs.length; m2++) { if (!imgs[m2].complete || imgs[m2].naturalWidth === 0) { missing++; } }
    // Seules comptent les faces qu'un texte EMPLOIE, dans la graisse et le style où il les emploie. Une face
    // est chargée si UNE de ses déclarations l'est : la police déclarée deux fois (lien simple et lien à
    // graisses, cf. fonts.ts) garde un doublon jamais téléchargé, que \`document.fonts.check\` compterait.
    function loaded(family, weight, style) {
      var declared = false, exact = false, any = false;
      document.fonts.forEach(function (f) {
        if (f.family.replace(/['"]/g, '').trim() !== family) { return; }
        declared = true;
        if (f.status !== 'loaded') { return; }
        any = true;
        var w = String(f.weight).split(' '), lo = parseFloat(w[0]), hi = parseFloat(w[1] || w[0]);
        if (String(f.style) === style && weight >= lo && weight <= hi) { exact = true; }
      });
      return !declared || exact || any;
    }
    var faces = [], seen = {};
    for (var fi = 0; fi < texts.length && faces.length < 6; fi++) {
      if (isDecor(texts[fi]) || !ownText(texts[fi])) { continue; }
      var fcs = getComputedStyle(texts[fi]), fam = fcs.fontFamily.split(',')[0].replace(/['"]/g, '').trim(), key = fam + '|' + fcs.fontWeight + '|' + fcs.fontStyle;
      if (!seen[key]) { seen[key] = true; faces.push({ family: fam, weight: parseFloat(fcs.fontWeight) || 400, style: fcs.fontStyle === 'italic' ? 'italic' : 'normal' }); }
    }
    var fontsLoaded = faces.every(function (f) { try { return loaded(f.family, f.weight, f.style); } catch (err) { return true; } });
    return { width: pr.width, height: pr.height, overflowPx: opts.fixed ? o.overflowPx : 0, overflowX: o.overflowX, panelOverflow: po.px, fill: o.fill, emptiness: opts.fixed ? Math.round(emptiness(p) * 100) / 100 : 0, minContrast: Math.round(minC * 100) / 100, lowContrast: low.slice(0, 12), overlaps: overlaps, decorOverText: decorHits, missingImages: missing, fontsLoaded: fontsLoaded, silhouette: cells.join(''), contentHeight: o.contentHeight, usableHeight: o.usableHeight };
  };
  // RÉPARER LE CONTRASTE, PAS REFUSER LA PAGE : un texte sous son seuil (4,5:1 ; 3:1 s'il est grand) sur son
  // fond RÉEL est ramené vers l'encre de la charte — sombre sur fond clair, claire sur fond sombre —, par pas,
  // en gardant sa teinte tant qu'il se peut ; le noir ou le blanc seulement si aucune encre ne tient.
  ge.fixContrast = function (opts) {
    var p = page(); if (!p || !opts.inks) { return 0; }
    function parse(c) { var m = c.match(/rgba?\\(([^)]+)\\)/); if (!m) { return null; } var q = m[1].split(',').map(function (x) { return parseFloat(x); }); return { r: q[0], g: q[1], b: q[2], a: q.length > 3 ? q[3] : 1 }; }
    function hex(h) { var v = String(h || '').replace('#', ''); if (v.length === 3) { v = v[0] + v[0] + v[1] + v[1] + v[2] + v[2]; } return { r: parseInt(v.slice(0, 2), 16), g: parseInt(v.slice(2, 4), 16), b: parseInt(v.slice(4, 6), 16), a: 1 }; }
    function lum(c) { var f = function (v) { v = v / 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); }
    function ratio(a, b) { var la = lum(a), lb = lum(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); }
    function bg(el) { var n = el; while (n) { var c = parse(getComputedStyle(n).backgroundColor || ''); if (c && c.a > 0.6) { return c; } if (n === p) { break; } n = n.parentElement; } return parse(getComputedStyle(p).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 }; }
    function css(c) { return 'rgb(' + Math.round(c.r) + ', ' + Math.round(c.g) + ', ' + Math.round(c.b) + ')'; }
    var dark = hex(opts.inks.dark), light = hex(opts.inks.light);
    var photo = !!p.querySelector('[data-ge-decor] [data-ge-image]');
    var texts = p.querySelectorAll('p, h1, h2, h3, li, td, th, figcaption, blockquote, span, a');
    var fixed = 0;
    for (var k = 0; k < texts.length; k++) {
      var e = texts[k];
      if (isDecor(e) || !ownText(e)) { continue; }
      if (photo && !e.closest('[data-ge-surface]')) { continue; }
      var s = getComputedStyle(e);
      var fg = parse(s.color); if (!fg || fg.a === 0) { continue; }
      var size = parseFloat(s.fontSize), weight = parseInt(s.fontWeight, 10) || 400;
      var need = (size >= 24 || (size >= 18.66 && weight >= 700)) ? 3 : 4.5;
      var back = bg(e);
      // Une couleur illisible pour ce petit lecteur (oklch(), color()…) : on ne repeint pas à l'aveugle.
      if (isNaN(fg.r + fg.g + fg.b) || isNaN(back.r + back.g + back.b)) { continue; }
      if (ratio(fg, back) >= need - 0.05) { continue; }
      var target = lum(back) > 0.35 ? dark : light, done = false;
      for (var t = 0.15; t <= 1.0001 && !done; t += 0.15) {
        var u = Math.min(1, t), c = { r: fg.r + (target.r - fg.r) * u, g: fg.g + (target.g - fg.g) * u, b: fg.b + (target.b - fg.b) * u };
        if (ratio(c, back) >= need) { e.style.color = css(c); done = true; }
      }
      if (!done) { e.style.color = ratio({ r: 0, g: 0, b: 0 }, back) >= ratio({ r: 255, g: 255, b: 255 }, back) ? '#000000' : '#ffffff'; }
      fixed++;
    }
    return fixed;
  };
  return true;
})()`;

export interface FitOptions {
  fixed: boolean;
  /** Agrandir une page trop vide (diapositives). */
  grow?: boolean;
  /** Ne pas ajuster : mesurer seulement. */
  measureOnly?: boolean;
  /** Plus petite taille de texte admise (px) et échelle minimale des textes. */
  minPx?: number;
  floor?: number;
  /** Les encres de la charte vers lesquelles un texte trop pâle est ramené (sombre, claire). */
  inks?: { dark: string; light: string };
}

interface PageResult {
  measurement: Measurement;
  html: string;
  png?: Buffer;
}

async function run(html: string, head: string, format: FormatDef, opts: FitOptions, options: BrowserOptions & { lang?: string; scale?: number; shoot?: boolean }): Promise<PageResult> {
  const doc = pageDocument(html, head, { lang: options.lang });
  return withPage(
    doc,
    { width: Math.ceil(format.width), height: Math.ceil(format.height), scale: options.shoot ? options.scale ?? format.exportScale : 1 },
    async (page) => {
      await page.evaluate(RUNTIME_SCRIPT);
      const fitted = opts.measureOnly ? { shrunk: 0, grown: 0, textScale: 1 } : ((await page.evaluate(`window.__ge.fit(${JSON.stringify(opts)})`)) as { shrunk: number; grown: number; textScale: number } | null);
      // Le contraste se répare APRÈS l'ajustement : la taille finale d'un texte décide de son seuil.
      const recolored = !opts.measureOnly && opts.inks ? ((await page.evaluate(`window.__ge.fixContrast(${JSON.stringify(opts)})`)) as number) : 0;
      const measured = (await page.evaluate(`window.__ge.measure(${JSON.stringify(opts)})`)) as Omit<Measurement, 'fitted'> | null;
      if (!measured || !fitted) throw new Error('graphic-engine: page introuvable dans le rendu (.ge-page)');
      const out = (await page.evaluate(`document.querySelector('.ge-page').outerHTML`)) as string;
      let png: Buffer | undefined;
      if (options.shoot) {
        const target = await page.$('.ge-page');
        const raw = target ? await target.screenshot({ type: 'png' }) : await page.screenshot({ type: 'png' });
        png = Buffer.from(raw);
      }
      return { measurement: { ...measured, fitted: { ...fitted, recolored } }, html: out, png };
    },
    options
  );
}

/** Ajuster puis mesurer (et photographier si demandé) en une seule ouverture de page. */
export function fitAndMeasure(html: string, head: string, format: FormatDef, opts: FitOptions, options: BrowserOptions & { lang?: string; scale?: number; shoot?: boolean } = {}): Promise<PageResult> {
  return run(html, head, format, opts, options);
}

/** Mesurer seulement (contrôles, pages déjà livrées). */
export async function measureHtml(html: string, head: string, format: FormatDef, options: BrowserOptions & { lang?: string } = {}): Promise<Measurement> {
  return (await run(html, head, format, { fixed: format.kind === 'fixed', measureOnly: true }, options)).measurement;
}

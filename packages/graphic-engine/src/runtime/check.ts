/**
 * LE SEUL CONTRÔLE : la page s'affiche-t-elle ?
 *
 * Chromium (le même moteur que l'impression PDF) ouvre la page. Une page qui ne se charge pas, une racine sans
 * taille, une toile où rien n'est visible, un TEXTE COUPÉ par le bord — les quatre sur une toile fixe, la gauche
 * et la droite sur une page de flux, dont seule la hauteur grandit — (il ne s'affiche
 * pas en entier) ou RECOUVERT par une forme, une image, un aplat (il ne se lit pas) est une ERREUR TECHNIQUE : elle part en correction. Rien d'autre n'est jugé : ni contraste, ni
 * équilibre, ni goût. C'est l'auteur qui décide de la page.
 */
import { pageDocument, withPage } from './browser';
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
}

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
    if (probes && hits >= 2) covered.push('"' + t.textContent.trim().slice(0, 40) + '"');
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
}

const QUALITY = (f: QualityFrame) => `(function (f) {
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
  if ((f.assets || []).length && !shownAssets) errors.push('the brand asset image is not shown — place it with <img src="{{…url}}" class="object-contain">, whole and readable');
  else if (f.minAssetSide && (f.assets || []).length && biggest < f.minAssetSide) errors.push('the brand asset is the subject of this page but is shown small (' + Math.round(biggest * 100) + '% of the page) — make it at least ' + Math.round(f.minAssetSide * 100) + '% of the page width or height');
  // 3. Les cadres vides et le semis de formes : une forme peinte qui ne porte rien et ne sert de fond à rien.
  // Ce qu'une forme peut porter en fond : un texte, ou un média d'une taille réelle (une pastille d'icône ne suffit pas).
  var media = [];
  root.querySelectorAll('img,svg,canvas,video,[data-ge-chart],[data-ge-pattern],[data-ge-pattern-tile],[data-ge-gallery]').forEach(function (m) { if (visible(m)) media.push(m.getBoundingClientRect()); });
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
  root.querySelectorAll('*').forEach(function (el) {
    // (la racine porte elle-même data-ge-pattern="authored" : seuls les ancêtres SOUS elle comptent)
    var inPrimitive = el.closest('svg,[data-ge-chart],[data-ge-pattern],[data-ge-pattern-tile],[data-ge-gallery],[data-ge-logo],table');
    if (el === root || (inPrimitive && inPrimitive !== root && root.contains(inPrimitive))) return;
    var tag = el.tagName.toLowerCase();
    if (['img', 'svg', 'canvas', 'video', 'hr', 'br'].indexOf(tag) >= 0) return;
    if (!visible(el)) return;
    var cs = getComputedStyle(el);
    if (!paints(el, cs)) return;
    var r = el.getBoundingClientRect();
    if (Math.min(r.width, r.height) < 6) return;
    if ((el.textContent || '').trim()) return;
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
    var rgb = (cs.backgroundColor.match(/[\d.]+/g) || []).map(Number);
    var neutral = cs.backgroundImage === 'none' && (!opaque(cs.backgroundColor) || (rgb.length >= 3 && Math.max(rgb[0], rgb[1], rgb[2]) - Math.min(rgb[0], rgb[1], rgb[2]) < 40 && (rgb[0] + rgb[1] + rgb[2]) / 3 > 200));
    if (large && !neutral) return;
    if (!f.allowEmptyShapes && compact && r.width * r.height >= pageArea * 0.012 && Math.min(r.width, r.height) >= 24) empty.push(Math.round(r.width) + 'x' + Math.round(r.height));
  });
  if (empty.length) errors.push('empty frames: ' + empty.length + ' painted box(es) (' + empty.slice(0, 3).join(', ') + ' px) hold nothing — remove them or put the content they stand for inside (no placeholder, no empty card, avatar or image zone)');
  else if (!f.allowEmptyShapes && decor > 10) errors.push('decoration noise: ' + decor + ' empty decorative shapes (dots, cells, rings, fake diagram) — keep at most a few brand marks; the content alone builds the page');
  return errors;
})(${JSON.stringify(f)})`;

export async function checkRender(html: string, head: string, format: FormatDef, o: { lang?: string; shoot?: boolean; quality?: QualityFrame } = {}): Promise<RenderCheck> {
  try {
    return await withPage(pageDocument(html, head, { lang: o.lang, background: '#ffffff' }), { width: format.width, height: format.height }, async (page) => {
      const probe = (await page.evaluate(PROBE)) as { error?: string; width?: number; height?: number };
      if (!probe.error && o.quality) {
        const faults = (await page.evaluate(QUALITY(o.quality))) as string[];
        if (faults.length) probe.error = faults.join(' | ');
      }
      // Texte coupé, recouvert, page désordonnée : la page s'affiche presque entière — gardée comme repli si la
      // correction échoue (livrée signalée plutôt que perdue).
      const cut = Boolean(probe.error && /cut off by the edge|covered by another element|on top of each other|brand asset|empty frames|decoration noise|long text|written over a mockup/.test(probe.error));
      if (probe.error && !cut) return { ok: false, error: probe.error };
      let png: Buffer | undefined;
      if (o.shoot) {
        const target = await page.$('.ge-page');
        if (target) png = Buffer.from(await target.screenshot({ type: 'png' }));
      }
      // Un texte coupé : la photographie est gardée (la page servira de repli si la correction échoue).
      if (cut) return { ok: false, cut: true, error: probe.error, ...(png ? { png } : {}) };
      return { ok: true, width: Math.round(probe.width ?? 0), height: Math.round(probe.height ?? 0), ...(png ? { png } : {}) };
    });
  } catch (error) {
    const message = String((error as Error)?.message ?? error);
    if (/launch|Could not find (Chrome|Chromium|expected browser)|ECONNREFUSED|Target closed|Protocol error|Navigation timeout/i.test(message)) return { ok: true, infra: true, error: message.slice(0, 200) };
    return { ok: false, error: `the page could not be rendered: ${String((error as Error)?.message ?? error).slice(0, 200)}` };
  }
}

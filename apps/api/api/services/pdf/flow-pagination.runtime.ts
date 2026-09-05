/**
 * Flow → A4 pages paginator, injected in the Puppeteer page before printing.
 *
 * Why: AI agents emit ONE continuous HTML flow per section. Letting Chrome
 * paginate it produces (a) blocks cut in half at page boundaries and (b) large
 * empty areas at the bottom of pages, because a block that does not fit is
 * pushed whole to the next page.
 *
 * What this runtime does, entirely from measured layout (no guessing):
 *   1. waits for fonts / images / Chart.js, then rasterizes every <canvas> to a
 *      PNG <img> so charts survive being moved around and print crisply;
 *   2. measures the flow (rows, gaps, insets) WITHOUT touching the DOM;
 *   3. plans pages: greedy packing + recursive fragmentation (containers, table
 *      rows, long paragraphs) + "keep with next" for headings;
 *   4. re-plans with a reduced capacity (binary search) so the content is
 *      BALANCED over the same number of pages instead of "full, full, 15%";
 *   5. materializes each page as a clone of the AI root (classes, background and
 *      absolutely-positioned decorations preserved) with a FIXED A4 height;
 *   6. fills the residual space by growing the inter-block gaps (capped), so the
 *      page covers the whole A4 surface;
 *   7. verifies every built page and repairs any overflow by pushing trailing
 *      blocks to a new page — nothing is ever clipped.
 *
 * The script is exposed as `window.__idemFlow` and is dependency-free (ES5-ish,
 * no template literals so it can live in a TS template string).
 */

export interface FlowPaginationOptions {
  /** Page width in mm (210 for A4 portrait). */
  pageWidthMm: number;
  /** Page height in mm (297 for A4 portrait). */
  pageHeightMm: number;
  /** Do not stretch a page filled under this ratio (avoids grotesque gaps). */
  minFillRatio?: number;
  /** Space (mm) a single inter-block gap may gain on a well-filled page. */
  maxGapAddMm?: number;
  /** Absolute ceiling (mm) for a single inter-block gap. */
  maxGapAddHardMm?: number;
  /** Space (mm) a gap INSIDE a multi-row block may gain. */
  maxInnerGapAddMm?: number;
  /** Spread the content evenly over the pages of a section. */
  balance?: boolean;
  /** Push the plan and the per-page filling into `warnings` (diagnostics). */
  debug?: boolean;
}

export interface FlowPaginationSectionReport {
  name: string;
  /** Number of A4 pages produced for this section. */
  pages: number;
  /** Fill ratio (0..1) of each page, after the gaps have been stretched. */
  fills: number[];
  /** Blocks fragmented across a page boundary. */
  splits: number;
  /** Blocks scaled down because a single one was taller than a page. */
  scaled: number;
  /** Blocks moved by the safety net after a measurement drift. */
  repaired: number;
  /** Full-bleed page rendered as-is (cover). */
  fixed: boolean;
}

export interface FlowPaginationReport {
  totalPages: number;
  sections: FlowPaginationSectionReport[];
  warnings: string[];
}

export const FLOW_PAGINATION_RUNTIME = `
(function () {
  'use strict';
  if (window.__idemFlow) { return; }

  var MM = 96 / 25.4;
  var EPS = 0.75;

  function num(v) { var n = parseFloat(v); return isNaN(n) ? 0 : n; }
  function st(el) { return el.ownerDocument.defaultView.getComputedStyle(el); }
  function delay(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function frames() {
    return new Promise(function (r) {
      requestAnimationFrame(function () { requestAnimationFrame(function () { r(); }); });
    });
  }

  /* =====================================================================
   * 1. Readiness + chart rasterization
   * ===================================================================== */

  function waitFonts() {
    try { return document.fonts.ready.then(function () {}, function () {}); }
    catch (e) { return Promise.resolve(); }
  }

  function waitImages(timeoutMs) {
    var pending = [].slice.call(document.images).filter(function (i) { return !i.complete; });
    if (!pending.length) { return Promise.resolve(0); }
    var all = Promise.all(pending.map(function (img) {
      return new Promise(function (res) {
        img.addEventListener('load', res, { once: true });
        img.addEventListener('error', res, { once: true });
      });
    })).then(function () { return pending.length; });
    return Promise.race([all, delay(timeoutMs).then(function () { return -1; })]);
  }

  /**
   * The Tailwind Play CDN generates utilities asynchronously (MutationObserver).
   * Measuring before it has run would size every block wrong, so we poll a probe
   * using an arbitrary value that cannot have been generated beforehand.
   */
  function waitTailwind(timeoutMs) {
    if (!window.tailwind) { return Promise.resolve(false); }
    var probe = document.createElement('div');
    probe.className = 'h-[137px] w-[41px]';
    probe.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden;';
    document.body.appendChild(probe);
    // page.setContent() rewrites the document, which detaches the Play CDN
    // observer: utilities are only (re)generated when the config is assigned.
    // Re-assigning it forces a full rebuild against the current DOM.
    try { window.tailwind.config = window.tailwind.config || {}; } catch (e) { /* ignore */ }
    var deadline = Date.now() + timeoutMs;
    return new Promise(function (resolve) {
      (function tick() {
        var r = probe.getBoundingClientRect();
        if (Math.abs(r.height - 137) < 0.6 && Math.abs(r.width - 41) < 0.6) {
          probe.parentNode.removeChild(probe);
          return resolve(true);
        }
        if (Date.now() >= deadline) {
          probe.parentNode.removeChild(probe);
          return resolve(false);
        }
        setTimeout(tick, 50);
      })();
    });
  }

  /**
   * Construit les graphiques déclarés par le GABARIT.
   *
   * Le rendu serveur pose sur chaque "<canvas>" un attribut "data-idem-chart"
   * qui porte la configuration Chart.js complète, palette du document comprise.
   * C'est ici qu'elle devient un graphique.
   *
   * ── POURQUOI PAS UN <script> PAR GRAPHIQUE ─────────────────────────────────
   *
   * Un script inline s'exécute au moment où "setContent" analyse le document —
   * or Chart.js n'est injecté qu'APRÈS. Il ne trouverait donc jamais
   * "window.Chart". Le faire ici, dans le runtime injecté après la
   * bibliothèque, supprime la course : quand cette fonction tourne, Chart.js
   * est là.
   *
   * Accessoirement, la page reste sans script exécutable — elle survit donc aux
   * éditeurs et aux prévisualisations qui les retirent, où le repli statique
   * posé sous le canvas prend le relais.
   */
  function buildCharts() {
    if (!window.Chart) { return 0; }
    var list = [].slice.call(document.querySelectorAll('canvas[data-idem-chart]'));
    var built = 0;
    for (var i = 0; i < list.length; i++) {
      var canvas = list[i];
      if (window.Chart.getChart && window.Chart.getChart(canvas)) { continue; }
      var cfg = null;
      try { cfg = JSON.parse(canvas.getAttribute('data-idem-chart')); } catch (e) { cfg = null; }
      if (!cfg) { canvas.setAttribute('data-idem-nochart', '1'); continue; }
      // Aucune animation : on imprime, il n'y a personne pour la voir, et elle
      // ferait rasteriser une image à mi-parcours.
      cfg.options = cfg.options || {};
      cfg.options.animation = false;
      cfg.options.responsive = true;
      cfg.options.maintainAspectRatio = false;
      try {
        new window.Chart(canvas, cfg);
        built++;
        // Le graphique est là : le repli statique n'a plus lieu d'être. On le
        // masque sans le retirer du flux, pour que la hauteur mesurée par le
        // paginateur reste EXACTEMENT celle qu'il a mesurée avant.
        var host = canvas.parentNode;
        var fallback = host ? host.querySelector('[data-chart-fallback]') : null;
        if (fallback) { fallback.style.visibility = 'hidden'; }
      } catch (e) {
        canvas.setAttribute('data-idem-nochart', '1');
      }
    }
    return built;
  }

  /** Re-renders every chart once the final layout is known (no animation). */
  function refreshCharts() {
    if (!window.Chart || !window.Chart.getChart) { return 0; }
    var list = [].slice.call(document.querySelectorAll('canvas'));
    var n = 0;
    for (var i = 0; i < list.length; i++) {
      var inst = window.Chart.getChart(list[i]);
      if (!inst) { continue; }
      try { inst.resize(); inst.update('none'); n++; } catch (e) { /* keep going */ }
    }
    return n;
  }

  function pendingCharts() {
    var out = [];
    var list = [].slice.call(document.querySelectorAll('canvas'));
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      if (c.getAttribute('data-idem-nochart') === '1') { continue; }
      var inst = window.Chart && window.Chart.getChart ? window.Chart.getChart(c) : null;
      if (!inst) { out.push(c); }
    }
    return out;
  }

  /** Waits until every <canvas> owns a Chart.js instance (or the deadline). */
  function waitCharts(timeoutMs) {
    var deadline = Date.now() + timeoutMs;
    return new Promise(function (resolve) {
      (function tick() {
        var pending = pendingCharts();
        if (!pending.length) { return resolve(0); }
        if (Date.now() >= deadline) {
          // Plain (non Chart.js) canvases, or a script that failed: stop waiting.
          pending.forEach(function (c) { c.setAttribute('data-idem-nochart', '1'); });
          return resolve(pending.length);
        }
        setTimeout(tick, 80);
      })();
    });
  }

  /**
   * Replaces every <canvas> by an <img> of the exact same box. Charts then
   * behave like plain images: they can be moved between pages, cloned, measured
   * and printed without the canvas bitmap being lost or re-rendered.
   */
  function rasterizeCharts() {
    var list = [].slice.call(document.querySelectorAll('canvas'));
    var count = 0;
    for (var i = 0; i < list.length; i++) {
      var canvas = list[i];
      var rect = canvas.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) { continue; }
      var url = '';
      try { url = canvas.toDataURL('image/png', 1); } catch (e) { continue; }
      if (!url || url.length < 64) { continue; }
      var img = document.createElement('img');
      img.setAttribute('src', url);
      if (canvas.className) { img.className = canvas.className; }
      var inline = canvas.getAttribute('style');
      if (inline) { img.setAttribute('style', inline); }
      img.style.width = rect.width + 'px';
      img.style.height = rect.height + 'px';
      img.style.display = 'block';
      img.setAttribute('alt', canvas.getAttribute('aria-label') || 'chart');
      img.setAttribute('data-idem-chart', '1');
      canvas.parentNode.replaceChild(img, canvas);
      count++;
    }
    return count;
  }

  /* =====================================================================
   * 2. Measurement helpers (read-only)
   * ===================================================================== */

  var ATOMIC_TAGS = { IMG: 1, CANVAS: 1, SVG: 1, VIDEO: 1, HR: 1, IFRAME: 1, INPUT: 1, BUTTON: 1, TEXTAREA: 1, SELECT: 1 };

  function insetsOf(el) {
    var s = st(el);
    return {
      top: num(s.paddingTop) + num(s.borderTopWidth),
      bottom: num(s.paddingBottom) + num(s.borderBottomWidth)
    };
  }

  function isHeadingLike(el) {
    if (!el || el.nodeType !== 1) { return false; }
    if (el.hasAttribute('data-keep-with-next')) { return true; }
    if (/^H[1-6]$/.test(el.tagName)) { return true; }
    if (st(el).breakAfter === 'avoid') { return true; }
    // Wrapper that only carries a heading (very common in AI markup).
    if (el.children.length === 1 && /^H[1-6]$/.test(el.children[0].tagName)) {
      return el.textContent.trim() === el.children[0].textContent.trim();
    }
    return false;
  }

  /** Text-only element: safe to cut between two lines. */
  function isTextLeaf(el) {
    if (!el.textContent || !el.textContent.trim()) { return false; }
    for (var i = 0; i < el.children.length; i++) {
      var d = st(el.children[i]).display;
      if (d !== 'inline' && d !== 'inline-block' && d !== 'contents' && d !== 'none') { return false; }
    }
    return true;
  }

  function canSplit(el) {
    if (!el || el.nodeType !== 1) { return false; }
    if (ATOMIC_TAGS[el.tagName]) { return false; }
    if (el.hasAttribute('data-keep-together')) { return false; }
    var s = st(el);
    if (s.breakInside === 'avoid' || s.breakInside === 'avoid-page') { return false; }
    // A designed box (fixed height + clipping) must keep its proportions.
    if ((s.overflow === 'hidden' || s.overflowY === 'hidden') && s.height !== 'auto' && !el.hasAttribute('data-idem-root')) {
      return false;
    }
    return true;
  }

  /**
   * Groups the in-flow children of \`el\` into visual rows (handles grids,
   * floats and flex-wrap) and returns the absolutely-positioned decorations
   * separately: those must be replicated on every page.
   */
  function flowRows(el) {
    var rows = [];
    var decorations = [];
    var visible = [];
    var kids = el.children;
    for (var i = 0; i < kids.length; i++) {
      var child = kids[i];
      var s = st(child);
      if (s.display === 'none') { continue; }
      if (s.position === 'absolute' || s.position === 'fixed') { decorations.push(child); continue; }
      var r = child.getBoundingClientRect();
      if (r.height <= 0.5 && r.width <= 0.5) { continue; }
      visible.push({ el: child, top: r.top, bottom: r.bottom, width: r.width });
    }
    visible.sort(function (a, b) { return (a.top - b.top) || (a.bottom - b.bottom); });
    for (var j = 0; j < visible.length; j++) {
      var v = visible[j];
      var last = rows.length ? rows[rows.length - 1] : null;
      if (last && v.top < last.bottom - 1) {
        last.els.push(v.el);
        last.bottom = Math.max(last.bottom, v.bottom);
        last.width = Math.max(last.width, v.width);
      } else {
        rows.push({ els: [v.el], top: v.top, bottom: v.bottom, width: v.width });
      }
    }
    return { rows: rows, decorations: decorations };
  }

  /** Single-line kicker ("01. OPPORTUNITY") that belongs to the title below. */
  function isKicker(el) {
    var text = (el.textContent || '').trim();
    if (!text || text.length > 90) { return false; }
    var lh = num(st(el).lineHeight) || num(st(el).fontSize) * 1.4;
    return lh > 0 && el.getBoundingClientRect().height <= lh * 1.8;
  }

  function itemsFromRows(rows) {
    var items = [];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var next = rows[i + 1];
      items.push({
        kind: 'whole',
        els: r.els,
        h: Math.max(0, r.bottom - r.top),
        w: r.width || 0,
        gapAfter: next ? Math.max(0, next.top - r.bottom) : 0,
        gapBefore: 0,
        keepWithNext: r.els.length === 1 && isHeadingLike(r.els[0])
      });
    }
    // A kicker sitting right above a title is part of the title group.
    for (var k = items.length - 2; k >= 0; k--) {
      if (items[k + 1].keepWithNext && items[k].els.length === 1 && isKicker(items[k].els[0])) {
        items[k].keepWithNext = true;
      }
    }
    return items;
  }

  /** Children items of an element, memoized on the item (measurement only). */
  function childItems(item) {
    if (item._kids) { return item._kids; }
    var el = item.els[0];
    var scan = flowRows(el);
    var items = itemsFromRows(scan.rows);
    if (el.tagName === 'TABLE') {
      // Keep <thead> out of the split and repeat it on every fragment.
      var head = null;
      items = items.filter(function (it) {
        if (it.els.length === 1 && it.els[0].tagName === 'THEAD') { head = it; return false; }
        return true;
      });
      if (head && items.length === 1 && items[0].els[0].tagName === 'TBODY') {
        // Descend one more level so rows become the split unit.
        var body = items[0];
        var bodyKids = childItems(body);
        item._repeatHead = head.els[0];
        item._headHeight = head.h;
        item._bodyEl = body.els[0];
        item._kids = bodyKids;
        return item._kids;
      }
      if (head) { item._repeatHead = head.els[0]; item._headHeight = head.h; }
    }
    item._kids = items;
    item._decorations = scan.decorations;
    return item._kids;
  }

  /* =====================================================================
   * 3. Text fragmentation (line-accurate, via Range measurement)
   * ===================================================================== */

  function textNodesOf(el) {
    var out = [];
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    var n;
    while ((n = walker.nextNode())) { if (n.nodeValue && n.nodeValue.length) { out.push(n); } }
    return out;
  }

  /** Global (element-wide) character offsets of every word boundary. */
  function wordBreaks(nodes) {
    var breaks = [];
    var base = 0;
    for (var i = 0; i < nodes.length; i++) {
      var v = nodes[i].nodeValue;
      for (var k = 1; k < v.length; k++) {
        if (/\\s/.test(v.charAt(k - 1)) && !/\\s/.test(v.charAt(k))) { breaks.push(base + k); }
      }
      base += v.length;
    }
    return breaks;
  }

  function locate(nodes, offset) {
    var base = 0;
    for (var i = 0; i < nodes.length; i++) {
      var len = nodes[i].nodeValue.length;
      if (offset <= base + len) { return { node: nodes[i], offset: offset - base }; }
      base += len;
    }
    var last = nodes[nodes.length - 1];
    return { node: last, offset: last.nodeValue.length };
  }

  function heightUpTo(nodes, offset, topRef) {
    var pos = locate(nodes, offset);
    var range = document.createRange();
    range.setStart(nodes[0], 0);
    range.setEnd(pos.node, pos.offset);
    var rect = range.getBoundingClientRect();
    range.detach && range.detach();
    if (!rect || !rect.height) { return 0; }
    return rect.bottom - topRef;
  }

  /**
   * Splits a text-only element so the head fits in \`avail\`, keeping at least
   * two lines on each side (no widow / orphan).
   */
  function splitTextItem(item, avail) {
    var el = item.els[0];
    var nodes = textNodesOf(el);
    if (!nodes.length) { return null; }
    var breaks = wordBreaks(nodes);
    if (breaks.length < 8) { return null; }
    var ins = insetsOf(el);
    var lineH = num(st(el).lineHeight) || (num(st(el).fontSize) * 1.4);
    if (!lineH) { return null; }
    var totalLines = Math.round((item.h - ins.top - ins.bottom) / lineH);
    if (totalLines < 4) { return null; }
    var top = nodes[0].parentNode.getBoundingClientRect().top;
    var range = document.createRange();
    range.setStart(nodes[0], 0);
    range.setEnd(nodes[0], 0);
    var textTop = range.getBoundingClientRect().top || top;
    var budget = avail - ins.top - ins.bottom;
    if (budget < lineH * 2) { return null; }

    var lo = 0, hi = breaks.length - 1, best = -1;
    while (lo <= hi) {
      var mid = (lo + hi) >> 1;
      var h = heightUpTo(nodes, breaks[mid], textTop);
      if (h <= budget) { best = mid; lo = mid + 1; } else { hi = mid - 1; }
    }
    if (best < 0) { return null; }
    var cut = breaks[best];
    var headH = heightUpTo(nodes, cut, textTop);
    var headLines = Math.round(headH / lineH);
    var tailLines = totalLines - headLines;
    if (headLines < 2 || tailLines < 2) { return null; }

    return {
      head: {
        kind: 'text', el: el, els: [el], textFrom: 0, textTo: cut,
        h: headH + ins.top + ins.bottom, gapAfter: 0, gapBefore: 0, keepWithNext: false
      },
      tail: {
        kind: 'text', el: el, els: [el], textFrom: cut, textTo: -1,
        h: Math.max(lineH, item.h - headH), gapAfter: item.gapAfter, gapBefore: 0, keepWithNext: false
      }
    };
  }

  /* =====================================================================
   * 4. Fragmentation of a block that does not fit
   * ===================================================================== */

  function partHeight(el, parts, extraTop) {
    var ins = insetsOf(el);
    var total = ins.top + ins.bottom + (extraTop || 0);
    for (var i = 0; i < parts.length; i++) { total += parts[i].h + (parts[i].gapBefore || 0); }
    return total;
  }

  function cloneItem(it, gapBefore) {
    return {
      kind: it.kind, els: it.els, el: it.el, parts: it.parts, h: it.h, w: it.w,
      gapAfter: it.gapAfter, gapBefore: gapBefore || 0, keepWithNext: it.keepWithNext,
      textFrom: it.textFrom, textTo: it.textTo, repeatHead: it.repeatHead,
      headHeight: it.headHeight, bodyEl: it.bodyEl, decorations: it.decorations,
      scale: it.scale, rawH: it.rawH
    };
  }

  /**
   * Returns { head, tail } where head fits in \`avail\`, or null when the block
   * cannot be fragmented (atomic, or nothing meaningful would fit).
   */
  function splitItem(item, avail, depth) {
    if (depth > 6) { return null; }
    if (item.kind === 'text') { return null; }    // already line-fragmented
    if (item.els.length !== 1) { return null; }   // a grid/flex row is never cut
    var el = item.els[0];
    if (!canSplit(el)) { return null; }

    var kids, extraTop, repeat, body, deco;
    if (item.kind === 'part') {
      // A fragment must stay fragmentable: a 60-row list or a 3-page table is
      // cut once per page boundary, not once in total.
      kids = item.parts;
      extraTop = item.headHeight || 0;
      repeat = item.repeatHead;
      body = item.bodyEl;
      deco = item.decorations;
    } else {
      if (isTextLeaf(el)) { return splitTextItem(item, avail); }
      kids = childItems(item);
      extraTop = item._headHeight || 0;
      repeat = item._repeatHead || null;
      body = item._bodyEl || null;
      deco = item._decorations || null;
    }
    if (!kids || kids.length < 2) { return null; }
    var ins = insetsOf(el);
    var budget = avail - ins.top - ins.bottom - extraTop;
    if (budget < 24 * MM) { return null; }

    var headParts = [], tailParts = [];
    var used = 0, i = 0;
    for (; i < kids.length; i++) {
      var k = kids[i];
      var gap = i > 0 ? kids[i - 1].gapAfter : 0;
      if (used + gap + k.h <= budget) {
        headParts.push(cloneItem(k, gap));
        used += gap + k.h;
        continue;
      }
      var sub = splitItem(k, budget - used - gap, depth + 1);
      if (sub) {
        headParts.push(cloneItem(sub.head, gap));
        tailParts.push(cloneItem(sub.tail, 0));
        i++;
      }
      break;
    }
    for (; i < kids.length; i++) {
      tailParts.push(cloneItem(kids[i], tailParts.length ? kids[i - 1].gapAfter : 0));
    }

    // Never leave a heading alone at the bottom of a fragment.
    while (headParts.length && headParts[headParts.length - 1].keepWithNext) {
      var moved = headParts.pop();
      moved.gapBefore = 0;
      if (tailParts.length) { tailParts[0].gapBefore = moved.gapAfter; }
      tailParts.unshift(moved);
    }
    if (!headParts.length || !tailParts.length) { return null; }
    headParts[0].gapBefore = 0;
    tailParts[0].gapBefore = 0;

    var head = {
      kind: 'part', el: el, els: [el], parts: headParts, gapAfter: 0, gapBefore: 0,
      keepWithNext: false, repeatHead: repeat, headHeight: extraTop, bodyEl: body,
      decorations: deco, w: item.w, h: partHeight(el, headParts, extraTop)
    };
    var tail = {
      kind: 'part', el: el, els: [el], parts: tailParts, gapAfter: item.gapAfter, gapBefore: 0,
      keepWithNext: false, repeatHead: repeat, headHeight: extraTop, bodyEl: body,
      decorations: deco, w: item.w, h: partHeight(el, tailParts, extraTop)
    };
    return { head: head, tail: tail };
  }

  /* =====================================================================
   * 5. Planning (pure arithmetic on measurements → replayable)
   * ===================================================================== */

  /** Height still to place, from index i to the end of the queue. */
  function remainingHeight(queue, i) {
    var total = 0;
    for (var j = i; j < queue.length; j++) {
      total += queue[j].h + (j + 1 < queue.length ? queue[j].gapAfter : 0);
    }
    return total;
  }

  /**
   * Greedy packing. When targetPages is set, each page also gets a SOFT
   * budget (remaining height / remaining pages): blocks are then spread evenly
   * instead of "full, full, 20%".
   */
  function planPages(items, capacity, minSplitPx, targetPages, relax) {
    var pages = [];
    var current = [];
    var used = 0;
    var queue = items.slice();
    var splits = 0;
    var scaled = 0;
    var guard = 0;
    var softCap = capacity;

    function flush() {
      if (current.length) { pages.push({ slices: current, used: used }); }
      current = [];
      used = 0;
      softCap = capacity;
    }

    function budgetFor(i) {
      if (!targetPages) { return capacity; }
      var left = targetPages - pages.length;
      if (left <= 1) { return capacity; }
      var even = (remainingHeight(queue, i) / left) * (relax || 1);
      return Math.max(capacity * 0.5, Math.min(capacity, even));
    }

    var i = 0;
    while (i < queue.length && guard++ < 4000) {
      var item = queue[i];
      if (!current.length) { softCap = budgetFor(i); }
      var gap = current.length ? (queue[i - 1] ? queue[i - 1].gapAfter : 0) : 0;
      if (used + gap + item.h <= softCap + EPS) {
        current.push(cloneItem(item, current.length ? gap : 0));
        used += (current.length > 1 ? gap : 0) + item.h;
        i++;
        continue;
      }

      if (!current.length) {
        // Empty page: the block must be fragmented or scaled down.
        var big = splitItem(item, softCap, 0);
        if (big) {
          splits++;
          current.push(cloneItem(big.head, 0));
          used = big.head.h;
          queue[i] = big.tail;
          flush();
          continue;
        }
        var k = Math.min(1, capacity / Math.max(1, item.h));
        var slice = cloneItem(item, 0);
        if (k < 0.999) { slice.scale = k; slice.rawH = item.h; slice.h = item.h * k; scaled++; }
        current.push(slice);
        used = slice.h;
        i++;
        flush();
        continue;
      }

      var room = softCap - used - gap;
      if (room > minSplitPx) {
        var frag = splitItem(item, room, 0);
        if (frag) {
          splits++;
          current.push(cloneItem(frag.head, gap));
          used += gap + frag.head.h;
          queue[i] = frag.tail;
          flush();
          continue;
        }
      }

      // Only a title group on the page and an unsplittable oversized figure
      // next: scale the figure so it stays with its title, instead of leaving
      // a 5%-full page followed by a full-page image.
      var hardRoom = capacity - used - gap;
      var onlyTitles = true;
      for (var t = 0; t < current.length; t++) {
        if (!current[t].keepWithNext) { onlyTitles = false; break; }
      }
      if (onlyTitles && hardRoom >= capacity * 0.5 && item.h > hardRoom) {
        var ratio = hardRoom / item.h;
        var fitted = cloneItem(item, gap);
        fitted.scale = ratio;
        fitted.rawH = item.h;
        fitted.h = hardRoom;
        scaled++;
        current.push(fitted);
        used += gap + hardRoom;
        i++;
        flush();
        continue;
      }

      // Pull a trailing heading with the block that follows it.
      while (current.length > 1 && current[current.length - 1].keepWithNext) {
        var back = current.pop();
        used -= back.h + back.gapBefore;
        queue.splice(i, 0, back);
      }
      flush();
    }
    flush();
    return { pages: pages, splits: splits, scaled: scaled };
  }

  /**
   * Two passes: the first one gives the minimum number of pages, the second one
   * replays the packing with an even budget per page. We get [78%, 78%, 74%]
   * instead of [100%, 100%, 30%]; the residual is then absorbed by the gaps.
   * If balancing would cost an extra page, the plain plan wins.
   */
  function balancePlan(items, capacity, minSplitPx, maxGapAddHard) {
    var full = planPages(items, capacity, minSplitPx, 0, 1);
    full.mode = 'greedy';
    var target = full.pages.length;
    if (target < 2) { return full; }
    // An even budget can be too tight for lumpy blocks (a chart, a 2x2 grid):
    // sweep the budget from "perfectly even" to "loose" and keep the plan whose
    // emptiest page is the fullest — the most balanced achievable layout.
    var best = full;
    var bestScore = scorePlan(full, capacity, maxGapAddHard);
    for (var relax = 1; relax <= 1.4001; relax += 0.05) {
      var trial = planPages(items, capacity, minSplitPx, target, relax);
      if (trial.pages.length > target) { continue; }
      var score = scorePlan(trial, capacity, maxGapAddHard);
      if (score > bestScore + 0.001) {
        bestScore = score;
        best = trial;
        best.mode = 'balanced x' + relax.toFixed(2);
      }
    }
    return best;
  }

  /**
   * Score of a plan = fill ratio of its emptiest page ONCE the gaps have been
   * stretched. A page holding many blocks can absorb much more empty space than
   * a page holding two, so the raw fill alone would pick the wrong plan.
   */
  function scorePlan(plan, capacity, maxGapAddHard) {
    var min = 1;
    for (var i = 0; i < plan.pages.length; i++) {
      var page = plan.pages[i];
      var stretch = elasticSlots(page.slices) * maxGapAddHard;
      var ratio = Math.min(1, (page.used + stretch) / capacity);
      if (ratio < min) { min = ratio; }
    }
    return min;
  }

  /** Gaps that may grow: those that do not separate a title from its text. */
  function elasticSlots(slices) {
    var n = 0;
    for (var i = 0; i + 1 < slices.length; i++) {
      if (!slices[i].keepWithNext) { n++; }
    }
    return n;
  }

  /* =====================================================================
   * 6. Materialization
   * ===================================================================== */

  function deleteText(root, from, to) {
    var nodes = textNodesOf(root);
    if (!nodes.length) { return; }
    var range = document.createRange();
    var start = locate(nodes, from);
    if (to < 0) {
      var last = nodes[nodes.length - 1];
      range.setStart(start.node, start.offset);
      range.setEnd(last, last.nodeValue.length);
    } else {
      var end = locate(nodes, to);
      range.setStart(start.node, start.offset);
      range.setEnd(end.node, end.offset);
    }
    range.deleteContents();
  }

  function materialize(slice) {
    var node;
    if (slice.kind === 'text') {
      node = slice.el.cloneNode(true);
      if (slice.textFrom > 0) { deleteText(node, 0, slice.textFrom); }
      else if (slice.textTo >= 0) { deleteText(node, slice.textTo, -1); }
    } else if (slice.kind === 'part') {
      node = slice.el.cloneNode(false);
      node.removeAttribute('id');
      if (slice.decorations) {
        for (var d = 0; d < slice.decorations.length; d++) { node.appendChild(slice.decorations[d].cloneNode(true)); }
      }
      if (slice.repeatHead) { node.appendChild(slice.repeatHead.cloneNode(true)); }
      var host = node;
      if (slice.bodyEl) {
        host = slice.bodyEl.cloneNode(false);
        host.removeAttribute('id');
        node.appendChild(host);
      }
      for (var p = 0; p < slice.parts.length; p++) {
        var child = materialize(slice.parts[p]);
        applyGap(child, slice.parts[p].gapBefore);
        host.appendChild(child);
      }
    } else if (slice.els.length > 1) {
      // Grid / flex row kept whole: wrap the elements in an invisible group.
      node = document.createElement('div');
      node.setAttribute('data-idem-row', '1');
      node.style.display = 'contents';
      for (var e = 0; e < slice.els.length; e++) { node.appendChild(slice.els[e]); }
      return node;
    } else {
      node = slice.els[0];
    }

    if (slice.scale && slice.scale < 0.999) {
      // Measured at plan time: the element may already have been emptied by a
      // previous fragment, so never re-measure it here.
      var rawH = slice.rawH || 0;
      var rawW = slice.w || 0;
      if (!rawH || !rawW) {
        var rect = slice.els[0].getBoundingClientRect();
        rawH = rawH || rect.height;
        rawW = rawW || rect.width;
      }
      var box = document.createElement('div');
      box.style.width = '100%';
      box.style.height = (rawH * slice.scale) + 'px';
      box.style.overflow = 'hidden';
      node.style.transformOrigin = 'top left';
      node.style.transform = 'scale(' + slice.scale + ')';
      node.style.width = rawW + 'px';
      box.appendChild(node);
      node = box;
    }
    return node;
  }

  function applyGap(node, gap) {
    if (!node || node.nodeType !== 1) { return; }
    // A "contents" wrapper has no box: the gap goes on its first real child.
    var target = node.style.display === 'contents' ? node.firstElementChild : node;
    if (!target) { return; }
    target.style.marginTop = Math.max(0, gap || 0) + 'px';
    target.style.marginBottom = '0px';
  }

  /* =====================================================================
   * 7. Fill: grow the gaps so the page covers the whole A4 surface
   * ===================================================================== */

  function gapTarget(node) {
    return node.style.display === 'contents' ? node.firstElementChild : node;
  }

  function fillPage(nodes, gaps, leftover, maxAdd, hardMaxAdd, slices) {
    if (leftover <= 1 || nodes.length < 2) { return 0; }
    var slots = nodes.length - 1;
    var weights = [];
    var total = 0;
    var elastic = 0;
    for (var i = 0; i < slots; i++) {
      var w;
      if (slices && slices[i] && slices[i].keepWithNext) {
        w = 0;                                 // never detach a title from its text
      } else if (slices && slices[i + 1] && slices[i + 1].keepWithNext) {
        w = ((gaps[i + 1] || 0) + 8) * 2.5;    // breathe before a new sub-section
      } else {
        w = (gaps[i + 1] || 0) + 8;            // follow the existing rhythm
      }
      weights.push(w);
      total += w;
      if (w > 0) { elastic++; }
    }
    if (!elastic) { return 0; }
    // Few elastic gaps → allow wider ones, otherwise the bottom stays empty;
    // many gaps → keep the growth discreet.
    var ceiling = elastic <= 2 ? hardMaxAdd * 1.5 : hardMaxAdd;
    var limit = Math.min(ceiling, Math.max(maxAdd, leftover / elastic));
    var added = 0;
    var remaining = leftover;
    for (var pass = 0; pass < 2 && remaining > 1 && total > 0; pass++) {
      var carried = 0;
      var newTotal = 0;
      for (var j = 0; j < slots; j++) {
        if (weights[j] <= 0) { continue; }
        var target = gapTarget(nodes[j + 1]);
        if (!target) { weights[j] = 0; continue; }
        var share = remaining * (weights[j] / total);
        var current = num(target.style.marginTop);
        var room = limit - (current - (gaps[j + 1] || 0));
        var give = Math.max(0, Math.min(share, room));
        target.style.marginTop = (current + give) + 'px';
        added += give;
        carried += give;
        if (give >= share - 0.5) { newTotal += weights[j]; } else { weights[j] = 0; }
      }
      remaining -= carried;
      total = newTotal;
    }
    return added;
  }

  /**
   * Second level of elasticity: when the gaps BETWEEN blocks are exhausted (a
   * page holding only two blocks), the gaps INSIDE multi-row blocks (card grid,
   * list, stack of paragraphs in a card) take the rest. Neutral typographically
   * — it only makes a block breathe — and it never touches title groups.
   */
  function fillInner(nodes, leftover, maxAdd) {
    if (leftover <= 1) { return 0; }
    var targets = [];
    var slots = 0;
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      if (!node || node.nodeType !== 1 || node.style.display === 'contents') { continue; }
      if (ATOMIC_TAGS[node.tagName] || node.hasAttribute('data-keep-together')) { continue; }
      var scan = flowRows(node);
      if (scan.rows.length < 2) { continue; }
      var s = st(node);
      var grid = s.display.indexOf('grid') >= 0 || s.display.indexOf('flex') >= 0;
      targets.push({ el: node, rows: scan.rows, grid: grid, slots: scan.rows.length - 1 });
      slots += scan.rows.length - 1;
    }
    if (!slots) { return 0; }
    var share = Math.min(maxAdd, leftover / slots);
    if (share < 2) { return 0; }
    var added = 0;
    for (var t = 0; t < targets.length; t++) {
      var target = targets[t];
      if (target.grid) {
        var gap = num(st(target.el).rowGap);
        target.el.style.rowGap = (gap + share) + 'px';
        added += share * target.slots;
        continue;
      }
      for (var r = 1; r < target.rows.length; r++) {
        var first = target.rows[r].els[0];
        first.style.marginTop = (num(st(first).marginTop) + share) + 'px';
        added += share;
      }
    }
    return added;
  }

  /* =====================================================================
   * 8. Section pagination
   * ===================================================================== */

  function neutralize(el, widthPx) {
    el.style.width = widthPx + 'px';
    el.style.minWidth = '0';
    el.style.maxWidth = 'none';
    el.style.height = 'auto';
    el.style.minHeight = '0';
    el.style.maxHeight = 'none';
    el.style.overflow = 'visible';
    el.style.margin = '0';
  }

  function makePageHost(root, geo) {
    var host = root.cloneNode(false);
    host.removeAttribute('id');
    host.setAttribute('data-idem-page-host', '1');
    host.style.width = geo.pageW + 'px';
    host.style.height = geo.pageH + 'px';
    host.style.minHeight = '0';
    host.style.maxHeight = 'none';
    host.style.minWidth = '0';
    host.style.maxWidth = 'none';
    host.style.overflow = 'hidden';
    host.style.margin = '0';
    host.style.position = 'relative';
    var display = geo.display;
    if (display.indexOf('flex') >= 0 || display.indexOf('grid') >= 0) {
      host.style.gap = '0px';
      host.style.justifyContent = 'flex-start';
      host.style.alignContent = 'flex-start';
    }
    return host;
  }

  function paginateSection(flow, opts, report) {
    var roots = [];
    for (var i = 0; i < flow.children.length; i++) {
      if (st(flow.children[i]).display !== 'none') { roots.push(flow.children[i]); }
    }
    if (!roots.length) { return; }
    var root = roots[0];
    if (roots.length > 1) {
      // The agent emitted several top-level blocks instead of one container:
      // wrap them, otherwise everything but the first one would be dropped.
      root = document.createElement('div');
      root.setAttribute('data-idem-synthetic-root', '1');
      flow.insertBefore(root, roots[0]);
      for (var m = 0; m < roots.length; m++) { root.appendChild(roots[m]); }
    }

    var name = flow.getAttribute('data-section-name') || 'section';
    var geo = {
      pageW: opts.pageW,
      pageH: opts.pageH,
      display: st(root).display
    };

    // Full-bleed designed page (cover): exactly one page, never re-flowed.
    if (flow.getAttribute('data-fixed-page') === '1') {
      root.style.width = geo.pageW + 'px';
      root.style.height = geo.pageH + 'px';
      root.style.minHeight = '0';
      root.style.maxHeight = 'none';
      root.style.overflow = 'hidden';
      var single = document.createElement('div');
      single.className = 'idem-page';
      single.appendChild(root);
      flow.parentNode.replaceChild(single, flow);
      report.sections.push({ name: name, pages: 1, fills: [1], splits: 0, scaled: 0, repaired: 0, fixed: true });
      return;
    }

    root.setAttribute('data-idem-root', '1');
    neutralize(root, geo.pageW);

    var ins = insetsOf(root);
    var capacity = geo.pageH - ins.top - ins.bottom - 1;
    if (capacity < 100) { capacity = geo.pageH - 1; }

    var scan = flowRows(root);
    var items = itemsFromRows(scan.rows);
    if (!items.length) { return; }

    var plan = opts.balance
      ? balancePlan(items, capacity, capacity * 0.18, opts.maxGapAddHard)
      : planPages(items, capacity, capacity * 0.18, 0, 1);

    // Build the pages.
    var fragment = document.createDocumentFragment();
    var built = [];
    for (var p = 0; p < plan.pages.length; p++) {
      var pageEl = document.createElement('div');
      pageEl.className = 'idem-page';
      var host = makePageHost(root, geo);
      for (var d = 0; d < scan.decorations.length; d++) {
        host.appendChild(scan.decorations[d].cloneNode(true));
      }
      var nodes = [];
      var gaps = [];
      var slices = plan.pages[p].slices;
      for (var s = 0; s < slices.length; s++) {
        var node = materialize(slices[s]);
        applyGap(node, s === 0 ? 0 : slices[s].gapBefore);
        host.appendChild(node);
        nodes.push(node);
        gaps.push(s === 0 ? 0 : slices[s].gapBefore);
      }
      pageEl.appendChild(host);
      fragment.appendChild(pageEl);
      built.push({ pageEl: pageEl, host: host, nodes: nodes, gaps: gaps, slices: slices.slice() });
    }
    flow.parentNode.replaceChild(fragment, flow);

    // Verify → repair → fill (measurements are now real, not planned).
    if (opts.debug) {
      report.warnings.push(
        'plan ' + name + ': mode=' + (plan.mode || 'greedy') + ' cap=' + Math.round(capacity) +
        ' pages=[' + plan.pages.map(function (p) { return Math.round(p.used); }).join(', ') + ']'
      );
    }

    var fills = [];
    var repaired = 0;
    for (var b = 0; b < built.length; b++) {
      repaired += repairPage(built, b, capacity, geo, root);
    }
    for (var f = 0; f < built.length; f++) {
      var page = built[f];
      var used = contentHeight(page.host, page.nodes);
      var before = used;
      var added = 0;
      var leftover = capacity - used;
      if (leftover > 1 && used >= capacity * opts.minFillRatio) {
        added = fillPage(
          page.nodes, page.gaps, leftover, opts.maxGapAdd, opts.maxGapAddHard, page.slices
        );
        used = contentHeight(page.host, page.nodes);
        if (capacity - used > capacity * 0.08) {
          added += fillInner(page.nodes, capacity - used, opts.maxInnerGapAdd);
          used = contentHeight(page.host, page.nodes);
        }
      }
      if (opts.debug) {
        report.warnings.push(
          'fill ' + name + ' p' + (f + 1) + ': blocks=' + page.nodes.length +
          ' planned=' + Math.round((plan.pages[f] && plan.pages[f].used) || 0) +
          ' used=' + Math.round(before) + '/' + Math.round(capacity) +
          ' added=' + Math.round(added) + ' final=' + Math.round(used)
        );
      }
      fills.push(Math.min(1, used / capacity));
    }

    report.sections.push({
      name: name,
      pages: built.length,
      fills: fills.map(function (v) { return Math.round(v * 100) / 100; }),
      splits: plan.splits,
      scaled: plan.scaled,
      repaired: repaired,
      fixed: false
    });
  }

  function contentHeight(host, nodes) {
    if (!nodes.length) { return 0; }
    var hostTop = host.getBoundingClientRect().top + insetsOf(host).top;
    var bottom = hostTop;
    for (var i = 0; i < nodes.length; i++) {
      if (!nodes[i].getBoundingClientRect) { continue; }
      var r = nodes[i].nodeType === 1 && nodes[i].style.display === 'contents'
        ? rectOfChildren(nodes[i])
        : nodes[i].getBoundingClientRect();
      if (r.bottom > bottom) { bottom = r.bottom; }
    }
    return bottom - hostTop;
  }

  function rectOfChildren(node) {
    var top = Infinity, bottom = -Infinity;
    for (var i = 0; i < node.children.length; i++) {
      var r = node.children[i].getBoundingClientRect();
      if (r.top < top) { top = r.top; }
      if (r.bottom > bottom) { bottom = r.bottom; }
    }
    if (top === Infinity) { return { top: 0, bottom: 0 }; }
    return { top: top, bottom: bottom };
  }

  /**
   * Safety net: if the real layout overflows the page (a measurement drifted),
   * trailing blocks are pushed to a freshly inserted page. Nothing is clipped.
   */
  function repairPage(built, index, capacity, geo, root) {
    var page = built[index];
    var moved = 0;
    var guard = 0;
    while (page.nodes.length > 1 && contentHeight(page.host, page.nodes) > capacity + EPS && guard++ < 60) {
      var node = page.nodes.pop();
      page.gaps.pop();
      var slice = page.slices.pop();
      var next = built[index + 1];
      if (!next) {
        var pageEl = document.createElement('div');
        pageEl.className = 'idem-page';
        var host = makePageHost(root, geo);
        pageEl.appendChild(host);
        page.pageEl.parentNode.insertBefore(pageEl, page.pageEl.nextSibling);
        next = { pageEl: pageEl, host: host, nodes: [], gaps: [], slices: [] };
        built.splice(index + 1, 0, next);
      }
      var anchor = next.nodes.length ? next.nodes[0] : null;
      next.host.insertBefore(node, anchor);
      applyGap(node, 0);
      if (next.nodes.length) { applyGap(next.nodes[0], 0); }
      next.nodes.unshift(node);
      next.gaps.unshift(0);
      next.slices.unshift(slice);
      moved++;
    }
    return moved;
  }

  /* =====================================================================
   * Public API
   * ===================================================================== */

  window.__idemFlow = {
    prepare: function (opts) {
      opts = opts || {};
      var out = { tailwind: false, built: 0, charts: 0, rasterized: 0 };
      return waitTailwind(opts.tailwindTimeout || 6000)
        .then(function (ok) { out.tailwind = ok; return waitFonts(); })
        .then(function () { return waitImages(opts.imageTimeout || 8000); })
        // Les graphiques du gabarit sont construits ICI, après Chart.js et
        // avant l'attente qui les compte : sans cela, "waitCharts" attendrait
        // des instances que personne n'a créées.
        .then(function () { out.built = buildCharts(); return frames(); })
        .then(function () { return waitCharts(opts.chartTimeout || 6000); })
        .then(function () { return frames(); })
        .then(function () { out.charts = refreshCharts(); return frames(); })
        .then(function () { out.rasterized = rasterizeCharts(); return waitImages(4000); })
        .then(function () { return frames(); })
        .then(function () { return out; });
    },

    paginate: function (options) {
      var opts = options || {};
      var report = { totalPages: 0, sections: [], warnings: [] };
      var probe = document.createElement('div');
      probe.style.cssText = 'position:absolute;visibility:hidden;width:' + (opts.pageWidthMm || 210) + 'mm;height:' + (opts.pageHeightMm || 297) + 'mm;';
      document.body.appendChild(probe);
      var pr = probe.getBoundingClientRect();
      var cfg = {
        pageW: pr.width || (opts.pageWidthMm || 210) * MM,
        pageH: pr.height || (opts.pageHeightMm || 297) * MM,
        minFillRatio: opts.minFillRatio == null ? 0.3 : opts.minFillRatio,
        maxGapAdd: (opts.maxGapAddMm == null ? 12 : opts.maxGapAddMm) * MM,
        maxGapAddHard: (opts.maxGapAddHardMm == null ? 26 : opts.maxGapAddHardMm) * MM,
        maxInnerGapAdd: (opts.maxInnerGapAddMm == null ? 10 : opts.maxInnerGapAddMm) * MM,
        balance: opts.balance !== false,
        debug: !!opts.debug
      };
      probe.parentNode.removeChild(probe);

      var flows = [].slice.call(document.querySelectorAll('.idem-flow'));
      for (var i = 0; i < flows.length; i++) {
        try {
          paginateSection(flows[i], cfg, report);
        } catch (err) {
          report.warnings.push('section ' + i + ': ' + (err && err.message ? err.message : String(err)));
        }
      }
      report.totalPages = document.querySelectorAll('.idem-page').length;
      return report;
    }
  };
})();
`;

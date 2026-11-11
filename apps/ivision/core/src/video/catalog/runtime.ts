/**
 * LE RUNTIME DES SCÈNES DU CATALOGUE — le code d'IDEM embarqué dans la composition HyperFrames (jamais publié par le
 * catalogue). Chaque scène appelle `__ge.scene(tl, root, D, spec)` avec des DONNÉES ; une fois les polices prêtes, le
 * runtime :
 *
 *   1. découpe les textes animés en mots, lettres ou lignes (DOM construit par `textContent`, jamais par du HTML) ;
 *   2. fait TENIR chaque texte dans sa zone : taille la plus grande qui tient (mesurée dans la page, du maximum de la
 *      mise en page jusqu'à son minimum) — un texte trop long pour le minimum est signalé (`__fitIssues`) ;
 *   3. pose les tweens GSAP sur la timeline de la scène (entrée, tenue, sortie) et, pour sa transition d'entrée, sur
 *      la timeline maîtresse (sortie de la scène d'avant, panneaux de marque, entrée de celle-ci).
 *
 * Déterministe : ni hasard, ni horloge, ni réseau ; la même page rend toujours les mêmes images. Une erreur ne coupe
 * que SA scène (`__sceneErrors`).
 */
export const CATALOG_RUNTIME = String.raw`(function () {
  var GE = window.__ge = { pending: [], fitIssues: [] };
  window.__fitIssues = GE.fitIssues;
  window.__sceneErrors = window.__sceneErrors || [];
  var comp = document.getElementById('comp');
  var ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  function each(list, fn) { Array.prototype.forEach.call(list || [], fn); }
  function minSide() { return Math.min(comp.offsetWidth || 1080, comp.offsetHeight || 1080); }
  function unit() { return minSide() / 1080; }

  // ── Mesurer une scène même quand elle n'est pas montée ─────────────────────────────────────
  function shown(sec, fn) {
    var d = sec.style.display, v = sec.style.visibility;
    sec.style.display = 'block';
    sec.style.visibility = 'hidden';
    try { return fn(); } finally { sec.style.display = d; sec.style.visibility = v; }
  }

  // ── Le découpage des textes ────────────────────────────────────────────────────────────────
  function span(cls, display, text) {
    var s = document.createElement('span');
    s.className = cls;
    s.style.display = display;
    if (text !== undefined) s.textContent = text;
    return s;
  }
  function masked(child) {
    var outer = span('ge-u', 'inline-block');
    outer.style.overflow = 'hidden';
    outer.style.paddingBottom = '0.14em';
    outer.style.marginBottom = '-0.14em';
    outer.style.verticalAlign = 'top';
    child.className = 'ge-i';
    outer.appendChild(child);
    return outer;
  }
  function split(el, mode, mask) {
    if (el.__geSplit) return;
    el.__geSplit = mode;
    var words = (el.textContent || '').split(/\s+/).filter(Boolean);
    while (el.firstChild) el.removeChild(el.firstChild);
    words.forEach(function (w, i) {
      if (i) el.appendChild(document.createTextNode(' '));
      if (mode === 'chars') {
        var holder = span('ge-word', 'inline-block');
        holder.style.whiteSpace = 'nowrap';
        Array.from(w).forEach(function (c) {
          var u = span('ge-u', 'inline-block', c);
          holder.appendChild(mask ? masked(u) : u);
        });
        el.appendChild(holder);
      } else {
        var u = span(mode === 'lines' ? 'ge-w' : 'ge-u', 'inline-block', w);
        el.appendChild(mask && mode === 'words' ? masked(u) : u);
      }
    });
  }
  /** Les mots déjà posés regroupés en LIGNES (après la mise à la taille : les lignes sont celles qu'on voit). */
  function lines(el, mask) {
    var ws = el.querySelectorAll('.ge-w');
    if (!ws.length) return;
    var rows = [], top = null;
    each(ws, function (w) {
      if (top === null || Math.abs(w.offsetTop - top) > 2) { rows.push([]); top = w.offsetTop; }
      rows[rows.length - 1].push(w.textContent);
    });
    while (el.firstChild) el.removeChild(el.firstChild);
    rows.forEach(function (row) {
      var inner = span('ge-i', 'block', row.join(' '));
      if (mask) {
        var outer = span('ge-u', 'block');
        outer.style.overflow = 'hidden';
        outer.style.paddingBottom = '0.12em';
        outer.style.marginBottom = '-0.12em';
        outer.appendChild(inner);
        el.appendChild(outer);
      } else { inner.className = 'ge-u'; el.appendChild(inner); }
    });
  }

  // ── La mise à la taille ────────────────────────────────────────────────────────────────────
  function fit(sec) {
    var els = sec.querySelectorAll('[data-fit]');
    if (!els.length) return true;
    var u = minSide();
    var safe = sec.querySelector('[data-safe]') || sec;
    each(els, function (el) { el.style.fontSize = (parseFloat(el.getAttribute('data-fk')) * u).toFixed(2) + 'px'; });
    // Une marge de respiration (2,5 %) : le contenu ne touche jamais les bords de la zone sûre (la dérive lente d'un
    // titre, l'interligne d'une capitale accentuée y restent).
    function content() {
      var top = Infinity, bottom = -Infinity;
      each(safe.children, function (c) { var r = c.getBoundingClientRect(); if (r.height > 0) { top = Math.min(top, r.top); bottom = Math.max(bottom, r.bottom); } });
      // Les glyphes eux-mêmes : avec un interligne serré, une capitale accentuée (É, Ç) dépasse de sa ligne.
      each(els, function (el) {
        var rg = document.createRange();
        rg.selectNodeContents(el);
        each(rg.getClientRects(), function (q) { if (q.height > 0.5) { top = Math.min(top, q.top); bottom = Math.max(bottom, q.bottom); } });
      });
      return bottom > top ? bottom - top : 0;
    }
    function over() {
      var box = safe.getBoundingClientRect();
      // L'étendue des enfants (un contenu centré déborde aussi vers le haut, ce que la hauteur de défilement ignore).
      if (content() > box.height * 0.975 + 1 || safe.scrollWidth > safe.clientWidth + 1) return true;
      for (var i = 0; i < els.length; i++) if (els[i].clientWidth && els[i].scrollWidth > els[i].clientWidth + 1) return true;
      return false;
    }
    for (var n = 0; n < 40 && over(); n++) {
      var moved = false;
      each(els, function (el) {
        var min = parseFloat(el.getAttribute('data-fmin')) * u, cur = parseFloat(el.style.fontSize);
        if (cur > min + 0.05) { el.style.fontSize = Math.max(min, cur * 0.95).toFixed(2) + 'px'; moved = true; }
      });
      if (!moved) break;
    }
    return !over();
  }

  // ── Les tweens ─────────────────────────────────────────────────────────────────────────────
  function conv(o, k) {
    var out = {};
    for (var p in o) {
      var v = o[p];
      if (p === 'blur') out.filter = 'blur(' + (v * k).toFixed(2) + 'px)';
      else if (p === 'clip') { out.clipPath = v; out.webkitClipPath = v; }
      else if (p === 'x' || p === 'y') out[p] = v * k;
      else if (p === 'transformOrigin' && v === 'auto') out[p] = function (i, el) { var a = getComputedStyle(el).textAlign; return a === 'center' ? '50% 50%' : a === 'right' || a === 'end' ? '100% 50%' : '0% 50%'; };
      else out[p] = v;
    }
    return out;
  }
  function counter(tl, els, st, at) {
    each(els, function (el) {
      var txt = el.textContent || '';
      var m = /^([^\d]*?)(\d[\d\s.,  ]*\d|\d)(.*)$/.exec(txt);
      if (!m) return;
      var raw = m[2], dec = '', group = '', decimals = 0;
      var tail = /[.,](\d{1,2})$/.exec(raw);
      if (tail && !/[.,]\d{3}$/.test(raw)) { dec = raw.charAt(raw.length - tail[1].length - 1); decimals = tail[1].length; }
      var g = /\d([\s.,  ])\d{3}/.exec(raw);
      if (g && g[1] !== dec) group = g[1];
      var value = parseFloat(raw.split(group || '\u0000').join('').replace(dec || '\u0000', '.').replace(/[^\d.]/g, ''));
      if (!isFinite(value)) return;
      function fmt(n) {
        var s = n.toFixed(decimals), parts = s.split('.');
        var int = group ? parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, group) : parts[0];
        return m[1] + int + (decimals ? dec + parts[1] : '') + m[3];
      }
      var o = { v: 0 };
      tl.fromTo(o, { v: 0 }, { v: value, duration: st.duration, ease: st.ease || 'power2.out', onUpdate: function () { el.textContent = this.progress() >= 1 ? txt : fmt(o.v); } }, at);
    });
  }
  /** Une suite de tweens à partir de start ; resolve(target) rend les éléments visés. Rend la fin. */
  function steps(tl, resolve, list, start) {
    var k = unit(), prevStart = start, end = start;
    (list || []).forEach(function (st) {
      var at = st.at != null ? prevStart + st.at : end;
      var els = resolve(st.target);
      if (!els.length) return;
      if (st.counter) counter(tl, els, st, at);
      else {
        var vars = conv(st.to || {}, k);
        vars.duration = st.duration;
        vars.ease = st.ease || 'none';
        if (st.stagger) vars.stagger = st.stagger;
        if (st.from) tl.fromTo(els, conv(st.from, k), vars, at);
        else tl.to(els, vars, at);
      }
      prevStart = at;
      end = Math.max(end, at + st.duration + (st.stagger || 0) * (els.length - 1));
    });
    return end;
  }
  function roleTargets(root, r) {
    var base = Array.prototype.slice.call(root.querySelectorAll(r.sel));
    return function (target) {
      if (target === 'inner') return base.map(function (el) { return el.querySelector('[data-ge-inner]') || el; });
      if (r.split && r.split !== 'none') {
        var units = [];
        base.forEach(function (el) { each(el.querySelectorAll(r.mask ? '.ge-i' : '.ge-u'), function (u) { units.push(u); }); });
        return units.length ? units : base;
      }
      return base;
    };
  }

  // ── Les transitions (sur la timeline maîtresse) ────────────────────────────────────────────
  var COLORS = { primary: 'var(--color-brand-primary)', secondary: 'var(--color-brand-secondary)', accent: 'var(--color-brand-accent)', ground: 'var(--color-ground)', ink: 'var(--color-ink)' };
  var AREAS = {
    full: 'left:0;top:0;width:100%;height:100%',
    top: 'left:0;top:0;width:100%;height:50.5%',
    bottom: 'left:0;bottom:0;width:100%;height:50.5%',
    left: 'left:0;top:0;width:50.5%;height:100%',
    right: 'right:0;top:0;width:50.5%;height:100%',
    band: 'left:-20%;top:-30%;width:140%;height:160%'
  };
  function transition(item, tr) {
    var M = window.master, layer = document.getElementById('ge-fx');
    if (!M || !layer) return;
    var start = item.tl.startTime(), half = tr.half;
    var prev = document.getElementById(tr.prevKey);
    var overlays = (tr.overlays || []).map(function (ov) {
      var d = document.createElement('div');
      d.className = 'ge-ov';
      d.setAttribute('style', 'position:absolute;visibility:hidden;' + (AREAS[ov.area] || AREAS.full) + ';background:' + (COLORS[ov.color] || COLORS.primary));
      layer.appendChild(d);
      if (ov.area === 'band') M.set(d, { skewX: -14 }, 0);
      M.set(d, { visibility: 'visible' }, Math.max(0, start - half));
      M.set(d, { visibility: 'hidden' }, start + half + 0.02);
      return d;
    });
    function resolve(t) {
      if (t === 'prev') return prev ? [prev] : [];
      if (t === 'next') return [item.root];
      var m = /^overlay:(\d)$/.exec(t || '');
      return m && overlays[+m[1]] ? [overlays[+m[1]]] : [];
    }
    steps(M, resolve, tr.out, Math.max(0, start - half));
    steps(M, resolve, tr['in'], start);
  }

  // ── Une scène ──────────────────────────────────────────────────────────────────────────────
  function build(item) {
    var sp = item.spec, root = item.root, tl = item.tl;
    try {
      shown(root, function () {
        (sp.roles || []).forEach(function (r) {
          if (!r.split || r.split === 'none') return;
          each(root.querySelectorAll(r.sel), function (el) { split(el, r.split === 'lines' ? 'lines' : r.split, r.mask && r.split !== 'lines'); });
        });
        if (!fit(root)) GE.fitIssues.push(sp.key);
        (sp.roles || []).forEach(function (r) {
          if (r.split === 'lines') each(root.querySelectorAll(r.sel), function (el) { lines(el, r.mask); });
        });
      });
      (sp.roles || []).forEach(function (r) {
        var resolve = roleTargets(root, r);
        steps(tl, resolve, r['in'], r.at);
        if (r.hold) steps(tl, resolve, r.hold, r.holdAt);
        if (r.out) steps(tl, resolve, r.out, r.outAt);
      });
      if (sp.transition) transition(item, sp.transition);
    } catch (e) {
      window.__sceneErrors.push({ key: sp.key, message: String((e && e.message) || e).slice(0, 300) });
    }
  }
  function flush() {
    var list = GE.pending.splice(0, GE.pending.length);
    list.forEach(build);
  }
  GE.scene = function (tl, root, D, spec) {
    GE.pending.push({ tl: tl, root: root, D: D, spec: spec });
    ready.then(flush);
  };
})();`;

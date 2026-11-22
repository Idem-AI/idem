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
 * Les EFFETS DE TEXTE nommés par le catalogue (`fx` : frappe, décodage, surligneur, contour, glitch, vague,
 * soulignement, relief, rature, coupe en deux, balayage) et le compteur passent par un plugin GSAP interne (`geFx`) :
 * GSAP lui donne la progression (courbe appliquée) à CHAQUE rendu, y compris quand HyperFrames positionne la timeline
 * sans événements (flou de mouvement), là où un `onUpdate` resterait muet. Chaque effet est une fonction pure de cette
 * progression : la même image, quel que soit le chemin pour y arriver. Couleurs : celles de la marque (variables
 * `--color-brand-*`), choisies lisibles sur le fond réel de l'élément.
 *
 * Déterministe : ni hasard, ni horloge, ni réseau ; la même page rend toujours les mêmes images. Une erreur ne coupe
 * que SA scène (`__sceneErrors`).
 */
export const CATALOG_RUNTIME = String.raw`(function () {
  var GE = window.__ge = { pending: [], fitIssues: [], fx: [] };
  // Le plugin des effets : la valeur passée est un NUMÉRO dans le registre (GSAP évaluerait une fonction passée telle quelle).
  if (window.gsap && !window.__geFxPlugin) {
    window.__geFxPlugin = true;
    gsap.registerPlugin({ name: 'geFx', init: function (target, id) { this.geFn = GE.fx[id]; }, render: function (ratio, data) { if (data.geFn) data.geFn(ratio); } });
  }
  function reg(fn) {
    var safe = function (p) { try { fn(p); } catch (e) {} };
    GE.fx.push(safe);
    return GE.fx.length - 1;
  }
  window.__fitIssues = GE.fitIssues;
  window.__sceneErrors = window.__sceneErrors || [];
  var comp = document.getElementById('comp');
  // Tailwind n'émet que les variables de couleur qu'une classe emploie : les effets et les panneaux de transition ont
  // besoin de TOUTE la palette de la marque. Une variable absente est posée depuis la palette transmise.
  (function () {
    var pal = window.__gePalette || {}, cs = getComputedStyle(comp);
    var names = { 'brand-primary': pal.primary, 'brand-secondary': pal.secondary, 'brand-accent': pal.accent, ground: pal.ground, ink: pal.ink };
    for (var n in names) if (names[n] && !cs.getPropertyValue('--color-' + n).trim()) comp.style.setProperty('--color-' + n, names[n]);
  })();
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
      // Les glyphes eux-mêmes : avec un interligne serré, une capitale accentuée (É, Ç) dépasse de sa ligne. Seuls les
      // textes de la zone sûre comptent (un texte posé hors d'elle, en tête de page, a sa propre place).
      each(els, function (el) {
        if (!safe.contains(el)) return;
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
      else if (p === 'letterSpacing') out.letterSpacing = spacing(v);
      else if (p === 'transformOrigin' && v === 'auto') out[p] = function (i, el) { var a = getComputedStyle(el).textAlign; return a === 'center' ? '50% 50%' : a === 'right' || a === 'end' ? '100% 50%' : '0% 50%'; };
      else out[p] = v;
    }
    // Une bascule 3D se voit en perspective (celle d'un objectif normal, à l'échelle de la toile).
    if ('rotationX' in o || 'rotationY' in o) out.transformPerspective = Math.round(1000 * k);
    return out;
  }
  /** L'approche est un ÉCART (em) à celle de la mise en page, lue une fois avant toute animation. */
  function spacing(d) {
    return function (i, el) {
      if (el.__geLs == null) {
        var cs = getComputedStyle(el);
        el.__geLs = cs.letterSpacing === 'normal' ? 0 : parseFloat(cs.letterSpacing) || 0;
        el.__geFs = parseFloat(cs.fontSize) || 16;
      }
      return (el.__geLs + d * el.__geFs).toFixed(3) + 'px';
    };
  }
  function counter(tl, els, st, at) {
    each(els, function (el) {
      var txt = el.textContent || '';
      var m = /^([^\d]*?)(\d[\d\s.,  ]*\d|\d)(.*)$/.exec(txt);
      if (!m) return;
      var raw = m[2], dec = '', group = '', decimals = 0;
      var tail = /[.,](\d{1,2})$/.exec(raw);
      if (tail && !/[.,]\d{3}$/.test(raw)) { dec = raw.charAt(raw.length - tail[1].length - 1); decimals = tail[1].length; }
      var g = /\d([\s.,  ])\d{3}/.exec(raw);
      if (g && g[1] !== dec) group = g[1];
      var value = parseFloat(raw.split(group || '\u0000').join('').replace(dec || '\u0000', '.').replace(/[^\d.]/g, ''));
      if (!isFinite(value)) return;
      function fmt(n) {
        var s = n.toFixed(decimals), parts = s.split('.');
        var int = group ? parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, group) : parts[0];
        return m[1] + int + (decimals ? dec + parts[1] : '') + m[3];
      }
      // La largeur finale est gardée : un chiffre qui grandit ne pousse pas la mise en page.
      var render = function (p) { el.textContent = p >= 1 ? txt : fmt(value * p); };
      render(0);
      tl.to({}, { geFx: reg(render), duration: st.duration, ease: st.ease || 'power2.out' }, at);
    });
  }

  // ── Les effets de texte ────────────────────────────────────────────────────────────────────
  var NS = 'http://www.w3.org/2000/svg';
  function clamp(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  /** La progression de l'unité i sur n quand chacune occupe une fenêtre w de la course (décalage régulier). */
  function local(p, i, n, w) { if (n <= 1) return clamp(p); var a = i * (1 - w) / (n - 1); return clamp((p - a) / w); }
  /** Un hasard DÉTERMINISTE (même entrée, même sortie). */
  function hash(a, b) { var h = (a * 374761393 + b * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return (h ^ (h >>> 16)) >>> 0; }
  function scaleOf() { var r = comp.getBoundingClientRect(); return r.width / (comp.offsetWidth || r.width || 1) || 1; }
  function rel(el) { if (getComputedStyle(el).position === 'static') el.style.position = 'relative'; }
  function parseRgb(str) { var m = /rgba?\(([^)]+)\)/.exec(str || ''); if (!m) return null; var v = m[1].split(/[\s,\/]+/).filter(Boolean).map(parseFloat); return v.length >= 3 ? v : null; }
  var probe = null;
  function rgbOf(color) {
    if (!probe) { probe = document.createElement('span'); probe.style.display = 'none'; comp.appendChild(probe); }
    probe.style.color = '';
    probe.style.color = color;
    return parseRgb(getComputedStyle(probe).color);
  }
  function lum(v) { var c = [v[0], v[1], v[2]].map(function (x) { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
  function contrast(a, b) { var x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  function groundOf(el) {
    for (var e = el; e && e !== document.documentElement; e = e.parentElement) {
      var v = parseRgb(getComputedStyle(e).backgroundColor);
      if (v && (v.length < 4 || v[3] > 0.5)) return v;
    }
    return [255, 255, 255];
  }
  /** La première couleur de la marque qui se lit sur le fond réel de l'élément (sinon l'encre). */
  function brandOn(el, min, order) {
    var g = groundOf(el), names = order || ['brand-primary', 'brand-accent', 'brand-secondary'];
    for (var i = 0; i < names.length; i++) {
      var raw = getComputedStyle(comp).getPropertyValue('--color-' + names[i]).trim();
      if (!raw) continue;
      var v = rgbOf(raw);
      if (v && contrast(v, g) >= min) return raw;
    }
    return getComputedStyle(el).color;
  }
  /** Les lignes VUES d'un texte, en px de la toile, relatives à l'élément. */
  function lineBoxes(el) {
    var rg = document.createRange(), rows = [];
    rg.selectNodeContents(el);
    each(rg.getClientRects(), function (q) {
      if (q.width < 1 || q.height < 1) return;
      for (var i = 0; i < rows.length; i++) {
        var r = rows[i];
        if (Math.abs((q.top + q.bottom) / 2 - (r.top + r.bottom) / 2) < Math.min(q.height, r.bottom - r.top) * 0.5) {
          r.left = Math.min(r.left, q.left); r.right = Math.max(r.right, q.right); r.top = Math.min(r.top, q.top); r.bottom = Math.max(r.bottom, q.bottom);
          return;
        }
      }
      rows.push({ left: q.left, right: q.right, top: q.top, bottom: q.bottom });
    });
    var box = el.getBoundingClientRect(), sc = scaleOf();
    return rows.sort(function (a, b) { return a.top - b.top; }).map(function (r) { return { x: (r.left - box.left) / sc, y: (r.top - box.top) / sc, w: (r.right - r.left) / sc, h: (r.bottom - r.top) / sc }; });
  }
  function ownerOf(u, base) { for (var e = u; e; e = e.parentElement) if (base.indexOf(e) >= 0) return e; return base[0]; }
  function fontOf(el) { return parseFloat(getComputedStyle(el).fontSize) || 16; }

  /**
   * Chaque effet reçoit { base: les éléments du rôle, units: leurs unités découpées, opts, dur, k } AVANT toute animation
   * (la scène est montée, mesurée, à sa taille) et rend la fonction p ∈ [0, 1] → état. p = 0 : l'état d'avant l'effet.
   */
  var FX = {
    // Frappe : les lettres paraissent une à une, un curseur aux couleurs de la marque les suit, clignote, puis s'efface.
    type: function (c) {
      var u = c.units, n = u.length;
      if (!n) return null;
      var carets = c.base.map(function (b) {
        rel(b);
        var k = document.createElement('span');
        k.setAttribute('aria-hidden', 'true');
        k.style.cssText = 'position:absolute;left:0;top:0;width:0.07em;border-radius:0.03em;pointer-events:none;opacity:0;background:' + brandOn(b, 1.6);
        b.appendChild(k);
        return k;
      });
      var info = u.map(function (x) { var b = ownerOf(x, c.base); var o = x.offsetParent === b ? x : null; return { b: c.base.indexOf(b), x0: o ? x.offsetLeft : 0, x: o ? x.offsetLeft + x.offsetWidth : 0, y: o ? x.offsetTop : 0, h: x.offsetHeight }; });
      var T = 0.8;
      return function (p) {
        var typed = Math.min(n, Math.floor(clamp(p / T) * n + 1e-6));
        for (var i = 0; i < n; i++) u[i].style.opacity = i < typed ? '1' : '0';
        var at = info[Math.max(0, typed - 1)];
        var blink = p <= 0 || p >= 1 ? 0 : p < T ? 1 : Math.floor((p - T) / (1 - T) * 4) % 2 === 0 ? 1 : 0;
        carets.forEach(function (k, j) {
          var on = j === at.b && blink;
          k.style.opacity = on ? '1' : '0';
          if (on) { k.style.height = (at.h * 0.8).toFixed(1) + 'px'; k.style.transform = 'translate(' + ((typed ? at.x : at.x0) + at.h * 0.04).toFixed(1) + 'px,' + (at.y + at.h * 0.1).toFixed(1) + 'px)'; }
        });
      };
    },
    // Décodage : une vague de signes de la même famille (capitales, minuscules, chiffres) précède le texte et se fige.
    scramble: function (c) {
      var u = c.units, n = u.length, W = c.opts.window || 4;
      if (!n) return null;
      var sc = scaleOf(), accent = brandOn(c.base[0], 1.6);
      var SETS = { up: 'ABCDEFGHJKLMNPQRSTUVWXYZ', low: 'abcdefghijkmnpqrstuvwxyz', dig: '0123456789' };
      var finals = u.map(function (x) {
        // La largeur de chaque lettre est figée : un signe plus large ne refait jamais les lignes.
        x.style.width = (x.getBoundingClientRect().width / sc).toFixed(2) + 'px';
        x.style.textAlign = 'center';
        return x.textContent;
      });
      function setOf(ch) { return /[0-9]/.test(ch) ? SETS.dig : ch.toLowerCase() !== ch ? SETS.up : ch.toUpperCase() !== ch ? SETS.low : ''; }
      return function (p) {
        var head = p * (n + W), tick = Math.floor(p * c.dur * 18);
        for (var i = 0; i < n; i++) {
          var x = u[i], set = setOf(finals[i]);
          if (p >= 1 || i < head - W) { if (x.textContent !== finals[i]) x.textContent = finals[i]; x.style.opacity = '1'; x.style.color = ''; }
          else if (i < head) { x.textContent = set ? set.charAt(hash(i + 1, tick) % set.length) : finals[i]; x.style.opacity = (0.4 + 0.6 * clamp((head - i) / W)).toFixed(3); x.style.color = accent; }
          else { x.textContent = finals[i]; x.style.opacity = '0'; x.style.color = ''; }
        }
      };
    },
    // Balayage : une bande aux couleurs de la marque traverse le texte, qui revient à son encre.
    sweep: function (c) {
      var list = c.base.map(function (el) {
        var ink = getComputedStyle(el).color;
        el.style.backgroundImage = 'linear-gradient(100deg,' + ink + ' 0%,' + ink + ' 38%,var(--color-brand-primary) 45%,var(--color-brand-accent) 50%,var(--color-brand-secondary) 55%,' + ink + ' 62%,' + ink + ' 100%)';
        el.style.backgroundSize = '260% 100%';
        el.style.backgroundRepeat = 'no-repeat';
        el.style.webkitBackgroundClip = 'text';
        el.style.backgroundClip = 'text';
        el.style.webkitTextFillColor = 'transparent';
        return el;
      });
      return function (p) { list.forEach(function (el) { el.style.backgroundPosition = (100 - p * 100).toFixed(2) + '% 50%'; }); };
    },
    // Surligneur : un trait de couleur se pose sous chaque ligne, de gauche à droite, ligne après ligne.
    marker: function (c) {
      var h = c.opts.height || 0.42;
      var marks = c.units.map(function (line) {
        var m = document.createElement('span');
        while (line.firstChild) m.appendChild(line.firstChild);
        line.appendChild(m);
        var col = 'color-mix(in srgb, ' + brandOn(line, 1.15, ['brand-accent', 'brand-primary', 'brand-secondary']) + ' 45%, transparent)';
        m.style.backgroundImage = 'linear-gradient(' + col + ',' + col + ')';
        m.style.backgroundRepeat = 'no-repeat';
        m.style.backgroundPosition = '0 88%';
        m.style.backgroundSize = '0% ' + h + 'em';
        m.style.webkitBoxDecorationBreak = 'clone';
        m.style.boxDecorationBreak = 'clone';
        return m;
      });
      return function (p) { marks.forEach(function (m, i) { m.style.backgroundSize = (local(p, i, marks.length, 0.6) * 100).toFixed(2) + '% ' + h + 'em'; }); };
    },
    // Contour → plein : le texte paraît en contour (couleur de la marque), puis se remplit de son encre.
    outline: function (c) {
      var list = c.base.map(function (el) { return { el: el, ink: getComputedStyle(el).color, stroke: brandOn(el, 1.6), w: Math.max(1, fontOf(el) * 0.022) }; });
      return function (p) {
        list.forEach(function (o) {
          var done = p >= 1;
          o.el.style.webkitTextFillColor = done ? '' : 'color-mix(in srgb, ' + o.ink + ' ' + (p * 100).toFixed(1) + '%, transparent)';
          o.el.style.webkitTextStroke = done ? '' : (o.w * (1 - p * 0.85)).toFixed(2) + 'px ' + o.stroke;
        });
      };
    },
    // Glitch : micro-saccades et décalage chromatique (couleurs de la marque) par à-coups, puis net.
    glitch: function (c) {
      var amp = (c.opts.amp || 6) * c.k;
      return function (p) {
        var tick = Math.floor(p * c.dur * 22);
        c.base.forEach(function (el, j) {
          var h = hash(tick + 1, j + 7), on = p > 0 && p < 0.88 && h % 5 < 3;
          if (!on) { el.style.translate = ''; el.style.textShadow = ''; el.style.clipPath = ''; return; }
          var dx = ((h >>> 3) % 9 - 4) / 4 * amp, sh = ((h >>> 7) % 5 + 2) / 6 * amp;
          el.style.translate = dx.toFixed(2) + 'px 0';
          el.style.textShadow = sh.toFixed(2) + 'px 0 var(--color-brand-primary),' + (-sh).toFixed(2) + 'px 0 var(--color-brand-accent)';
          var t = (h >>> 13) % 70;
          el.style.clipPath = (h >>> 11) % 6 === 0 ? 'inset(' + t + '% -10% ' + Math.max(0, 75 - t) + '% -10%)' : '';
        });
      };
    },
    // Vague : une ondulation traverse les lettres, de la première à la dernière.
    wave: function (c) {
      var u = c.units, n = u.length, amp = (c.opts.amp || 14) * c.k, s = 1.4;
      return function (p) {
        for (var i = 0; i < n; i++) {
          var l = clamp(p * (1 + s) - s * (n > 1 ? i / (n - 1) : 0));
          u[i].style.translate = l > 0 && l < 1 ? '0 ' + (-Math.sin(Math.PI * l) * amp).toFixed(2) + 'px' : '';
        }
      };
    },
    // Soulignement tracé à la main sous la dernière ligne (couleur de la marque).
    underline: function (c) {
      var paths = c.base.map(function (el) {
        var rows = lineBoxes(el);
        if (!rows.length) return null;
        rel(el);
        var r = rows[rows.length - 1], fs = fontOf(el), w = r.w, h = Math.max(6, fs * 0.2);
        var svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('viewBox', '0 0 ' + w.toFixed(1) + ' ' + h.toFixed(1));
        svg.setAttribute('aria-hidden', 'true');
        svg.style.cssText = 'position:absolute;overflow:visible;pointer-events:none;left:' + r.x.toFixed(1) + 'px;top:' + (r.y + r.h - fs * 0.1).toFixed(1) + 'px;width:' + w.toFixed(1) + 'px;height:' + h.toFixed(1) + 'px';
        var X = function (f) { return (w * f).toFixed(1); }, Y = function (f) { return (h * f).toFixed(1); };
        var path = document.createElementNS(NS, 'path');
        path.setAttribute('d', 'M' + X(0.01) + ' ' + Y(0.66) + ' C' + X(0.15) + ' ' + Y(0.1) + ',' + X(0.23) + ' ' + Y(0.92) + ',' + X(0.37) + ' ' + Y(0.5) + ' S' + X(0.64) + ' ' + Y(0.14) + ',' + X(0.76) + ' ' + Y(0.58) + ' S' + X(0.94) + ' ' + Y(0.76) + ',' + X(0.99) + ' ' + Y(0.3));
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('pathLength', '1');
        path.style.stroke = brandOn(el, 1.6, ['brand-accent', 'brand-primary', 'brand-secondary']);
        path.style.strokeWidth = Math.max(2, fs * 0.065).toFixed(1) + 'px';
        path.style.strokeDasharray = '1';
        path.style.strokeDashoffset = '1';
        svg.appendChild(path);
        el.appendChild(svg);
        return path;
      }).filter(Boolean);
      return function (p) { paths.forEach(function (path) { path.style.strokeDashoffset = (1 - p).toFixed(4); }); };
    },
    // Relief : la profondeur se construit couche après couche (teintes de la marque), la face monte d'autant.
    extrude: function (c) {
      var D = c.opts.depth || 6;
      var list = c.base.map(function (el) { return { el: el, s: Math.max(1, fontOf(el) * 0.011), col: brandOn(el, 1.4) }; });
      return function (p) {
        list.forEach(function (o) {
          var d = p * D, parts = [];
          for (var j = 1; j <= Math.ceil(d - 1e-6); j++) {
            var off = Math.min(j, d) * o.s;
            parts.push(off.toFixed(2) + 'px ' + off.toFixed(2) + 'px 0 color-mix(in srgb, ' + o.col + ' ' + Math.max(40, 100 - j * 7) + '%, black)');
          }
          o.el.style.textShadow = parts.join(',');
          o.el.style.translate = d > 0 ? (-d * o.s * 0.5).toFixed(2) + 'px ' + (-d * o.s * 0.5).toFixed(2) + 'px' : '';
        });
      };
    },
    // Rature : un trait barre chaque ligne, l'une après l'autre (réservé à la scène « problème »).
    strike: function (c) {
      var bars = [];
      c.base.forEach(function (el) {
        var rows = lineBoxes(el), fs = fontOf(el), col = brandOn(el, 1.6, ['brand-accent', 'brand-primary', 'brand-secondary']);
        if (!rows.length) return;
        rel(el);
        rows.forEach(function (r) {
          var b = document.createElement('span'), th = Math.max(2, fs * 0.075);
          b.setAttribute('aria-hidden', 'true');
          b.style.cssText = 'position:absolute;pointer-events:none;transform-origin:0 50%;transform:scaleX(0);border-radius:' + th + 'px;left:' + (r.x - fs * 0.04).toFixed(1) + 'px;top:' + (r.y + r.h * 0.55 - th / 2).toFixed(1) + 'px;width:' + (r.w + fs * 0.08).toFixed(1) + 'px;height:' + th.toFixed(1) + 'px;background:' + col;
          el.appendChild(b);
          bars.push(b);
        });
      });
      return function (p) { bars.forEach(function (b, i) { b.style.transform = 'scaleX(' + local(p, i, bars.length, 0.7).toFixed(4) + ')'; }); };
    },
    // Coupe en deux : la moitié haute descend, la moitié basse monte, et elles se rejoignent en un seul mot.
    split: function (c) {
      var off = c.opts.offset || 0.5;
      var list = c.base.map(function (el) {
        rel(el);
        var ink = getComputedStyle(el).color, fs = fontOf(el);
        function half(poly) {
          var d = document.createElement('div');
          d.setAttribute('aria-hidden', 'true');
          d.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;color:' + ink + ';-webkit-text-fill-color:' + ink + ';clip-path:polygon(' + poly + ')';
          each(Array.prototype.slice.call(el.childNodes), function (n) { d.appendChild(n.cloneNode(true)); });
          return d;
        }
        var top = half('-10% -40%,110% -40%,110% 50%,-10% 50%'), bot = half('-10% 50%,110% 50%,110% 140%,-10% 140%');
        el.appendChild(top);
        el.appendChild(bot);
        return { el: el, top: top, bot: bot, d: Math.min(el.offsetHeight * 0.5, fs * 0.9) * off * 2 };
      });
      return function (p) {
        list.forEach(function (o) {
          var done = p >= 1, e = 1 - p, a = clamp(p * 2.5).toFixed(3);
          o.el.style.webkitTextFillColor = done ? '' : 'transparent';
          o.top.style.display = o.bot.style.display = done ? 'none' : '';
          o.top.style.transform = 'translateY(' + (-e * o.d).toFixed(2) + 'px)';
          o.bot.style.transform = 'translateY(' + (e * o.d).toFixed(2) + 'px)';
          o.top.style.opacity = o.bot.style.opacity = a;
        });
      };
    }
  };

  /** Les effets d'un rôle, préparés sur la scène montée et mesurée (avant tout tween). */
  function prepare(root, r) {
    var resolve = roleTargets(root, r), k = unit();
    ['in', 'hold', 'develop', 'out'].forEach(function (phase) {
      (r[phase] || []).forEach(function (st) {
        if (!st.fx || !FX[st.fx]) return;
        st.__r = FX[st.fx]({ base: resolve('base'), units: resolve(), opts: st.opts || {}, dur: st.duration, k: k });
      });
    });
  }

  /** Une suite de tweens à partir de start ; resolve(target, pick) rend les éléments visés. Rend la fin. */
  function steps(tl, resolve, list, start, prime) {
    var k = unit(), prevStart = start, end = start;
    (list || []).forEach(function (st) {
      var at = st.at != null ? prevStart + st.at : end;
      if (st.fx) {
        if (st.__r) {
          // L'état de départ d'une entrée est posé tout de suite (comme un fromTo).
          if (prime) st.__r(0);
          tl.to({}, { geFx: reg(st.__r), duration: st.duration, ease: st.ease || 'none' }, at);
        }
        prevStart = at;
        end = Math.max(end, at + st.duration);
        return;
      }
      var els = resolve(st.target, st.pick);
      if (!els.length) return;
      if (st.counter) counter(tl, els, st, at);
      else {
        var vars = conv(st.to || {}, k);
        vars.duration = st.duration;
        vars.ease = st.ease || 'none';
        // Une répétition resserrée : les départs suivent une courbe (grands écarts d'abord, puis de plus en plus serrés).
        if (st.stagger) vars.stagger = st.compress && els.length > 2 ? { amount: st.stagger * (els.length - 1) * 0.85, ease: 'power1.out' } : st.stagger;
        if (st.from) tl.fromTo(els, conv(st.from, k), vars, at);
        else tl.to(els, vars, at);
      }
      prevStart = at;
      end = Math.max(end, at + st.duration + (st.stagger || 0) * (els.length - 1) * (st.compress ? 0.85 : 1));
    });
    return end;
  }

  // ── La traversée d'une coupe (séquence) ────────────────────────────────────────────────────
  /** La boîte d'un élément dans sa section, en px de la toile, SANS ses transformations (offsets). */
  function layoutBox(el, sec) {
    var x = 0, y = 0;
    for (var e = el; e && e !== sec; e = e.offsetParent) { x += e.offsetLeft; y += e.offsetTop; }
    return { x: x, y: y, w: el.offsetWidth, h: el.offsetHeight };
  }
  /**
   * L'élément porté part de sa place dans la scène d'avant et glisse vers la sienne (FLIP). Ses transformations passent
   * par GSAP (quickSetter : x, y, scaleX, scaleY) — des propriétés CSS à part seraient absorbées par GSAP au premier
   * tween du même élément et comptées deux fois. Pendant la traversée l'élément n'appartient qu'à elle : sa tenue et son
   * développement commencent après (l'assemblage les y place). Un cadre d'image change de proportions ; son image est
   * contre-mise à l'échelle et garde les siennes (elle repart du cadrage de la scène d'avant : innerFrom).
   */
  function carryIn(item, c) {
    var prevSec = document.getElementById(c.prevKey), el = item.root.querySelector(c.sel);
    var before = prevSec && prevSec.querySelector(c.sel);
    if (!el || !before) return;
    var a = shown(prevSec, function () { return layoutBox(before, prevSec); });
    var b = shown(item.root, function () { return layoutBox(el, item.root); });
    if (!a.w || !a.h || !b.w || !b.h) return;
    var sx = a.w / b.w, sy = a.h / b.h;
    if (c.mode !== 'frame') sx = sy = a.h / b.h;
    // Un texte (chiffre) ou un logo s'ancre là où il est aligné : sa boîte peut occuper toute la largeur alors que le
    // texte est ferré à gauche. Le point d'ancrage (gauche, centre, droite) de chaque côté, et l'origine au même point.
    function anchorOf(node) {
      if (c.mode === 'frame') return 0.5;
      var al = getComputedStyle(node).textAlign;
      return al === 'center' ? 0.5 : al === 'right' || al === 'end' ? 1 : 0;
    }
    var fa = shown(prevSec, function () { return anchorOf(before); }), fb = shown(item.root, function () { return anchorOf(el); });
    var dx = (a.x + a.w * fa) - (b.x + b.w * fb), dy = (a.y + a.h / 2) - (b.y + b.h / 2);
    var inner = c.mode === 'frame' ? el.querySelector('[data-ge-inner]') : null, from = c.innerFrom || 1;
    gsap.set(el, { transformOrigin: (fb * 100) + '% 50%' });
    if (inner) gsap.set(inner, { transformOrigin: '50% 50%' });
    var set = { x: gsap.quickSetter(el, 'x', 'px'), y: gsap.quickSetter(el, 'y', 'px'), sx: gsap.quickSetter(el, 'scaleX'), sy: gsap.quickSetter(el, 'scaleY') };
    var iset = inner ? { sx: gsap.quickSetter(inner, 'scaleX'), sy: gsap.quickSetter(inner, 'scaleY') } : null;
    function render(p) {
      var q = 1 - p, X = 1 + (sx - 1) * q, Y = 1 + (sy - 1) * q;
      set.x(dx * q); set.y(dy * q); set.sx(X); set.sy(Y);
      if (iset) { var z = 1 + (from - 1) * q; iset.sx(z / X); iset.sy(z / Y); }
    }
    render(0);
    item.tl.to({}, { geFx: reg(render), duration: c.duration, ease: c.ease || 'power2.inOut' }, 0);
  }
  function roleTargets(root, r) {
    var base = Array.prototype.slice.call(root.querySelectorAll(r.sel));
    return function (target, pick) {
      if (target === 'base') return base;
      if (target === 'inner') return base.map(function (el) { return el.querySelector('[data-ge-inner]') || el; });
      if (r.split && r.split !== 'none') {
        var units = [];
        base.forEach(function (el) {
          var own = Array.prototype.slice.call(el.querySelectorAll(r.mask ? '.ge-i' : '.ge-u'));
          // La sélection vaut pour chaque élément du rôle : son premier mot, son dernier, ou tous sauf le dernier.
          if (pick === 'first') own = own.slice(0, 1);
          else if (pick === 'last') own = own.slice(-1);
          else if (pick === 'rest') own = own.slice(0, -1);
          own.forEach(function (u) { units.push(u); });
        });
        return units.length || pick ? units : base;
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
        // Les effets se préparent sur la scène posée, à sa taille, AVANT les tweens (qui déplacent les unités).
        (sp.roles || []).forEach(function (r) { prepare(root, r); });
      });
      (sp.roles || []).forEach(function (r) {
        var resolve = roleTargets(root, r);
        steps(tl, resolve, r['in'], r.at, true);
        if (r.hold) steps(tl, resolve, r.hold, r.holdAt);
        if (r.develop) steps(tl, resolve, r.develop, r.developAt);
        if (r.out) steps(tl, resolve, r.out, r.outAt);
      });
      if (sp.carry) carryIn(item, sp.carry);
      else if (sp.transition) transition(item, sp.transition);
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
